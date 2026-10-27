import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Interview, ProblemReport, Session, User } from "./types";

// A small JSON-file store. Every server module shares one in-memory copy through
// globalThis, and reloads from disk when another process or module instance has
// written a newer version (checked by mtime).

interface Data {
  users: User[];
  sessions: Session[];
  interviews: Interview[];
  problemReports: ProblemReport[];
}

const DATA_DIR = process.env.SAAMNE_DATA_DIR ?? path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "db.json");

const g = globalThis as unknown as { __saamneDb?: { data: Data; mtime: number } };

function empty(): Data {
  return { users: [], sessions: [], interviews: [], problemReports: [] };
}

function load(): Data {
  let mtime = 0;
  try {
    mtime = fs.statSync(FILE).mtimeMs;
  } catch {
    // no file yet
  }
  if (g.__saamneDb && g.__saamneDb.mtime === mtime) return g.__saamneDb.data;
  let data = empty();
  if (mtime) {
    data = { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  }
  g.__saamneDb = { data, mtime };
  return data;
}

function persist(data: Data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
  g.__saamneDb = { data, mtime: fs.statSync(FILE).mtimeMs };
}

export function read<T>(fn: (db: Data) => T): T {
  return fn(load());
}

export function write<T>(fn: (db: Data) => T): T {
  const data = load();
  const result = fn(data);
  persist(data);
  return result;
}

export function newId(bytes = 9) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function getInterview(id: string) {
  return read((db) => db.interviews.find((i) => i.id === id));
}

export function updateInterview(id: string, fn: (iv: Interview) => void) {
  return write((db) => {
    const iv = db.interviews.find((i) => i.id === id);
    if (!iv) throw new Error("Interview not found");
    fn(iv);
    return iv;
  });
}

export function updateUser(id: string, fn: (u: User) => void) {
  return write((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) throw new Error("User not found");
    fn(u);
    return u;
  });
}
