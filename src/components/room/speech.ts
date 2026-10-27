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

// ------------------------------------------------------------------ speaker

/**
 * Queues sentences for speech one at a time, so the interviewer starts talking as
 * soon as the first sentence has streamed in. Reports a rough mouth level.
 */
export class Speaker {
  private queue: string[] = [];
  private speaking = false;
  private idleWaiters: (() => void)[] = [];
  voice: SpeechSynthesisVoice | null = null;
  rate = 1.02;
  onSentence: (s: string | null) => void = () => {};
  onLevel: (level: number) => void = () => {};
  private levelTimer: ReturnType<typeof setInterval> | null = null;

  say(sentence: string) {
    const s = sentence.trim();
    if (!s) return;
    this.queue.push(s);
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
    window.speechSynthesis.cancel();
    this.finish();
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
    const u = new SpeechSynthesisUtterance(s);
    if (this.voice) {
      u.voice = this.voice;
      u.lang = this.voice.lang;
    }
    u.rate = this.rate;
    const bump = this.startLevel();
    u.onboundary = () => bump();
    u.onstart = () => this.onSentence(s);
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      this.stopLevel();
      this.next();
    };
    u.onend = end;
    u.onerror = end;
    // Safety net if the browser never fires onend (sentences are short, so a stall is a bug).
    setTimeout(end, 2500 + s.length * 90);
    window.speechSynthesis.speak(u);
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
