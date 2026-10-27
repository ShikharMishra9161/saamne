"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { UserResume } from "@/lib/types";

export function ProfileSettings({ name, hidden, publicName }: { name: string; hidden: boolean; publicName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [hide, setHide] = useState(hidden);

  async function save(body: object) {
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await save({ name: value });
            setEditing(false);
          }}
        >
          <input className="input !py-2" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-primary !py-2">Save</button>
        </form>
      ) : (
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>
          Edit name
        </button>
      )}
      <label className="flex cursor-pointer items-center justify-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#f2a541]"
          checked={!hide}
          onChange={async (e) => {
            setHide(!e.target.checked);
            await save({ hideFromBoard: !e.target.checked });
          }}
        />
        <span className="text-paper-dim">{hide ? "Hidden from the leaderboard" : `On the leaderboard as ${publicName}`}</span>
      </label>
    </div>
  );
}

export function ResumeUpload({ resume }: { resume: UserResume | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/resume", { method: "POST", body: form });
    if (!res.ok) setError((await res.json()).error ?? "Upload failed.");
    setBusy(false);
    router.refresh();
  }

  const ats = resume?.ats;
  const color = ats ? (ats.score >= 85 ? "#7bd389" : ats.score >= 65 ? "#5ec4b6" : ats.score >= 45 ? "#f2c94c" : "#ef6f6c") : "#5a5143";
  const C = 2 * Math.PI * 52;

  return (
    <div className="mt-5">
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {resume ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
          <span className="min-w-0 truncate">
            📄 <b>{resume.fileName}</b>{" "}
            <span className="text-sm text-muted">
              updated {new Date(resume.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </span>
          <button className="shrink-0 text-sm text-amber hover:underline" onClick={() => input.current?.click()} disabled={busy}>
            Replace
          </button>
        </div>
      ) : (
        <button className="btn btn-primary w-full" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Reading your resume…" : "Upload resume (PDF)"}
        </button>
      )}
      {busy && resume && <p className="mt-3 text-sm text-paper-dim">Reading your resume…</p>}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {ats && (
        <>
          <div className="mt-6 flex items-center gap-5">
            <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`ATS score ${ats.score}, ${ats.label}`}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(244,237,225,0.08)" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(ats.score / 100) * C} ${C}`}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="62" textAnchor="middle" fontSize="34" fill="#f4ede1" fontFamily="var(--font-fraunces)">
                {ats.score}
              </text>
              <text x="60" y="84" textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>
                {ats.label}
              </text>
            </svg>
            <p className="text-sm text-paper-dim">
              How cleanly an applicant-tracking system can read your resume, and how strong its bullet points look. It&apos;s
              our own measure; every company&apos;s ATS reads a little differently.
            </p>
          </div>
          <ul className="mt-5 space-y-2.5 text-sm">
            {ats.checks.map((c) => (
              <li key={c.label} className="flex gap-2.5">
                <span aria-hidden className={c.passed ? "text-good" : "text-bad"}>
                  {c.passed ? "✓" : "✕"}
                </span>
                <span>
                  <b className="font-semibold">{c.label}.</b> <span className="text-paper-dim">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ProblemReportForm({ interviews }: { interviews: { id: string; label: string }[] }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return sent ? (
    <p className="mt-4 text-good">Thanks — we&apos;ve got it.</p>
  ) : (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const body = Object.fromEntries(new FormData(e.currentTarget));
        const res = await fetch("/api/problem-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) setSent(true);
        else setError((await res.json()).error);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Which interview?</span>
          <select name="interviewId" className="input">
            <option value="">Not about an interview</option>
            {interviews.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">What is it about?</span>
          <select name="topic" className="input">
            <option value="audio">The call or audio had a problem</option>
            <option value="transcription">My words were transcribed wrongly</option>
            <option value="score">The score or feedback seems wrong</option>
            <option value="code">The code runner or tests</option>
            <option value="other">Something else</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">What happened?</span>
        <textarea name="message" className="input min-h-28" required />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary">Send</button>
    </form>
  );
}
