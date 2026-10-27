import { after } from "next/server";
import { handle, HttpError, requireUser } from "@/lib/auth";
import { updateInterview } from "@/lib/db";
import { finishInterview, ownInterview, scoreInterview } from "@/lib/interviews";

export const maxDuration = 300;

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/interviews/[id]/finish">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const iv0 = ownInterview(id, user);
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  let iv = iv0;
  if (iv0.status === "live") iv = await finishInterview(id, body.code);
  else if (iv0.status === "failed") iv = updateInterview(id, (x) => void (x.status = "scoring"));
  else if (iv0.status !== "scoring") throw new HttpError(409, "This interview is already finished.");
  if (iv.status === "scoring") after(() => scoreInterview(id));
  return Response.json({ status: iv.status });
});
