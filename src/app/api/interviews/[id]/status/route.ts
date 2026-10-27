import { handle, requireUser } from "@/lib/auth";
import { ownInterview } from "@/lib/interviews";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/interviews/[id]/status">) => {
  const user = await requireUser();
  const iv = ownInterview((await ctx.params).id, user);
  return Response.json({ status: iv.status, error: iv.error ?? null });
});
