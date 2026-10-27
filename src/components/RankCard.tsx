import Link from "next/link";
import { rankFor } from "@/lib/ranks";
import { RankBadge } from "./RankBadge";

export function RankCard({ points }: { points: number }) {
  const { rank, next, toNext } = rankFor(points);
  const span = next ? next.min - rank.min : 1;
  const pct = next ? Math.round(((points - rank.min) / span) * 100) : 100;
  return (
    <div className="card p-7">
      <div className="flex items-center gap-5">
        <RankBadge rank={rank.name} size={92} />
        <div>
          <div className="text-sm text-muted">Your rank</div>
          <div className="font-display text-4xl tracking-wide" style={{ color: rank.color }}>
            {rank.name}
          </div>
        </div>
      </div>
      <p className="mt-4 text-paper-dim">{rank.blurb}</p>
      <div className="mt-6 flex items-baseline justify-between text-sm">
        <span>
          {next ? (
            <>
              <b>{toNext} points</b> <span className="text-paper-dim">to {next.name}</span>
            </>
          ) : (
            <b>Top rank reached</b>
          )}
        </span>
        <span className="tabular-nums text-paper-dim">
          {points}
          {next ? ` / ${next.min}` : ""}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress to ${next?.name ?? "top rank"}`}
      >
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: rank.color }} />
      </div>
      <Link href="/ranks" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-amber hover:underline">
        See all five ranks →
      </Link>
    </div>
  );
}
