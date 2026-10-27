"use client";

import { useEffect, useRef, useState } from "react";
import type { Persona } from "@/lib/personas";

export type AvatarState = "idle" | "speaking" | "listening" | "thinking";

/**
 * Illustrated interviewer. The mouth follows `level` (0–1) while speaking, the eyes
 * blink at random intervals, and the head drifts slightly so it never looks frozen.
 */
export function Avatar({ persona, state, level }: { persona: Persona; state: AvatarState; level: number }) {
  return persona.photo ? (
    <PhotoAvatar persona={persona} state={state} level={level} />
  ) : (
    <IllustratedAvatar persona={persona} state={state} level={level} />
  );
}

/**
 * A portrait shown the way a video call looks on a weak connection: the frame
 * drifts slightly as if hand-held, and the speaking ring and level bars follow
 * the interviewer's voice. No fake lip movement, which looks uncanny on a photo.
 */
function PhotoAvatar({ persona, state, level }: { persona: Persona; state: AvatarState; level: number }) {
  const speaking = state === "speaking";
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-800">
      {/* Portraits are tightly cropped, so show the whole frame centred over a
          blurred copy, the way calls show a phone held upright. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- local file of unknown size, shown as-is */}
      <img
        src={persona.photo}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl"
        draggable={false}
      />
      <div className="absolute inset-0" style={{ animation: "cam-drift 14s ease-in-out infinite" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local file of unknown size, shown as-is */}
        <img
          src={persona.photo}
          alt={`${persona.name}, ${persona.title}`}
          className="mx-auto h-full w-auto max-w-full object-contain"
          draggable={false}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.45) 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl transition-shadow duration-100"
        style={{ boxShadow: speaking ? `inset 0 0 0 ${2 + level * 3}px rgba(242,165,65,${0.55 + level * 0.4})` : "none" }}
      />
      <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center gap-[3px] rounded-full bg-black/55" aria-hidden>
        {[0.6, 1, 0.75].map((k, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-amber transition-[height] duration-100"
            style={{ height: speaking ? `${4 + level * 12 * k}px` : "4px", opacity: speaking ? 1 : 0.5 }}
          />
        ))}
      </div>
      {state === "thinking" && (
        <div className="absolute bottom-3 right-3 flex gap-1 rounded-full bg-black/55 px-2.5 py-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-paper" style={{ animation: `breathe 1s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      )}
    </div>
  );
}

function IllustratedAvatar({ persona, state, level }: { persona: Persona; state: AvatarState; level: number }) {
  const [blink, setBlink] = useState(false);
  const [drift, setDrift] = useState({ x: 0, y: 0, r: 0 });
  const t0 = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        loop();
      }, 2200 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let raf = 0;
    t0.current = performance.now();
    const tick = (now: number) => {
      const t = (now - t0.current) / 1000;
      const nod = state === "listening" ? Math.max(0, Math.sin(t * 2.2)) * 1.6 : 0;
      setDrift({
        x: Math.sin(t * 0.6) * 1.6,
        y: Math.sin(t * 0.9) * 1.1 + nod,
        r: Math.sin(t * 0.45) * 1.2 + (state === "thinking" ? -2.5 : 0),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const open = state === "speaking" ? 1.5 + level * 10 : 0;
  const eyeY = state === "thinking" ? -2 : 0;
  const eyeX = state === "thinking" ? 2.5 : 0;
  const male = persona.gender === "male";

  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={`${persona.name}, ${state}`}>
      <defs>
        <radialGradient id="room-bg" cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor="#3a3328" />
          <stop offset="1" stopColor="#15120e" />
        </radialGradient>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#room-bg)" />
      {/* soft, out-of-focus office behind */}
      <rect x="28" y="40" width="92" height="150" rx="6" fill="#4a4234" opacity="0.35" />
      <rect x="292" y="70" width="80" height="110" rx="6" fill="#2f4858" opacity="0.35" />
      <circle cx="320" cy="250" r="34" fill="#5e7d4f" opacity="0.18" />
      <rect x="0" y="330" width="400" height="70" fill="#0f0d0a" opacity="0.4" />

      <g transform={`translate(${drift.x} ${drift.y}) rotate(${drift.r} 200 230)`}>
        {/* shoulders */}
        <path d="M70 400 C80 320 130 292 200 292 C270 292 320 320 330 400 Z" fill={persona.shirt} />
        <path d="M70 400 C80 320 130 292 200 292 C270 292 320 320 330 400 Z" fill="url(#shade)" />
        {male ? (
          <path d="M176 292 L200 330 L224 292" fill="none" stroke="#e8e1d4" strokeWidth="6" strokeLinejoin="round" />
        ) : (
          <path d="M172 294 Q200 322 228 294" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="3" />
        )}
        {/* neck */}
        <path d="M180 250 L180 296 Q200 306 220 296 L220 250 Z" fill={persona.skin} />
        <path d="M180 270 Q200 284 220 270 L220 262 Q200 274 180 262 Z" fill="#000" opacity="0.12" />

        {/* hair behind head */}
        {persona.hairStyle === "long" && <path d="M128 170 Q122 290 160 300 L240 300 Q278 290 272 170 Z" fill={persona.hair} />}
        {persona.hairStyle === "bun" && <circle cx="200" cy="96" r="30" fill={persona.hair} />}

        {/* ears */}
        <ellipse cx="136" cy="200" rx="11" ry="18" fill={persona.skin} />
        <ellipse cx="264" cy="200" rx="11" ry="18" fill={persona.skin} />
        {/* head */}
        <ellipse cx="200" cy="190" rx="64" ry="80" fill={persona.skin} />
        <ellipse cx="200" cy="200" rx="64" ry="70" fill="url(#shade)" opacity="0.5" />

        {/* hair on top */}
        {persona.hairStyle === "short" && (
          <path d="M136 182 Q132 108 200 104 Q270 104 266 182 Q258 140 226 132 Q196 146 160 136 Q140 150 136 182 Z" fill={persona.hair} />
        )}
        {persona.hairStyle !== "short" && (
          <path d="M134 196 Q128 112 200 108 Q274 112 266 196 Q262 150 236 132 Q206 150 170 140 Q144 156 134 196 Z" fill={persona.hair} />
        )}

        {/* brows */}
        <g fill="none" stroke={persona.hair} strokeWidth="4.5" strokeLinecap="round">
          <path d={state === "listening" ? "M160 162 Q174 154 188 160" : "M160 164 Q174 158 188 162"} />
          <path d={state === "listening" ? "M212 160 Q226 154 240 162" : "M212 162 Q226 158 240 164"} />
        </g>

        {/* eyes */}
        <g transform={`translate(${eyeX} ${eyeY})`}>
          {[174, 226].map((x) => (
            <g key={x} transform={`translate(${x} 186) scale(1 ${blink ? 0.08 : 1})`}>
              <ellipse rx="10" ry="6.5" fill="#f6f1e8" />
              <circle r="4.6" fill="#2a1d14" />
              <circle cx="1.5" cy="-1.5" r="1.3" fill="#fff" />
            </g>
          ))}
        </g>
        {male && (
          <g fill="none" stroke="#1d1a17" strokeWidth="2.5" opacity="0.85">
            <rect x="158" y="174" width="32" height="24" rx="8" />
            <rect x="210" y="174" width="32" height="24" rx="8" />
            <path d="M190 184 Q200 180 210 184" />
          </g>
        )}

        {/* nose */}
        <path d="M200 192 Q196 214 192 220 Q200 224 208 220" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="2.5" strokeLinecap="round" />

        {/* mouth */}
        {open > 0 ? (
          <g>
            <ellipse cx="200" cy="240" rx={15 - Math.min(level, 1) * 3} ry={open} fill="#5a2620" />
            <path d={`M185 ${240 - open * 0.3} Q200 ${236 - open} 215 ${240 - open * 0.3}`} fill="none" stroke="#7a3b32" strokeWidth="2" />
          </g>
        ) : (
          <path
            d={state === "listening" ? "M184 238 Q200 248 216 238" : "M185 240 Q200 245 215 240"}
            fill="none"
            stroke="#7a3b32"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  );
}
