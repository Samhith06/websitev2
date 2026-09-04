'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_SECTIONS, GROUP_LABELS } from '@/lib/admin-nav';
import type { AdminRole } from '@/lib/admin';

/**
 * The staff sidebar.
 *
 * Counts appear only where there is work waiting, so a badge means "somebody is
 * still waiting on you" rather than "here is a number".
 */
export function AdminNav({
  role,
  pending,
}: {
  role: AdminRole;
  pending: { approvals: number; payouts: number };
}) {
  const pathname = usePathname();
  const sections = ADMIN_SECTIONS.filter((s) => !s.ownerOnly || role === 'owner');

  let lastGroup: string | null = null;

  return (
    <div className="admnav">
      {sections.map((section) => {
        const count =
          section.href === '/admin'
            ? pending.approvals
            : section.href === '/admin/payouts'
              ? pending.payouts
              : 0;

        // Exact match for the index, prefix for the rest — otherwise /admin
        // would light up on every screen.
        const active =
          section.href === '/admin' ? pathname === '/admin' : pathname.startsWith(section.href);

        const header =
          section.group !== lastGroup ? (
            <div key={`g-${section.group}`}>
              {lastGroup ? <div className="sep" /> : null}
              <div className="gp">{GROUP_LABELS[section.group]}</div>
            </div>
          ) : null;
        lastGroup = section.group;

        return (
          <div key={section.href}>
            {header}
            <Link href={section.href} className={active ? 'on' : ''}>
              {section.label}
              {count > 0 ? <span className="ct">{count}</span> : null}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
