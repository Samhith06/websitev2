import { coins, dateShort, relativeTime } from '@/lib/format';
import { ledger, razedPlayers, viewer } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, FilterBar, StatusPill } from '@/components/admin/Table';
import { Button, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';

export const metadata = { title: 'Members and coins' };

const COLS = 'lg:grid-cols-[1fr_150px_110px_130px_130px_110px]';

/** Every member row is derived from the same feed the Razed screen reads. */
const members = razedPlayers.slice(0, 6).map((player, i) => ({
  id: player.username,
  discord: player.matched?.discord ?? `${player.username}#${2000 + i}`,
  kick: player.matched ? player.username : null,
  balance: player.coins,
  lifetime: player.coins * 3 + 400,
  lastSeen: player.lastSeenInChat,
  frozen: Boolean(player.flag),
}));

export default function MembersPage() {
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
        columns={['Member', 'Kick link', 'Balance', 'Lifetime earned', 'Last seen', 'Status']}
      >
        {members.map((member) => (
          <AdminRow key={member.id} cols={COLS} tint={member.frozen ? 'danger' : undefined}>
            <Cell className="truncate text-ink">{member.discord}</Cell>
            <Cell label="Kick">
              {member.kick ? (
                <span className="font-mono text-[13px] text-ink-2">{member.kick}</span>
              ) : (
                <span className="font-mono text-[12.5px] text-gold">unlinked</span>
              )}
            </Cell>
            <Cell label="Balance" className="font-mono tabular-nums text-ink-2">
              {coins(member.balance)}
            </Cell>
            <Cell label="Lifetime" className="font-mono tabular-nums text-faint">
              {coins(member.lifetime)}
            </Cell>
            <Cell label="Last seen" className="font-mono text-[12.5px] tabular-nums text-faint">
              {member.lastSeen ? relativeTime(member.lastSeen) : 'never'}
            </Cell>
            <Cell>
              <StatusPill tone={member.frozen ? 'danger' : 'brand'}>
                {member.frozen ? 'Frozen' : 'Active'}
              </StatusPill>
            </Cell>
          </AdminRow>
        ))}
      </AdminTable>

      {/* ------------------------------------------------------------- */}
      {/* Member detail — where the work actually happens               */}
      {/* ------------------------------------------------------------- */}
      <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Member detail
      </h2>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3.5">
          <div>
            <p className="text-[15px] text-ink">{viewer.discordUsername}</p>
            <p className="mt-0.5 font-mono text-[11.5px] tabular-nums text-faint">
              Kick: {viewer.kick?.kickUsername} (id {viewer.kick?.kickUserId}) · member since{' '}
              {dateShort(viewer.memberSince)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">Adjust coins</Button>
            <Button variant="danger" size="sm">Freeze earning</Button>
          </div>
        </div>

        <div className="grid gap-px bg-line sm:grid-cols-4 [&>div]:bg-surface">
          <Figure label="Balance" value={coins(viewer.balance)} tone="brand" />
          <Figure label="Lifetime earned" value={coins(viewer.lifetimeEarned)} />
          <Figure label="Multiplier" value={`${viewer.multiplier.value}×`} />
        </div>

        {/* The reason field is mandatory for a reason: six months later the
            audit log needs to say why someone got 500 coins, and "adjustment"
            is not an answer. */}
        <div className="border-t border-line px-4 py-4">
          <Label className="mb-2">Coin adjustment</Label>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="mb-1.5">Amount</Label>
              <Input type="number" defaultValue={0} className="h-9 w-28 text-[13px]" />
            </div>
            <div className="min-w-[240px] flex-1">
              <Label className="mb-1.5">Reason (required)</Label>
              <Input placeholder="why this adjustment is being made" className="h-9 text-[13px]" />
            </div>
            <Button size="sm" disabled>
              Apply adjustment
            </Button>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            A moderator’s adjustment is capped at 500 MC; above that the field reads “Owner approval
            required” rather than failing on submit. Every adjustment writes an audit row naming the
            admin and carrying this reason.
          </p>
        </div>

        <div className="border-t border-line">
          <div className="border-b border-line px-4 py-3">
            <Label>Coin ledger</Label>
          </div>
          <ul className="divide-y divide-line">
            {ledger.slice(0, 6).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="w-[130px] shrink-0 font-mono text-[11.5px] tabular-nums text-faint">
                  {dateShort(entry.createdAt)}
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] text-ink-2">
                  {entry.reason}
                  {entry.moderator ? <span className="ml-2 text-muted">{entry.moderator}</span> : null}
                </span>
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
        </div>
      </Card>
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
