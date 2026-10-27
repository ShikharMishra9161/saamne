// Quick connectivity check: npx tsx --env-file=.env.local scripts/check-gemini.mts
import { GoogleGenAI } from "@google/genai";

const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const timer = setTimeout(() => {
  console.log("TIMEOUT: no reply from Gemini after 30s");
  process.exit(1);
}, 30000);
const t0 = Date.now();
try {
  const stream = await ai.interactions.create({ model, input: "Say hello in five words.", stream: true, store: true, generation_config: { thinking_level: "low" } });
  let text = "";
  for await (const ev of stream) {
    if (ev.event_type === "step.delta" && ev.delta.type === "text") text += ev.delta.text;
    if (ev.event_type === "error") console.log("STREAM ERROR:", JSON.stringify(ev.error));
  }
  console.log(`OK (${model}, ${Date.now() - t0} ms):`, text);
} catch (err) {
  const e = err as { status?: number; message?: string };
  console.log("FAILED:", e.status, (e.message ?? String(err)).slice(0, 600));
}
clearTimeout(timer);
