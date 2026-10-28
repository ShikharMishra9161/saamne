import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Gemini via Google's Interactions API, on the free tier by default.
// Free-tier content may be used by Google to improve its products.

// Free-tier models vary a lot minute to minute (one answers in 1.5 s while another
// hangs), so every request has several to choose from.
const LITE = "gemini-3.5-flash-lite";
const LITE_OLD = "gemini-3.1-flash-lite";
const FLASH = "gemini-3.8-flash";
const FLASH_OLD = "gemini-3.6-flash";
/** Live conversation: speed first. */
export const LIVE_MODELS = [...new Set([process.env.GEMINI_LIVE_MODEL || LITE, LITE_OLD, FLASH_OLD, FLASH])];
/** Reports and resume reading: quality first; a slower answer is fine there. */
export const MODELS = [...new Set([process.env.GEMINI_MODEL || FLASH, FLASH_OLD, LITE, LITE_OLD])];

let client: GoogleGenAI | null = null;
function gemini() {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export function hasApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export class RateLimitError extends Error {}

/** HTTP status from either SDK surface (Interactions errors use statusCode). */
function statusOf(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number; code?: number } | null;
  const s = e?.statusCode ?? e?.status ?? e?.code;
  return typeof s === "number" ? s : undefined;
}

const isRateLimit = (err: unknown) =>
  statusOf(err) === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(String((err as Error)?.message ?? ""));

/** Overloaded, rate-limited, timed out or unreachable: worth trying another model. */
function isBusy(err: unknown) {
  const s = statusOf(err);
  if (s === 429 || s === 500 || s === 502 || s === 503 || s === 504) return true;
  const name = (err as Error)?.name ?? "";
  const msg = String((err as Error)?.message ?? "");
  return /timeout|ECONNRESET|ETIMEDOUT|fetch failed|socket|high demand|unavailable|overloaded|RESOURCE_EXHAUSTED/i.test(`${name} ${msg}`);
}

// Remember briefly that a model was busy, so the next request skips straight past it.
const busyUntil = new Map<string, number>();
function modelOrder(models: string[]) {
  const now = Date.now();
  const free = models.filter((m) => (busyUntil.get(m) ?? 0) < now);
  return free.length ? [...free, ...models.filter((m) => !free.includes(m))] : models;
}
function markBusy(model: string, err: unknown) {
  // Rate limits reset within a minute; overloads last longer.
  busyUntil.set(model, Date.now() + (isRateLimit(err) ? 60_000 : 3 * 60_000));
}


type Thinking = "low" | "medium" | "high";
const NO_RETRY = { retries: { strategy: "none" as const } };

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export class AbortedError extends Error {}

/** If a model hasn't started answering by now, ask the next one in parallel. */
const HEDGE_MS = 2500;

/**
 * One streamed conversational turn. The whole conversation is sent each time
 * (not stored by Google): measured, this starts speaking 2–3x sooner, and any
 * model can pick the conversation up.
 *
 * Models race: the first is asked straight away, and each further one joins if
 * nobody has started answering within HEDGE_MS (or as soon as one fails). The
 * first to stream text wins and the others are cancelled, so a slow or busy
 * model costs seconds instead of a stalled call.
 */
export function streamTurn(opts: {
  system: string;
  history: ChatTurn[];
  input: string;
  thinking: Thinking;
  onText: (delta: string) => void;
  /** Aborted when the candidate keeps talking or leaves; stops the turn. */
  signal?: AbortSignal;
}): Promise<{ text: string; model: string }> {
  const steps = [...opts.history, { role: "user" as const, text: opts.input }].map((t) => ({
    type: t.role === "user" ? ("user_input" as const) : ("model_output" as const),
    content: [{ type: "text" as const, text: t.text }],
  }));
  const order = modelOrder(LIVE_MODELS);

  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new AbortedError("The candidate kept talking."));
    const attempts: { model: string; abort: AbortController }[] = [];
    let next = 0;
    let running = 0;
    let winner: string | null = null;
    let settled = false;
    let lastErr: unknown;
    let allRateLimited = true;
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: { text: string; model: string } | null, err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedge);
      clearTimeout(overall);
      opts.signal?.removeEventListener("abort", onOuterAbort);
      for (const a of attempts) if (a.model !== result?.model) a.abort.abort(new AbortedError("Turn finished."));
      if (result) resolve(result);
      else reject(err);
    };
    const onOuterAbort = () => finish(null, new AbortedError("The candidate kept talking."));
    opts.signal?.addEventListener("abort", onOuterAbort);
    const overall = setTimeout(() => finish(null, new Error("timeout: no model answered in time")), 30_000);

    const launchNext = () => {
      if (settled || winner) return;
      if (next >= order.length) {
        if (running === 0) {
          finish(null, allRateLimited ? new RateLimitError("The free Gemini limit was reached. Wait a minute and try again.") : lastErr);
        }
        return;
      }
      const model = order[next++];
      const abort = new AbortController();
      attempts.push({ model, abort });
      running++;
      clearTimeout(hedge);
      hedge = setTimeout(launchNext, HEDGE_MS);
      void run(model, abort);
    };

    const run = async (model: string, abort: AbortController) => {
      let text = "";
      let quiet = setTimeout(() => abort.abort(new Error("timeout: no response from model")), 10_000);
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
          { ...NO_RETRY, fetchOptions: { signal: abort.signal } },
        );
        for await (const ev of stream) {
          clearTimeout(quiet);
          quiet = setTimeout(() => abort.abort(new Error("timeout: model went quiet")), 10_000);
          if (ev.event_type === "step.delta" && ev.delta.type === "text") {
            if (!winner) {
              winner = model;
              clearTimeout(hedge);
              for (const a of attempts) if (a.model !== model) a.abort.abort(new AbortedError("Another model answered first."));
            }
            text += ev.delta.text;
            opts.onText(ev.delta.text);
          } else if (ev.event_type === "error") {
            throw Object.assign(new Error(ev.error?.message ?? "Gemini returned an error."), { statusCode: ev.error?.code });
          }
        }
        // A reply with no text at all still counts (the model chose silence).
        if (!winner) winner = model;
        if (winner === model) finish({ text, model });
      } catch (err) {
        const e = abort.signal.aborted ? abort.signal.reason : err;
        if (e instanceof AbortedError || settled) return;
        if (winner === model) return finish(null, e); // failed mid-sentence; can't switch now
        lastErr = e;
        if (!isRateLimit(e)) allRateLimited = false;
        if (isBusy(e)) markBusy(model, e);
        console.warn(`Gemini model ${model} didn't answer (${statusOf(e) ?? (e as Error)?.message}); trying another.`);
        launchNext();
      } finally {
        clearTimeout(quiet);
        running--;
        if (!settled && !winner && running === 0 && next >= order.length) launchNext();
      }
    };

    launchNext();
  });
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
          throw Object.assign(new Error(ev.error?.message ?? "Gemini returned an error."), { statusCode: ev.error?.code });
        }
      }
      return opts.schema.parse(JSON.parse(raw));
    } catch (err) {
      lastErr = abort.signal.aborted ? abort.signal.reason : err;
      if (!isBusy(lastErr)) break;
      markBusy(model, lastErr);
      console.warn(`Gemini model ${model} is busy (${statusOf(lastErr) ?? (lastErr as Error)?.message}); trying the next one.`);
    } finally {
      clearTimeout(quiet);
      clearTimeout(overall);
    }
  }
  if (isRateLimit(lastErr)) throw new RateLimitError("The free Gemini limit was reached. Wait a minute and try again.");
  throw lastErr;
}
