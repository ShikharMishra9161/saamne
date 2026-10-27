import fs from "node:fs";
import path from "node:path";
import { PERSONAS, type Persona } from "./personas";
import type { Round } from "./types";

// Drop a portrait named after the round into public/interviewers/
// (technical.jpg, resume.jpg, behavioral.jpg; .png and .webp work too) and the
// call shows it instead of the illustrated interviewer.

const DIR = path.join(process.cwd(), "public", "interviewers");
const EXTS = ["jpg", "jpeg", "png", "webp"];

export function personaFor(round: Round): Persona {
  for (const ext of EXTS) {
    const file = path.join(/*turbopackIgnore: true*/ DIR, `${round}.${ext}`);
    if (fs.existsSync(file)) {
      // mtime in the URL so a replaced photo isn't served from cache
      return { ...PERSONAS[round], photo: `/interviewers/${round}.${ext}?v=${Math.round(fs.statSync(file).mtimeMs)}` };
    }
  }
  return PERSONAS[round];
}
