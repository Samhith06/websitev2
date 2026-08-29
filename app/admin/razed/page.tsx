import { coins, money, relativeTime } from '@/lib/format';
import { feedHealth, razed, razedPlayers, razedReturnedCount } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, FilterBar, StatusPill } from '@/components/admin/Table';
import { Button, Chip, ChipRow, Input } from '@/components/ui/controls';
import { Label } from '@/components/ui/typography';
import { RazedZ } from '@/components/ui/marks';

export const metadata = { title: 'Razed players' };

const COLS = 'lg:grid-cols-[56px_1fr_180px_130px_100px_140px_90px]';

export default function RazedPlayersPage() {
  const health =
    feedHealth.status === 'healthy'
      ? { tone: 'brand' as const, text: `Feed healthy · ${feedHealth.code}` }
      : feedHealth.status === 'stale'
        ? { tone: 'gold' as const, text: `Stale · last OK ${relativeTime(feedHealth.lastSyncAt)}` }
        : { tone: 'danger' as const, text: `Failing · ${feedHealth.code}` };

  return (
    <>
      <AdminHeader
        eyebrow={
          <>
            <RazedZ size={15} />
            Razed · referrals/leaderboard · code {razed.referralCode}
          </>
        }
        title="Razed players"
        right={
          <>
            <span className="font-mono text-[11.5px] tabular-nums text-faint">
              Synced {relativeTime(feedHealth.lastSyncAt)}
            </span>
            <Button variant="outline" size="sm">Sync now</Button>
            <Button size="sm">Export CSV</Button>
          </>
        }
      />

      <FilterBar
        right={<StatusPill tone={health.tone}>{health.text}</StatusPill>}
      >
        <div>
          <Label className="mb-1.5">From</Label>
          <Input type="date" className="h-9 w-40 text-[13px]" defaultValue="2026-08-24" />
        </div>
        <div>
          <Label className="mb-1.5">To</Label>
          <Input type="date" className="h-9 w-40 text-[13px]" defaultValue="2026-08-31" />
        </div>
        <div>
          <Label className="mb-1.5">Top</Label>
          <Input type="number" className="h-9 w-20 text-[13px]" defaultValue={25} />
        </div>
        <ChipRow label="Preset period" className="pb-0.5">
          <Chip active>This week</Chip>
          <Chip>This month</Chip>
          <Chip>Custom</Chip>
        </ChipRow>
      </FilterBar>

      <AdminTable
        cols={COLS}
        columns={['Rank', 'Razed player', 'Matched member', 'Wagered', 'Coins', 'Last seen in chat', '']}
      >
        {razedPlayers.map((player) => (
          <AdminRow key={player.rank} cols={COLS} tint={player.flag ? 'danger' : undefined}>
            <Cell className="font-mono tabular-nums text-muted">{player.rank}</Cell>

            {/* Unmasked here — a moderator is verifying a claim against it. */}
            <Cell className="truncate text-ink">{player.username}</Cell>

            <Cell label="Matched">
              {player.flag ? (
                <span className="inline-flex items-center gap-2 text-[13px] text-danger">
                  <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
                  <span className="truncate">{player.flag}</span>
                </span>
              ) : player.matched ? (
                <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span className="truncate">{player.matched.discord}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px] text-gold">
                  <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                  Unmatched
                </span>
              )}
            </Cell>

            <Cell label="Wagered" className="font-mono tabular-nums text-ink-2">
              {money(player.wagered)}
            </Cell>

            <Cell label="Coins" className="font-mono tabular-nums text-ink-2">
              {coins(player.coins)}
            </Cell>

            <Cell label="Last seen" className="font-mono text-[12.5px] tabular-nums text-faint">
              {player.lastSeenInChat ? relativeTime(player.lastSeenInChat) : 'never'}
            </Cell>

            <Cell>
              {/* A big wagerer with no account is the highest-value person on
                  this screen, so the action for them is "Invite". */}
              <button
                type="button"
                className="text-[13px] text-brand transition-colors duration-150 hover:text-brand-dim"
              >
                {player.matched ? 'View' : 'Invite'}
              </button>
            </Cell>
          </AdminRow>
        ))}
      </AdminTable>

      {/* State the ceiling plainly. Razed returns a top-N list and a moderator
          needs to know they are not looking at everybody. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11.5px] tabular-nums text-faint">
          Showing {razedPlayers.length} of {razedReturnedCount} returned by Razed
        </span>
        <button type="button" className="text-[13px] text-brand hover:text-brand-dim">
          Show all {razedReturnedCount}
        </button>
      </div>

      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        This is a top-N feed, not a per-player lookup: someone below the cut-off does not appear
        here at all, and their absence is not evidence they did not wager. Matching a Razed player
        to a member is a moderator’s note for convenience — it is never used to pay a prize
        automatically.
      </p>
    </>
  );
}
