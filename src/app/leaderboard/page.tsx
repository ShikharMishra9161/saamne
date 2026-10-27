import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { RankBadge } from "@/components/RankBadge";
import { currentUser, publicName } from "@/lib/auth";
import { read } from "@/lib/db";
import { rankFor } from "@/lib/ranks";

export default async function Leaderboard() {
  const me = await currentUser();
  if (!me) redirect("/login");
  const all = read((db) =>
    db.users
      .filter((u) => !u.hideFromBoard && u.points > 0)
      .sort((a, b) => b.points - a.points || a.createdAt.localeCompare(b.createdAt)),
  );
  const top = all.slice(0, 10);
  const myPos = all.findIndex((u) => u.id === me.id);

  return (
    <>
      <Nav />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-5 py-14 lg:grid-cols-[1fr_1.4fr]">
        <section>
          <h1 className="font-display text-6xl leading-[1.02] tracking-tight">The top ten.</h1>
          <p className="mt-6 text-lg text-paper-dim">
            Every scored interview adds points, and the board is ordered by points (which also decides rank).
          </p>
          <p className="mt-4 text-sm text-muted">
            Names show as first name and last initial. You can hide yours from your profile.
          </p>
          <div className="card mt-8 p-5">
            {me.hideFromBoard ? (
              <span className="text-paper-dim">You&apos;re hidden from the leaderboard.</span>
            ) : myPos >= 0 ? (
              <span>
                You&apos;re <b>#{myPos + 1}</b> of {all.length} with <b>{me.points}</b> points.
              </span>
            ) : (
              <span className="text-paper-dim">Finish a scored interview to appear on the board.</span>
            )}
          </div>
        </section>
        <section className="card p-3">
          {top.length === 0 ? (
            <p className="p-8 text-center text-paper-dim">No one is on the board yet. Be the first.</p>
          ) : (
            <ol>
              {top.map((u, i) => {
                const r = rankFor(u.points).rank;
                return (
                  <li
                    key={u.id}
                    className={`flex items-center gap-5 rounded-2xl px-5 py-4 ${u.id === me.id ? "bg-white/[0.05]" : ""}`}
                  >
                    <span className="w-8 font-display text-3xl italic text-paper-dim">{i + 1}</span>
                    <RankBadge rank={r.name} size={48} />
                    <span className="flex-1">
                      <span className="block font-semibold">
                        {publicName(u)}
                        {u.id === me.id && <span className="ml-2 text-sm font-normal text-muted">(you)</span>}
                      </span>
                      <span className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: r.color }}>
                        {r.name}
                      </span>
                    </span>
                    <span className="font-display text-4xl tabular-nums">{u.points.toLocaleString("en-IN")}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
