'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeNav, type NavItem } from '@/lib/nav';
import { NavIcon } from './NavIcon';

/**
 * The tab bar. Same destinations as the desktop row, in the same order, so the
 * two never disagree about where something lives — six always, seven or eight
 * while a stream game runs, at which point the bar scrolls.
 *
 * Hidden at 1100px and up by CSS rather than by a media query in JavaScript, so
 * it costs nothing on desktop and never flashes in on a slow hydration.
 */
export function MobileNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  const active = activeNav(pathname, nav);

  return (
    <nav className="mobnav" aria-label="Primary, compact">
      <div className="mn">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={active === item.href ? 'on' : ''}
            aria-current={active === item.href ? 'page' : undefined}
          >
            <NavIcon name={item.icon} />
            {item.short}
          </Link>
        ))}
      </div>
    </nav>
  );
}
