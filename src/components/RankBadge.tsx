import { RANKS } from "@/lib/ranks";

// Original geometric insignia: each rank adds a ring of detail to the same shield.
export function RankBadge({ rank, size = 64 }: { rank: string; size?: number }) {
  const idx = Math.max(0, RANKS.findIndex((r) => r.name === rank || r.key === rank));
  const color = RANKS[idx].color;
  const id = `rb-${RANKS[idx].key}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${RANKS[idx].name} badge`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={color} opacity="0.12" />
      {idx >= 3 && <circle cx="32" cy="32" r="27" fill="none" stroke={color} strokeOpacity="0.5" strokeDasharray="2 3" />}
      <path d="M32 9 L50 16 V31 C50 43 42 51 32 55 C22 51 14 43 14 31 V16 Z" fill={`url(#${id})`} />
      <path d="M32 13 L46 18.5 V31 C46 40.5 40 47 32 50.5 C24 47 18 40.5 18 31 V18.5 Z" fill="#17140f" opacity="0.55" />
      {/* chevrons: one per rank above Rookie */}
      {Array.from({ length: idx }).map((_, i) => (
        <path
          key={i}
          d={`M24 ${38 - i * 5} L32 ${33 - i * 5} L40 ${38 - i * 5}`}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {idx === 0 && <circle cx="32" cy="32" r="4" fill={color} />}
      {idx === 4 && <path d="M32 15 l2 4 4.5 .6-3.3 3 .8 4.4-4-2.2-4 2.2.8-4.4-3.3-3 4.5-.6z" fill={color} />}
    </svg>
  );
}
