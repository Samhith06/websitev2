import Link from 'next/link';
import { coins, dateShort, relativeTime } from '@/lib/format';
import { hasDatabase } from '@/lib/db';
import { multiplierFor, recentUsers, subStateFor } from '@/lib/store/accounts';
import { balanceOf, ledgerFor } from '@/lib/store/coins';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, FilterBar, StatusPill } from '@/components/admin/Table';
import { Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { MemberActions } from '@/components/admin/MemberActions';

export const metadata = { title: 'Members and coins' };
export const dynamic = 'force-dynamic';

const COLS = 'lg:grid-cols-[1fr_150px_110px_130px_130px_110px]';

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;

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

  const members = await recentUsers(50);
  const selectedId = member ? Number(member) : members[0]?.id;
  const selected = members.find((m) => m.id === selectedId) ?? members[0] ?? null;

  const [ledger, balance, sub] = selected
    ? await Promise.all([ledgerFor(selected.id, 12), balanceOf(selected.id), subStateFor(selected.id)])
    : [[], { balance: 0, lifetimeEarned: 0 }, { subActiveUntil: null, isVip: false }];

  return (
    <>
      <AdminHeader eyebrow="Lookup, ledger, adjustments" title="Members and coins" />

      <FilterBar>
        <div className="min-w-[260px] flex-1">
          <Label className="mb-1.5">Search</Label>
          <Input placeholder="Discord name, Kick name or ID" className="h-9 text-[13px]" />
        </div>
      </FilterBar>

      <AdminTable
        cols={COLS}
        columns={['Member', 'Kick link', 'Balance', 'Lifetime earned', 'Joined', 'Status']}
      >
        {members.length === 0 ? (
          <p className="px-4 py-6 text-[13.5px] text-muted">
            Nobody has signed in yet. An account row is created the first time somebody signs in
            with Discord.
          </p>
        ) : null}
        {members.map((row) => (
          <AdminRow key={row.id} cols={COLS} tint={row.status === 'frozen' ? 'danger' : undefined}>
            <Cell className="truncate text-ink">
              <Link href={`/admin/members?member=${row.id}`} className="hover:text-brand">
                {row.discordUsername}
              </Link>
            </Cell>
            <Cell label="Kick">
              {row.kick ? (
                <span className="font-mono text-[13px] text-ink-2">{row.kick.kickUsername}</span>
              ) : (
                /* Not a warning — most people sign in before they verify. It is
                   gold because an unlinked account earns nothing, and that is
                   the first thing to check when someone says coins are broken. */
                <span className="font-mono text-[12.5px] text-gold">unlinked</span>
              )}
            </Cell>
            <Cell label="Balance" className="font-mono tabular-nums text-ink-2">
              {coins(row.balance)}
            </Cell>
            <Cell label="Lifetime" className="font-mono tabular-nums text-faint">
              {coins(row.lifetimeEarned)}
            </Cell>
            <Cell label="Joined" className="font-mono text-[12.5px] tabular-nums text-faint">
              {relativeTime(row.createdAt)}
            </Cell>
            <Cell>
              <StatusPill tone={row.status === 'frozen' ? 'danger' : 'brand'}>
                {row.status === 'frozen' ? 'Frozen' : 'Active'}
              </StatusPill>
            </Cell>
          </AdminRow>
        ))}
      </AdminTable>

      {/* ------------------------------------------------------------- */}
      {/* Member detail — where the work actually happens               */}
      {/* ------------------------------------------------------------- */}
      {selected ? (
        <>
          <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Member detail
          </h2>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3.5">
              <div>
                <p className="text-[15px] text-ink">{selected.discordUsername}</p>
                <p className="mt-0.5 font-mono text-[11.5px] tabular-nums text-faint">
                  {selected.kick
                    ? `Kick: ${selected.kick.kickUsername} (id ${selected.kick.kickUserId})`
                    : 'No Kick link — this account cannot earn from watching'}
                  {' · '}member since {dateShort(selected.createdAt)}
                </p>
              </div>
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
              <div className="border-b border-line px-4 py-3">
                <Label>Coin ledger</Label>
              </div>
              {ledger.length === 0 ? (
                <p className="px-4 py-6 text-[13.5px] text-muted">
                  No movements yet. Every coin this account ever gains or spends lands here.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {ledger.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                      <span className="w-[130px] shrink-0 font-mono text-[11.5px] tabular-nums text-faint">
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
        </>
      ) : null}
    </>
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
