import { correctnessScore, resumeText, writeReport } from "./ai";
import { HttpError } from "./auth";
import { getInterview, read, updateInterview, updateUser, write } from "./db";
import { getProblem } from "./problems";
import { pointsFor, rankFor } from "./ranks";
import { runCode } from "./runner";
import type { Interview, User } from "./types";

export function ownInterview(id: string, user: User): Interview {
  const iv = getInterview(id);
  if (!iv || iv.userId !== user.id) throw new HttpError(404, "Interview not found.");
  return iv;
}

export function elapsedSec(iv: Interview) {
  return iv.startedAt ? Math.max(0, (Date.now() - new Date(iv.startedAt).getTime()) / 1000) : 0;
}

export function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Enough happened to score fairly? Otherwise the credit is refunded. */
function scorable(iv: Interview) {
  const said = iv.transcript.filter((t) => t.role === "candidate");
  const words = said.reduce((n, t) => n + t.text.split(/\s+/).filter(Boolean).length, 0);
  return said.length >= 2 && words >= 40;
}

/** Ends the call. Runs the final tests, then writes the report in the background. */
export async function finishInterview(id: string, finalCode: string | undefined): Promise<Interview> {
  let iv = updateInterview(id, (x) => {
    if (x.status !== "live") return;
    if (finalCode !== undefined) x.code = finalCode;
    x.durationSec = Math.round(elapsedSec(x));
    x.endedAt = new Date().toISOString();
    if (scorable(x)) x.status = "scoring";
    else x.status = "abandoned";
  });
  if (iv.status === "abandoned") {
    updateUser(iv.userId, (u) => void (u.credits += 1));
  }
  if (iv.status === "scoring" && iv.round === "technical") {
    const problem = getProblem(iv.problemId);
    if (problem && iv.language && iv.code && iv.problemShownAt !== undefined) {
      const final = await runCode(problem, iv.language, iv.code, "final", iv.durationSec ?? 0);
      iv = updateInterview(id, (x) => void x.runs.push(final));
    }
  }
  return iv;
}

export async function scoreInterview(id: string) {
  const iv = getInterview(id);
  if (!iv || iv.status !== "scoring") return;
  const user = read((db) => db.users.find((u) => u.id === iv.userId))!;
  try {
    const report = await writeReport(iv, user.name, resumeText(user.resume?.parsed), getProblem(iv.problemId));
    write((db) => {
      const x = db.interviews.find((i) => i.id === id)!;
      const u = db.users.find((y) => y.id === x.userId)!;
      const earned = pointsFor(report.score, x.difficulty);
      x.rankBefore = rankFor(u.points).rank.name;
      u.points += earned;
      x.report = report;
      x.pointsAwarded = earned;
      x.pointsAfter = u.points;
      x.rankAfter = rankFor(u.points).rank.name;
      x.status = "done";
      x.error = undefined;
    });
  } catch (err) {
    console.error("Scoring failed", err);
    updateInterview(id, (x) => {
      x.status = "failed";
      x.error = err instanceof Error ? err.message : String(err);
    });
  }
}

export { correctnessScore };
