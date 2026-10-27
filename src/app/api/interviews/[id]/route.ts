import { handle, requireUser } from "@/lib/auth";
import { elapsedSec, ownInterview } from "@/lib/interviews";
import { personaFor } from "@/lib/photos";
import { getProblem, publicProblem } from "@/lib/problems";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/interviews/[id]">) => {
  const user = await requireUser();
  const iv = ownInterview((await ctx.params).id, user);
  const problem = getProblem(iv.problemId);
  return Response.json({
    id: iv.id,
    round: iv.round,
    difficulty: iv.difficulty,
    language: iv.language ?? null,
    durationMin: iv.durationMin,
    status: iv.status,
    started: Boolean(iv.startedAt),
    elapsed: elapsedSec(iv),
    persona: personaFor(iv.round),
    candidateName: user.name,
    problem: problem && iv.language ? publicProblem(problem, iv.language) : null,
    problemShown: iv.problemShownAt !== undefined,
    code: iv.code ?? null,
    transcript: iv.transcript,
    lastRun: iv.runs.at(-1) ?? null,
  });
});
