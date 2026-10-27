import { Nav } from "@/components/Nav";
import { RankBadge } from "@/components/RankBadge";
import { currentUser } from "@/lib/auth";
import { RANKS, rankFor } from "@/lib/ranks";

export default async function RanksPage() {
  const user = await currentUser();
  const mine = user ? rankFor(user.points).rank.key : null;
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-14">
        <h1 className="font-display text-5xl tracking-tight">Five ranks.</h1>
        <p className="mt-4 max-w-2xl text-lg text-paper-dim">
          Every scored interview earns points: more for a higher score and for harder problems. A weak interview still
          earns a little, and nothing is ever taken away.
        </p>
        <ol className="mt-10 space-y-4">
          {RANKS.map((r) => (
            <li
              key={r.key}
              className={`card flex items-center gap-6 p-6 ${mine === r.key ? "ring-1 ring-amber/60" : ""}`}
            >
              <RankBadge rank={r.name} size={72} />
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl" style={{ color: r.color }}>
                    {r.name}
                  </span>
                  <span className="text-sm text-muted">from {r.min} points</span>
                  {mine === r.key && <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs text-amber">You</span>}
                </div>
                <p className="mt-1 text-paper-dim">{r.blurb}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="card mt-8 p-6 text-paper-dim">
          <div className="eyebrow mb-2">How points work</div>
          Points = 10 + 2.2 × (score − 40) × difficulty, where difficulty is 1× for Easy, 1.5× for Medium and 2× for Hard
          (resume and behavioral rounds use the difficulty you pick). A score of 40 or below earns the flat 10.
        </div>
      </main>
    </>
  );
}
