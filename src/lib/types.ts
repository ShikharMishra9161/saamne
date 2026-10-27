export type Round = "technical" | "resume" | "behavioral";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type Lang = "java" | "python" | "cpp" | "javascript";

export const LANG_LABEL: Record<Lang, string> = {
  java: "Java",
  python: "Python",
  cpp: "C++",
  javascript: "JavaScript",
};

export interface ResumeParsed {
  name: string;
  headline: string;
  skills: string[];
  experience: { title: string; org: string; period: string; bullets: string[] }[];
  projects: { name: string; tech: string[]; bullets: string[] }[];
  education: { school: string; degree: string; period: string }[];
}

export interface AtsResult {
  score: number;
  label: string;
  checks: { label: string; passed: boolean; detail: string }[];
}

export interface UserResume {
  fileName: string;
  updatedAt: string;
  parsed: ResumeParsed;
  ats: AtsResult;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passHash: string;
  salt: string;
  createdAt: string;
  credits: number;
  points: number;
  hideFromBoard: boolean;
  resume?: UserResume;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface TranscriptEntry {
  role: "interviewer" | "candidate" | "event";
  text: string;
  at: number; // seconds since interview start
  whileCoding?: boolean;
}

export interface TestOutcome {
  name: string;
  hidden: boolean;
  perf: boolean;
  passed: boolean;
  input?: string;
  expected?: string;
  got?: string;
  error?: string;
  timeMs?: number;
}

export interface RunResult {
  kind: "run" | "submit" | "final";
  at: number;
  status: "ok" | "compile_error" | "runtime_error" | "timeout" | "internal_error";
  compileError?: string;
  stderr?: string;
  debugOutput?: string;
  tests: TestOutcome[];
  passed: number;
  total: number;
}

export interface FeedbackItem {
  title: string;
  detail: string;
  quote?: string;
  code?: string;
  dimension: string;
}

export interface DimensionScore {
  key: string;
  label: string;
  score: number | null;
}

export interface Report {
  score: number;
  verdict: Verdict;
  summary: string;
  dimensions: DimensionScore[];
  strengths: FeedbackItem[];
  improvements: FeedbackItem[];
  howToImprove: string[];
  prepareBeforeReal: string[];
  resumeItems: { title: string; kind: string; assessment: string }[];
  skills: Partial<Record<SkillKey, number>>;
}

export type Verdict = "Strong Hire" | "Hire" | "Lean Hire" | "Lean No Hire" | "No Hire";

export type SkillKey =
  | "coding"
  | "problemSolving"
  | "communication"
  | "technicalDepth"
  | "ownership"
  | "selfAwareness";

export interface Interview {
  id: string;
  userId: string;
  round: Round;
  difficulty: Difficulty;
  language?: Lang;
  durationMin: number;
  problemId?: string;
  focus?: string;
  status: "live" | "scoring" | "done" | "abandoned" | "failed";
  /** Frozen at creation so the prompt prefix never changes mid-interview. */
  systemPrompt: string;
  /** Exact conversation sent to the AI: each turn's input and the interviewer's reply. */
  aiLog: { role: "user" | "model"; text: string }[];
  /** Candidate input from turns that failed, resent with the next turn. */
  aiUnsent: string[];
  transcript: TranscriptEntry[];
  /** Room events (code runs) not yet passed to the interviewer. */
  pendingEvents: string[];
  startedAt?: string;
  code?: string;
  runs: RunResult[];
  problemShownAt?: number;
  report?: Report;
  pointsAwarded?: number;
  pointsAfter?: number;
  rankBefore?: string;
  rankAfter?: string;
  error?: string;
  createdAt: string;
  endedAt?: string;
  durationSec?: number;
}

export interface ProblemReport {
  id: string;
  userId: string;
  interviewId: string | null;
  topic: string;
  message: string;
  createdAt: string;
}
