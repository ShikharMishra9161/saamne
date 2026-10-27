import type { Difficulty, Lang } from "../types";
import { describeInput, formatOutput, serialize, starterCode, type Shape, type ShapeInput, type Signature } from "./templates";

export interface TestCase {
  name: string;
  input: ShapeInput;
  hidden: boolean;
  perf?: boolean;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  shape: Shape;
  sig: Signature;
  statement: string;
  constraints: string[];
  examples: { input: ShapeInput; explanation?: string }[];
  /** Private notes for the interviewer: optimal approach, pitfalls, hint ladder. */
  notes: string;
  solve: (input: ShapeInput) => unknown;
  /** Optional custom checker for problems with more than one valid answer. */
  check?: (input: ShapeInput, got: string) => boolean;
  tests: () => TestCase[];
}

// Seeded RNG so hidden tests are identical on every run.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const randArr = (r: () => number, n: number, lo: number, hi: number) =>
  Array.from({ length: n }, () => randInt(r, lo, hi));

type Arr = { nums: number[] };
type ArrK = { nums: number[]; k: number };
type Str = { s: string };
type Iv = { iv: [number, number][] };
type Grid = { grid: string[] };

const PERF_N = 200_000;

export const PROBLEMS: Problem[] = [
  {
    id: "stock-profit",
    title: "Best Day to Buy and Sell",
    difficulty: "Easy",
    shape: "arr_long",
    sig: { fn: "maxProfit", params: ["prices"] },
    statement:
      "You are given the price of a stock on each day. Choose one day to buy and a later day to sell. Return the maximum profit you can make. If no profit is possible, return 0.",
    constraints: ["1 ≤ prices.length ≤ 200,000", "0 ≤ prices[i] ≤ 10,000"],
    examples: [
      { input: { nums: [7, 1, 5, 3, 6, 4] }, explanation: "Buy at 1 on day 2, sell at 6 on day 5: profit 5." },
      { input: { nums: [7, 6, 4, 3, 1] }, explanation: "Prices only fall, so no transaction gives a profit." },
    ],
    notes:
      "Optimal: one pass tracking the minimum price so far and the best (price - min). O(n) time, O(1) space. Brute force over all pairs is O(n^2) and fails the performance test. Pitfalls: selling before buying (taking the global max minus global min), returning a negative number. Hint ladder: (1) What do you need to know about the past when you are on day i? (2) Could you keep the cheapest price seen so far?",
    solve: (i) => {
      let min = Infinity;
      let best = 0;
      for (const p of (i as Arr).nums) {
        min = Math.min(min, p);
        best = Math.max(best, p - min);
      }
      return best;
    },
    tests: () => {
      const r = rng(11);
      return [
        { name: "single day", input: { nums: [5] }, hidden: true },
        { name: "rising", input: { nums: [1, 2, 3, 4, 5] }, hidden: true },
        { name: "min after max", input: { nums: [3, 8, 1, 4] }, hidden: true },
        { name: "all equal", input: { nums: [4, 4, 4, 4] }, hidden: true },
        ...Array.from({ length: 6 }, (_, k) => ({
          name: `random ${k + 1}`,
          input: { nums: randArr(r, randInt(r, 2, 60), 0, 10000) },
          hidden: true,
        })),
        { name: "performance", input: { nums: randArr(r, PERF_N, 0, 10000) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "two-sum",
    title: "Pair With Target Sum",
    difficulty: "Easy",
    shape: "arr_int_arr",
    sig: { fn: "twoSum", params: ["nums", "target"] },
    statement:
      "Given an array of integers nums and an integer target, return the indices of the two different elements that add up to target. Exactly one valid pair exists. Return the two indices in any order.",
    constraints: ["2 ≤ nums.length ≤ 200,000", "-10^9 ≤ nums[i] ≤ 10^9", "-2·10^9 ≤ target ≤ 2·10^9 (fits in a 32-bit int)", "Exactly one answer exists"],
    examples: [
      { input: { nums: [2, 7, 11, 15], k: 9 }, explanation: "nums[0] + nums[1] = 9." },
      { input: { nums: [3, 2, 4], k: 6 }, explanation: "nums[1] + nums[2] = 6. Using index 0 twice is not allowed." },
    ],
    notes:
      "Optimal: hash map from value to index, one pass; for each x check whether target - x was seen. O(n) time and space. Sorting with two pointers is O(n log n) but must keep original indices. Brute force O(n^2) fails the performance test. Pitfalls: using the same element twice, integer overflow on the sum in Java/C++ (values up to 1e9). Hint ladder: (1) For a given x, what value are you looking for? (2) How can you look that up in O(1)?",
    solve: (i) => {
      const { nums, k } = i as ArrK;
      const seen = new Map<number, number>();
      for (let j = 0; j < nums.length; j++) {
        const want = k - nums[j];
        if (seen.has(want)) return [seen.get(want)!, j];
        seen.set(nums[j], j);
      }
      return [];
    },
    check: (i, got) => {
      const { nums, k } = i as ArrK;
      const parts = got.trim().split(/\s+/).map(Number);
      if (parts.length !== 2 || parts.some((x) => !Number.isInteger(x))) return false;
      const [a, b] = parts;
      return a !== b && a >= 0 && b >= 0 && a < nums.length && b < nums.length && nums[a] + nums[b] === k;
    },
    tests: () => {
      const r = rng(22);
      // Build arrays with exactly one valid pair: distinct values from a sparse set.
      const unique = (n: number, big: boolean) => {
        const vals = new Set<number>();
        while (vals.size < n) vals.add(big ? randInt(r, -1e9 / 2, 1e9 / 2) * 2 : randInt(r, -50, 50) * 2);
        const nums = [...vals];
        const a = randInt(r, 0, n - 1);
        let b = randInt(r, 0, n - 1);
        if (b === a) b = (a + 1) % n;
        nums[b] = nums[b] + 1; // the only odd value
        nums[a] = nums[a] + 0;
        // target is odd, and the only odd element is nums[b], so the pair is unique
        return { nums, k: nums[a] + nums[b] };
      };
      return [
        { name: "two elements", input: { nums: [1, 4], k: 5 }, hidden: true },
        { name: "negatives", input: { nums: [-3, 4, 3, 90], k: 0 }, hidden: true },
        { name: "duplicate values", input: { nums: [3, 3], k: 6 }, hidden: true },
        { name: "large values", input: { nums: [1000000000, -5, 999999999], k: 1999999999 }, hidden: true },
        ...Array.from({ length: 5 }, (_, j) => ({ name: `random ${j + 1}`, input: unique(randInt(r, 3, 40), false), hidden: true })),
        { name: "performance", input: unique(PERF_N, true), hidden: true, perf: true },
      ];
    },
  },
  {
    id: "valid-brackets",
    title: "Balanced Brackets",
    difficulty: "Easy",
    shape: "str_bool",
    sig: { fn: "isValid", params: ["s"] },
    statement:
      "Given a string s containing only the characters ( ) [ ] { }, return true if every opening bracket is closed by the same type of bracket in the correct order, and false otherwise. An empty string is balanced.",
    constraints: ["0 ≤ s.length ≤ 200,000", "s contains only ()[]{}"],
    examples: [
      { input: { s: "()[]{}" }, explanation: "Each pair closes immediately." },
      { input: { s: "([)]" }, explanation: "The ] closes while ( is still open, so it is not balanced." },
      { input: { s: "{[]}" } },
    ],
    notes:
      "Optimal: stack of open brackets; on a closer, the stack top must be the matching opener. Valid only if the stack ends empty. O(n) time and space. Pitfalls: popping an empty stack, forgetting to check the stack is empty at the end, only counting brackets (fails \"([)]\"). Hint ladder: (1) Which open bracket must the next closer match? (2) What data structure gives you the most recent one?",
    solve: (i) => {
      const st: string[] = [];
      const pair: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
      for (const c of (i as Str).s) {
        if (c in pair) {
          if (st.pop() !== pair[c]) return false;
        } else st.push(c);
      }
      return st.length === 0;
    },
    tests: () => {
      const r = rng(33);
      const balanced = (n: number) => {
        const open = "([{";
        const close: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
        let s = "";
        const st: string[] = [];
        for (let j = 0; j < n; j++) {
          if (st.length && (r() < 0.5 || st.length > n - j - 1)) s += close[st.pop()!];
          else {
            const c = open[randInt(r, 0, 2)];
            st.push(c);
            s += c;
          }
        }
        while (st.length) s += close[st.pop()!];
        return s;
      };
      const mutate = (s: string) => {
        const p = randInt(r, 0, s.length - 1);
        const chars = "()[]{}".replace(s[p], "");
        return s.slice(0, p) + chars[randInt(r, 0, chars.length - 1)] + s.slice(p + 1);
      };
      return [
        { name: "empty string", input: { s: "" }, hidden: true },
        { name: "single opener", input: { s: "(" }, hidden: true },
        { name: "single closer", input: { s: "]" }, hidden: true },
        { name: "closer first", input: { s: ")(" }, hidden: true },
        { name: "deep nesting", input: { s: "(((([[[{{{}}}]]]))))" }, hidden: true },
        { name: "unclosed at end", input: { s: "()[]{" }, hidden: true },
        ...Array.from({ length: 4 }, (_, j) => ({ name: `random balanced ${j + 1}`, input: { s: balanced(randInt(r, 4, 40)) }, hidden: true })),
        ...Array.from({ length: 4 }, (_, j) => ({ name: `random broken ${j + 1}`, input: { s: mutate(balanced(randInt(r, 4, 40))) }, hidden: true })),
        { name: "performance", input: { s: balanced(PERF_N / 2) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "max-subarray",
    title: "Best Streak Sum",
    difficulty: "Easy",
    shape: "arr_long",
    sig: { fn: "maxSubArray", params: ["nums"] },
    statement:
      "Given an integer array nums, find the contiguous subarray (containing at least one number) with the largest sum, and return that sum.",
    constraints: ["1 ≤ nums.length ≤ 200,000", "-10^4 ≤ nums[i] ≤ 10^4"],
    examples: [
      { input: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] }, explanation: "[4, -1, 2, 1] has the largest sum, 6." },
      { input: { nums: [-3, -1, -2] }, explanation: "All negative: the best is the single element -1." },
    ],
    notes:
      "Optimal: Kadane's algorithm — running sum resets to the current element when it would be better to start fresh; track the best. O(n) time, O(1) space. Prefix sums with running minimum also works. O(n^2) fails performance. Pitfalls: initialising best to 0 (wrong for all-negative arrays), overflow is not an issue here. Hint ladder: (1) What is the best subarray that ends exactly at index i? (2) How does it relate to the best one ending at i-1?",
    solve: (i) => {
      let cur = -Infinity;
      let best = -Infinity;
      for (const x of (i as Arr).nums) {
        cur = Math.max(x, cur + x);
        best = Math.max(best, cur);
      }
      return best;
    },
    tests: () => {
      const r = rng(44);
      return [
        { name: "single negative", input: { nums: [-7] }, hidden: true },
        { name: "all negative", input: { nums: [-8, -3, -6, -2, -5, -4] }, hidden: true },
        { name: "all positive", input: { nums: [1, 2, 3, 4] }, hidden: true },
        { name: "zeros", input: { nums: [0, 0, 0] }, hidden: true },
        ...Array.from({ length: 6 }, (_, j) => ({ name: `random ${j + 1}`, input: { nums: randArr(r, randInt(r, 1, 60), -100, 100) }, hidden: true })),
        { name: "performance", input: { nums: randArr(r, PERF_N, -10000, 10000) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "longest-unique",
    title: "Longest Run Without Repeats",
    difficulty: "Medium",
    shape: "str_long",
    sig: { fn: "lengthOfLongestSubstring", params: ["s"] },
    statement:
      "Given a string s, return the length of the longest substring (contiguous) that contains no repeated characters.",
    constraints: ["0 ≤ s.length ≤ 200,000", "s contains letters, digits and symbols, no spaces"],
    examples: [
      { input: { s: "abcabcbb" }, explanation: "\"abc\" has length 3." },
      { input: { s: "bbbbb" }, explanation: "\"b\" has length 1." },
      { input: { s: "pwwkew" }, explanation: "\"wke\" has length 3. \"pwke\" is not contiguous." },
    ],
    notes:
      "Optimal: sliding window with a map from character to its last index; when a repeat is inside the window, move the left edge to lastIndex + 1 (never backwards). O(n) time, O(alphabet) space. Pitfalls: moving the left pointer backwards (\"abba\"), off-by-one on window length, O(n^2) or O(n^3) brute force fails performance. Hint ladder: (1) If s[l..r] has no repeats, what happens when you add s[r+1]? (2) Where should the window start after a repeat?",
    solve: (i) => {
      const last = new Map<string, number>();
      let l = 0;
      let best = 0;
      const s = (i as Str).s;
      for (let r = 0; r < s.length; r++) {
        const p = last.get(s[r]);
        if (p !== undefined && p >= l) l = p + 1;
        last.set(s[r], r);
        best = Math.max(best, r - l + 1);
      }
      return best;
    },
    tests: () => {
      const r = rng(55);
      const alpha = "abcdefghijklmnopqrstuvwxyz0123456789!@#$%";
      const str = (n: number, k: number) => Array.from({ length: n }, () => alpha[randInt(r, 0, k - 1)]).join("");
      return [
        { name: "empty", input: { s: "" }, hidden: true },
        { name: "one char", input: { s: "z" }, hidden: true },
        { name: "abba", input: { s: "abba" }, hidden: true },
        { name: "dvdf", input: { s: "dvdf" }, hidden: true },
        { name: "all distinct", input: { s: "abcdefg" }, hidden: true },
        ...Array.from({ length: 6 }, (_, j) => ({ name: `random ${j + 1}`, input: { s: str(randInt(r, 5, 80), randInt(r, 2, 26)) }, hidden: true })),
        { name: "performance", input: { s: str(PERF_N, alpha.length) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "merge-intervals",
    title: "Merge Booking Slots",
    difficulty: "Medium",
    shape: "intervals",
    sig: { fn: "merge", params: ["intervals"] },
    statement:
      "You are given a list of booking slots, each as [start, end] with start ≤ end. Merge all slots that overlap or touch (for example [1,3] and [3,5] become [1,5]) and return the merged slots sorted by start.",
    constraints: ["1 ≤ intervals.length ≤ 200,000", "0 ≤ start ≤ end ≤ 10^9", "Input is not sorted"],
    examples: [
      { input: { iv: [[1, 3], [2, 6], [8, 10], [15, 18]] }, explanation: "[1,3] and [2,6] overlap, giving [1,6]." },
      { input: { iv: [[1, 4], [4, 5]] }, explanation: "Touching slots merge into [1,5]." },
    ],
    notes:
      "Optimal: sort by start, then sweep; extend the last merged interval's end with max(end, current end) when current start <= last end. O(n log n) time. Pitfalls: not sorting, using current end instead of max (fails [[1,10],[2,3]]), using < instead of <= for touching intervals, comparator overflow in Java when subtracting large values. Hint ladder: (1) Would it help if the intervals were in order of start time? (2) When does a new interval NOT overlap the last merged one?",
    solve: (i) => {
      const iv = [...(i as Iv).iv].sort((a, b) => a[0] - b[0]);
      const out: [number, number][] = [];
      for (const [a, b] of iv) {
        const last = out[out.length - 1];
        if (last && a <= last[1]) last[1] = Math.max(last[1], b);
        else out.push([a, b]);
      }
      return out;
    },
    tests: () => {
      const r = rng(66);
      const gen = (n: number, maxV: number, maxLen: number): [number, number][] =>
        Array.from({ length: n }, () => {
          const a = randInt(r, 0, maxV);
          return [a, a + randInt(r, 0, maxLen)];
        });
      return [
        { name: "single", input: { iv: [[5, 5]] }, hidden: true },
        { name: "contained", input: { iv: [[1, 10], [2, 3], [4, 5]] }, hidden: true },
        { name: "unsorted", input: { iv: [[8, 9], [1, 2], [2, 4]] }, hidden: true },
        { name: "no overlap", input: { iv: [[1, 2], [4, 5], [7, 8]] }, hidden: true },
        { name: "large values", input: { iv: [[999999990, 1000000000], [0, 1000000000]] }, hidden: true },
        ...Array.from({ length: 6 }, (_, j) => ({ name: `random ${j + 1}`, input: { iv: gen(randInt(r, 2, 40), 100, 10) }, hidden: true })),
        { name: "performance", input: { iv: gen(PERF_N, 1e9 - 1e6, 5000) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "count-islands",
    title: "Count the Islands",
    difficulty: "Medium",
    shape: "grid_long",
    sig: { fn: "numIslands", params: ["grid"] },
    statement:
      "You are given a map as a grid of '1' (land) and '0' (water). An island is a group of land cells connected horizontally or vertically (not diagonally). Return the number of islands.",
    constraints: ["1 ≤ rows, cols ≤ 300", "grid[i][j] is '0' or '1'"],
    examples: [
      { input: { grid: ["11000", "11000", "00100", "00011"] }, explanation: "Three separate groups of land." },
      { input: { grid: ["111", "010", "111"] }, explanation: "All land cells connect through the middle: one island." },
    ],
    notes:
      "Optimal: scan every cell; on unvisited land, increment the count and flood-fill (BFS or DFS) marking the island visited. O(rows*cols) time. Union-find also works. Pitfalls: counting diagonal neighbours, revisiting cells (infinite loop), recursion depth on large all-land grids in Python/Java (iterative BFS is safer — good follow-up question). Hint ladder: (1) When you find a land cell, how do you avoid counting the rest of its island again? (2) How would you visit every cell connected to it?",
    solve: (i) => {
      const g = (i as Grid).grid.map((row) => row.split(""));
      const R = g.length;
      const C = g[0].length;
      let count = 0;
      for (let a = 0; a < R; a++)
        for (let b = 0; b < C; b++) {
          if (g[a][b] !== "1") continue;
          count++;
          const q: number[] = [a * C + b];
          g[a][b] = "0";
          while (q.length) {
            const cur = q.pop()!;
            const x = Math.floor(cur / C);
            const y = cur % C;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < R && ny < C && g[nx][ny] === "1") {
                g[nx][ny] = "0";
                q.push(nx * C + ny);
              }
            }
          }
        }
      return count;
    },
    tests: () => {
      const r = rng(77);
      const grid = (R: number, C: number, p: number) =>
        Array.from({ length: R }, () => Array.from({ length: C }, () => (r() < p ? "1" : "0")).join(""));
      return [
        { name: "single water", input: { grid: ["0"] }, hidden: true },
        { name: "single land", input: { grid: ["1"] }, hidden: true },
        { name: "diagonal only", input: { grid: ["101", "010", "101"] }, hidden: true },
        { name: "one row", input: { grid: ["1101011"] }, hidden: true },
        { name: "one column", input: { grid: ["1", "1", "0", "1"] }, hidden: true },
        ...Array.from({ length: 5 }, (_, j) => ({ name: `random ${j + 1}`, input: { grid: grid(randInt(r, 2, 12), randInt(r, 2, 12), 0.45) }, hidden: true })),
        { name: "performance", input: { grid: grid(300, 300, 0.5) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "subarray-sum-k",
    title: "Count Segments With Sum K",
    difficulty: "Medium",
    shape: "arr_int_long",
    sig: { fn: "subarraySum", params: ["nums", "k"] },
    statement:
      "Given an integer array nums (values can be negative) and an integer k, return how many contiguous subarrays have a sum exactly equal to k.",
    constraints: ["1 ≤ nums.length ≤ 200,000", "-1000 ≤ nums[i] ≤ 1000", "-10^7 ≤ k ≤ 10^7", "The answer can exceed 2^31 - 1"],
    examples: [
      { input: { nums: [1, 1, 1], k: 2 }, explanation: "[1,1] starting at index 0 and at index 1." },
      { input: { nums: [1, 2, 3], k: 3 }, explanation: "[1,2] and [3]." },
    ],
    notes:
      "Optimal: prefix sums with a hash map counting how many times each prefix sum has occurred; for each prefix P add count[P - k]. Initialise count[0] = 1. O(n) time and space. Sliding window does NOT work because values can be negative — a strong signal if the candidate notices. Pitfalls: forgetting count[0] = 1, int overflow of the answer (use long — up to ~2e10 when all zeros and k = 0), O(n^2) fails performance. Hint ladder: (1) Can you express the sum of nums[i..j] using prefix sums? (2) For a fixed j, which earlier prefix sums would work?",
    solve: (i) => {
      const { nums, k } = i as ArrK;
      const count = new Map<number, number>([[0, 1]]);
      let p = 0;
      let ans = 0;
      for (const x of nums) {
        p += x;
        ans += count.get(p - k) ?? 0;
        count.set(p, (count.get(p) ?? 0) + 1);
      }
      return ans;
    },
    tests: () => {
      const r = rng(88);
      return [
        { name: "single match", input: { nums: [5], k: 5 }, hidden: true },
        { name: "negatives", input: { nums: [1, -1, 0], k: 0 }, hidden: true },
        { name: "no match", input: { nums: [1, 2, 3], k: 100 }, hidden: true },
        { name: "k negative", input: { nums: [-1, -1, 1], k: -1 }, hidden: true },
        ...Array.from({ length: 6 }, (_, j) => ({ name: `random ${j + 1}`, input: { nums: randArr(r, randInt(r, 1, 60), -5, 5), k: randInt(r, -5, 5) }, hidden: true })),
        { name: "overflow (all zeros)", input: { nums: Array(PERF_N).fill(0), k: 0 }, hidden: true, perf: true },
        { name: "performance", input: { nums: randArr(r, PERF_N, -1000, 1000), k: randInt(r, -50, 50) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "longest-consecutive",
    title: "Longest Consecutive Run",
    difficulty: "Medium",
    shape: "arr_long",
    sig: { fn: "longestConsecutive", params: ["nums"] },
    statement:
      "Given an unsorted array of integers, return the length of the longest sequence of consecutive values (like 4, 5, 6, 7) that can be formed from its elements. Duplicates count once. Aim for better than sorting if you can.",
    constraints: ["0 ≤ nums.length ≤ 200,000", "-10^9 ≤ nums[i] ≤ 10^9"],
    examples: [
      { input: { nums: [100, 4, 200, 1, 3, 2] }, explanation: "1, 2, 3, 4 gives length 4." },
      { input: { nums: [0, 3, 7, 2, 5, 8, 4, 6, 0, 1] }, explanation: "0 through 8 gives length 9." },
    ],
    notes:
      "Optimal: put all values in a hash set; only start counting from x where x-1 is not in the set, then walk x+1, x+2... O(n) time. Sorting gives O(n log n) and passes the tests — a good follow-up is to ask for O(n). Pitfalls: duplicates breaking the count after sorting, empty array, starting a walk from every element (O(n^2) on a long run). Hint ladder: (1) How do you know a number is the start of a run? (2) What structure answers 'is x+1 present' in O(1)?",
    solve: (i) => {
      const set = new Set((i as Arr).nums);
      let best = 0;
      for (const x of set) {
        if (set.has(x - 1)) continue;
        let y = x;
        while (set.has(y + 1)) y++;
        best = Math.max(best, y - x + 1);
      }
      return best;
    },
    tests: () => {
      const r = rng(99);
      const longRun = Array.from({ length: PERF_N }, (_, j) => j - 100000);
      for (let j = longRun.length - 1; j > 0; j--) {
        const s = randInt(r, 0, j);
        [longRun[j], longRun[s]] = [longRun[s], longRun[j]];
      }
      return [
        { name: "empty", input: { nums: [] }, hidden: true },
        { name: "duplicates", input: { nums: [1, 2, 2, 3] }, hidden: true },
        { name: "negatives", input: { nums: [-1, -2, 0, 5] }, hidden: true },
        { name: "extremes", input: { nums: [1000000000, -1000000000, 999999999] }, hidden: true },
        ...Array.from({ length: 6 }, (_, j) => ({ name: `random ${j + 1}`, input: { nums: randArr(r, randInt(r, 1, 50), -30, 30) }, hidden: true })),
        { name: "performance (one long run)", input: { nums: longRun }, hidden: true, perf: true },
        { name: "performance (random)", input: { nums: randArr(r, PERF_N, -1e9, 1e9) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "rain-water",
    title: "Rainwater Between Walls",
    difficulty: "Hard",
    shape: "arr_long",
    sig: { fn: "trap", params: ["height"] },
    statement:
      "Each element of height is the height of a wall of width 1. After it rains, water collects between the walls. Return how many units of water are trapped.",
    constraints: ["1 ≤ height.length ≤ 200,000", "0 ≤ height[i] ≤ 100,000"],
    examples: [
      { input: { nums: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }, explanation: "6 units are trapped." },
      { input: { nums: [4, 2, 0, 3, 2, 5] }, explanation: "9 units are trapped." },
    ],
    notes:
      "Water above i = min(maxLeft(i), maxRight(i)) - height[i]. Good: prefix/suffix max arrays, O(n) time and space. Optimal: two pointers moving the side with the smaller max, O(1) space. Monotonic stack also O(n). Brute force recomputing maxes per index is O(n^2) and fails performance. Pitfalls: counting water at the edges, int overflow (sum up to 2e10 — needs long). Hint ladder: (1) For a single position, what decides how much water sits on it? (2) Can you precompute those values? (3) Do you need both arrays at once?",
    solve: (i) => {
      const h = (i as Arr).nums;
      let l = 0;
      let r = h.length - 1;
      let lm = 0;
      let rm = 0;
      let w = 0;
      while (l < r) {
        if (h[l] < h[r]) {
          lm = Math.max(lm, h[l]);
          w += lm - h[l++];
        } else {
          rm = Math.max(rm, h[r]);
          w += rm - h[r--];
        }
      }
      return w;
    },
    tests: () => {
      const r = rng(111);
      const valley = Array.from({ length: PERF_N }, (_, j) => (j === 0 || j === PERF_N - 1 ? 100000 : 0));
      return [
        { name: "single wall", input: { nums: [5] }, hidden: true },
        { name: "rising", input: { nums: [1, 2, 3, 4] }, hidden: true },
        { name: "v shape", input: { nums: [3, 0, 3] }, hidden: true },
        { name: "plateau", input: { nums: [2, 2, 2] }, hidden: true },
        ...Array.from({ length: 6 }, (_, j) => ({ name: `random ${j + 1}`, input: { nums: randArr(r, randInt(r, 2, 60), 0, 20) }, hidden: true })),
        { name: "overflow (deep valley)", input: { nums: valley }, hidden: true, perf: true },
        { name: "performance", input: { nums: randArr(r, PERF_N, 0, 100000) }, hidden: true, perf: true },
      ];
    },
  },
  {
    id: "window-max",
    title: "Moving Window Maximum",
    difficulty: "Hard",
    shape: "arr_int_arr",
    sig: { fn: "maxSlidingWindow", params: ["nums", "k"] },
    statement:
      "Given an array nums and a window size k, a window of size k slides from the left of the array to the right, one position at a time. Return the maximum of each window, in order.",
    constraints: ["1 ≤ k ≤ nums.length ≤ 200,000", "-10^4 ≤ nums[i] ≤ 10^4"],
    examples: [
      { input: { nums: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 }, explanation: "Windows: [1,3,-1]→3, [3,-1,-3]→3, [-1,-3,5]→5, [-3,5,3]→5, [5,3,6]→6, [3,6,7]→7." },
      { input: { nums: [9], k: 1 } },
    ],
    notes:
      "Optimal: monotonic deque of indices with decreasing values; pop from the back while smaller than the new value, pop from the front when it leaves the window. O(n) time. A heap with lazy deletion is O(n log n) and acceptable. Brute force O(nk) fails performance for large k. Pitfalls: storing values instead of indices (can't tell when the max leaves the window), off-by-one on when to start emitting. Hint ladder: (1) Once a bigger number enters the window, can any smaller number before it ever be the max again? (2) What structure lets you drop from both ends?",
    solve: (i) => {
      const { nums, k } = i as ArrK;
      const dq: number[] = [];
      let head = 0;
      const out: number[] = [];
      for (let j = 0; j < nums.length; j++) {
        while (dq.length > head && nums[dq[dq.length - 1]] <= nums[j]) dq.pop();
        dq.push(j);
        if (dq[head] <= j - k) head++;
        if (j >= k - 1) out.push(nums[dq[head]]);
      }
      return out;
    },
    tests: () => {
      const r = rng(122);
      const desc = Array.from({ length: PERF_N }, (_, j) => 10000 - (j % 20000));
      return [
        { name: "k equals n", input: { nums: [4, 2, 12, 3], k: 4 }, hidden: true },
        { name: "k is 1", input: { nums: [4, -2, 7], k: 1 }, hidden: true },
        { name: "decreasing", input: { nums: [9, 8, 7, 6, 5], k: 2 }, hidden: true },
        { name: "duplicates", input: { nums: [2, 2, 2, 1, 2], k: 3 }, hidden: true },
        ...Array.from({ length: 6 }, (_, j) => {
          const n = randInt(r, 1, 50);
          return { name: `random ${j + 1}`, input: { nums: randArr(r, n, -20, 20), k: randInt(r, 1, n) }, hidden: true };
        }),
        { name: "performance (large k)", input: { nums: desc, k: 100000 }, hidden: true, perf: true },
        { name: "performance", input: { nums: randArr(r, PERF_N, -10000, 10000), k: 5000 }, hidden: true, perf: true },
      ];
    },
  },
];

export const LANGS: Lang[] = ["java", "python", "cpp", "javascript"];

export function getProblem(id: string | undefined) {
  return PROBLEMS.find((p) => p.id === id);
}

export function pickProblem(difficulty: Difficulty, exclude: string[]) {
  const pool = PROBLEMS.filter((p) => p.difficulty === difficulty);
  const fresh = pool.filter((p) => !exclude.includes(p.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/** What the browser needs to show the problem. No hidden tests or notes. */
export function publicProblem(p: Problem, lang: Lang) {
  return {
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    statement: p.statement,
    constraints: p.constraints,
    examples: p.examples.map((e) => ({
      input: describeInput(p.shape, p.sig, e.input),
      output: formatOutput(p.shape, p.solve(e.input)).replace(/\n/g, ", "),
      explanation: e.explanation,
    })),
    starter: starterCode(p.shape, p.sig, lang),
  };
}
export type PublicProblem = ReturnType<typeof publicProblem>;

export function exampleCases(p: Problem): TestCase[] {
  return p.examples.map((e, i) => ({ name: `Example ${i + 1}`, input: e.input, hidden: false }));
}

export { serialize, formatOutput, describeInput, starterCode };
