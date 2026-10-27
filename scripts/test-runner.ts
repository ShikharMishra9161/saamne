import { PROBLEMS, getProblem, starterCode } from "../src/lib/problems";
import { runCode } from "../src/lib/runner";
import type { Lang } from "../src/lib/types";

const langs: Lang[] = ["java", "python", "cpp", "javascript"];
const only = process.argv[2];

async function main() {
  // 1. Every starter template compiles and runs in every language.
  for (const p of PROBLEMS) {
    if (only && p.id !== only) continue;
    const row: string[] = [];
    for (const l of langs) {
      const r = await runCode(p, l, starterCode(p.shape, p.sig, l), "submit", 0);
      row.push(`${l}:${r.status}(${r.passed}/${r.total})`);
      if (r.status !== "ok") console.log(r.compileError ?? r.stderr);
    }
    console.log(p.id.padEnd(22), row.join("  "));
  }
  // 2. Correct solutions pass everything, including performance.
  const p = getProblem("stock-profit")!;
  const fill = (l: Lang, body: string) => starterCode(p.shape, p.sig, l).replace(/(\/\/|#) Write your solution here\n\s*return 0;?/, body);
  const sols: Record<Lang, string> = {
    java: "long mn = Long.MAX_VALUE, best = 0; for (int x : prices) { mn = Math.min(mn, x); best = Math.max(best, x - mn); } return best;",
    python: "mn, best = float('inf'), 0\n        for x in prices:\n            mn = min(mn, x); best = max(best, x - mn)\n        return best",
    cpp: "long long mn = LLONG_MAX, best = 0; for (int x : prices) { mn = min(mn, (long long)x); best = max(best, x - mn); } return best;",
    javascript: "let mn = Infinity, best = 0; for (const x of prices) { mn = Math.min(mn, x); best = Math.max(best, x - mn); } return best;",
  };
  for (const l of langs) {
    const r = await runCode(p, l, fill(l, sols[l]), "submit", 0);
    console.log("correct", l, r.status, `${r.passed}/${r.total}`, r.tests.filter(t => t.perf).map(t => t.timeMs + "ms").join(","), r.tests.filter(t=>!t.passed).map(t=>t.name+":"+(t.error??t.got)).join("; "));
  }
  const slow = fill("python", "best = 0\n        for i in range(len(prices)):\n            for j in range(i + 1, len(prices)):\n                best = max(best, prices[j] - prices[i])\n        return best");
  const r = await runCode(p, "python", slow, "submit", 0);
  console.log("brute python", `${r.passed}/${r.total}`, r.tests.filter(t => !t.passed).map(t => `${t.name}: ${t.error}`).join("; "));
  const dbg = fill("javascript", "console.log('debug!', prices.length); let mn = Infinity, best = 0; for (const x of prices) { mn = Math.min(mn, x); best = Math.max(best, x - mn); } return best;");
  const d = await runCode(p, "javascript", dbg, "run", 0);
  console.log("debug prints", `${d.passed}/${d.total}`, JSON.stringify(d.debugOutput));
}
main();
