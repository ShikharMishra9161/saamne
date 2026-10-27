import { handle, HttpError, requireUser } from "@/lib/auth";
import { updateUser } from "@/lib/db";

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await req.json();
  updateUser(user.id, (u) => {
    if (typeof body.hideFromBoard === "boolean") u.hideFromBoard = body.hideFromBoard;
    if (typeof body.name === "string") {
      if (!body.name.trim()) throw new HttpError(400, "Name can't be empty.");
      u.name = body.name.trim().slice(0, 80);
    }
  });
  return Response.json({ ok: true });
});
