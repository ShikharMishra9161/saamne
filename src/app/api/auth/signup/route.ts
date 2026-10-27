import { createUser, handle, HttpError, startSession } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const { name, email, password } = await req.json();
  if (!name?.trim() || !email?.includes("@")) throw new HttpError(400, "Enter your name and a valid email.");
  if (typeof password !== "string" || password.length < 8) throw new HttpError(400, "Use at least 8 characters for your password.");
  let user;
  try {
    user = createUser(name, email, password);
  } catch (err) {
    throw new HttpError(409, (err as Error).message);
  }
  await startSession(user.id);
  return Response.json({ ok: true });
});
