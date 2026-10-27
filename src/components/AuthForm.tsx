"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      router.push(mode === "signup" ? "/profile?welcome=1" : "/");
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md space-y-4 p-8">
      <h1 className="font-display text-4xl">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="text-paper-dim">
        {mode === "signup" ? "Your first interviews are free. No card needed." : "Sign in to continue practising."}
      </p>
      {mode === "signup" && (
        <label className="block">
          <span className="mb-1.5 block text-sm text-paper-dim">Full name</span>
          <input name="name" className="input" autoComplete="name" required />
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm text-paper-dim">Email</span>
        <input name="email" type="email" className="input" autoComplete="email" required />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-paper-dim">Password</span>
        <input
          name="password"
          type="password"
          className="input"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login" className="text-amber">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup" className="text-amber">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
