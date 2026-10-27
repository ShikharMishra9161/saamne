import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { RankBadge } from "@/components/RankBadge";
import { SetupForm } from "@/components/SetupForm";
import { hasApiKey } from "@/lib/ai";
import { currentUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { rankFor } from "@/lib/ranks";

export default async function InterviewSetup() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const last = read((db) =>
    db.interviews
      .filter((i) => i.userId === user.id && i.status === "done")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
  );
  const { rank, next, toNext } = rankFor(user.points);
  const pct = next ? ((user.points - rank.min) / (next.min - rank.min)) * 100 : 100;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        <h1 className="font-display text-6xl tracking-tight">Set up your interview</h1>
        <p className="mt-4 max-w-2xl text-lg text-paper-dim">
          Each round tests a different side of you. A strong candidate does well in all three.
        </p>

        <div className="card mt-8 flex flex-wrap items-center gap-6 p-5">
          <div className="flex items-center gap-4">
            <RankBadge rank={rank.name} size={56} />
            <div className="w-56">
              <div className="flex justify-between text-sm">
                <b style={{ color: rank.color }}>{rank.name}</b>
                <span className="text-paper-dim">{user.points} points</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: rank.color }} />
              </div>
              <div className="mt-1.5 text-xs text-paper-dim">{next ? `${toNext} to ${next.name}` : "Top rank"}</div>
            </div>
          </div>
          <div className="hidden h-12 w-px bg-white/10 md:block" />
          <div className="flex-1 text-paper-dim">
            {last?.report ? (
              <>
                Last interview: <b className="text-paper">{last.report.score}</b>,{" "}
                <b className={last.report.score >= 70 ? "text-good" : last.report.score >= 55 ? "text-warn" : "text-bad"}>
                  {last.report.verdict}
                </b>
                .{" "}
                <Link href={`/report/${last.id}`} className="font-semibold text-amber hover:underline">
                  Read your report →
                </Link>
              </>
            ) : (
              "Your first report will show up here."
            )}
          </div>
        </div>

        {!hasApiKey() && (
          <div className="mt-6 rounded-2xl border border-bad/40 bg-bad/10 p-5 text-sm">
            <b>The interviewer isn&apos;t connected yet.</b> Add <code className="font-mono">GEMINI_API_KEY</code> to{" "}
            <code className="font-mono">.env.local</code> in the project folder and restart the server.
          </div>
        )}

        <SetupForm credits={user.credits} hasResume={Boolean(user.resume)} />
      </main>
    </>
  );
}
