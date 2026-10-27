import { hasApiKey } from "@/lib/ai";
import { handle, HttpError, requireUser } from "@/lib/auth";
import { newId, write } from "@/lib/db";
import { LANGS, pickProblem } from "@/lib/problems";
import { interviewerSystem } from "@/lib/prompts";
import type { Difficulty, Interview, Lang, Round } from "@/lib/types";

const ROUNDS: Round[] = ["technical", "resume", "behavioral"];
const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard"];
const DURATIONS = [15, 30, 45];

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (!hasApiKey()) {
    throw new HttpError(503, "The AI isn't connected. Add GEMINI_API_KEY to .env.local and restart the server.");
  }
  const body = await req.json();
  const round = body.round as Round;
  const difficulty = (body.difficulty ?? "Medium") as Difficulty;
  const language = body.language as Lang | undefined;
  const durationMin = Number(body.durationMin ?? 30);
  if (!ROUNDS.includes(round)) throw new HttpError(400, "Choose a round.");
  if (!DIFFS.includes(difficulty)) throw new HttpError(400, "Choose a difficulty.");
  if (!DURATIONS.includes(durationMin)) throw new HttpError(400, "Choose a duration.");
  if (round === "technical" && (!language || !LANGS.includes(language))) throw new HttpError(400, "Choose a language.");
  if (round === "resume" && !user.resume) throw new HttpError(400, "Upload your resume on your profile first.");

  const id = write((db) => {
    const u = db.users.find((x) => x.id === user.id)!;
    if (u.credits <= 0) throw new HttpError(402, "You have no interviews left.");
    const past = db.interviews.filter((i) => i.userId === u.id && i.problemId).map((i) => i.problemId!);
    const problem = round === "technical" ? pickProblem(difficulty, past) : undefined;
    const iv: Interview = {
      id: newId(),
      userId: u.id,
      round,
      difficulty,
      language: round === "technical" ? language : undefined,
      durationMin,
      problemId: problem?.id,
      focus: typeof body.focus === "string" && body.focus.trim() ? body.focus.trim().slice(0, 300) : undefined,
      status: "live",
      systemPrompt: "",
      aiLog: [],
      aiUnsent: [],
      transcript: [],
      pendingEvents: [],
      runs: [],
      createdAt: new Date().toISOString(),
    };
    iv.systemPrompt = interviewerSystem(iv, u, problem);
    u.credits -= 1;
    db.interviews.push(iv);
    return iv.id;
  });
  return Response.json({ id });
});
