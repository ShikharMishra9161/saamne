import Link from "next/link";
import { redirect } from "next/navigation";
import { PointsJourney, Radar, ScoreBars } from "@/components/Charts";
import { Nav } from "@/components/Nav";
import { ProblemReportForm, ProfileSettings, ResumeUpload } from "@/components/ProfileForms";
import { RankBadge } from "@/components/RankBadge";
import { currentUser, publicName } from "@/lib/auth";
import { read } from "@/lib/db";
import { ROUND_INFO } from "@/lib/personas";
import { getProblem } from "@/lib/problems";
import { RANKS, rankFor } from "@/lib/ranks";
import { LANG_LABEL, type SkillKey } from "@/lib/types";

const SKILLS: { key: SkillKey; label: string }[] = [
  { key: "coding", label: "Coding" },
  { key: "problemSolving", label: "Problem solving" },
  { key: "communication", label: "Communication" },
  { key: "selfAwareness", label: "Self-awareness" },
  { key: "ownership", label: "Ownership" },
  { key: "technicalDepth", label: "Technical depth" },
];

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const welcome = (await searchParams).welcome === "1";
  const interviews = read((db) =>
    db.interviews.filter((i) => i.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  const done = interviews.filter((i) => i.status === "done" && i.report);

  // Latest score for each skill, from the most recent interview that measured it.
  const latest: Partial<Record<SkillKey, number>> = {};
  for (const iv of done) for (const s of SKILLS) if (latest[s.key] === undefined && iv.report!.skills[s.key] !== undefined) latest[s.key] = iv.report!.skills[s.key];

  const chrono = [...done].reverse();
  const journey = [
    { label: "Start", points: 0 },
    ...chrono.map((iv) => ({
      label: new Date(iv.endedAt ?? iv.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      points: iv.pointsAfter ?? 0,
      earned: iv.pointsAwarded,
      score: iv.report!.score,
    })),
  ];
  const { rank, next } = rankFor(user.points);
  const thresholds = RANKS.filter((r) => r.min > 0 && r.min <= (next?.min ?? rank.min)).map((r) => ({ name: r.name, min: r.min, color: r.color }));

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        {welcome && (
          <div className="card mb-6 border-amber/40 p-5">
            <b>Welcome to Saamne.</b>{" "}
            <span className="text-paper-dim">
              Upload your resume so your interviewers can ask about your own projects, then{" "}
              <Link href="/interview" className="text-amber hover:underline">
                start your first interview
              </Link>
              .
            </span>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.45fr]">
          <div className="space-y-6">
            <section className="card p-7 text-center">
              <div className="flex justify-center">
                <RankBadge rank={rank.name} size={96} />
              </div>
              <h1 className="mt-3 font-display text-3xl">{user.name}</h1>
              <div className="text-sm text-muted">{user.email}</div>
              <div className="mt-2 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: rank.color }}>
                {rank.name} · {user.points} points
              </div>
              <div className="mt-6 border-t border-white/5 pt-6">
                <ProfileSettings name={user.name} hidden={user.hideFromBoard} publicName={publicName(user)} />
              </div>
            </section>

            <section className="card p-7">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-3xl">Resume</h2>
                <span className="text-sm text-muted">ATS check</span>
              </div>
              <ResumeUpload resume={user.resume ?? null} />
            </section>

            <section className="card p-7">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-3xl">Skill balance</h2>
                <span className="text-sm text-muted">Latest score per skill</span>
              </div>
              <Radar
                title="Latest score for each skill"
                size={260}
                axes={SKILLS.map((s) => ({ label: s.label, value: latest[s.key] ?? null }))}
              />
              <ScoreBars items={SKILLS.map((s) => ({ label: s.label, value: latest[s.key] ?? null }))} />
              <p className="mt-4 text-sm text-muted">
                Technical rounds measure coding, problem solving and communication. Resume and behavioral rounds fill in
                ownership, self-awareness and depth.
              </p>
            </section>
          </div>

          <div className="space-y-6">
            <section className="card p-7">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-3xl">Points journey</h2>
                <span className="text-sm">
                  <b className="text-good">+{user.points}</b> <span className="text-paper-dim">since you started</span>
                </span>
              </div>
              {done.length ? (
                <PointsJourney data={journey} thresholds={thresholds} />
              ) : (
                <p className="mt-6 text-paper-dim">Your points appear here after your first scored interview.</p>
              )}
            </section>

            <section className="card p-7">
              <h2 className="font-display text-3xl">Past interviews</h2>
              {interviews.length === 0 ? (
                <p className="mt-4 text-paper-dim">
                  None yet.{" "}
                  <Link href="/interview" className="text-amber hover:underline">
                    Start one →
                  </Link>
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-white/5">
                  {interviews.map((iv) => {
                    const p = getProblem(iv.problemId);
                    return (
                      <li key={iv.id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 py-4">
                        <span className="text-sm text-paper-dim">
                          {new Date(iv.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        <span>
                          <span className="block font-semibold">{p ? p.title : ROUND_INFO[iv.round].title}</span>
                          <span className="text-sm text-muted">
                            {iv.round === "technical" ? `${LANG_LABEL[iv.language!]} · ` : `${ROUND_INFO[iv.round].title} · `}
                            {iv.difficulty}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          {iv.report ? (
                            <>
                              <span className="font-display text-3xl tabular-nums">{iv.report.score}</span>
                              <span className={`hidden rounded-full px-2.5 py-0.5 text-sm sm:inline ${iv.report.score >= 70 ? "bg-good/15 text-good" : iv.report.score >= 55 ? "bg-warn/15 text-warn" : "bg-bad/15 text-bad"}`}>
                                {iv.report.verdict}
                              </span>
                              <Link href={`/report/${iv.id}`} className="font-semibold text-amber hover:underline">
                                Report →
                              </Link>
                            </>
                          ) : iv.status === "live" ? (
                            <Link href={`/interview/${iv.id}`} className="text-sm text-amber hover:underline">
                              Rejoin →
                            </Link>
                          ) : iv.status === "abandoned" ? (
                            <span className="text-sm text-muted">Not scored (refunded)</span>
                          ) : (
                            <Link href={`/report/${iv.id}`} className="text-sm text-amber hover:underline">
                              {iv.status === "failed" ? "Retry report →" : "Scoring…"}
                            </Link>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card p-7">
              <h2 className="font-display text-3xl">Report a problem</h2>
              <ProblemReportForm
                interviews={interviews.slice(0, 15).map((iv) => ({
                  id: iv.id,
                  label: `${new Date(iv.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${ROUND_INFO[iv.round].title}`,
                }))}
              />
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
