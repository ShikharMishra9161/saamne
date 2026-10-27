import crypto from "node:crypto";
import { cookies } from "next/headers";
import { newId, read, write } from "./db";
import type { User } from "./types";

export const SESSION_COOKIE = "saamne_session";
const SESSION_DAYS = 30;
export const FREE_INTERVIEWS = Number(process.env.FREE_INTERVIEWS ?? 5);

function hash(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function createUser(name: string, email: string, password: string): User {
  const salt = crypto.randomBytes(16).toString("hex");
  const user: User = {
    id: newId(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    salt,
    passHash: hash(password, salt),
    createdAt: new Date().toISOString(),
    credits: FREE_INTERVIEWS,
    points: 0,
    hideFromBoard: false,
  };
  write((db) => {
    if (db.users.some((u) => u.email === user.email)) {
      throw new Error("An account with this email already exists.");
    }
    db.users.push(user);
  });
  return user;
}

export function verifyLogin(email: string, password: string): User | null {
  const user = read((db) => db.users.find((u) => u.email === email.trim().toLowerCase()));
  if (!user) return null;
  const a = Buffer.from(hash(password, user.salt), "hex");
  const b = Buffer.from(user.passHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? user : null;
}

export async function startSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  write((db) => {
    db.sessions = db.sessions.filter((s) => new Date(s.expiresAt) > new Date());
    db.sessions.push({ token, userId, expiresAt: expiresAt.toISOString() });
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) write((db) => void (db.sessions = db.sessions.filter((s) => s.token !== token)));
  store.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return read((db) => {
    const s = db.sessions.find((x) => x.token === token);
    if (!s || new Date(s.expiresAt) < new Date()) return null;
    return db.users.find((u) => u.id === s.userId) ?? null;
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}

/** Wraps a route handler so HttpError becomes a JSON error response. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return Response.json({ error: "Something went wrong on our side." }, { status: 500 });
    }
  };
}

export function publicName(user: Pick<User, "name">) {
  const parts = user.name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function firstName(user: Pick<User, "name">) {
  return user.name.trim().split(/\s+/)[0];
}
