import { hasApiKey, parseResume } from "@/lib/ai";
import { handle, HttpError, requireUser } from "@/lib/auth";
import { updateUser } from "@/lib/db";

export const maxDuration = 120;

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (!hasApiKey()) throw new HttpError(503, "The AI isn't connected. Add GEMINI_API_KEY to .env.local and restart the server.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a PDF file.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new HttpError(400, "Upload your resume as a PDF.");
  }
  if (file.size > 5 * 1024 * 1024) throw new HttpError(400, "Keep the PDF under 5 MB.");
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const { parsed, ats } = await parseResume(data);
  updateUser(user.id, (u) => {
    u.resume = { fileName: file.name, updatedAt: new Date().toISOString(), parsed, ats };
  });
  return Response.json({ ok: true, ats });
});
