import type { Difficulty } from "./types";

export interface Rank {
  key: string;
  name: string;
  min: number;
  color: string;
  blurb: string;
}

export const RANKS: Rank[] = [
  {
    key: "rookie",
    name: "Rookie",
    min: 0,
    color: "#b8ad98",
    blurb: "Every strong interviewer started here. Do one full round and see where you stand.",
  },
  {
    key: "contender",
    name: "Contender",
    min: 150,
    color: "#5ec4b6",
    blurb: "You show up and finish. Now make every answer land the first time.",
  },
  {
    key: "specialist",
    name: "Specialist",
    min: 400,
    color: "#7aa7ff",
    blurb: "You solve and you explain. Interviewers can follow your thinking without chasing it.",
  },
  {
    key: "expert",
    name: "Expert",
    min: 800,
    color: "#f2a541",
    blurb: "Clean code, clear trade-offs, honest about gaps. You read like a hire.",
  },
  {
    key: "master",
    name: "Master",
    min: 1500,
    color: "#ef6f6c",
    blurb: "Consistently excellent across every round. The bar other candidates are measured against.",
  },
];

export function rankFor(points: number) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (points >= r.min) idx = i;
  });
  const rank = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  return { rank, index: idx, next, toNext: next ? next.min - points : 0 };
}

const MULT: Record<Difficulty, number> = { Easy: 1, Medium: 1.5, Hard: 2 };

/** Points earned for a scored interview. Weak scores earn little; nothing is taken away. */
export function pointsFor(score: number, difficulty: Difficulty) {
  return Math.round(10 + Math.max(0, score - 40) * 2.2 * MULT[difficulty]);
}
