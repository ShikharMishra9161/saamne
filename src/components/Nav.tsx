import Link from "next/link";
import { currentUser, firstName } from "@/lib/auth";
import { rankFor } from "@/lib/ranks";
import { NavLinks } from "./NavLinks";
import { RankBadge } from "./RankBadge";
import { LogoutButton } from "./LogoutButton";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber text-[#1a1206]">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <circle cx="8" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="16" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      </span>
      <span className="font-display text-2xl tracking-tight">
        Saamne<span className="text-amber">.</span>
      </span>
    </Link>
  );
}

export async function Nav() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Logo />
        {user ? (
          <>
            <NavLinks />
            <div className="flex items-center gap-3">
              <Link
                href="/interview"
                className="hidden items-center gap-2 rounded-full border border-white/10 px-3.5 py-1.5 text-sm sm:flex"
                title="Interviews you can still take"
              >
                <span className={`h-2 w-2 rounded-full ${user.credits > 0 ? "bg-good" : "bg-bad"}`} />
                <b>{user.credits}</b> <span className="text-paper-dim">interviews left</span>
              </Link>
              <Link href="/profile" className="flex items-center gap-2" title={`${firstName(user)} · ${rankFor(user.points).rank.name}`}>
                <RankBadge rank={rankFor(user.points).rank.name} size={38} />
              </Link>
              <LogoutButton />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost !py-2">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary !py-2">
              Start free
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
