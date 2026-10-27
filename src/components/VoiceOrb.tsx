// Decorative idle animation: a breathing orb and a soft waveform.
const HEIGHTS = [6, 10, 16, 9, 22, 14, 28, 18, 34, 22, 26, 14, 30, 20, 12, 24, 16, 30, 12, 20, 8, 16, 10, 6];

export function VoiceOrb() {
  return (
    <div className="flex items-center gap-5" aria-hidden>
      <div
        className="h-16 w-16 shrink-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 30%, #fff3dc, #f2a541 45%, #b0611a 100%)",
          animation: "breathe 3.2s ease-in-out infinite, pulse-ring 2.4s ease-out infinite",
        }}
      />
      <div className="flex h-10 items-center gap-[3px]">
        {HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-amber/70"
            style={{ height: h, animation: `bar ${1.1 + (i % 5) * 0.17}s ease-in-out ${i * 0.05}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}
