"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STEPS = ["Running your final code against every test", "Reading the transcript", "Scoring each dimension", "Writing your feedback"];

export function ReportWaiting({ id, initialStatus, error }: { id: string; initialStatus: string; error: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [err, setErr] = useState(error);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (status !== "scoring") return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/interviews/${id}/status`);
      if (!res.ok) return;
      const s = await res.json();
      if (s.status !== "scoring") {
        setStatus(s.status);
        setErr(s.error);
        router.refresh();
      }
    }, 2500);
    const steps = setInterval(() => setStep((x) => Math.min(x + 1, STEPS.length - 1)), 9000);
    return () => {
      clearInterval(poll);
      clearInterval(steps);
    };
  }, [id, status, router]);

  async function retry() {
    setStatus("scoring");
    setErr(null);
    setStep(1);
    await fetch(`/api/interviews/${id}/finish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-24">
      {status === "failed" ? (
        <div className="text-center">
          <h1 className="font-display text-4xl">The report didn&apos;t finish</h1>
          <p className="mt-3 text-paper-dim">Your interview is saved. This was a temporary problem on our side.</p>
          {err && <p className="mt-2 font-mono text-xs text-muted">{err}</p>}
          <button className="btn btn-primary mt-7" onClick={retry}>
            Try again
          </button>
        </div>
      ) : (
        <div>
          <h1 className="font-display text-4xl">Writing your report…</h1>
          <p className="mt-3 text-paper-dim">This usually takes under a minute. You can leave this page; the report will be on your profile.</p>
          <ol className="mt-8 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 ${i <= step ? "text-paper" : "text-muted"}`}>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${i < step ? "bg-good" : i === step ? "bg-amber" : "bg-white/10"}`}
                  style={i === step ? { animation: "breathe 1.4s ease-in-out infinite" } : undefined}
                />
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
