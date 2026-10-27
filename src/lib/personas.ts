import type { Round } from "./types";

export interface Persona {
  name: string;
  title: string;
  gender: "female" | "male";
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: "short" | "long" | "bun";
  /** Set when a portrait exists in public/interviewers/ (see interviewerPhoto). */
  photo?: string;
}

export const PERSONAS: Record<Round, Persona> = {
  technical: {
    name: "Arjun Mehta",
    title: "Senior Software Engineer",
    gender: "male",
    skin: "#c68a5e",
    hair: "#1d1612",
    shirt: "#2f4858",
    hairStyle: "short",
  },
  resume: {
    name: "Kavya Rao",
    title: "Engineering Manager",
    gender: "female",
    skin: "#b97b52",
    hair: "#20140f",
    shirt: "#5b3a4a",
    hairStyle: "long",
  },
  behavioral: {
    name: "Neha Kapoor",
    title: "Senior Talent Partner",
    gender: "female",
    skin: "#d49a6a",
    hair: "#2b1a12",
    shirt: "#3d5a4c",
    hairStyle: "bun",
  },
};

export const ROUND_INFO: Record<Round, { title: string; subtitle: string; blurb: string }> = {
  technical: {
    title: "Technical",
    subtitle: "Data structures and algorithms",
    blurb: "Solve a coding problem live while you explain your thinking. Your code runs against real tests.",
  },
  resume: {
    title: "Resume Deep Dive",
    subtitle: "Your projects, questioned in depth",
    blurb: "Every project and internship on your resume, probed the way an engineering manager would: what you built, why, and what you'd change.",
  },
  behavioral: {
    title: "Behavioral",
    subtitle: "HR and hiring manager round",
    blurb: "A conversation about how you work: conflict, failure, ownership and impact, with follow-ups when an answer is vague.",
  },
};
