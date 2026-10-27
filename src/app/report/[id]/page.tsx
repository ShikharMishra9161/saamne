import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Radar } from "@/components/Charts";
import { Nav } from "@/components/Nav";
import { RankBadge } from "@/components/RankBadge";
import { ReportWaiting } from "@/components/ReportWaiting";
import { CodeAndTests } from "@/components/CodeAndTests";
import { currentUser } from "@/lib/auth";
import { read } from "@/lib/db";
import { PERSONAS, ROUND_INFO } from "@/lib/personas";
import { getProblem } from "@/lib/problems";
import { LANG_LABEL, type FeedbackItem, type Verdict } from "@/lib/types";

const VERDICT_STYLE: Record<Verdict, string> = {
  "Strong Hire": "bg-good/15 text-good",
  Hire: "bg-good/15 text-good",
  "Lean Hire": "bg-warn/15 text-warn",
  "Lean No Hire": "bg-bad/15 text-bad",
  "No Hire": "bg-bad/15 text-bad",
};

function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;
}

export default async function ReportPage({ params }: PageProps<"/report/[id]">) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const iv = read((db) => db.interviews.find((i) => i.id === id));
  if (!iv || iv.userId !== user.id) notFound();

  if (iv.status === "live") redirect(`/interview/${id}`);

  if (iv.status === "abandoned") {
    return (
      <>
        <Nav />
        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-20 text-center">
          <h1 className="font-display text-5xl">Too short to score</h1>
          <p className="mt-4 text-lg text-paper-dim">
            The call ended before there was enough to judge fairly, so it wasn&apos;t scored and your interview credit was
            refunded.
          </p>
          <Link href="/interview" className="btn btn-primary mt-8">
            Start another interview →
          </Link>
        </main>
      </>
    );
  }

  if (iv.status === "scoring" || iv.status === "failed" || !iv.report) {
    return (
      <>
        <Nav />
        <ReportWaiting id={id} initialStatus={iv.status} error={iv.error ?? null} />
      </>
    );
  }

  const r = iv.report;
  const prev = read((db) =>
    db.interviews
      .filter((x) => x.userId === user.id && x.round === iv.round && x.status === "done" && x.createdAt < iv.createdAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
  );
  const problem = getProblem(iv.problemId);
  const final = iv.runs.find((x) => x.kind === "final") ?? null;
  const promoted = iv.rankBefore && iv.rankAfter && iv.rankBefore !== iv.rankAfter;
  const meta = [
    iv.round === "technical" ? LANG_LABEL[iv.language!] : ROUND_INFO[iv.round].title,
    iv.difficulty,
    `${Math.max(1, Math.round((iv.durationSec ?? 0) / 60))} minutes`,
  ].join(" · ");

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 py-12">
        <section className="card grid gap-10 p-8 lg:grid-cols-[1.1fr_1fr] lg:p-10">
          <div>
            <div className="text-paper-dim">{meta}</div>
            {problem && <div className="mt-1 text-sm text-muted">Problem: {problem.title}</div>}
            <div className="mt-3 flex items-end gap-5">
              <span className="font-display text-[8rem] leading-[0.85] tracking-tight">{r.score}</span>
              <span className="mb-3 text-2xl text-paper-dim">/100</span>
              <span className={`mb-4 rounded-full px-4 py-1.5 text-lg font-semibold ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
            </div>
            <p className="mt-6 text-lg leading-relaxed text-paper-dim">{r.summary}</p>
            <div className="mt-7 flex items-center gap-4 border-t border-white/5 pt-6">
              <RankBadge rank={iv.rankAfter ?? "Rookie"} size={60} />
              <div>
                <div>
                  <span className="font-display text-4xl text-good">+{iv.pointsAwarded}</span>{" "}
                  <b>points</b> <span className="text-paper-dim">· {iv.rankAfter}, {iv.pointsAfter}</span>
                </div>
                <div className="text-sm text-paper-dim">
                  {promoted ? `Promoted to ${iv.rankAfter}.` : `Still ${iv.rankAfter}.`}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="font-semibold">
              {prev ? `Change since your last ${ROUND_INFO[iv.round].title.toLowerCase()} round` : `Your first scored ${ROUND_INFO[iv.round].title.toLowerCase()} round`}
            </div>
            <Radar
              title="Score by dimension"
              size={300}
              axes={r.dimensions.map((d) => {
                const before = prev?.report?.dimensions.find((x) => x.key === d.key)?.score ?? null;
                return { label: d.label, value: d.score, delta: d.score !== null && before !== null ? d.score - before : null };
              })}
            />
            <p className="text-center text-sm text-muted">
              {prev ? "Arrows show the change from your previous round of this type." : "Every skill starts here. Your next interview shows what changed."}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/interview" className="btn btn-primary">
            Practise again →
          </Link>
          <Link href="/" className="btn btn-ghost">
            Back to home
          </Link>
        </div>

        {iv.round === "technical" && <CodeAndTests code={iv.code ?? ""} result={final} />}

        <section className="grid gap-6 lg:grid-cols-2">
          <FeedbackList title="What went well" good items={r.strengths} />
          <div className="card p-7">
            <FeedbackList title="Needs improvement" good={false} items={r.improvements} bare />
            {r.howToImprove.length > 0 && (
              <div className="mt-8 border-t border-white/5 pt-6">
                <h3 className="text-lg font-semibold">How to improve</h3>
                <NumberedList items={r.howToImprove} />
              </div>
            )}
          </div>
        </section>

        {r.prepareBeforeReal.length > 0 && (
          <section className="card p-7">
            <h3 className="text-lg font-semibold">Prepare before a real interview</h3>
            <NumberedList items={r.prepareBeforeReal} />
          </section>
        )}

        {r.resumeItems.map((it, i) => (
          <section key={i} className="card p-7">
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="text-xl font-semibold">{it.title}</h3>
              <span className="text-sm text-muted">{it.kind}</span>
            </div>
            <p className="mt-3 text-lg leading-relaxed text-paper-dim">{it.assessment}</p>
          </section>
        ))}

        <details className="card p-7">
          <summary className="cursor-pointer text-lg font-semibold">Full transcript</summary>
          <p className="mt-2 text-sm text-muted">Transcribed from speech, so expect some misheard words.</p>
          <ol className="mt-5 space-y-4">
            {iv.transcript.map((t, i) => (
              <li key={i} className="grid grid-cols-[4rem_1fr] gap-3">
                <span className="pt-0.5 font-mono text-xs text-muted">{mmss(t.at)}</span>
                <div>
                  <span className={`text-xs font-semibold ${t.role === "interviewer" ? "text-amber" : "text-teal"}`}>
                    {t.role === "interviewer" ? PERSONAS[iv.round].name : "You"}
                  </span>
                  <p className="text-paper-dim">{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </details>
      </main>
    </>
  );
}

function FeedbackList({ title, items, good, bare }: { title: string; items: FeedbackItem[]; good: boolean; bare?: boolean }) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <Mark good={good} big />
        <h2 className="text-2xl font-semibold">{title}</h2>
      </div>
      <ul className="mt-4 divide-y divide-white/5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-4 py-5">
            <Mark good={good} />
            <div className="min-w-0">
              <div className="font-semibold">{it.title}</div>
              <p className="mt-1 text-paper-dim">{it.detail}</p>
              {it.quote && <blockquote className="mt-2 border-l-2 border-white/15 pl-3 italic text-paper-dim">&ldquo;{it.quote}&rdquo;</blockquote>}
              {it.code && (
                <code className="mt-2 inline-block max-w-full overflow-x-auto rounded-md bg-amber/10 px-2 py-1 font-mono text-sm text-amber">
                  {it.code}
                </code>
              )}
              <div className="mt-1.5 text-sm text-muted">{it.dimension}</div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
  return bare ? body : <div className="card p-7">{body}</div>;
}

function Mark({ good, big }: { good: boolean; big?: boolean }) {
  return (
    <span
      aria-label={good ? "Strength" : "To improve"}
      className={`grid shrink-0 place-items-center rounded-full ${big ? "h-10 w-10 text-lg" : "h-7 w-7 text-sm"} ${
        good ? "bg-good/15 text-good" : "bg-bad/15 text-bad"
      }`}
    >
      {good ? "✓" : "✕"}
    </span>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {items.map((x, i) => (
        <li key={i} className="flex gap-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] font-display italic text-amber">{i + 1}</span>
          <span className="pt-1 leading-relaxed">{x}</span>
        </li>
      ))}
    </ol>
  );
}
