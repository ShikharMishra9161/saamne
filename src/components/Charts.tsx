"use client";

import { useState } from "react";

const MARK = "#d07a1f"; // validated against the dark surface (dataviz check)
const MARK_FILL = "rgba(208, 122, 31, 0.22)";
const GRID = "rgba(244, 237, 225, 0.10)";
const INK_DIM = "#cfc5b3";
const INK_MUTED = "#9b917f";

export interface RadarAxis {
  label: string;
  value: number | null;
  delta?: number | null;
}

/** Single-series radar for dimension scores (0–100). Null axes show "Not yet". */
export function Radar({ axes, size = 360, title }: { axes: RadarAxis[]; size?: number; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = 92;
  const W = size + pad * 2;
  const H = size + 70;
  const cx = W / 2;
  const cy = H / 2;
  const R = size / 2 - 20;
  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [cx + Math.cos(angle(i)) * (R * v) / 100, cy + Math.sin(angle(i)) * (R * v) / 100];
  const known = axes.map((a, i) => ({ ...a, i })).filter((a) => a.value !== null);
  const poly = known.map((a) => pt(a.i, a.value!).join(",")).join(" ");

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {[25, 50, 75, 100].map((v) => (
          <polygon
            key={v}
            points={axes.map((_, i) => pt(i, v).join(",")).join(" ")}
            fill="none"
            stroke={GRID}
            strokeWidth={1}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} strokeWidth={1} />;
        })}
        {known.length >= 3 && <polygon points={poly} fill={MARK_FILL} stroke={MARK} strokeWidth={2} strokeLinejoin="round" />}
        {known.length === 2 && <polyline points={poly} fill="none" stroke={MARK} strokeWidth={2} />}
        {known.map((a) => {
          const [x, y] = pt(a.i, a.value!);
          return (
            <g key={a.i} onMouseEnter={() => setHover(a.i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x} cy={y} r={14} fill="transparent" />
              <circle cx={x} cy={y} r={hover === a.i ? 6 : 4.5} fill={MARK} stroke="#17140f" strokeWidth={2} />
            </g>
          );
        })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 122);
          const cos = Math.cos(angle(i));
          const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
          return (
            <text key={i} x={x} y={y} textAnchor={anchor} fontSize={14} fill={INK_DIM}>
              <tspan x={x} dy={-4}>
                {a.label}
              </tspan>
              <tspan x={x} dy={18} fontWeight={700} fill={a.value === null ? INK_MUTED : "#f4ede1"} fontStyle={a.value === null ? "italic" : undefined}>
                {a.value === null ? "Not yet" : a.value}
                {a.delta != null && a.delta !== 0 && (
                  <tspan fill={a.delta > 0 ? "#7bd389" : "#ef6f6c"} fontWeight={600}>
                    {" "}
                    {a.delta > 0 ? `▲${a.delta}` : `▼${Math.abs(a.delta)}`}
                  </tspan>
                )}
              </tspan>
            </text>
          );
        })}
      </svg>
      {hover !== null && axes[hover].value !== null && (
        <div
          className="pointer-events-none absolute rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm shadow-xl"
          style={{
            left: `${(pt(hover, axes[hover].value!)[0] / W) * 100}%`,
            top: `${(pt(hover, axes[hover].value!)[1] / H) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          <div className="text-paper-dim">{axes[hover].label}</div>
          <div className="font-semibold">{axes[hover].value} / 100</div>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {axes.map((a) => (
            <tr key={a.label}>
              <th>{a.label}</th>
              <td>{a.value ?? "Not yet assessed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars for a few scores, value labelled at the end. */
export function ScoreBars({ items }: { items: { label: string; value: number | null }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="text-paper-dim">{it.label}</span>
          <span className="h-2 rounded-full bg-white/[0.07]">
            {it.value !== null && (
              <span className="block h-full rounded-full" style={{ width: `${Math.max(it.value, 2)}%`, background: MARK }} />
            )}
          </span>
          <span className="text-right font-semibold tabular-nums">
            {it.value ?? <span className="font-normal italic text-muted">—</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface JourneyPoint {
  label: string;
  points: number;
  earned?: number;
  score?: number;
}

/** Points over time with rank thresholds as labelled reference lines. */
export function PointsJourney({
  data,
  thresholds,
}: {
  data: JourneyPoint[];
  thresholds: { name: string; min: number; color: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 300;
  const m = { l: 52, r: 24, t: 40, b: 36 };
  const maxY = Math.max(...data.map((d) => d.points), ...thresholds.map((t) => t.min), 100);
  const x = (i: number) => m.l + (data.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (data.length - 1));
  const y = (v: number) => H - m.b - (v / maxY) * (H - m.t - m.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.points)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Points after each interview"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          data.forEach((_, i) => {
            if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
          });
          setHover(best);
        }}
      >
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke={GRID} />
        {thresholds.map((t) => (
          <g key={t.name}>
            <line x1={m.l} x2={W - m.r} y1={y(t.min)} y2={y(t.min)} stroke={GRID} strokeDasharray="4 5" />
            <text x={m.l - 8} y={y(t.min) + 4} textAnchor="end" fontSize={12} fill={INK_MUTED}>
              {t.min}
            </text>
            <text x={m.l + 8} y={y(t.min) - 6} fontSize={11} letterSpacing={2} fill={INK_DIM}>
              {t.name.toUpperCase()}
            </text>
          </g>
        ))}
        <path d={area} fill={MARK_FILL} opacity={0.6} />
        <path d={line} fill="none" stroke={MARK} strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={y(0)} stroke="rgba(244,237,225,0.25)" />}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.points)} r={hover === i ? 6 : 4.5} fill={MARK} stroke="#17140f" strokeWidth={2} />
        ))}
        <text x={x(0)} y={H - 10} fontSize={12} fill={INK_MUTED} textAnchor={data.length === 1 ? "middle" : "start"}>
          {data[0].label}
        </text>
        {data.length > 1 && (
          <text x={x(data.length - 1)} y={H - 10} fontSize={12} fill={INK_MUTED} textAnchor="end">
            {data[data.length - 1].label}
          </text>
        )}
        <text x={x(data.length - 1)} y={y(data[data.length - 1].points) - 12} fontSize={13} fontWeight={700} fill="#f4ede1" textAnchor="end">
          {data[data.length - 1].points} pts
        </text>
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm shadow-xl"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].points) / H) * 100}%`, transform: "translate(-50%, -125%)" }}
        >
          <div className="text-paper-dim">{data[hover].label}</div>
          <div className="font-semibold tabular-nums">{data[hover].points} points</div>
          {data[hover].earned !== undefined && (
            <div className="text-paper-dim">
              +{data[hover].earned} from a score of {data[hover].score}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
