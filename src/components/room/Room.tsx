"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Persona } from "@/lib/personas";
import type { PublicProblem } from "@/lib/problems";
import type { Lang, Round, RunResult, TranscriptEntry } from "@/lib/types";
import { Avatar, type AvatarState } from "./Avatar";
import { CodePanel } from "./CodePanel";
import { englishVoices, Listener, pickVoice, Speaker, speechRecognitionSupported, takeSentences } from "./speech";

interface RoomData {
  id: string;
  round: Round;
  difficulty: string;
  language: Lang | null;
  durationMin: number;
  status: string;
  started: boolean;
  elapsed: number;
  persona: Persona;
  candidateName: string;
  problem: PublicProblem | null;
  problemShown: boolean;
  code: string | null;
  transcript: TranscriptEntry[];
  lastRun: RunResult | null;
}

type Phase = "loading" | "lobby" | "thinking" | "speaking" | "listening" | "ending" | "error";

const TOKENS = /\[\[(SHOW_PROBLEM|LISTEN|END|ERROR|RATE_LIMIT)\]\]/g;
const SILENCE_MS = { talk: 1900, coding: 3200 };

function speakable(full: string, final: boolean) {
  let s = full.replace(TOKENS, "");
  if (!final) {
    const open = s.lastIndexOf("[[");
    if (open >= 0 && s.indexOf("]]", open) < 0) s = s.slice(0, open);
  }
  return s;
}

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Room({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<RoomData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [caption, setCaption] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [problemShown, setProblemShown] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState<"run" | "submit" | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [camError, setCamError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [typed, setTyped] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [sttOk, setSttOk] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const speakerRef = useRef<Speaker | null>(null);
  const listenerRef = useRef<Listener | null>(null);
  const codeRef = useRef("");
  const finalBuf = useRef("");
  const interimBuf = useRef("");
  const lastActivity = useRef(0);
  const lastEdit = useRef(0);
  const lastInterviewerEnd = useRef(0);
  const busy = useRef(false);
  const queuedSaid = useRef<string | null>(null);
  const nudged = useRef(false);
  const timeUpSent = useRef(false);
  const ending = useRef(false);
  const mutedRef = useRef(false);
  const phaseRef = useRef<Phase>("loading");
  const problemShownRef = useRef(false);
  const clockStart = useRef(0);
  const durationRef = useRef(30);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // ------------------------------------------------------------- load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/interviews/${id}`);
      if (!res.ok) {
        setNotice((await res.json()).error ?? "Couldn't load this interview.");
        setPhaseBoth("error");
        return;
      }
      const d: RoomData = await res.json();
      if (cancelled) return;
      if (d.status !== "live") {
        router.replace(`/report/${id}`);
        return;
      }
      setData(d);
      setTranscript(d.transcript);
      setProblemShown(d.problemShown);
      problemShownRef.current = d.problemShown;
      setRunResult(d.lastRun);
      codeRef.current = d.code ?? d.problem?.starter ?? "";
      durationRef.current = d.durationMin;
      setElapsed(d.elapsed);
      setSttOk(speechRecognitionSupported());
      setPhaseBoth("lobby");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router, setPhaseBoth]);

  // ------------------------------------------------------------- voices
  useEffect(() => {
    if (!data || typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      const v = englishVoices();
      setVoices(v);
      setVoiceName((cur) => cur || pickVoice(v, data.persona.gender)?.name || "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [data]);

  // ------------------------------------------------------------- camera + mic level
  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
      mediaRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!audioCtxRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const b of buf) sum += (b - 128) ** 2;
        setMicLevel(Math.min(1, Math.sqrt(sum / buf.length) / 30));
        requestAnimationFrame(tick);
      };
      tick();
      setCamError("");
    } catch {
      setCamError("Camera or microphone access was blocked. Allow it in the address bar, or continue and type your answers.");
    }
  }, []);

  useEffect(() => {
    if (phase !== "lobby" || mediaRef.current) return;
    // Media must start after the lobby has rendered its <video>.
    const t = setTimeout(startMedia, 0);
    return () => clearTimeout(t);
  }, [phase, startMedia]);

  // keep the <video> attached when the layout moves it
  useEffect(() => {
    if (videoRef.current && mediaRef.current && videoRef.current.srcObject !== mediaRef.current) {
      videoRef.current.srcObject = mediaRef.current;
    }
  });

  useEffect(() => {
    mediaRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);

  const stopEverything = useCallback(() => {
    listenerRef.current?.stop();
    speakerRef.current?.cancel();
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  useEffect(() => stopEverything, [stopEverything]);

  // ------------------------------------------------------------- listening
  const startListening = useCallback(() => {
    finalBuf.current = "";
    interimBuf.current = "";
    setHeard("");
    lastActivity.current = Date.now();
    nudged.current = false;
    if (!mutedRef.current) listenerRef.current?.start();
    setPhaseBoth("listening");
  }, [setPhaseBoth]);

  const stopListening = useCallback(() => {
    listenerRef.current?.stop();
  }, []);

  // ------------------------------------------------------------- one turn
  const finishRef = useRef<() => void>(() => {});

  const sendTurn = useCallback(
    async (body: { said?: string; event?: string }) => {
      if (ending.current) return;
      if (busy.current) {
        if (body.said) queuedSaid.current = [queuedSaid.current, body.said].filter(Boolean).join(" ");
        return;
      }
      busy.current = true;
      stopListening();
      setPhaseBoth("thinking");
      setHeard("");
      const at = Math.round((Date.now() - clockStart.current) / 1000);
      if (body.said) {
        setTranscript((t) => [...t, { role: "candidate", text: body.said!, at, whileCoding: problemShownRef.current || undefined }]);
      }

      let full = "";
      let queuedUpTo = 0;
      const speaker = speakerRef.current!;
      const flush = (final: boolean) => {
        if (full.includes("[[SHOW_PROBLEM]]") && !problemShownRef.current) {
          problemShownRef.current = true;
          setProblemShown(true);
        }
        const clean = speakable(full, final);
        const pending = clean.slice(queuedUpTo);
        const { sentences, rest } = final ? { sentences: [pending], rest: "" } : takeSentences(pending);
        for (const s of sentences) {
          if (s.trim()) {
            speaker.say(s);
            setPhaseBoth("speaking");
          }
        }
        queuedUpTo = clean.length - rest.length;
      };

      try {
        const res = await fetch(`/api/interviews/${id}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, code: data?.round === "technical" ? codeRef.current : undefined }),
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "The interviewer couldn't respond." }));
          throw new Error(err.error);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += dec.decode(value, { stream: true });
          flush(false);
        }
        flush(true);
        if (full.includes("[[RATE_LIMIT]]")) {
          setNotice("The free AI limit was reached for the moment. Wait about a minute, then keep talking; nothing you said is lost.");
        } else if (full.includes("[[ERROR]]")) {
          setNotice("The interviewer's connection dropped for a moment. Keep going; what you said will reach them with your next answer.");
        } else {
          setNotice(null);
        }
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Connection problem. Please try again.");
      }

      const spoken = speakable(full, true).trim();
      if (spoken) {
        setTranscript((t) => [...t, { role: "interviewer", text: spoken, at: Math.round((Date.now() - clockStart.current) / 1000) }]);
      }
      await speaker.idle();
      lastInterviewerEnd.current = Date.now();
      busy.current = false;
      if (full.includes("[[END]]")) {
        finishRef.current();
        return;
      }
      if (ending.current) return;
      startListening();
      if (queuedSaid.current) {
        const said = queuedSaid.current;
        queuedSaid.current = null;
        sendTurn({ said });
      }
    },
    [id, data?.round, setPhaseBoth, startListening, stopListening],
  );

  const submitSpeech = useCallback(() => {
    const said = `${finalBuf.current} ${interimBuf.current}`.replace(/\s+/g, " ").trim();
    finalBuf.current = "";
    interimBuf.current = "";
    setHeard("");
    if (said) sendTurn({ said });
  }, [sendTurn]);

  // ------------------------------------------------------------- finish
  const finish = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    setConfirmEnd(false);
    setPhaseBoth("ending");
    stopEverything();
    await fetch(`/api/interviews/${id}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: data?.round === "technical" ? codeRef.current : undefined }),
    }).catch(() => {});
    router.push(`/report/${id}`);
  }, [id, data?.round, router, setPhaseBoth, stopEverything]);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  // ------------------------------------------------------------- join
  const join = useCallback(() => {
    if (!data) return;
    const speaker = new Speaker();
    speaker.voice = voices.find((v) => v.name === voiceName) ?? null;
    speaker.onSentence = setCaption;
    speaker.onLevel = setLevel;
    speakerRef.current = speaker;
    // Unlock speech synthesis inside this click.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));

    listenerRef.current = new Listener({
      onFinal: (t) => {
        finalBuf.current = `${finalBuf.current} ${t}`.trim();
        setHeard(finalBuf.current);
      },
      onInterim: (t) => {
        interimBuf.current = t;
        setHeard(`${finalBuf.current} ${t}`.trim());
      },
      onActivity: () => {
        lastActivity.current = Date.now();
        nudged.current = false;
      },
      onError: (kind, message) => {
        if (kind === "blocked") setSttOk(false);
        setNotice(message);
      },
    });

    clockStart.current = Date.now() - data.elapsed * 1000;
    sendTurn({
      event: data.started
        ? "The candidate reconnected to the call after a drop. Briefly acknowledge it and continue where you left off."
        : `The candidate has joined the call${mediaRef.current && camOn ? " with their camera on" : ""}.`,
    });
  }, [data, voices, voiceName, sendTurn, camOn]);

  // ------------------------------------------------------------- timers
  useEffect(() => {
    if (phase === "loading" || phase === "lobby" || phase === "ending" || phase === "error") return;
    const t = setInterval(() => {
      const now = Date.now();
      const el = (now - clockStart.current) / 1000;
      setElapsed(el);
      const limit = durationRef.current * 60;
      if (el > limit + 360) {
        finishRef.current();
        return;
      }
      if (phaseRef.current !== "listening" || busy.current) return;

      // End of a spoken answer: a pause after some speech.
      const hasSpeech = Boolean(finalBuf.current || interimBuf.current);
      const threshold = problemShownRef.current ? SILENCE_MS.coding : SILENCE_MS.talk;
      if (hasSpeech && now - lastActivity.current > threshold) {
        submitSpeech();
        return;
      }
      if (el > limit + 90 && !timeUpSent.current) {
        timeUpSent.current = true;
        sendTurn({ event: "Time is up. Close the interview now: thank the candidate and say goodbye." });
        return;
      }
      // Long silences: a real interviewer would check in.
      const quietFor = (now - Math.max(lastActivity.current, lastInterviewerEnd.current)) / 1000;
      if (!hasSpeech && !nudged.current && !mutedRef.current) {
        if (problemShownRef.current && quietFor > 90) {
          nudged.current = true;
          const editing = now - lastEdit.current < 30_000;
          sendTurn({
            event: `The candidate has been quiet for ${Math.round(quietFor)} seconds${editing ? " but is actively editing the code" : " and hasn't edited the code in the last 30 seconds"}.`,
          });
        } else if (!problemShownRef.current && quietFor > 30) {
          nudged.current = true;
          sendTurn({ event: `The candidate has been silent for ${Math.round(quietFor)} seconds since you last spoke.` });
        }
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase, sendTurn, submitSpeech]);

  useEffect(() => {
    if (phase === "lobby" || phase === "loading" || phase === "ending" || phase === "error") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  // ------------------------------------------------------------- code
  const runCode = useCallback(
    async (kind: "run" | "submit") => {
      setRunning(kind);
      try {
        const res = await fetch(`/api/interviews/${id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: codeRef.current, kind }),
        });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error);
        setRunResult(r);
        if (kind === "submit" && !busy.current) {
          // Pending speech is folded into the same turn.
          const said = `${finalBuf.current} ${interimBuf.current}`.replace(/\s+/g, " ").trim();
          finalBuf.current = "";
          interimBuf.current = "";
          sendTurn({ event: "The candidate submitted their code; the results are above.", said: said || undefined });
        }
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Couldn't run the code.");
      } finally {
        setRunning(null);
      }
    },
    [id, sendTurn],
  );

  // ------------------------------------------------------------- render
  if (phase === "loading") {
    return <div className="grid flex-1 place-items-center text-paper-dim">Setting up the room…</div>;
  }
  if (phase === "error" || !data) {
    return <div className="grid flex-1 place-items-center text-bad">{notice}</div>;
  }

  const persona = data.persona;
  const first = data.candidateName.split(/\s+/)[0];
  const avatarState: AvatarState =
    phase === "speaking" ? "speaking" : phase === "thinking" ? "thinking" : phase === "listening" ? "listening" : "idle";
  const remaining = data.durationMin * 60 - elapsed;

  const selfTile = (small: boolean) => (
    <div
      className={`relative overflow-hidden rounded-2xl bg-ink-800 ${small ? "aspect-[4/3]" : "aspect-[4/3]"}`}
      style={{ boxShadow: micLevel > 0.15 && phase === "listening" && !muted ? `0 0 0 ${2 + micLevel * 4}px rgba(94,196,182,0.7)` : undefined }}
    >
      <video ref={videoRef} autoPlay muted playsInline className={`h-full w-full -scale-x-100 object-cover ${camOn && !camError ? "" : "invisible"}`} />
      {(!camOn || camError) && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-ink-600 font-display text-3xl">{first[0]}</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-xs">
        {first} (you){muted ? " · muted" : ""}
      </span>
    </div>
  );

  if (phase === "lobby") {
    return (
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-5 py-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          {selfTile(false)}
          <div className="mt-3 flex items-center gap-3 text-sm text-paper-dim">
            <span>Mic</span>
            <span className="h-2 flex-1 rounded-full bg-white/[0.07]">
              <span className="block h-full rounded-full bg-teal transition-[width]" style={{ width: `${Math.round(micLevel * 100)}%` }} />
            </span>
            <button className="text-amber" onClick={() => setCamOn((c) => !c)}>
              {camOn ? "Turn camera off" : "Turn camera on"}
            </button>
          </div>
          {camError && <p className="mt-3 text-sm text-bad">{camError}</p>}
        </div>
        <div>
          {persona.photo && (
            // eslint-disable-next-line @next/next/no-img-element -- local portrait
            <img
              src={persona.photo}
              alt={persona.name}
              className="mb-5 h-20 w-20 rounded-full object-cover object-[50%_28%] ring-2 ring-amber/50"
            />
          )}
          <div className="eyebrow">Waiting room</div>
          <h1 className="mt-3 font-display text-4xl leading-tight">
            {persona.name} is ready for you.
          </h1>
          <p className="mt-2 text-paper-dim">
            {persona.title} · {data.durationMin} minutes ·{" "}
            {data.round === "technical" ? `${data.difficulty} coding in ${data.language && { java: "Java", python: "Python", cpp: "C++", javascript: "JavaScript" }[data.language]}` : data.round === "resume" ? "Resume deep dive" : "Behavioral"}
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-paper-dim">
            <li>🎧 Use headphones so the interviewer doesn&apos;t hear themselves.</li>
            <li>🗣️ Speak naturally. When you finish a thought, pause for about two seconds and they&apos;ll respond.</li>
            <li>💭 Think out loud, especially while coding. Silence is the most common reason for a low score.</li>
            <li>⌨️ You can also type an answer at any time.</li>
          </ul>
          {!sttOk && (
            <p className="mt-5 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
              This browser can&apos;t transcribe speech. Use Chrome or Edge for the voice interview, or continue and type your
              answers.
            </p>
          )}
          <label className="mt-6 block text-sm">
            <span className="text-paper-dim">Interviewer voice</span>
            <div className="mt-1.5 flex gap-2">
              <select className="input !py-2" value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                className="btn btn-ghost !py-2"
                onClick={() => {
                  const u = new SpeechSynthesisUtterance(`Hi ${first}, I'm ${persona.name.split(" ")[0]}. Can you hear me clearly?`);
                  const v = voices.find((x) => x.name === voiceName);
                  if (v) u.voice = v;
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(u);
                }}
              >
                Test
              </button>
            </div>
          </label>
          <button className="btn btn-primary mt-7 w-full !py-3.5 text-lg" onClick={join}>
            {data.started ? "Rejoin the call" : "Join the call"}
          </button>
        </div>
      </div>
    );
  }

  const status =
    phase === "speaking"
      ? `${persona.name.split(" ")[0]} is speaking`
      : phase === "thinking"
        ? `${persona.name.split(" ")[0]} is thinking…`
        : phase === "ending"
          ? "Ending the call…"
          : muted
            ? "You're muted"
            : "Listening";

  const interviewerTile = (
    <div className="relative overflow-hidden rounded-2xl bg-ink-800">
      <div className={problemShown ? "aspect-[4/3]" : "aspect-video"}>
        <Avatar persona={persona} state={avatarState} level={level} />
      </div>
      <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-0.5 text-xs">
        {persona.name} · {persona.title}
      </span>
      {caption && !problemShown && (
        <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-4 py-2.5 text-center text-[15px] leading-snug backdrop-blur-sm">
          {caption}
        </div>
      )}
    </div>
  );
  // In the coding layout the tile is small, so captions sit below it instead of over the face.
  const sideCaption = problemShown && caption && (
    <div className="rounded-2xl border border-amber/20 bg-ink-900 px-4 py-3 text-sm leading-snug">
      <span className="mb-0.5 block text-xs font-semibold text-amber">{persona.name.split(" ")[0]}</span>
      {caption}
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* top bar */}
      <div className="flex items-center gap-4 border-b border-white/5 px-5 py-3">
        <span className="font-display text-xl">
          Saamne<span className="text-amber">.</span>
        </span>
        <span className="hidden text-sm text-muted sm:inline">
          {data.round === "technical" ? "Technical round" : data.round === "resume" ? "Resume deep dive" : "Behavioral round"}
        </span>
        <span className="ml-auto flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${phase === "listening" && !muted ? "bg-teal" : phase === "speaking" ? "bg-amber" : "bg-muted"}`}
          />
          {status}
        </span>
        <span className={`rounded-full px-3 py-1 font-mono text-sm tabular-nums ${remaining < 300 ? "bg-bad/15 text-bad" : "bg-white/[0.06]"}`}>
          {clock(elapsed)} / {data.durationMin}:00
        </span>
        <button className="text-sm text-paper-dim hover:text-paper" onClick={() => setShowTranscript((s) => !s)}>
          Transcript
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-4 bg-warn/10 px-5 py-2 text-sm text-warn">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* stage */}
      <div className="relative flex min-h-0 flex-1 gap-4 p-4">
        {problemShown && data.problem ? (
          <>
            <div className="flex w-[300px] shrink-0 flex-col gap-3">
              {interviewerTile}
              {sideCaption}
              {selfTile(true)}
              <HeardBox text={heard} phase={phase} />
            </div>
            <div className="min-w-0 flex-1">
              <CodePanel
                problem={data.problem}
                language={data.language!}
                initialCode={codeRef.current}
                onChange={(c) => {
                  codeRef.current = c;
                  lastEdit.current = Date.now();
                }}
                onRun={runCode}
                running={running}
                result={runResult}
              />
            </div>
          </>
        ) : (
          <div className="m-auto grid w-full max-w-6xl items-center gap-4 lg:grid-cols-[1.6fr_1fr]">
            {interviewerTile}
            <div className="flex flex-col gap-3">
              {selfTile(false)}
              <HeardBox text={heard} phase={phase} />
            </div>
          </div>
        )}

        {showTranscript && (
          <aside className="absolute bottom-4 right-4 top-4 z-20 flex w-[360px] flex-col rounded-2xl border border-white/10 bg-ink-900/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <b>Transcript</b>
              <button onClick={() => setShowTranscript(false)} aria-label="Close transcript">
                ✕
              </button>
            </div>
            <ol className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              {transcript.map((t, i) => (
                <li key={i}>
                  <span className={`text-xs font-semibold ${t.role === "interviewer" ? "text-amber" : "text-teal"}`}>
                    {t.role === "interviewer" ? persona.name.split(" ")[0] : "You"} · {clock(t.at)}
                  </span>
                  <p className="text-paper-dim">{t.text}</p>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-3 border-t border-white/5 px-5 py-3">
        <button
          className={`btn !px-4 !py-2 ${muted ? "bg-bad/20 text-bad" : "btn-ghost"}`}
          onClick={() => {
            const m = !muted;
            setMuted(m);
            mutedRef.current = m;
            if (m) {
              listenerRef.current?.stop();
              finalBuf.current = "";
              interimBuf.current = "";
              setHeard("");
            } else if (phaseRef.current === "listening") listenerRef.current?.start();
          }}
          aria-pressed={muted}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button className="btn btn-ghost !px-4 !py-2" onClick={() => setCamOn((c) => !c)} aria-pressed={!camOn}>
          {camOn ? "Camera off" : "Camera on"}
        </button>
        {phase === "speaking" && (
          <button className="btn btn-ghost !px-4 !py-2" onClick={() => speakerRef.current?.cancel()}>
            Interrupt
          </button>
        )}
        {phase === "listening" && heard && (
          <button className="btn btn-ghost !px-4 !py-2" onClick={submitSpeech}>
            I&apos;m done ↵
          </button>
        )}
        <form
          className="flex min-w-[220px] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = typed.trim();
            if (!t || phase === "ending") return;
            setTyped("");
            const pending = `${finalBuf.current} ${interimBuf.current}`.replace(/\s+/g, " ").trim();
            finalBuf.current = "";
            interimBuf.current = "";
            sendTurn({ said: pending ? `${pending} ${t}` : t });
          }}
        >
          <input
            className="input !rounded-full !py-2"
            placeholder={sttOk ? "Or type your answer…" : "Type your answer and press Enter…"}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </form>
        <button className="btn bg-bad !px-5 !py-2 text-white hover:bg-bad/90" onClick={() => setConfirmEnd(true)} disabled={phase === "ending"}>
          End interview
        </button>
      </div>

      {confirmEnd && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-5" role="dialog" aria-modal>
          <div className="card w-full max-w-md bg-ink-900 p-7">
            <h2 className="font-display text-3xl">End the interview?</h2>
            <p className="mt-3 text-paper-dim">
              {problemShown ? "Your current code will be tested and " : "Y"}
              {problemShown ? "y" : ""}ou&apos;ll get your report in about a minute. Very short calls aren&apos;t scored and
              the interview is refunded.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn btn-ghost" onClick={() => setConfirmEnd(false)}>
                Keep going
              </button>
              <button className="btn bg-bad text-white" onClick={finish}>
                End and get report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeardBox({ text, phase }: { text: string; phase: Phase }) {
  return (
    <div className="min-h-[72px] rounded-2xl border border-white/5 bg-ink-900 px-4 py-3 text-sm">
      {text ? (
        <p className="text-paper">{text}</p>
      ) : (
        <p className="text-muted">
          {phase === "listening" ? "Speak whenever you're ready…" : phase === "thinking" ? "…" : "Your words will appear here as you speak."}
        </p>
      )}
    </div>
  );
}
