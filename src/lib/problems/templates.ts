import type { Lang } from "../types";

// Every problem takes one of a few input/output shapes. The starter code for each
// language is generated from the shape, so the reading and printing code is always
// correct and the candidate only writes the function body.
//
// Batch protocol: stdin starts with T, the number of cases. For each case the
// program prints "@@CASE", the answer, then "@@END". Anything printed outside the
// markers is treated as the candidate's debug output.

export type Shape =
  | "arr_long"
  | "arr_int_arr"
  | "arr_int_long"
  | "str_long"
  | "str_bool"
  | "intervals"
  | "grid_long";

export type ShapeInput =
  | { nums: number[] }
  | { nums: number[]; k: number }
  | { s: string }
  | { iv: [number, number][] }
  | { grid: string[] };

export interface Signature {
  fn: string;
  params: string[]; // names, in order
}

export function serialize(shape: Shape, input: ShapeInput): string {
  switch (shape) {
    case "arr_long": {
      const { nums } = input as { nums: number[] };
      return `${nums.length}\n${nums.join(" ")}`;
    }
    case "arr_int_arr":
    case "arr_int_long": {
      const { nums, k } = input as { nums: number[]; k: number };
      return `${nums.length}\n${nums.join(" ")}\n${k}`;
    }
    case "str_long":
    case "str_bool": {
      const { s } = input as { s: string };
      return s.length ? `${s.length}\n${s}` : "0";
    }
    case "intervals": {
      const { iv } = input as { iv: [number, number][] };
      return [String(iv.length), ...iv.map(([a, b]) => `${a} ${b}`)].join("\n");
    }
    case "grid_long": {
      const { grid } = input as { grid: string[] };
      return [`${grid.length} ${grid[0].length}`, ...grid].join("\n");
    }
  }
}

export function formatOutput(shape: Shape, value: unknown): string {
  switch (shape) {
    case "arr_long":
    case "arr_int_long":
    case "str_long":
    case "grid_long":
      return String(value);
    case "str_bool":
      return value ? "true" : "false";
    case "arr_int_arr":
      return (value as number[]).join(" ");
    case "intervals":
      return (value as [number, number][]).map(([a, b]) => `${a} ${b}`).join("\n");
  }
}

/** Human-readable rendering of one case, for showing failed tests. */
export function describeInput(shape: Shape, sig: Signature, input: ShapeInput): string {
  const p = sig.params;
  const arr = (a: unknown[]) => `[${a.join(", ")}]`;
  switch (shape) {
    case "arr_long": {
      const { nums } = input as { nums: number[] };
      return `${p[0]} = ${arr(nums)}`;
    }
    case "arr_int_arr":
    case "arr_int_long": {
      const { nums, k } = input as { nums: number[]; k: number };
      return `${p[0]} = ${arr(nums)}, ${p[1]} = ${k}`;
    }
    case "str_long":
    case "str_bool":
      return `${p[0]} = "${(input as { s: string }).s}"`;
    case "intervals":
      return `${p[0]} = [${(input as { iv: [number, number][] }).iv.map((x) => arr(x)).join(", ")}]`;
    case "grid_long":
      return `${p[0]} = [\n${(input as { grid: string[] }).grid.map((r) => `  "${r}"`).join(",\n")}\n]`;
  }
}

const RETURN_TYPE: Record<Shape, Record<Lang, string>> = {
  arr_long: { java: "long", python: "int", cpp: "long long", javascript: "number" },
  arr_int_long: { java: "long", python: "int", cpp: "long long", javascript: "number" },
  str_long: { java: "long", python: "int", cpp: "long long", javascript: "number" },
  grid_long: { java: "long", python: "int", cpp: "long long", javascript: "number" },
  str_bool: { java: "boolean", python: "bool", cpp: "bool", javascript: "boolean" },
  arr_int_arr: { java: "int[]", python: "List[int]", cpp: "vector<int>", javascript: "number[]" },
  intervals: {
    java: "int[][]",
    python: "List[List[int]]",
    cpp: "vector<vector<int>>",
    javascript: "number[][]",
  },
};

const DEFAULT_RETURN: Record<Shape, Record<Lang, string>> = {
  arr_long: { java: "0", python: "0", cpp: "0", javascript: "0" },
  arr_int_long: { java: "0", python: "0", cpp: "0", javascript: "0" },
  str_long: { java: "0", python: "0", cpp: "0", javascript: "0" },
  grid_long: { java: "0", python: "0", cpp: "0", javascript: "0" },
  str_bool: { java: "false", python: "False", cpp: "false", javascript: "false" },
  arr_int_arr: { java: "new int[0]", python: "[]", cpp: "{}", javascript: "[]" },
  intervals: { java: "new int[0][]", python: "[]", cpp: "{}", javascript: "[]" },
};

function paramDecls(shape: Shape, sig: Signature, lang: Lang): string {
  const [a, b] = sig.params;
  const t: Record<Lang, (name: string, kind: "arr" | "int" | "str" | "iv" | "grid") => string> = {
    java: (n, k) =>
      ({ arr: `int[] ${n}`, int: `int ${n}`, str: `String ${n}`, iv: `int[][] ${n}`, grid: `char[][] ${n}` })[k],
    python: (n, k) =>
      ({ arr: `${n}: List[int]`, int: `${n}: int`, str: `${n}: str`, iv: `${n}: List[List[int]]`, grid: `${n}: List[List[str]]` })[k],
    cpp: (n, k) =>
      ({ arr: `vector<int>& ${n}`, int: `int ${n}`, str: `string ${n}`, iv: `vector<vector<int>>& ${n}`, grid: `vector<vector<char>>& ${n}` })[k],
    javascript: (n) => n,
  };
  const f = t[lang];
  switch (shape) {
    case "arr_long":
      return f(a, "arr");
    case "arr_int_arr":
    case "arr_int_long":
      return `${f(a, "arr")}, ${f(b, "int")}`;
    case "str_long":
    case "str_bool":
      return f(a, "str");
    case "intervals":
      return f(a, "iv");
    case "grid_long":
      return f(a, "grid");
  }
}

function javaIO(shape: Shape, sig: Signature): string {
  const call = `new Solution().${sig.fn}`;
  let read = "";
  let args = "";
  switch (shape) {
    case "arr_long":
    case "arr_int_arr":
    case "arr_int_long":
      read = `int n = in.nextInt();
            int[] nums = new int[n];
            for (int i = 0; i < n; i++) nums[i] = in.nextInt();`;
      args = "nums";
      if (shape !== "arr_long") {
        read += `\n            int k = in.nextInt();`;
        args = "nums, k";
      }
      break;
    case "str_long":
    case "str_bool":
      read = `int len = in.nextInt();
            String s = len > 0 ? in.next() : "";`;
      args = "s";
      break;
    case "intervals":
      read = `int n = in.nextInt();
            int[][] iv = new int[n][2];
            for (int i = 0; i < n; i++) { iv[i][0] = in.nextInt(); iv[i][1] = in.nextInt(); }`;
      args = "iv";
      break;
    case "grid_long":
      read = `int r = in.nextInt(), c = in.nextInt();
            char[][] grid = new char[r][];
            for (int i = 0; i < r; i++) grid[i] = in.next().toCharArray();`;
      args = "grid";
      break;
  }
  let print = "";
  if (shape === "arr_int_arr") {
    print = `int[] res = ${call}(${args});
            StringBuilder sb = new StringBuilder("@@CASE\\n");
            for (int i = 0; i < res.length; i++) { if (i > 0) sb.append(' '); sb.append(res[i]); }
            System.out.println(sb.append("\\n@@END"));`;
  } else if (shape === "intervals") {
    print = `int[][] res = ${call}(${args});
            StringBuilder sb = new StringBuilder("@@CASE\\n");
            for (int[] p : res) sb.append(p[0]).append(' ').append(p[1]).append('\\n');
            System.out.println(sb.append("@@END"));`;
  } else {
    print = `String res = String.valueOf(${call}(${args}));
            System.out.println("@@CASE\\n" + res + "\\n@@END");`;
  }
  return `
// ---- Input/output handling. You don't need to change anything below. ----
// Use System.err for debug prints if you want them kept separate.
public class Main {
    public static void main(String[] args) throws IOException {
        FastReader in = new FastReader();
        int t = in.nextInt();
        while (t-- > 0) {
            ${read}
            ${print}
        }
    }
}

class FastReader {
    private final BufferedReader br = new BufferedReader(new InputStreamReader(System.in), 1 << 16);
    private StringTokenizer st;
    String next() throws IOException {
        while (st == null || !st.hasMoreTokens()) st = new StringTokenizer(br.readLine());
        return st.nextToken();
    }
    int nextInt() throws IOException { return Integer.parseInt(next()); }
}
`;
}

function pythonIO(shape: Shape, sig: Signature): string {
  let read = "";
  let args = "";
  switch (shape) {
    case "arr_long":
    case "arr_int_arr":
    case "arr_int_long":
      read = `n = int(data[pos]); pos += 1
        nums = [int(x) for x in data[pos:pos + n]]; pos += n`;
      args = "nums";
      if (shape !== "arr_long") {
        read += `\n        k = int(data[pos]); pos += 1`;
        args = "nums, k";
      }
      break;
    case "str_long":
    case "str_bool":
      read = `n = int(data[pos]); pos += 1
        s = ""
        if n > 0:
            s = data[pos]; pos += 1`;
      args = "s";
      break;
    case "intervals":
      read = `n = int(data[pos]); pos += 1
        iv = []
        for _ in range(n):
            iv.append([int(data[pos]), int(data[pos + 1])]); pos += 2`;
      args = "iv";
      break;
    case "grid_long":
      read = `r, c = int(data[pos]), int(data[pos + 1]); pos += 2
        grid = [list(data[pos + i]) for i in range(r)]; pos += r`;
      args = "grid";
      break;
  }
  let fmt = "str(res)";
  if (shape === "str_bool") fmt = '"true" if res else "false"';
  if (shape === "arr_int_arr") fmt = '" ".join(map(str, res))';
  if (shape === "intervals") fmt = '"\\n".join(f"{a} {b}" for a, b in res)';
  return `
# ---- Input/output handling. You don't need to change anything below. ----
# Use print(..., file=sys.stderr) for debug prints if you want them kept separate.
def _main():
    data = sys.stdin.read().split()
    pos = 0
    t = int(data[pos]); pos += 1
    for _ in range(t):
        ${read}
        res = Solution().${sig.fn}(${args})
        print("@@CASE")
        print(${fmt})
        print("@@END", flush=True)


if __name__ == "__main__":
    _main()
`;
}

function cppIO(shape: Shape, sig: Signature): string {
  let read = "";
  let args = "";
  switch (shape) {
    case "arr_long":
    case "arr_int_arr":
    case "arr_int_long":
      read = `int n; cin >> n;
        vector<int> nums(n);
        for (auto& x : nums) cin >> x;`;
      args = "nums";
      if (shape !== "arr_long") {
        read += `\n        int k; cin >> k;`;
        args = "nums, k";
      }
      break;
    case "str_long":
    case "str_bool":
      read = `int len; cin >> len;
        string s;
        if (len > 0) cin >> s;`;
      args = "s";
      break;
    case "intervals":
      read = `int n; cin >> n;
        vector<vector<int>> iv(n, vector<int>(2));
        for (auto& p : iv) cin >> p[0] >> p[1];`;
      args = "iv";
      break;
    case "grid_long":
      read = `int r, c; cin >> r >> c;
        vector<vector<char>> grid(r);
        for (int i = 0; i < r; i++) { string row; cin >> row; grid[i] = vector<char>(row.begin(), row.end()); }`;
      args = "grid";
      break;
  }
  let print = `cout << "@@CASE\\n" << sol.${sig.fn}(${args}) << "\\n@@END" << endl;`;
  if (shape === "str_bool") {
    print = `cout << "@@CASE\\n" << (sol.${sig.fn}(${args}) ? "true" : "false") << "\\n@@END" << endl;`;
  }
  if (shape === "arr_int_arr") {
    print = `vector<int> res = sol.${sig.fn}(${args});
        cout << "@@CASE\\n";
        for (size_t i = 0; i < res.size(); i++) cout << (i ? " " : "") << res[i];
        cout << "\\n@@END" << endl;`;
  }
  if (shape === "intervals") {
    print = `vector<vector<int>> res = sol.${sig.fn}(${args});
        cout << "@@CASE\\n";
        for (auto& p : res) cout << p[0] << ' ' << p[1] << '\\n';
        cout << "@@END" << endl;`;
  }
  return `
// ---- Input/output handling. You don't need to change anything below. ----
// Use cerr for debug prints if you want them kept separate.
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t; cin >> t;
    while (t--) {
        ${read}
        Solution sol;
        ${print}
    }
    return 0;
}
`;
}

function jsIO(shape: Shape, sig: Signature): string {
  let read = "";
  let args = "";
  switch (shape) {
    case "arr_long":
    case "arr_int_arr":
    case "arr_int_long":
      read = `const n = Number(data[pos++]);
    const nums = data.slice(pos, pos + n).map(Number); pos += n;`;
      args = "nums";
      if (shape !== "arr_long") {
        read += `\n    const k = Number(data[pos++]);`;
        args = "nums, k";
      }
      break;
    case "str_long":
    case "str_bool":
      read = `const len = Number(data[pos++]);
    const s = len > 0 ? data[pos++] : "";`;
      args = "s";
      break;
    case "intervals":
      read = `const n = Number(data[pos++]);
    const iv = [];
    for (let i = 0; i < n; i++) { iv.push([Number(data[pos]), Number(data[pos + 1])]); pos += 2; }`;
      args = "iv";
      break;
    case "grid_long":
      read = `const r = Number(data[pos++]); pos++;
    const grid = [];
    for (let i = 0; i < r; i++) grid.push(data[pos++].split(""));`;
      args = "grid";
      break;
  }
  let fmt = "String(res)";
  if (shape === "str_bool") fmt = 'res ? "true" : "false"';
  if (shape === "arr_int_arr") fmt = 'res.join(" ")';
  if (shape === "intervals") fmt = 'res.map((p) => p[0] + " " + p[1]).join("\\n")';
  return `
// ---- Input/output handling. You don't need to change anything below. ----
// Use console.error for debug prints if you want them kept separate.
const data = require("fs").readFileSync(0, "utf8").split(/\\s+/).filter(Boolean);
let pos = 0;
let t = Number(data[pos++]);
while (t-- > 0) {
    ${read}
    const res = ${sig.fn}(${args});
    console.log("@@CASE\\n" + (${fmt}) + "\\n@@END");
}
`;
}

export function starterCode(shape: Shape, sig: Signature, lang: Lang): string {
  const params = paramDecls(shape, sig, lang);
  const ret = RETURN_TYPE[shape][lang];
  const def = DEFAULT_RETURN[shape][lang];
  switch (lang) {
    case "java":
      return `import java.util.*;
import java.io.*;

class Solution {
    public ${ret} ${sig.fn}(${params}) {
        // Write your solution here
        return ${def};
    }
}
${javaIO(shape, sig)}`;
    case "python":
      return `import sys
from typing import List


class Solution:
    def ${sig.fn}(self, ${params}) -> ${ret}:
        # Write your solution here
        return ${def}

${pythonIO(shape, sig)}`;
    case "cpp":
      return `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    ${ret} ${sig.fn}(${params}) {
        // Write your solution here
        return ${def};
    }
};
${cppIO(shape, sig)}`;
    case "javascript":
      return `/**
${sig.params.map((p) => ` * @param ${p}`).join("\n")}
 * @return {${ret}}
 */
function ${sig.fn}(${params}) {
    // Write your solution here
    return ${def};
}
${jsIO(shape, sig)}`;
  }
}
