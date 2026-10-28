import { z } from "zod";
import { generateJson, hasApiKey, streamTurn } from "./llm";
import { DIMENSIONS, reportSystem } from "./prompts";
import type { Problem } from "./problems";
import { summarizeRun } from "./runner";
import type { AtsResult, Interview, Report, ResumeParsed, SkillKey, Verdict } from "./types";
import { LANG_LABEL } from "./types";

export { hasApiKey };

// ------------------------------------------------------------- interviewer

/**
 * Streams the interviewer's reply to `input`, continuing the stored conversation.
 * Returns the new interaction id to continue from next time.
 */
const EDITOR = /<editor>[\s\S]*?<\/editor>/g;

export function interviewerTurn(iv: Interview, input: string, onText: (delta: string) => void, signal?: AbortSignal) {
  // Only the newest code snapshot matters; older ones just slow every turn down.
  const turns = [...(iv.aiLog ?? []), { role: "user" as const, text: input }];
  let latest = -1;
  turns.forEach((t, i) => {
    if (t.role === "user" && EDITOR.test(t.text)) latest = i;
    EDITOR.lastIndex = 0;
  });
  const compact = turns.map((t, i) =>
    t.role === "user" && i !== latest ? { ...t, text: t.text.replace(EDITOR, "<editor>(older version, see the latest below)</editor>") } : t,
  );
  const history = compact.slice(0, -1);
  const current = compact[compact.length - 1].text;
  // Low thinking keeps the reply fast enough for a spoken conversation.
  return streamTurn({ system: iv.systemPrompt, history, input: current, thinking: "low", onText, signal });
}

// ------------------------------------------------------------------ report

const ReportSchema = z.object({
  dimensions: z.array(
    z.object({
      key: z.string(),
      score: z.number().nullable(),
      rationale: z.string(),
    }),
  ),
  summary: z.string(),
  strengths: z.array(
    z.object({ title: z.string(), detail: z.string(), quote: z.string(), code: z.string(), dimension: z.string() }),
  ),
  improvements: z.array(
    z.object({ title: z.string(), detail: z.string(), quote: z.string(), code: z.string(), dimension: z.string() }),
  ),
  howToImprove: z.array(z.string()),
  prepareBeforeReal: z.array(z.string()),
  resumeItems: z.array(z.object({ title: z.string(), kind: z.string(), assessment: z.string() })),
});

function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

export function verdictFor(score: number): Verdict {
  if (score >= 85) return "Strong Hire";
  if (score >= 70) return "Hire";
  if (score >= 55) return "Lean Hire";
  if (score >= 40) return "Lean No Hire";
  return "No Hire";
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Correctness comes from the tests, never from the model. Perf tests count double. */
export function correctnessScore(iv: Interview): number {
  const final = [...iv.runs].reverse().find((r) => r.kind === "final");
  if (!final || final.status === "compile_error") return 0;
  let got = 0;
  let total = 0;
  for (const t of final.tests) {
    const w = t.perf ? 2 : 1;
    total += w;
    if (t.passed) got += w;
  }
  return total ? clamp((got / total) * 100) : 0;
}

export async function writeReport(iv: Interview, candidateName: string, resumeText: string, problem?: Problem): Promise<Report> {
  const lines: string[] = [];
  lines.push(`Candidate: ${candidateName}`);
  lines.push(`Round: ${iv.round}, difficulty ${iv.difficulty}, planned ${iv.durationMin} minutes, actual ${mmss(iv.durationSec ?? 0)}.`);
  if (problem) {
    lines.push(`Problem: ${problem.title} — ${problem.statement}`);
    lines.push(`Reference notes: ${problem.notes}`);
    lines.push(`Language: ${LANG_LABEL[iv.language!]}`);
  }
  if (iv.round !== "technical") lines.push(`Resume:\n${resumeText}`);
  lines.push("\nTRANSCRIPT (timestamps are minutes:seconds from the start):");
  for (const t of iv.transcript) {
    const who = t.role === "interviewer" ? "Interviewer" : t.role === "candidate" ? "Candidate" : "Event";
    lines.push(`[${mmss(t.at)}] ${who}${t.whileCoding ? " (while coding)" : ""}: ${t.text}`);
  }
  if (iv.round === "technical") {
    const coding = iv.transcript.filter((t) => t.role === "candidate" && t.whileCoding);
    const words = coding.reduce((n, t) => n + t.text.split(/\s+/).filter(Boolean).length, 0);
    lines.push(`\nWords spoken by the candidate after the problem was shown: about ${words}.`);
    lines.push(`\nFINAL CODE:\n${iv.code?.trim() || "(the candidate wrote no code)"}`);
    lines.push("\nCODE RUNS DURING THE INTERVIEW:");
    for (const r of iv.runs.filter((r) => r.kind !== "final")) lines.push(`[${mmss(r.at)}] ${summarizeRun(r)}`);
    const final = iv.runs.find((r) => r.kind === "final");
    lines.push(`\nFINAL TEST RESULT ON SUBMITTED CODE: ${final ? summarizeRun(final) : "not run"}`);
    lines.push(`Correctness score from tests (fixed): ${correctnessScore(iv)}`);
  }

  const out = await generateJson({ schema: ReportSchema, system: reportSystem(iv.round), text: lines.join("\n"), thinking: "high" });

  const defs = DIMENSIONS[iv.round];
  const dimensions = defs.map((d) => {
    let score: number | null = out.dimensions.find((x) => x.key === d.key)?.score ?? null;
    if (d.key === "correctness") score = correctnessScore(iv);
    return { key: d.key, label: d.label, score: score === null ? null : clamp(score) };
  });
  let wSum = 0;
  let sSum = 0;
  defs.forEach((d, i) => {
    const s = dimensions[i].score;
    if (s === null) return;
    wSum += d.weight;
    sSum += d.weight * s;
  });
  const score = wSum ? clamp(sSum / wSum) : 0;

  const dim = (k: string) => dimensions.find((d) => d.key === k)?.score ?? null;
  const avg = (...xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? clamp(v.reduce((a, b) => a + b, 0) / v.length) : undefined;
  };
  const skills: Partial<Record<SkillKey, number>> = {};
  const set = (k: SkillKey, v: number | undefined) => {
    if (v !== undefined) skills[k] = v;
  };
  if (iv.round === "technical") {
    set("coding", avg(dim("correctness"), dim("readability"), dim("structure")));
    set("problemSolving", avg(dim("approach")));
    set("communication", avg(dim("explaining"), dim("thinkingAloud")));
  } else if (iv.round === "resume") {
    set("technicalDepth", avg(dim("technicalDepth"), dim("tradeoffs")));
    set("ownership", avg(dim("ownership")));
    set("communication", avg(dim("clarity")));
    set("selfAwareness", avg(dim("selfAwareness")));
  } else {
    set("ownership", avg(dim("ownership")));
    set("selfAwareness", avg(dim("selfAwareness")));
    set("communication", avg(dim("communication"), dim("structure")));
  }

  const item = (x: z.infer<typeof ReportSchema>["strengths"][number]) => ({
    title: x.title,
    detail: x.detail,
    quote: x.quote.trim() || undefined,
    code: x.code.trim() || undefined,
    dimension: x.dimension,
  });
  return {
    score,
    verdict: verdictFor(score),
    summary: out.summary,
    dimensions,
    strengths: out.strengths.map(item),
    improvements: out.improvements.map(item),
    howToImprove: out.howToImprove,
    prepareBeforeReal: out.prepareBeforeReal,
    resumeItems: out.resumeItems,
    skills,
  };
}

// ------------------------------------------------------------------ resume

const ResumeSchema = z.object({
  parsed: z.object({
    name: z.string(),
    headline: z.string(),
    skills: z.array(z.string()),
    experience: z.array(z.object({ title: z.string(), org: z.string(), period: z.string(), bullets: z.array(z.string()) })),
    projects: z.array(z.object({ name: z.string(), tech: z.array(z.string()), bullets: z.array(z.string()) })),
    education: z.array(z.object({ school: z.string(), degree: z.string(), period: z.string() })),
  }),
  checks: z.array(z.object({ id: z.string(), passed: z.boolean(), detail: z.string() })),
});

const ATS_CHECKS: { id: string; label: string; weight: number; rule: string }[] = [
  { id: "contact", label: "Contact details", weight: 10, rule: "Name, email and phone are present as plain text near the top." },
  { id: "sections", label: "Standard section headings", weight: 15, rule: "Uses recognisable headings such as Education, Experience, Projects, Skills." },
  { id: "readable", label: "Readable text layout", weight: 15, rule: "Text extracts in a sensible reading order: no content trapped in images, text boxes, or multi-column layouts that scramble the order." },
  { id: "dates", label: "Clear dates", weight: 10, rule: "Every role and degree has dates in a consistent format, most recent first." },
  { id: "verbs", label: "Action-led bullets", weight: 15, rule: "Most bullets start with a strong action verb and describe what the candidate did." },
  { id: "metrics", label: "Quantified impact", weight: 15, rule: "At least a third of experience and project bullets include a number, scale, or measurable result." },
  { id: "skills", label: "Skills section", weight: 10, rule: "A distinct skills section lists concrete technologies, not soft-skill adjectives." },
  { id: "length", label: "Concise length", weight: 10, rule: "One page for a fresher or early-career candidate, at most two; no long paragraphs." },
];

export async function parseResume(pdfBase64: string): Promise<{ parsed: ResumeParsed; ats: AtsResult }> {
  const instructions = `Extract this resume faithfully. Copy bullets verbatim (fix only obvious extraction artefacts such as broken hyphenation). Do not invent anything that isn't there; use empty strings or lists when absent. "headline" is a one-line description of the candidate based only on the resume.

Then evaluate each of these applicant-tracking-system checks strictly and honestly, as a recruiter's ATS would. For each, return its id, whether it passes, and a one-sentence detail that names the specific problem (or what is good) so the student can fix it:
${ATS_CHECKS.map((c) => `- ${c.id}: ${c.rule}`).join("\n")}`;
  const out = await generateJson({ schema: ResumeSchema, text: instructions, pdfBase64, thinking: "medium" });
  let got = 0;
  let total = 0;
  const checks = ATS_CHECKS.map((c) => {
    const r = out.checks.find((x) => x.id === c.id);
    total += c.weight;
    if (r?.passed) got += c.weight;
    return { label: c.label, passed: !!r?.passed, detail: r?.detail ?? "" };
  });
  const score = Math.round((got / total) * 100);
  const label = score >= 85 ? "Strong" : score >= 65 ? "Good" : score >= 45 ? "Fair" : "Weak";
  return { parsed: out.parsed, ats: { score, label, checks } };
}

export function resumeText(p: ResumeParsed | undefined) {
  if (!p) return "(no resume uploaded)";
  return [
    p.headline,
    `Skills: ${p.skills.join(", ")}`,
    ...p.experience.flatMap((e) => [`${e.title} | ${e.org} | ${e.period}`, ...e.bullets.map((b) => `- ${b}`)]),
    ...p.projects.flatMap((x) => [`Project: ${x.name} (${x.tech.join(", ")})`, ...x.bullets.map((b) => `- ${b}`)]),
    ...p.education.map((e) => `${e.degree}, ${e.school}, ${e.period}`),
  ].join("\n");
}
