"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useState } from "react";
import type { PublicProblem } from "@/lib/problems";
import type { Lang, RunResult } from "@/lib/types";
import { LANG_LABEL } from "@/lib/types";

const MONACO_LANG: Record<Lang, string> = { java: "java", python: "python", cpp: "cpp", javascript: "javascript" };

export function CodePanel({
  problem,
  language,
  initialCode,
  onChange,
  onRun,
  running,
  result,
}: {
  problem: PublicProblem;
  language: Lang;
  initialCode: string;
  onChange: (code: string) => void;
  onRun: (kind: "run" | "submit") => void;
  running: "run" | "submit" | null;
  result: RunResult | null;
}) {
  const [tab, setTab] = useState<"problem" | "results">("problem");
  const [shownResultAt, setShownResultAt] = useState<number | null>(null);

  // Switch to the results tab when a new result arrives.
  if (result && result.at !== shownResultAt && !running) {
    setShownResultAt(result.at);
    setTab("results");
  }

  const mount: OnMount = (_editor, monaco) => {
    monaco.editor.defineTheme("saamne", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#14110d",
        "editor.lineHighlightBackground": "#1f1b15",
        "editorLineNumber.foreground": "#5a5143",
        "editorGutter.background": "#14110d",
      },
    });
    monaco.editor.setTheme("saamne");
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 lg:grid-cols-[minmax(280px,0.8fr)_1.5fr] lg:grid-rows-1">
      <section className="card flex min-h-0 flex-col overflow-hidden !rounded-2xl">
        <div className="flex border-b border-white/5 text-sm">
          {(["problem", "results"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 font-medium capitalize ${tab === t ? "border-b-2 border-amber text-paper" : "text-muted hover:text-paper"}`}
            >
              {t}
              {t === "results" && result && (
                <span className={`ml-2 tabular-nums ${result.passed === result.total ? "text-good" : "text-bad"}`}>
                  {result.passed}/{result.total}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "problem" ? <ProblemView problem={problem} /> : <ResultsView result={result} running={running} />}
        </div>
      </section>
      <section className="card flex min-h-[360px] flex-col overflow-hidden !rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-sm">
          <span className="text-paper-dim">{LANG_LABEL[language]}</span>
          <span className="text-xs text-muted">Edit the function. Input and output handling is already written.</span>
        </div>
        <div className="min-h-0 flex-1">
          <Editor
            defaultLanguage={MONACO_LANG[language]}
            defaultValue={initialCode}
            onChange={(v) => onChange(v ?? "")}
            onMount={mount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "var(--font-jetbrains), monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              tabSize: 4,
              automaticLayout: true,
              padding: { top: 12 },
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/5 px-4 py-2.5">
          <button className="btn btn-ghost !px-4 !py-1.5 text-sm" disabled={!!running} onClick={() => onRun("run")}>
            {running === "run" ? "Running…" : "Run examples"}
          </button>
          <button className="btn btn-primary !px-4 !py-1.5 text-sm" disabled={!!running} onClick={() => onRun("submit")}>
            {running === "submit" ? "Testing…" : "Submit"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProblemView({ problem }: { problem: PublicProblem }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      <div>
        <h3 className="font-display text-2xl">{problem.title}</h3>
        <span
          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            problem.difficulty === "Easy" ? "bg-good/15 text-good" : problem.difficulty === "Medium" ? "bg-warn/15 text-warn" : "bg-bad/15 text-bad"
          }`}
        >
          {problem.difficulty}
        </span>
      </div>
      <p className="text-paper-dim">{problem.statement}</p>
      {problem.examples.map((e, i) => (
        <div key={i} className="rounded-xl bg-ink-900 p-3.5 font-mono text-[13px]">
          <div className="mb-1 font-sans text-xs font-semibold text-muted">Example {i + 1}</div>
          <div className="whitespace-pre-wrap">
            <span className="text-muted">Input: </span>
            {e.input}
          </div>
          <div>
            <span className="text-muted">Output: </span>
            {e.output}
          </div>
          {e.explanation && <div className="mt-1 font-sans text-[13px] text-paper-dim">{e.explanation}</div>}
        </div>
      ))}
      <div>
        <div className="mb-1 text-xs font-semibold text-muted">Constraints</div>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-paper-dim">
          {problem.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ResultsView({ result, running }: { result: RunResult | null; running: "run" | "submit" | null }) {
  if (running) return <p className="text-paper-dim">{running === "run" ? "Running the examples…" : "Running every test, including performance…"}</p>;
  if (!result) return <p className="text-paper-dim">Run your code to see results here.</p>;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-baseline justify-between">
        <b className={result.passed === result.total ? "text-good" : "text-bad"}>
          {result.status === "compile_error"
            ? "Compile error"
            : result.passed === result.total
              ? `All ${result.total} passed`
              : `${result.passed} of ${result.total} passed`}
        </b>
        <span className="text-muted">{result.kind === "run" ? "Examples" : "Full test suite"}</span>
      </div>
      {result.compileError && <pre className="overflow-x-auto rounded-lg bg-bad/10 p-3 font-mono text-xs text-bad">{result.compileError}</pre>}
      {result.stderr && result.status !== "compile_error" && (
        <pre className="overflow-x-auto rounded-lg bg-bad/10 p-3 font-mono text-xs text-bad">{result.stderr}</pre>
      )}
      {result.status !== "compile_error" && (
        <ul className="space-y-2">
          {result.tests.map((t, i) => (
            <li key={i} className="rounded-lg bg-ink-900 p-2.5">
              <div className="flex items-center gap-2">
                <span aria-hidden className={t.passed ? "text-good" : "text-bad"}>
                  {t.passed ? "✓" : "✕"}
                </span>
                <span>{t.name}</span>
                {t.perf && t.timeMs !== undefined && <span className="ml-auto text-xs text-muted">{t.timeMs} ms</span>}
                {t.error && <span className="ml-auto text-xs text-bad">{t.error}</span>}
              </div>
              {!t.passed && t.input && (
                <div className="mt-1.5 space-y-0.5 pl-6 font-mono text-xs text-paper-dim">
                  <div className="whitespace-pre-wrap">in: {t.input}</div>
                  <div>expected: {t.expected}</div>
                  <div>got: {t.got ?? "—"}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {result.debugOutput && (
        <div>
          <div className="mb-1 text-xs font-semibold text-muted">Your printed output</div>
          <pre className="max-h-40 overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-xs">{result.debugOutput}</pre>
        </div>
      )}
    </div>
  );
}
