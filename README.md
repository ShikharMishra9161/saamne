# Saamne — face-to-face interview practice

Practise real interviews out loud with an AI interviewer (Google Gemini, free tier), on camera, then get an evidence-based report.

## Run it

1. Get a free key at https://aistudio.google.com/apikey and put it in `.env.local`:
   ```
   GEMINI_API_KEY=...
   ```
   On the free tier Google may use what you send (transcripts, code, resume) to improve its products, and there are daily request limits.
2. Install and start:
   ```
   npm install
   npm run dev
   ```
3. Open http://localhost:3000 in **Chrome or Edge** (they have the speech recognition the voice call needs). Use headphones.

Requirements for the coding round: `javac`/`java`, `python`, `g++` and `node` on your PATH (the runner compiles and runs code locally).

## What's in it

- **Three rounds.** Technical (live coding + explanation), Resume Deep Dive (questions about your own projects), Behavioral (STAR follow-ups). Each has its own interviewer persona and rubric.
- **The call.** Speech-to-text listens and decides when you've finished a thought; the interviewer's reply streams back and is spoken sentence by sentence while an illustrated interviewer lip-syncs. The interviewer stays silent while you think aloud during coding, checks in after long silences, gives hints one rung at a time, and manages the clock. You can always type instead of speaking.
- **Real code execution.** 11 problems (Easy/Medium/Hard), starter code in Java, Python, C++ and JavaScript, seeded hidden tests plus performance tests that catch brute force. Correctness in the report comes from the tests, never from the model.
- **The report.** Score, hire signal, dimension radar with change since last time, strengths and weaknesses quoting what you actually said or wrote, how to improve, what to prepare before a real interview, and the full transcript.
- **Progress.** Points, five ranks, leaderboard (first name + last initial, can opt out), skill balance across rounds, points journey.
- **Resume.** PDF upload, structured extraction used by the interviewers, and an ATS check.

## Where things live

| Path | What |
|---|---|
| `src/lib/prompts.ts` | Interviewer behaviour per round, and the report rubric |
| `src/lib/llm.ts` | Gemini client: streamed turns (full conversation resent each turn for speed), JSON output, automatic fallback when a model is busy |
| `src/lib/ai.ts` | Interviewer turns, report writing and resume reading, built on `llm.ts` |
| `src/lib/problems/` | Problem bank, reference solutions, test generators, starter-code templates |
| `src/lib/runner.ts` | Compiles and runs candidate code with time limits |
| `src/components/room/` | The live call: speech, avatar, code panel, turn-taking |
| `data/db.json` | Local data store (created on first run; delete it to reset) |

## Checks

```
npm run test:problems   # every reference answer agrees with an independent brute force
npm run test:runner     # every starter template compiles in all 4 languages; correct code passes, brute force fails perf
```

## Settings

- `GEMINI_LIVE_MODEL` (default `gemini-3.5-flash-lite`, first words in ~1.2 s) for the conversation, `GEMINI_MODEL` (default `gemini-3.8-flash`) for reports and resumes. If a model is busy the app switches to the other one automatically. Your free limits: https://aistudio.google.com/rate-limit.
- `FREE_INTERVIEWS` (default 5): interviews each new account starts with. Calls too short to score are refunded.
- The code runner executes code on this machine. That's fine for personal use; before letting other people use it, run code in a container or sandbox service.
