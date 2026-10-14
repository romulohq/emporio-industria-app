import type { SVGProps } from "react";

/** A highlighter marker (chisel tip, barrel, cap with a clip) in the same outline style as the lucide icons. */
export function MarkerIcon({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <g transform="rotate(45 12 12)">
        <path d="M10.7 22.8 L10.2 25 L13.4 24.5 L13.6 22.8" />
        <path d="M10.7 22.8 L9.2 18 H14.8 L13.6 22.8 Z" />
        <path d="M9.2 18 V7.5 H14.8 V18" />
        <path d="M9.2 7.5 V1 a1.6 1.6 0 0 1 1.6 -1.6 h2.4 a1.6 1.6 0 0 1 1.6 1.6 V7.5" />
        <path d="M14.8 2.5 h0.9 a1 1 0 0 1 1 1 V8 a1 1 0 0 1 -1 1 h-0.9" />
      </g>
    </svg>
  );
}
