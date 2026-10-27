import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Gemini via Google's Interactions API, on the free tier by default.
// Free-tier content may be used by Google to improve its products.

const LITE = "gemini-3.5-flash-lite";
const FLASH = "gemini-3.8-flash";
/** Live conversation: speed first (Flash-Lite starts speaking in about a second). */
export const LIVE_MODELS = [...new Set([process.env.GEMINI_LIVE_MODEL || LITE, FLASH, LITE])];
/** Reports and resume reading: quality first; a slower answer is fine there. */
export const MODELS = [...new Set([process.env.GEMINI_MODEL || FLASH, LITE])];

let client: GoogleGenAI | null = null;
function gemini() {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export function hasApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export class RateLimitError extends Error {}

const statusOf = (err: unknown) => (err as { status?: number; code?: number }).status ?? (err as { code?: number }).code;

/** Overloaded, rate-limited, timed out or unreachable: worth trying another model. */
function isBusy(err: unknown) {
  const s = statusOf(err);
  if (s === 429 || s === 500 || s === 503 || s === 504) return true;
  const name = (err as Error)?.name ?? "";
  const msg = String((err as Error)?.message ?? "");
  return /timeout|abort|ECONNRESET|ETIMEDOUT|fetch failed|high demand|unavailable/i.test(name + " " + msg);
}

// Remember briefly that a model was busy, so the next request skips straight past it.
const busyUntil = new Map<string, number>();
function modelOrder(models: string[], preferred?: string) {
  const now = Date.now();
  const order = preferred ? [preferred, ...models.filter((m) => m !== preferred)] : models;
  const free = order.filter((m) => (busyUntil.get(m) ?? 0) < now);
  return free.length ? [...free, ...order.filter((m) => !free.includes(m))] : order;
}
function markBusy(model: string) {
  busyUntil.set(model, Date.now() + 5 * 60_000);
}

type Thinking = "low" | "medium" | "high";
const NO_RETRY = { retries: { strategy: "none" as const } };

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * One streamed conversational turn. The whole conversation is sent each time
 * (not stored by Google): measured, this starts speaking 2–3x sooner, and any
 * model can pick the conversation up if another is busy.
 */
export async function streamTurn(opts: {
  system: string;
  history: ChatTurn[];
  input: string;
  thinking: Thinking;
  onText: (delta: string) => void;
}): Promise<{ text: string; model: string }> {
  const steps = [...opts.history, { role: "user" as const, text: opts.input }].map((t) => ({
    type: t.role === "user" ? ("user_input" as const) : ("model_output" as const),
    content: [{ type: "text" as const, text: t.text }],
  }));
  let lastErr: unknown;
  for (const model of modelOrder(LIVE_MODELS)) {
    let text = "";
    try {
      const stream = await gemini().interactions.create(
        {
          model,
          system_instruction: opts.system,
          input: steps,
          store: false,
          stream: true,
          generation_config: { thinking_level: opts.thinking },
        },
        // A busy model hangs rather than failing, so give up quickly and move on.
        { ...NO_RETRY, timeout_ms: 15_000 },
      );
      for await (const ev of stream) {
        if (ev.event_type === "step.delta" && ev.delta.type === "text") {
          text += ev.delta.text;
          opts.onText(ev.delta.text);
        } else if (ev.event_type === "error") {
          throw Object.assign(new Error(ev.error?.message ?? "Gemini returned an error."), { status: ev.error?.code });
        }
      }
      return { text, model };
    } catch (err) {
      lastErr = err;
      // Once words have been spoken we can't switch models mid-sentence.
      if (text || !isBusy(err)) break;
      markBusy(model);
      console.warn(`Gemini model ${model} is busy; trying the next one.`);
    }
  }
  if (statusOf(lastErr) === 429) throw new RateLimitError("The free Gemini limit was reached. Wait a minute and try again.");
  throw lastErr;
}

/** JSON schema for Gemini from a Zod schema (validated again on the way back). */
function jsonSchema(schema: z.ZodType) {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export async function generateJson<T>(opts: {
  schema: z.ZodType<T>;
  system?: string;
  text: string;
  pdfBase64?: string;
  thinking: Thinking;
}): Promise<T> {
  let lastErr: unknown;
  for (const model of modelOrder(MODELS)) {
    // Streamed so a busy model (which sends nothing at all) is detected in seconds,
    // while a working one is allowed as long as it needs to think.
    const abort = new AbortController();
    let quiet = setTimeout(() => abort.abort(new Error("timeout: no response from model")), 12_000);
    const overall = setTimeout(() => abort.abort(new Error("timeout: model took too long")), 150_000);
    try {
      const stream = await gemini().interactions.create(
        {
          model,
          system_instruction: opts.system,
          input: opts.pdfBase64
            ? [
                { type: "document", data: opts.pdfBase64, mime_type: "application/pdf" },
                { type: "text", text: opts.text },
              ]
            : opts.text,
          store: false,
          stream: true,
          response_format: { type: "text", mime_type: "application/json", schema: jsonSchema(opts.schema) },
          generation_config: { thinking_level: opts.thinking },
        },
        { ...NO_RETRY, fetchOptions: { signal: abort.signal } },
      );
      let raw = "";
      for await (const ev of stream) {
        clearTimeout(quiet);
        quiet = setTimeout(() => abort.abort(new Error("timeout: model went quiet")), 60_000);
        if (ev.event_type === "step.delta" && ev.delta.type === "text") raw += ev.delta.text;
        else if (ev.event_type === "error") {
          throw Object.assign(new Error(ev.error?.message ?? "Gemini returned an error."), { status: ev.error?.code });
        }
      }
      return opts.schema.parse(JSON.parse(raw));
    } catch (err) {
      lastErr = abort.signal.aborted ? abort.signal.reason : err;
      if (!isBusy(lastErr)) break;
      markBusy(model);
      console.warn(`Gemini model ${model} is busy; trying the next one.`);
    } finally {
      clearTimeout(quiet);
      clearTimeout(overall);
    }
  }
  if (statusOf(lastErr) === 429) throw new RateLimitError("The free Gemini limit was reached. Wait a minute and try again.");
  throw lastErr;
}
