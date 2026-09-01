import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins, dateShort, relativeTime } from '@/lib/format';
import { hasDatabase } from '@/lib/db';
import {
  memberById, multiplierFor, searchUsers, subStateFor, type MemberFilter,
} from '@/lib/store/accounts';
import { balanceOf, ledgerFor } from '@/lib/store/coins';
import { AdminHeader } from '@/components/admin/AdminShell';
import { StatusPill } from '@/components/admin/Table';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { MemberActions } from '@/components/admin/MemberActions';

export const metadata = { title: 'Members and coins' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const FILTERS: Array<{ key: MemberFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unlinked', label: 'Unlinked' },
  { key: 'frozen', label: 'Frozen' },
];

/**
 * Members, rebuilt as master and detail.
 *
 * The old screen listed fifty accounts with a dead search box and put the
 * detail panel underneath the table, so working a two hundred member community
 * meant scrolling past every row to reach the one you wanted, and anyone
 * outside the newest fifty was unreachable entirely.
 *
 * Now: a searchable, filterable, paged list on the left; the selected member
 * pinned on the right. The list scrolls; the detail does not move.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; q?: string; filter?: string; page?: string }>;
}) {
  const sp = await searchParams;

  if (!hasDatabase()) {
    return (
      <>
        <AdminHeader eyebrow="Lookup, ledger, adjustments" title="Members and coins" />
        <Card tone="gold">
          <div className="px-5 py-5">
            <p className="text-[15px] text-ink">No database is configured.</p>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              Accounts, balances and the ledger all live in Postgres. Set{' '}
              <code className="font-mono text-gold">DATABASE_URL</code> and this screen fills itself
              the first time somebody signs in.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const query = (sp.q ?? '').trim();
  const filter: MemberFilter =
    sp.filter === 'unlinked' || sp.filter === 'frozen' ? sp.filter : 'all';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const { members, total } = await searchUsers({
    query,
    filter,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  // The selected member may not be on this page — a moderator can arrive from a
  // link, or page past them — so it is fetched on its own rather than found in
  // the current slice.
  const wanted = sp.member ? Number(sp.member) : members[0]?.id;
  const selected = wanted
    ? (members.find((m) => m.id === wanted) ?? (await memberById(wanted)))
    : null;

  const [ledger, balance, sub] = selected
    ? await Promise.all([
        ledgerFor(selected.id, 20),
        balanceOf(selected.id),
        subStateFor(selected.id),
      ])
    : [[], { balance: 0, lifetimeEarned: 0 }, { subActiveUntil: null, isVip: false }];

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const href = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (filter !== 'all') p.set('filter', filter);
    if (page > 1) p.set('page', String(page));
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === '') p.delete(k);
      else p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/admin/members?${s}` : '/admin/members';
  };

  return (
    <>
      <AdminHeader
        eyebrow="Lookup, ledger, adjustments"
        title="Members and coins"
        right={
          <span className="font-mono text-[11.5px] tabular-nums text-muted">
            {total} {total === 1 ? 'account' : 'accounts'}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:items-start">
        {/* ================================================================ */}
        {/* Master: search, filters, the list                                */}
        {/* ================================================================ */}
        <div className="rounded-[3px] border border-line bg-surface">
          {/* Search is a plain GET form, so the query lives in the URL and one
              moderator can send another a link to exactly what they are
              looking at. */}
          <form method="GET" action="/admin/members" className="border-b border-line p-3">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Discord name, Kick name or ID"
                aria-label="Search members"
                className="h-9 w-full rounded-[3px] border border-line-2 bg-surface-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-brand focus:outline-none"
              />
            </div>
            {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={href({ filter: f.key === 'all' ? undefined : f.key, page: undefined, member: undefined })}
                  className={cn(
                    'rounded-[2px] border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors duration-150',
                    filter === f.key
                      ? 'border-brand-line bg-brand-bg text-brand'
                      : 'border-line bg-surface text-muted hover:border-line-2 hover:text-ink-2',
                  )}
                >
                  {f.label}
                </Link>
              ))}
              {query ? (
                <Link
                  href={href({ q: undefined, page: undefined, member: undefined })}
                  className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint hover:text-brand"
                >
                  Clear search
                </Link>
              ) : null}
            </div>
          </form>

          {/* The list itself. Fixed height with its own scroll, so the detail
              beside it stays in view however long the list is. */}
          <div className="max-h-[calc(100dvh-320px)] min-h-[240px] overflow-y-auto">
            {members.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13.5px] text-muted">
                {query || filter !== 'all'
                  ? 'Nothing matches that. Clear the search or the filter to see everyone.'
                  : 'Nobody has signed in yet. An account row is created the first time somebody signs in with Discord.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {members.map((row) => {
                  const active = selected?.id === row.id;
                  return (
                    <li key={row.id}>
                      <Link
                        href={href({ member: row.id })}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-l-2 px-3.5 py-2.5 transition-colors duration-150',
                          active
                            ? 'border-l-brand bg-brand-bg/60'
                            : 'border-l-transparent hover:bg-surface-2',
                          row.status === 'frozen' && !active && 'bg-danger/[0.05]',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] text-ink">
                            {row.discordUsername}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">
                            {row.kick ? (
                              row.kick.kickUsername
                            ) : (
                              /* An unlinked account earns nothing, and it is the
                                 first thing to check when someone says their
                                 coins are broken. */
                              <span className="text-gold">unlinked</span>
                            )}
                            {' · joined '}
                            {relativeTime(row.createdAt)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <Num tone="brand" className="block text-[13px]">
                            {coins(row.balance)}
                          </Num>
                          {row.status === 'frozen' ? (
                            <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-danger">
                              frozen
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* An honest count, and paging that says where you are. */}
          <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5">
            <span className="font-mono text-[11px] tabular-nums text-faint">
              {total === 0 ? 'No accounts' : `${from}–${to} of ${total}`}
            </span>
            <span className="flex items-center gap-1">
              <PageLink href={href({ page: page - 1, member: undefined })} disabled={page <= 1} label="Previous page">
                <ChevronLeft size={15} />
              </PageLink>
              <span className="px-1 font-mono text-[11px] tabular-nums text-muted">
                {page} / {lastPage}
              </span>
              <PageLink href={href({ page: page + 1, member: undefined })} disabled={page >= lastPage} label="Next page">
                <ChevronRight size={15} />
              </PageLink>
            </span>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Detail: pinned, so it never scrolls away behind the list         */}
        {/* ================================================================ */}
        <div className="xl:sticky xl:top-[26px]">
          {selected ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[16px] text-ink">{selected.discordUsername}</p>
                  <p className="mt-1 font-mono text-[11.5px] tabular-nums text-faint">
                    {selected.kick
                      ? `Kick: ${selected.kick.kickUsername} (id ${selected.kick.kickUserId})`
                      : 'No Kick link. This account cannot earn from watching.'}
                    {' · '}member since {dateShort(selected.createdAt)}
                  </p>
                </div>
                <StatusPill tone={selected.status === 'frozen' ? 'danger' : 'brand'}>
                  {selected.status === 'frozen' ? 'Frozen' : 'Active'}
                </StatusPill>
              </div>

              <div className="grid gap-px bg-line sm:grid-cols-3 [&>div]:bg-surface">
                <Figure label="Balance" value={coins(balance.balance)} tone="brand" />
                <Figure label="Lifetime earned" value={coins(balance.lifetimeEarned)} />
                <Figure label="Multiplier" value={`${multiplierFor(sub).value}×`} />
              </div>

              <MemberActions
                userId={selected.id}
                username={selected.discordUsername}
                frozen={selected.status === 'frozen'}
              />

              <div className="border-t border-line">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <Label>Coin ledger</Label>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                    last {ledger.length}
                  </span>
                </div>
                {ledger.length === 0 ? (
                  <p className="px-4 py-6 text-[13.5px] text-muted">
                    No movements yet. Every coin this account ever gains or spends lands here.
                  </p>
                ) : (
                  <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
                    {ledger.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                        <span className="w-[120px] shrink-0 font-mono text-[11.5px] tabular-nums text-faint">
                          {dateShort(entry.createdAt)}
                        </span>
                        <span className="min-w-0 flex-1 text-[13.5px] text-ink-2">{entry.reason}</span>
                        <Num tone={entry.delta >= 0 ? 'brand' : 'danger'} className="w-20 shrink-0 text-right text-[13px]">
                          {entry.delta >= 0 ? '+' : '−'}
                          {coins(Math.abs(entry.delta))}
                        </Num>
                        <Num tone="muted" className="w-20 shrink-0 text-right text-[13px]">
                          {coins(entry.balance)}
                        </Num>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <p className="px-5 py-10 text-center text-[13.5px] text-muted">
                Pick somebody from the list to see their balance, their ledger and the actions you
                can take on the account.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = 'grid size-8 place-items-center rounded-[3px] border transition-colors duration-150';
  if (disabled) {
    return (
      <span aria-disabled className={cn(cls, 'cursor-not-allowed border-line text-faint opacity-45')}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(cls, 'border-line text-ink-2 hover:border-brand hover:text-brand')}>
      {children}
    </Link>
  );
}

function Figure({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'brand' }) {
  return (
    <div className="px-4 py-4">
      <Label className="mb-2">{label}</Label>
      <Num tone={tone} className="text-[22px] leading-none">
        {value}
      </Num>
    </div>
  );
}
