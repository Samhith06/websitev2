import type { ReactNode } from 'react';
import type { NavIconName } from '@/lib/nav';

/**
 * The tab bar's icons, drawn with square corners and square line ends to match
 * the rest of the system — which is why they are here rather than from the icon
 * library, whose set is all rounded.
 */
const PATHS: Record<NavIconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
  flag: (
    <>
      <path d="M4 22V4" />
      <path d="M4 4h13l-2 4 2 4H4" />
    </>
  ),
  games: (
    <>
      <rect x="2" y="7" width="20" height="11" />
      <path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13.5h.01" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8V5h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" />
      <path d="M14 5v10" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 13H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </>
  ),
  crown: <path d="M3 20h18M4 16 3 7l5 4 4-7 4 7 5-4-1 9z" />,
  sword: <path d="M14 3h7v7L10 21l-7-7zM6 11l7 7" />,
  banner: <path d="M5 22V3h14v10H5" />,
  bracket: <path d="M3 5h5v6h5M3 19h5v-8M21 11h-8" />,
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="miter"
      strokeLinecap="square"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
