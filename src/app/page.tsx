import Link from "next/link";
import { Greeting } from "@/components/Greeting";
import { Nav } from "@/components/Nav";
import { RankCard } from "@/components/RankCard";
import { VoiceOrb } from "@/components/VoiceOrb";
import { currentUser, firstName } from "@/lib/auth";
import { read } from "@/lib/db";
import { ROUND_INFO } from "@/lib/personas";

export default async function Home() {
  const user = await currentUser();
  return (
    <>
      <Nav />
      {user ? <Dashboard userId={user.id} /> : <Landing />}
    </>
  );
}

async function Dashboard({ userId }: { userId: string }) {
  const user = (await currentUser())!;
  const recent = read((db) =>
    db.interviews
      .filter((i) => i.userId === userId && (i.status === "done" || i.status === "scoring" || i.status === "failed"))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3),
  );
  const live = read((db) =>
    db.interviews.find(
      (i) => i.userId === userId && i.status === "live" && Date.now() - new Date(i.createdAt).getTime() < 3 * 3600_000,
    ),
  );
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14">
      <div className="grid items-start gap-12 lg:grid-cols-[1.25fr_1fr]">
        <section className="fade-up">
          <Greeting />
          <h1 className="mt-6 font-display text-6xl leading-[1.02] tracking-tight sm:text-7xl">
            <em className="text-amber">{firstName(user)},</em> your interviewer is ready.
          </h1>
          <div className="mt-10">
            <VoiceOrb />
          </div>
          <p className="mt-8 max-w-xl text-lg text-paper-dim">
            Practise every round of a real interview out loud, on camera, with an interviewer who listens, follows up and
            pushes back. Then hear exactly what to fix before the real one.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {live ? (
              <Link href={`/interview/${live.id}`} className="btn btn-primary">
                Rejoin your interview →
              </Link>
            ) : (
              <Link href="/interview" className="btn btn-primary">
                Start an interview →
              </Link>
            )}
            {recent[0] && (
              <Link href={`/report/${recent[0].id}`} className="btn btn-ghost">
                Read your last report
              </Link>
            )}
          </div>
        </section>
        <section className="fade-up space-y-5" style={{ animationDelay: "120ms" }}>
          <RankCard points={user.points} />
          {recent.length > 0 && (
            <div className="card p-6">
              <div className="eyebrow">Recent interviews</div>
              <ul className="mt-4 divide-y divide-white/5">
                {recent.map((i) => (
                  <li key={i.id}>
                    <Link href={`/report/${i.id}`} className="flex items-center justify-between py-3 hover:text-amber">
                      <span>
                        {ROUND_INFO[i.round].title}
                        <span className="ml-2 text-sm text-muted">
                          {new Date(i.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {i.report ? <b>{i.report.score}</b> : <span className="text-sm text-muted">Scoring…</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Landing() {
  const steps = [
    ["Join the call", "Camera and mic on. Your interviewer greets you, asks a warm-up question, and takes it from there."],
    ["Think out loud", "Explain while you code or answer. They listen, stay quiet when you're working, and follow up when you're vague."],
    ["Read the report", "A score, a hire signal, and every strength and weakness tied to what you actually said or wrote."],
  ];
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-20">
      <section className="fade-up max-w-3xl">
        <span className="eyebrow">Face-to-face interview practice</span>
        <h1 className="mt-5 font-display text-6xl leading-[1.02] tracking-tight sm:text-7xl">
          Say it out loud <em className="text-amber">before</em> it counts.
        </h1>
        <p className="mt-6 text-xl text-paper-dim">
          Saamne puts you across the table from an interviewer who runs a real technical, resume or behavioral round with
          you — by voice, on camera, with your code running against real tests.
        </p>
        <div className="mt-9 flex gap-3">
          <Link href="/signup" className="btn btn-primary">
            Start practising free →
          </Link>
          <Link href="/login" className="btn btn-ghost">
            I have an account
          </Link>
        </div>
        <div className="mt-12">
          <VoiceOrb />
        </div>
      </section>
      <section className="mt-24 grid gap-5 md:grid-cols-3">
        {steps.map(([t, d], i) => (
          <div key={t} className="card p-7">
            <div className="font-display text-3xl text-amber">{i + 1}</div>
            <div className="mt-3 text-lg font-semibold">{t}</div>
            <p className="mt-2 text-paper-dim">{d}</p>
          </div>
        ))}
      </section>
      <section className="mt-5 grid gap-5 md:grid-cols-3">
        {Object.values(ROUND_INFO).map((r) => (
          <div key={r.title} className="card p-7">
            <div className="font-display text-2xl">{r.title}</div>
            <div className="text-sm text-muted">{r.subtitle}</div>
            <p className="mt-3 text-paper-dim">{r.blurb}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
