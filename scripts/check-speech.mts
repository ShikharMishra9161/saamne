// Sanity checks for turn-taking helpers: npx tsx scripts/check-speech.mts
import { isEcho, soundsLikeQuestion, soundsUnfinished } from "../src/components/room/speech";

const said = "So the idea is to keep the minimum price seen so far and compute the profit at each day.";
const cases: [string, boolean, boolean][] = [
  // [text, expected, actual]
  ["echo of interviewer", true, isEcho("keep the minimum price seen so far", said)],
  ["candidate talking over", false, isEcho("wait I have a doubt about the input", said)],
  ["trailing 'and'", true, soundsUnfinished("I will first initialise the hash map and")],
  ["trailing 'so um'", true, soundsUnfinished("okay so um")],
  ["complete sentence", false, soundsUnfinished("I will use a hash map for lookups")],
  ["question 'can I'", true, soundsLikeQuestion("can I use extra space here")],
  ["question 'is that okay'", true, soundsLikeQuestion("I'll sort first, is that okay")],
  ["thinking aloud", false, soundsLikeQuestion("now I loop over the array and update the minimum")],
];
let bad = 0;
for (const [name, want, got] of cases) {
  if (want !== got) bad++;
  console.log(want === got ? "ok  " : "FAIL", name);
}
process.exit(bad ? 1 : 0);
