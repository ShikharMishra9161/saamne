import { handle, HttpError, requireUser } from "@/lib/auth";
import { newId, write } from "@/lib/db";

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { interviewId, topic, message } = await req.json();
  if (!String(message ?? "").trim()) throw new HttpError(400, "Tell us what happened.");
  write((db) =>
    db.problemReports.push({
      id: newId(),
      userId: user.id,
      interviewId: interviewId || null,
      topic: String(topic ?? "other").slice(0, 80),
      message: String(message).slice(0, 4000),
      createdAt: new Date().toISOString(),
    }),
  );
  return Response.json({ ok: true });
});
