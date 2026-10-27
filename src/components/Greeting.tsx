"use client";

import { useSyncExternalStore } from "react";

function partOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Greeting() {
  const text = useSyncExternalStore(
    () => () => {},
    partOfDay,
    () => "Welcome back",
  );
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-sm text-paper-dim">
      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
      {text}
    </span>
  );
}
