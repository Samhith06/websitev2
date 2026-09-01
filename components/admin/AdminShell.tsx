'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList, Coins as CoinsIcon, Film, Gauge, Gift, Handshake, Menu, ScrollText,
  ShoppingBag, Trophy, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/typography';
import { LogoMark, RazedZ } from '@/components/ui/marks';

type Role = 'owner' | 'mod';

/**
 * Grouped rather than a flat list of ten. At a glance an operator can see the
 * shape of the system: who, what they get, what is on the site, and the record.
 *
 * The Redemptions badge used to be a hardcoded 3. A fake count on a work queue
 * is worse than no count, so it is gone until it is wired to the real table.
 */
const NAV: Array<{
  group: string;
  items: Array<{
    href: string; label: string; Icon: typeof Gauge | null;
    exact?: boolean; razed?: boolean; ownerOnly?: boolean;
  }>;
}> = [
  {
    group: 'Today',
    items: [{ href: '/admin', label: 'Overview', Icon: Gauge, exact: true }],
  },
  {
    group: 'People',
    items: [
      { href: '/admin/members', label: 'Members and coins', Icon: Users },
      { href: '/admin/bulk', label: 'Bulk coin grant', Icon: CoinsIcon },
      { href: '/admin/razed', label: 'Razed players', Icon: null, razed: true },
    ],
  },
  {
    group: 'Queues',
    items: [
      { href: '/admin/redemptions', label: 'Redemptions', Icon: ClipboardList },
      { href: '/admin/giveaways', label: 'Giveaways', Icon: Gift },
      { href: '/admin/prizes', label: 'Prizes and periods', Icon: Trophy, ownerOnly: true },
    ],
  },
  {
    group: 'Content',
    items: [
      { href: '/admin/shop', label: 'Shop items', Icon: ShoppingBag },
      { href: '/admin/clips', label: 'Clips', Icon: Film },
      { href: '/admin/games', label: 'Games', Icon: Handshake, ownerOnly: true },
    ],
  },
  {
    group: 'Record',
    items: [{ href: '/admin/audit', label: 'Audit log', Icon: ScrollText }],
  },
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

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {NAV.map((section) => (
          <div key={section.group} className="mb-4 last:mb-0">
            <p className="px-3 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const locked = item.ownerOnly && role !== 'owner';

                const inner = (
                  <>
                    <span className="grid w-4 shrink-0 place-items-center">
                      {item.razed ? <RazedZ size={14} /> : item.Icon ? <item.Icon size={15} strokeWidth={1.8} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {locked ? (
                      <span className="shrink-0 rounded-[2px] border border-gold-line bg-gold-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-gold">
                        owner
                      </span>
                    ) : null}
                  </>
                );

                if (locked) {
                  return (
                    <li key={item.href}>
                      {/* Visible, greyed and labelled. A moderator should see
                          what exists and know who to ask, rather than finding
                          a hole where a feature was. */}
                      <span
                        aria-disabled
                        title="Ask an owner to do this"
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-[3px] px-3 py-[7px] text-[13px] text-faint opacity-60"
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
                        'flex items-center gap-2.5 rounded-[3px] border-l-2 px-3 py-[7px] text-[13px] transition-colors duration-150',
                        active
                          ? 'border-l-brand bg-brand-bg text-brand'
                          : 'border-l-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      {inner}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        {eyebrow ? <Label className="mb-1.5 flex items-center gap-2">{eyebrow}</Label> : null}
        <h1 className="text-[21px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
      </div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}
