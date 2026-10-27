"use client";

import { useState } from "react";
import type { RunResult } from "@/lib/types";

export function CodeAndTests({ code, result }: { code: string; result: RunResult | null }) {
  const [open, setOpen] = useState(false);
  const failed = result?.tests.filter((t) => !t.passed) ?? [];
  return (
    <section className="card p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Your final code</h2>
          <p className="text-paper-dim">
            {!result
              ? "No code was submitted."
              : result.status === "compile_error"
                ? "It didn't compile."
                : `${result.passed} of ${result.total} tests passed${result.tests.some((t) => t.perf && !t.passed) ? ", including a failed performance test" : ""}.`}
          </p>
        </div>
        <button className="btn btn-ghost !py-2" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide code" : "‹/› Show code"}
        </button>
      </div>
      {open && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <pre className="max-h-[480px] overflow-auto rounded-xl bg-ink-900 p-4 font-mono text-[13px] leading-relaxed">{code || "(empty)"}</pre>
          <div className="space-y-2 text-sm">
            {result?.compileError && <pre className="overflow-x-auto rounded-lg bg-bad/10 p-3 font-mono text-xs text-bad">{result.compileError}</pre>}
            {result?.tests.map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2">
                <span aria-hidden className={t.passed ? "text-good" : "text-bad"}>
                  {t.passed ? "✓" : "✕"}
                </span>
                <span>{t.name}</span>
                <span className="ml-auto text-xs text-muted">{t.error ?? (t.timeMs !== undefined ? `${t.timeMs} ms` : "")}</span>
              </div>
            ))}
            {failed.some((t) => t.input) && (
              <div className="pt-2">
                <div className="mb-1 text-xs font-semibold text-muted">First failing case</div>
                {failed
                  .filter((t) => t.input)
                  .slice(0, 1)
                  .map((t) => (
                    <div key={t.name} className="rounded-lg bg-ink-900 p-3 font-mono text-xs text-paper-dim">
                      <div className="whitespace-pre-wrap">in: {t.input}</div>
                      <div>expected: {t.expected}</div>
                      <div>got: {t.got ?? "—"}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
