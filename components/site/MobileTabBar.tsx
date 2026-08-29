'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/leaderboard', label: 'Board', Icon: Trophy },
  { href: '/shop', label: 'Shop', Icon: ShoppingBag },
  { href: '/me', label: 'Me', Icon: User },
];

/**
 * Fixed at 62px with four tabs (UI Spec §27). The coin balance is always one
 * tap away, which is the behaviour you want — a viewer checking their balance
 * mid-stream is a viewer still watching.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  // Admin runs its own shell.
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 h-[62px] border-t border-line bg-bg/95 backdrop-blur-sm lg:hidden"
    >
      <ul className="grid h-full grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1',
                  active ? 'text-brand' : 'text-muted',
                )}
              >
                <Icon size={20} strokeWidth={1.9} />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
