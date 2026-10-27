"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROUND_INFO } from "@/lib/personas";
import type { Difficulty, Lang, Round } from "@/lib/types";
import { LANG_LABEL } from "@/lib/types";

const ICONS: Record<Round, React.ReactNode> = {
  technical: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />,
  resume: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  behavioral: <path d="M4 5h16v11H9l-5 4z" />,
};

function Pills<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.v}
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className={`rounded-full border px-4 py-2 text-sm transition ${
            value === o.v ? "border-amber bg-amber/15 text-paper" : "border-white/10 text-paper-dim hover:border-white/25"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SetupForm({ credits, hasResume }: { credits: number; hasResume: boolean }) {
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [language, setLanguage] = useState<Lang>("java");
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [durationMin, setDuration] = useState(30);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ round, language, difficulty, durationMin, focus }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    router.push(`/interview/${data.id}`);
  }

  const blocked = round === "resume" && !hasResume;

  return (
    <div className="mt-12">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-2xl italic text-amber">1</span>
        <h2 className="text-lg font-semibold">Choose your round</h2>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {(Object.keys(ROUND_INFO) as Round[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRound(r)}
            aria-pressed={round === r}
            className={`card p-7 text-left transition hover:border-white/20 ${round === r ? "!border-amber/70 ring-1 ring-amber/40" : ""}`}
          >
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.06]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {ICONS[r]}
                </svg>
              </span>
              <span>
                <span className="block font-display text-3xl">{ROUND_INFO[r].title}</span>
                <span className="text-sm text-muted">{ROUND_INFO[r].subtitle}</span>
              </span>
            </div>
            <p className="mt-4 text-paper-dim">{ROUND_INFO[r].blurb}</p>
          </button>
        ))}
      </div>

      {round && (
        <div className="fade-up mt-12">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl italic text-amber">2</span>
            <h2 className="text-lg font-semibold">Set it up</h2>
          </div>
          <div className="card mt-5 grid gap-7 p-7 md:grid-cols-2">
            {round === "technical" && (
              <div>
                <div className="mb-3 text-sm text-paper-dim">Language</div>
                <Pills
                  label="Language"
                  value={language}
                  onChange={setLanguage}
                  options={(Object.keys(LANG_LABEL) as Lang[]).map((l) => ({ v: l, label: LANG_LABEL[l] }))}
                />
              </div>
            )}
            <div>
              <div className="mb-3 text-sm text-paper-dim">{round === "technical" ? "Problem difficulty" : "How hard to push"}</div>
              <Pills
                label="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => ({ v: d, label: d }))}
              />
            </div>
            <div>
              <div className="mb-3 text-sm text-paper-dim">Length</div>
              <Pills
                label="Length"
                value={durationMin}
                onChange={setDuration}
                options={[15, 30, 45].map((d) => ({ v: d, label: `${d} minutes` }))}
              />
            </div>
            {round !== "technical" && (
              <label className="block md:col-span-2">
                <span className="mb-3 block text-sm text-paper-dim">Anything to focus on? (optional)</span>
                <input
                  className="input"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder={round === "resume" ? "e.g. my internship at Itrik, or my backend projects" : "e.g. leadership stories, a product company role"}
                />
              </label>
            )}
          </div>

          {blocked && (
            <p className="mt-5 text-paper-dim">
              This round needs your resume.{" "}
              <Link href="/profile" className="font-semibold text-amber hover:underline">
                Upload it on your profile →
              </Link>
            </p>
          )}
          {error && <p className="mt-5 text-bad">{error}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button className="btn btn-primary" disabled={busy || blocked || credits <= 0} onClick={start}>
              {busy ? "Setting up the room…" : "Go to the waiting room →"}
            </button>
            <span className="text-sm text-muted">
              {credits > 0 ? `Uses 1 of your ${credits} interviews. Very short calls are refunded.` : "You have no interviews left."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
