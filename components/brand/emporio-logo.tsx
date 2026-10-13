/**
 * The Empório do Pão emblem: a ring with the name around a wheat ear. Drawn as SVG so it prints
 * sharp at any size; swap this component for the original artwork when the file is available.
 */
export function EmporioLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Empório do Pão" fill="none">
      <defs>
        <path id="emporio-arc-top" d="M 17 50 A 33 33 0 0 1 83 50" />
        <path id="emporio-arc-bottom" d="M 12 50 A 38 38 0 0 0 88 50" />
      </defs>
      <circle cx="50" cy="50" r="46" stroke="#6f4636" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="27" stroke="#6f4636" strokeWidth="1" opacity="0.5" />
      <text fontSize="9.5" fontWeight="700" letterSpacing="1.6" fill="#6f4636" fontFamily="Georgia, serif">
        <textPath href="#emporio-arc-top" startOffset="50%" textAnchor="middle">
          EMPÓRIO
        </textPath>
      </text>
      <text fontSize="9.5" fontWeight="700" letterSpacing="1.6" fill="#6f4636" fontFamily="Georgia, serif">
        <textPath href="#emporio-arc-bottom" startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
          DO PÃO
        </textPath>
      </text>
      {/* wheat: stalk and three pairs of grains */}
      <g stroke="#6f4636" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 66 V40" />
        <path d="M50 36 c-3-3-3-6 0-9 c3 3 3 6 0 9z" fill="#6f4636" />
        <path d="M50 46 c-6 0-9-3-9-7 c6 0 9 3 9 7z M50 46 c6 0 9-3 9-7 c-6 0-9 3-9 7z" fill="#6f4636" />
        <path d="M50 56 c-6 0-9-3-9-7 c6 0 9 3 9 7z M50 56 c6 0 9-3 9-7 c-6 0-9 3-9 7z" fill="#6f4636" />
      </g>
    </svg>
  );
}
