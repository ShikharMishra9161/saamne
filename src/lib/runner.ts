import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describeInput, exampleCases, formatOutput, serialize, type Problem, type TestCase } from "./problems";
import type { Lang, RunResult, TestOutcome } from "./types";

// Runs candidate code locally in a temp directory with time and output limits.
// This is fine for a self-hosted practice tool. If you ever deploy it for other
// people, run this inside a container or a dedicated sandbox service instead.

const PY = process.env.PYTHON_BIN ?? (process.platform === "win32" ? "python" : "python3");
const MAX_OUTPUT = 8 * 1024 * 1024;

/** Time limit for one performance case, per language (includes process start-up). */
const PERF_LIMIT_MS: Record<Lang, number> = { cpp: 2000, java: 3500, javascript: 3000, python: 7000 };
const BATCH_LIMIT_MS = 15000;

interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  overflow: boolean;
  ms: number;
}

function exec(cmd: string, args: string[], cwd: string, input: string, timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let overflow = false;
    let child;
    try {
      child = spawn(cmd, args, { cwd, windowsHide: true });
    } catch (err) {
      resolve({ code: -1, stdout: "", stderr: String(err), timedOut: false, overflow: false, ms: 0 });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
      if (stdout.length > MAX_OUTPUT) {
        overflow = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < 64_000) stderr += d.toString();
    });
    child.on("error", (err) => {
      stderr += String(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, overflow, ms: Math.round(performance.now() - start) });
    });
    child.stdin.on("error", () => {
      // the program may exit without reading all input
    });
    child.stdin.end(input);
  });
}

const FILE: Record<Lang, string> = { java: "Main.java", python: "main.py", cpp: "main.cpp", javascript: "main.js" };

async function compile(lang: Lang, dir: string): Promise<string | null> {
  if (lang === "java") {
    const r = await exec("javac", ["-encoding", "UTF-8", "Main.java"], dir, "", 30000);
    return r.code === 0 ? null : clean(r.stderr || r.stdout || "Compilation failed.", dir);
  }
  if (lang === "cpp") {
    const r = await exec("g++", ["-O2", "-std=c++1z", "-o", "main.exe", "main.cpp"], dir, "", 60000);
    return r.code === 0 ? null : clean(r.stderr || r.stdout || "Compilation failed.", dir);
  }
  if (lang === "python") {
    const r = await exec(PY, ["-m", "py_compile", "main.py"], dir, "", 15000);
    return r.code === 0 ? null : clean(r.stderr, dir);
  }
  const r = await exec("node", ["--check", "main.js"], dir, "", 15000);
  return r.code === 0 ? null : clean(r.stderr, dir);
}

function runCmd(lang: Lang, dir: string): [string, string[]] {
  switch (lang) {
    case "java":
      return ["java", ["-Xss256m", "-cp", ".", "Main"]];
    case "python":
      return [PY, ["-u", "main.py"]];
    case "cpp":
      return [path.join(/*turbopackIgnore: true*/ dir, "main.exe"), []];
    case "javascript":
      return ["node", ["--stack-size=65500", "main.js"]];
  }
}

function clean(text: string, dir: string) {
  return text.split(dir + path.sep).join("").split(dir).join("").trim().slice(0, 4000);
}

/** Splits batch output into per-case answers and leftover debug output. */
function parseBatch(stdout: string) {
  const answers: string[] = [];
  const debug: string[] = [];
  let cur: string[] | null = null;
  for (const line of stdout.replace(/\r/g, "").split("\n")) {
    if (line === "@@CASE") cur = [];
    else if (line === "@@END" && cur) {
      answers.push(cur.join("\n"));
      cur = null;
    } else if (cur) cur.push(line);
    else if (line.trim()) debug.push(line);
  }
  return { answers, debug: debug.join("\n") };
}

const norm = (s: string) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .join("\n")
    .trim();

function judge(p: Problem, tc: TestCase, got: string | undefined): TestOutcome {
  const expected = formatOutput(p.shape, p.solve(tc.input));
  const passed = got !== undefined && (p.check ? p.check(tc.input, got) : norm(got) === norm(expected));
  const shown = !tc.perf;
  const truncate = (s: string) => (s.length > 600 ? s.slice(0, 600) + " …" : s);
  return {
    name: tc.name,
    hidden: tc.hidden,
    perf: !!tc.perf,
    passed,
    input: shown ? truncate(describeInput(p.shape, p.sig, tc.input)) : undefined,
    expected: shown ? truncate(expected) : undefined,
    got: shown && got !== undefined ? truncate(got) : undefined,
  };
}

export async function runCode(
  p: Problem,
  lang: Lang,
  code: string,
  kind: RunResult["kind"],
  at: number,
): Promise<RunResult> {
  const cases = kind === "run" ? exampleCases(p) : [...exampleCases(p), ...p.tests()];
  const normal = cases.filter((c) => !c.perf);
  const perf = cases.filter((c) => c.perf);
  const dir = await fs.mkdtemp(path.join(/*turbopackIgnore: true*/ os.tmpdir(), "saamne-run-"));
  const result: RunResult = { kind, at, status: "ok", tests: [], passed: 0, total: cases.length };
  try {
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ dir, FILE[lang]), code);
    const compileError = await compile(lang, dir);
    if (compileError) {
      result.status = "compile_error";
      result.compileError = compileError;
      result.tests = cases.map((c) => ({ name: c.name, hidden: c.hidden, perf: !!c.perf, passed: false }));
      return result;
    }
    const [cmd, args] = runCmd(lang, dir);

    const batchInput = [String(normal.length), ...normal.map((c) => serialize(p.shape, c.input))].join("\n") + "\n";
    const batch = await exec(cmd, args, dir, batchInput, BATCH_LIMIT_MS);
    const { answers, debug } = parseBatch(batch.stdout);
    if (debug) result.debugOutput = debug.slice(0, 4000);
    const crashed = batch.code !== 0 || batch.timedOut || batch.overflow;
    normal.forEach((c, i) => {
      const t = judge(p, c, answers[i]);
      if (answers[i] === undefined && crashed) {
        t.error = batch.timedOut ? "Timed out" : batch.overflow ? "Too much output" : "Runtime error";
      }
      result.tests.push(t);
    });
    if (crashed) {
      result.status = batch.timedOut ? "timeout" : "runtime_error";
      result.stderr = clean(batch.stderr, dir) || (batch.overflow ? "Output limit exceeded." : undefined);
    }

    for (const c of perf) {
      const input = `1\n${serialize(p.shape, c.input)}\n`;
      const r = await exec(cmd, args, dir, input, PERF_LIMIT_MS[lang]);
      const t = judge(p, c, parseBatch(r.stdout).answers[0]);
      t.timeMs = r.ms;
      if (r.timedOut) {
        t.passed = false;
        t.error = `Too slow: over ${PERF_LIMIT_MS[lang] / 1000}s`;
      } else if (r.code !== 0) {
        t.passed = false;
        t.error = "Runtime error";
        result.stderr ??= clean(r.stderr, dir);
      }
      result.tests.push(t);
    }
    result.passed = result.tests.filter((t) => t.passed).length;
    return result;
  } catch (err) {
    result.status = "internal_error";
    result.stderr = String(err);
    return result;
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** One-line summary the interviewer and the report writer can read. */
export function summarizeRun(r: RunResult): string {
  const label = r.kind === "run" ? "Ran the examples" : r.kind === "submit" ? "Submitted against all tests" : "Final code, all tests";
  if (r.status === "compile_error") return `${label}: compile error.\n${r.compileError?.slice(0, 800)}`;
  const failed = r.tests.filter((t) => !t.passed);
  const lines = [`${label}: ${r.passed}/${r.total} passed.`];
  if (r.status === "timeout") lines.push("The program timed out on the normal tests.");
  if (r.status === "runtime_error" && r.stderr) lines.push(`Runtime error: ${r.stderr.slice(0, 500)}`);
  for (const t of failed.slice(0, 4)) {
    if (t.perf) lines.push(`- FAILED performance test "${t.name}"${t.error ? ` (${t.error})` : ""}.`);
    else lines.push(`- FAILED "${t.name}": input ${t.input}; expected ${t.expected}; got ${t.got ?? t.error ?? "nothing"}.`);
  }
  if (failed.length > 4) lines.push(`- …and ${failed.length - 4} more failing.`);
  return lines.join("\n");
}
