'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, activeNav } from '@/lib/nav';

/**
 * The phone tab bar. Same six destinations as the desktop row, in the same
 * order, so the two never disagree about where something lives.
 *
 * Hidden above 760px by CSS rather than by a media query in JavaScript, so it
 * costs nothing on desktop and never flashes in on a slow hydration.
 */
export function MobileNav() {
  const pathname = usePathname();
  const active = activeNav(pathname);

  return (
    <nav className="mobnav" aria-label="Primary, compact">
      <div className="mn">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={active === item.href ? 'on' : ''}
            aria-current={active === item.href ? 'page' : undefined}
          >
            <span className="mi" aria-hidden>
              {item.icon}
            </span>
            {item.short}
          </Link>
        ))}
      </div>
    </nav>
  );
}
