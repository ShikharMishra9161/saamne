import { handle, HttpError, requireUser } from "@/lib/auth";
import { updateInterview } from "@/lib/db";
import { elapsedSec, ownInterview } from "@/lib/interviews";
import { getProblem } from "@/lib/problems";
import { runCode, summarizeRun } from "@/lib/runner";

export const maxDuration = 120;

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/interviews/[id]/run">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const iv = ownInterview(id, user);
  if (iv.status !== "live") throw new HttpError(409, "This interview has ended.");
  const problem = getProblem(iv.problemId);
  if (!problem || !iv.language) throw new HttpError(400, "This round has no coding problem.");
  const { code, kind } = (await req.json()) as { code: string; kind: "run" | "submit" };
  if (typeof code !== "string" || !code.trim()) throw new HttpError(400, "Write some code first.");
  const result = await runCode(problem, iv.language, code.slice(0, 40000), kind === "submit" ? "submit" : "run", Math.round(elapsedSec(iv)));
  updateInterview(id, (x) => {
    x.code = code.slice(0, 40000);
    x.runs.push(result);
    x.pendingEvents.push(`The candidate pressed ${kind === "submit" ? "Submit" : "Run"}. ${summarizeRun(result)}`);
  });
  return Response.json(result);
});
