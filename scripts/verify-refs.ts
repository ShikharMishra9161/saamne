/* eslint-disable @typescript-eslint/no-explicit-any -- brute-force checkers take loosely typed inputs */
import { PROBLEMS, formatOutput } from "../src/lib/problems";
type A = any;
const brute: Record<string, (i: A) => unknown> = {
  "stock-profit": ({ nums }) => { let b = 0; for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) b = Math.max(b, nums[j] - nums[i]); return b; },
  "two-sum": null as any,
  "valid-brackets": ({ s }) => { let t = s, prev; do { prev = t; t = t.replace(/\(\)|\[\]|\{\}/g, ""); } while (t !== prev); return t === ""; },
  "max-subarray": ({ nums }) => { let b = -Infinity; for (let i = 0; i < nums.length; i++) { let s = 0; for (let j = i; j < nums.length; j++) { s += nums[j]; b = Math.max(b, s); } } return b; },
  "longest-unique": ({ s }) => { let b = 0; for (let i = 0; i < s.length; i++) for (let j = i; j < s.length; j++) { const sub = s.slice(i, j + 1); if (new Set(sub).size === sub.length) b = Math.max(b, sub.length); } return b; },
  "merge-intervals": ({ iv }) => { const max = Math.max(...iv.map((x: number[]) => x[1])); if (max > 10000) return null; // union over half-steps
    const cover = new Array(2 * max + 2).fill(false); for (const [a, b] of iv) for (let x = 2 * a; x <= 2 * b; x++) cover[x] = true; const out: number[][] = []; let st = -1; for (let x = 0; x < cover.length; x++) { if (cover[x] && st < 0) st = x; if (!cover[x] && st >= 0) { out.push([st / 2, (x - 1) / 2]); st = -1; } } return out; },
  "count-islands": ({ grid }) => { const R = grid.length, C = grid[0].length; const par = Array.from({ length: R * C }, (_, i) => i); const f = (x: number): number => par[x] === x ? x : (par[x] = f(par[x])); for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (grid[i][j] === "1") { if (i + 1 < R && grid[i + 1][j] === "1") par[f(i * C + j)] = f((i + 1) * C + j); if (j + 1 < C && grid[i][j + 1] === "1") par[f(i * C + j)] = f(i * C + j + 1); } const s = new Set<number>(); for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (grid[i][j] === "1") s.add(f(i * C + j)); return s.size; },
  "subarray-sum-k": ({ nums, k }) => { let c = 0; for (let i = 0; i < nums.length; i++) { let s = 0; for (let j = i; j < nums.length; j++) { s += nums[j]; if (s === k) c++; } } return c; },
  "longest-consecutive": ({ nums }) => { const u = [...new Set<number>(nums)].sort((a, b) => a - b); let b = 0, run = 0; for (let i = 0; i < u.length; i++) { run = i && u[i] === u[i - 1] + 1 ? run + 1 : 1; b = Math.max(b, run); } return b; },
  "rain-water": ({ nums }) => { let w = 0; for (let i = 0; i < nums.length; i++) { const l = Math.max(...nums.slice(0, i + 1)); const r = Math.max(...nums.slice(i)); w += Math.min(l, r) - nums[i]; } return w; },
  "window-max": ({ nums, k }) => { const o = []; for (let i = 0; i + k <= nums.length; i++) o.push(Math.max(...nums.slice(i, i + k))); return o; },
};
let bad = 0, n = 0;
for (const p of PROBLEMS) {
  const cases = [...p.examples.map(e => e.input), ...p.tests().filter(t => !t.perf).map(t => t.input)];
  for (const c of cases) {
    const ref = formatOutput(p.shape, p.solve(c));
    if (p.id === "two-sum") { n++; if (!p.check!(c, ref)) { bad++; console.log("BAD two-sum", JSON.stringify(c)); } continue; }
    const b = brute[p.id](c); if (b === null) continue;
    n++;
    if (formatOutput(p.shape, b) !== ref) { bad++; console.log("MISMATCH", p.id, JSON.stringify(c).slice(0, 200), ref, formatOutput(p.shape, b)); }
  }
  // perf tests: ensure reference handles them and two-sum uniqueness generator is valid
  for (const t of p.tests().filter(t => t.perf)) { const ref = formatOutput(p.shape, p.solve(t.input)); if (p.check && !p.check(t.input, ref)) { bad++; console.log("BAD perf", p.id); } }
}
console.log(`checked ${n} cases, ${bad} problems`);
