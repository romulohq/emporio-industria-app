import type { SVGProps } from "react";

/** A loaf of bread (pão francês) in the same outline style as the lucide icons. */
export function BreadIcon({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
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
      <g transform="rotate(-35 12 12)">
        <ellipse cx="12" cy="12" rx="10" ry="5.6" />
        <path d="M8 9.8l-1.2 4.4M12.2 9.2l-1.2 5.6M16.4 9.8l-1.2 4.4" />
      </g>
    </svg>
  );
}
