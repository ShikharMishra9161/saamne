import { handle, HttpError, startSession, verifyLogin } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const { email, password } = await req.json();
  const user = verifyLogin(String(email ?? ""), String(password ?? ""));
  if (!user) throw new HttpError(401, "That email and password don't match.");
  await startSession(user.id);
  return Response.json({ ok: true });
});
