"use client";

// Browser speech: recognition (candidate → text) and synthesis (interviewer → voice).
// Recognition uses the Web Speech API, which Chrome and Edge support.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = any;

export function speechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export interface ListenerEvents {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onActivity: () => void;
  onError: (kind: "blocked" | "network" | "other", message: string) => void;
}

/** Continuous recognition that restarts itself until stopped. */
export class Listener {
  private rec: Rec | null = null;
  private active = false;
  constructor(private ev: ListenerEvents, private lang = "en-IN") {}

  start() {
    if (this.active) return;
    this.active = true;
    this.spawn();
  }

  stop() {
    this.active = false;
    try {
      this.rec?.abort();
    } catch {
      // already stopped
    }
    this.rec = null;
  }

  private spawn() {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec: Rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.ev.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      this.ev.onInterim(interim.trim());
      this.ev.onActivity();
    };
    rec.onspeechstart = () => this.ev.onActivity();
    rec.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.active = false;
        this.ev.onError("blocked", "Microphone access is blocked for this site.");
      } else if (e.error === "network") {
        this.ev.onError("network", "Speech recognition lost its connection. Retrying…");
      } else {
        this.ev.onError("other", `Speech recognition error: ${e.error}`);
      }
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      if (this.active) setTimeout(() => this.active && this.rec === rec && this.spawn(), 150);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      // start() throws if called twice; the onend handler will retry
    }
  }
}

// ------------------------------------------------------------------ voices

export function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

const FEMALE = /female|neerja|aria|jenny|sonia|libby|zira|samantha|karen|moira|tessa|veena|heera|swara|natasha|emma|ava|michelle/i;
const MALE = /\bmale\b|prabhat|guy|ryan|david|mark|daniel|alex|rishi|madhur|thomas|christopher|eric|andrew|brian|william/i;

/** Prefers natural (neural) Indian-English voices of the persona's gender. */
export function pickVoice(voices: SpeechSynthesisVoice[], gender: "female" | "male") {
  const want = gender === "female" ? FEMALE : MALE;
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 8 : 0) +
    (v.lang.toLowerCase() === "en-in" ? 4 : v.lang.toLowerCase() === "en-gb" ? 1 : 0) +
    (want.test(v.name) ? 6 : 0) +
    (/google/i.test(v.name) ? 2 : 0) -
    ((gender === "female" ? MALE : FEMALE).test(v.name) ? 6 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Best on-device voice: plainer than online ones, but it never stalls on the network. */
export function pickLocalVoice(voices: SpeechSynthesisVoice[], gender: "female" | "male") {
  return pickVoice(
    voices.filter((v) => v.localService),
    gender,
  );
}

// ------------------------------------------------------------------ turn-taking

const TRAILING = /\b(and|so|but|or|because|like|um+|uh+|hmm+|then|which|that|the|a|an|to|of|if|is|was|with|for|my|i|we|actually|basically)\s*$/i;
const ASKING =
  /\b(can you|could you|should i|shall i|do i|is it|is that|is this|are you|does it|what do you|how do i|am i|would it|did you|can i|okay\?|right\?)\b|\?\s*$/i;

/** Did the candidate stop mid-thought ("…and", "…so um")? Then wait longer. */
export function soundsUnfinished(text: string) {
  return TRAILING.test(text.trim());
}

/** Is the candidate asking the interviewer something (so they expect a reply)? */
export function soundsLikeQuestion(text: string) {
  return ASKING.test(text);
}

/**
 * Is what the mic heard just the interviewer's own voice coming back through the
 * speakers? Compares words with what was spoken in the last few seconds.
 */
export function isEcho(heard: string, recentlySpoken: string) {
  const words = heard.toLowerCase().match(/[a-z']+/g) ?? [];
  if (!words.length) return true;
  const spoken = new Set(recentlySpoken.toLowerCase().match(/[a-z']+/g) ?? []);
  const overlap = words.filter((w) => spoken.has(w)).length / words.length;
  return overlap >= 0.6;
}

// ------------------------------------------------------------------ speaker

/**
 * Queues sentences for speech one at a time, so the interviewer starts talking as
 * soon as the first sentence has streamed in. Reports a rough mouth level.
 */
/** Text-to-speech reads symbols literally, so drop formatting the model may add. */
function speakableText(s: string) {
  return s
    .replace(/[`*_#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Very long sentences make some voices stall; split them at a natural pause. */
function chunk(s: string, max = 180): string[] {
  if (s.length <= max) return [s];
  const cut = Math.max(s.lastIndexOf(", ", max), s.lastIndexOf("; ", max), s.lastIndexOf(" — ", max));
  const at = cut > 40 ? cut + 1 : s.lastIndexOf(" ", max);
  if (at <= 0) return [s];
  return [s.slice(0, at).trim(), ...chunk(s.slice(at).trim(), max)];
}

export class Speaker {
  private queue: string[] = [];
  private speaking = false;
  private idleWaiters: (() => void)[] = [];
  private stalls = 0;
  private generation = 0;
  voice: SpeechSynthesisVoice | null = null;
  /** An on-device voice to switch to if the chosen (online) voice keeps stalling. */
  fallbackVoice: SpeechSynthesisVoice | null = null;
  rate = 1.02;
  onSentence: (s: string | null) => void = () => {};
  onLevel: (level: number) => void = () => {};
  onVoiceSwitch: (v: SpeechSynthesisVoice) => void = () => {};
  private levelTimer: ReturnType<typeof setInterval> | null = null;

  say(sentence: string) {
    const s = speakableText(sentence);
    if (!s) return;
    this.queue.push(...chunk(s));
    if (!this.speaking) this.next();
  }

  get busy() {
    return this.speaking || this.queue.length > 0;
  }

  idle(): Promise<void> {
    if (!this.busy) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.push(r));
  }

  cancel() {
    this.queue = [];
    this.generation++;
    window.speechSynthesis.cancel();
    this.finish();
  }

  private stalled() {
    this.stalls++;
    if (this.stalls >= 2 && this.fallbackVoice && this.voice !== this.fallbackVoice) {
      this.voice = this.fallbackVoice;
      this.onVoiceSwitch(this.fallbackVoice);
    }
  }

  private finish() {
    this.speaking = false;
    this.stopLevel();
    this.onSentence(null);
    const w = this.idleWaiters;
    this.idleWaiters = [];
    w.forEach((f) => f());
  }

  private startLevel() {
    this.stopLevel();
    let boost = 0;
    this.levelTimer = setInterval(() => {
      boost = Math.max(0, boost - 0.15);
      this.onLevel(Math.min(1, 0.25 + Math.random() * 0.55 + boost));
    }, 90);
    return () => (boost = 0.6);
  }

  private stopLevel() {
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.levelTimer = null;
    this.onLevel(0);
  }

  private next() {
    const s = this.queue.shift();
    if (s === undefined) {
      this.finish();
      return;
    }
    this.speaking = true;
    const gen = this.generation;
    const synth = window.speechSynthesis;
    // Chrome sometimes keeps a dead utterance "speaking" forever; clear it first.
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(s);
    if (this.voice) {
      u.voice = this.voice;
      u.lang = this.voice.lang;
    }
    u.rate = this.rate;
    const bump = this.startLevel();
    u.onboundary = () => bump();
    let started = false;
    let done = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const end = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      this.stopLevel();
      if (gen === this.generation) this.next();
    };
    u.onstart = () => {
      started = true;
      this.onSentence(s);
    };
    u.onend = end;
    u.onerror = end;
    // Watchdogs. A voice that never starts: show the words for reading time and
    // move on. One that never finishes: stop it at a generous estimate.
    timers.push(
      setTimeout(() => {
        if (started || done) return;
        this.stalled();
        u.onend = u.onerror = null;
        synth.cancel();
        this.onSentence(s);
        timers.push(setTimeout(end, 600 + s.length * 45));
      }, 3000),
    );
    timers.push(
      setTimeout(() => {
        if (done) return;
        this.stalled();
        synth.cancel();
        end();
      }, 4000 + s.length * 110),
    );
    synth.speak(u);
  }
}

/** Splits streamed text into complete sentences, keeping the unfinished tail. */
export function takeSentences(text: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const re = /[^.!?]+[.!?]+["')\]]*(\s+|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // keep going if the match ends at the very end with no whitespace (may continue, e.g. "3.5")
    if (m.index + m[0].length === text.length && !/\s$/.test(m[0])) break;
    sentences.push(m[0].trim());
    last = m.index + m[0].length;
  }
  return { sentences, rest: text.slice(last) };
}
