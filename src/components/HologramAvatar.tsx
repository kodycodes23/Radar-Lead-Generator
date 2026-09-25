export function HologramAvatar() {
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center" aria-hidden>
      <div className="absolute h-40 w-40 rounded-full bg-emerald-400/25 blur-2xl" />
      <div className="absolute h-32 w-32 rounded-full border border-emerald-300/25" />
      <div className="absolute h-24 w-24 rounded-full border border-emerald-200/15" />

      <svg viewBox="0 0 200 200" className="relative h-36 w-36">
        <defs>
          <linearGradient id="holo-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
          </linearGradient>
          <clipPath id="holo-clip">
            <circle cx="100" cy="62" r="34" />
            <path d="M52 190 C52 130 70 108 100 108 C130 108 148 130 148 190 Z" />
          </clipPath>
        </defs>

        <g clipPath="url(#holo-clip)">
          <circle cx="100" cy="62" r="34" fill="url(#holo-fill)" />
          <path d="M52 190 C52 130 70 108 100 108 C130 108 148 130 148 190 Z" fill="url(#holo-fill)" />
          {Array.from({ length: 16 }).map((_, i) => (
            <rect key={i} x="0" y={i * 13} width="200" height="1.5" fill="#03140f" opacity="0.35" />
          ))}
        </g>

        <circle cx="100" cy="62" r="34" fill="none" stroke="#6ee7b7" strokeOpacity="0.5" />
        <path
          d="M52 190 C52 130 70 108 100 108 C130 108 148 130 148 190"
          fill="none"
          stroke="#6ee7b7"
          strokeOpacity="0.4"
        />
      </svg>
    </div>
  );
}
