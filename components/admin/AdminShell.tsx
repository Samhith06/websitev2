'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList, Film, Gauge, Gift, Handshake, Menu, ScrollText, ShoppingBag, Trophy, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/typography';
import { CountBadge } from '@/components/ui/controls';
import { LogoMark, RazedZ } from '@/components/ui/marks';

type Role = 'owner' | 'mod';

const NAV = [
  { href: '/admin', label: 'Overview', Icon: Gauge, exact: true },
  { href: '/admin/razed', label: 'Razed players', Icon: null, razed: true },
  { href: '/admin/members', label: 'Members and coins', Icon: Users },
  { href: '/admin/redemptions', label: 'Redemptions', Icon: ClipboardList, count: 3 },
  { href: '/admin/giveaways', label: 'Giveaways', Icon: Gift },
  { href: '/admin/shop', label: 'Shop items', Icon: ShoppingBag },
  { href: '/admin/prizes', label: 'Prizes and periods', Icon: Trophy, ownerOnly: true },
  { href: '/admin/clips', label: 'Clips', Icon: Film },
  { href: '/admin/games', label: 'Games', Icon: Handshake, ownerOnly: true },
  { href: '/admin/audit', label: 'Audit log', Icon: ScrollText },
];

/**
 * A fixed 236px sidebar on a slightly darker ground, content to the right
 * (UI Spec §15).
 *
 * Role differences are visible, not hidden: a moderator sees the owner-only
 * areas greyed with a tag rather than absent. It prevents the "where did that
 * menu go" support message.
 */
export function AdminShell({
  role,
  name,
  children,
}: {
  role: Role;
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <LogoMark size={28} />
        <span className="display text-[15px] tracking-wide text-ink">ADMIN</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const locked = item.ownerOnly && role !== 'owner';

            const inner = (
              <>
                <span className="grid w-4 shrink-0 place-items-center">
                  {item.razed ? <RazedZ size={15} /> : item.Icon ? <item.Icon size={15} strokeWidth={1.8} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {locked ? (
                  <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
                    owner only
                  </span>
                ) : item.count ? (
                  <CountBadge>{item.count}</CountBadge>
                ) : null}
              </>
            );

            if (locked) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-[3px] px-3 py-2 text-[13.5px] text-faint"
                  >
                    {inner}
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[3px] px-3 py-2 text-[13.5px] transition-colors duration-150',
                    active ? 'bg-brand-bg text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {inner}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <div className="rounded-[3px] border border-line bg-surface px-3 py-2.5">
          <p className="truncate text-[13px] text-ink">{name}</p>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-brand">
            {role}
          </p>
        </div>
        <Link
          href="/"
          className="mt-2 block px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint hover:text-brand-dim"
        >
          ← Back to the site
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Mobile bar — the redemption queue is used away from a desk. */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="display text-[14px] text-ink">ADMIN</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="grid size-11 place-items-center rounded-[3px] border border-line text-ink-2"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <aside className="hidden w-[236px] shrink-0 flex-col border-r border-line bg-[#0A0F1B] lg:flex">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 top-[57px] z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg/70"
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(280px,86vw)] flex-col border-r border-line bg-[#0A0F1B]">
            {sidebar}
          </div>
        </div>
      ) : null}

      <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-[26px]">
        {children}
      </main>
    </div>
  );
}

/** Header used at the top of every admin screen. */
export function AdminHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <Label className="mb-2 flex items-center gap-2">{eyebrow}</Label> : null}
        <h1 className="display text-[28px] leading-none text-ink lg:text-[34px]">{title}</h1>
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}
