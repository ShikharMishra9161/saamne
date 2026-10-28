// Live check of the Gemini layer: npx tsx --env-file=.env.local scripts/check-flow.mts
import { z } from "zod";
import { generateJson, LIVE_MODELS, MODELS, streamTurn, type ChatTurn } from "../src/lib/llm";

const system = "You are Arjun, a friendly interviewer on a voice call. Reply in one or two short spoken sentences.";
console.log("live:", LIVE_MODELS.join(" -> "), "| reports:", MODELS.join(" -> "));
const history: ChatTurn[] = [];
for (const said of ["Hi, my name is Shikhar and I like Java.", "What was my name and favourite language?"]) {
  const t0 = Date.now();
  let first = 0;
  const input = `<said>${said}</said>`;
  const r = await streamTurn({ system, history, input, thinking: "low", onText: () => (first ||= Date.now() - t0) });
  history.push({ role: "user", text: input }, { role: "model", text: r.text });
  console.log(`[${r.model}] first words ${first} ms, done ${Date.now() - t0} ms:`, r.text);
}
const t1 = Date.now();
const out = await generateJson({
  schema: z.object({ score: z.number().nullable(), strengths: z.array(z.object({ title: z.string(), quote: z.string() })) }),
  text: 'Candidate said: "I used a hash map so lookups are O(1)". Give a score 0-100 and one strength with a verbatim quote.',
  thinking: "low",
});
console.log(`json ${Date.now() - t1} ms:`, JSON.stringify(out));

// Cancelling a turn (the candidate kept talking) must stop it cleanly.
const ac = new AbortController();
setTimeout(() => ac.abort(), 150);
const t2 = Date.now();
try {
  await streamTurn({ system, history, input: "<said>Tell me a long story.</said>", thinking: "low", onText: () => {}, signal: ac.signal });
  console.log("cancel: NOT cancelled");
} catch (e) {
  console.log(`cancel: ${(e as Error).constructor.name} after ${Date.now() - t2} ms`);
}
