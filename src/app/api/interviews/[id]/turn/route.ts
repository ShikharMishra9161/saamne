import { interviewerTurn } from "@/lib/ai";
import { handle, HttpError, requireUser } from "@/lib/auth";
import { updateInterview } from "@/lib/db";
import { elapsedSec, mmss, ownInterview } from "@/lib/interviews";
import { RateLimitError } from "@/lib/llm";

export const maxDuration = 120;

const g = globalThis as unknown as { __turnLocks?: Set<string> };
const locks = (g.__turnLocks ??= new Set());

const TOKENS = /\[\[(SHOW_PROBLEM|LISTEN|END)\]\]/g;

/**
 * One conversational turn. The body carries what the candidate said and/or a room
 * event, plus the current editor contents. The response streams the interviewer's
 * reply as plain text, control tokens included.
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/interviews/[id]/turn">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const iv0 = ownInterview(id, user);
  if (iv0.status !== "live") throw new HttpError(409, "This interview has ended.");
  if (locks.has(id)) throw new HttpError(429, "The interviewer is still answering.");
  const body = (await req.json()) as { said?: string; event?: string; code?: string };
  const said = body.said?.trim().slice(0, 6000);
  const event = body.event?.trim().slice(0, 500);
  if (!said && !event) throw new HttpError(400, "Nothing to send.");

  locks.add(id);
  let iv;
  let input = "";
  try {
    iv = updateInterview(id, (x) => {
      x.startedAt ??= new Date().toISOString();
      const at = elapsedSec(x);
      const remaining = x.durationMin * 60 - at;
      const coding = x.problemShownAt !== undefined;
      const parts = [...(x.aiUnsent ?? [])];
      parts.push(
        `<context elapsed="${mmss(at)}" remaining="${remaining > 0 ? mmss(remaining) : "0:00, over time: wrap up now"}"${coding ? ' stage="problem shown"' : ""} />`,
      );
      if (x.round === "technical" && typeof body.code === "string" && body.code !== x.code) {
        x.code = body.code.slice(0, 40000);
        if (coding) parts.push(`<editor>\n${x.code}\n</editor>`);
      }
      for (const e of x.pendingEvents) parts.push(`<event>${e}</event>`);
      x.pendingEvents = [];
      if (event) parts.push(`<event>${event}</event>`);
      if (said) {
        parts.push(`<said>${said}</said>`);
        x.transcript.push({ role: "candidate", text: said, at: Math.round(at), whileCoding: coding || undefined });
      }
      input = parts.join("\n");
      x.aiUnsent = [];
    });
  } catch (err) {
    locks.delete(id);
    throw err;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { text } = await interviewerTurn(iv, input, (d) => controller.enqueue(encoder.encode(d)));
        updateInterview(id, (x) => {
          x.aiLog = [...(x.aiLog ?? []), { role: "user", text: input }, { role: "model", text: text || "[[LISTEN]]" }];
          const spoken = text.replace(TOKENS, "").trim();
          if (spoken) x.transcript.push({ role: "interviewer", text: spoken, at: Math.round(elapsedSec(x)) });
          if (text.includes("[[SHOW_PROBLEM]]") && x.problemShownAt === undefined) {
            x.problemShownAt = Math.round(elapsedSec(x));
          }
        });
      } catch (err) {
        console.error("Interviewer turn failed", err);
        // Keep what the candidate said so the interviewer still hears it next turn.
        updateInterview(id, (x) => void (x.aiUnsent = [...(x.aiUnsent ?? []), input]));
        controller.enqueue(encoder.encode(err instanceof RateLimitError ? "[[RATE_LIMIT]]" : "[[ERROR]]"));
      } finally {
        locks.delete(id);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
});
