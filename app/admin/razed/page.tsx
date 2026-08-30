import { money, relativeTime } from '@/lib/format';
import { razed } from '@/lib/mock';
import { currentPeriod } from '@/lib/store/periods';
import { fetchRazedLeaderboard, healthFrom } from '@/lib/razed';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, FilterBar, StatusPill } from '@/components/admin/Table';
import { Button, Chip, ChipRow, Input } from '@/components/ui/controls';
import { Label } from '@/components/ui/typography';
import { RazedZ } from '@/components/ui/marks';

export const metadata = { title: 'Razed players' };

const COLS = 'lg:grid-cols-[56px_1fr_180px_130px_100px_140px_90px]';

export default async function RazedPlayersPage() {
  const weekly = await currentPeriod('weekly');
  const from = weekly ? weekly.startsAt.slice(0, 10) : '';
  const to = weekly ? weekly.endsAt.slice(0, 10) : '';

  // The live call, unmasked: a moderator on this screen is verifying a claim
  // against the real usernames Razed returned.
  const feed = weekly ? await fetchRazedLeaderboard({ from, to }) : null;
  const feedHealth = feed
    ? healthFrom(feed)
    : {
        lastSyncAt: new Date().toISOString(),
        status: 'stale' as const,
        code: 'No weekly board is open — set one under Prizes and periods.',
      };
  const players = feed?.ok ? feed.rows : [];

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
          <Input type="date" className="h-9 w-40 text-[13px]" defaultValue={from} />
        </div>
        <div>
          <Label className="mb-1.5">To</Label>
          <Input type="date" className="h-9 w-40 text-[13px]" defaultValue={to} />
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
        {players.map((player) => (
          <AdminRow key={player.rank} cols={COLS}>
            <Cell className="font-mono tabular-nums text-muted">{player.rank}</Cell>

            {/* Unmasked here — a moderator is verifying a claim against it. */}
            <Cell className="truncate text-ink">{player.username}</Cell>

            {/* Nobody is matched yet: matching is a moderator's note held in
                our own store, and that store does not exist. Razed knows
                nothing about our members, so this stays honestly empty. */}
            <Cell label="Matched">
              <span className="inline-flex items-center gap-2 text-[13px] text-gold">
                <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
                Unmatched
              </span>
            </Cell>

            <Cell label="Wagered" className="font-mono tabular-nums text-ink-2">
              {money(player.wagered)}
            </Cell>

            <Cell label="Coins" className="font-mono tabular-nums text-faint">
              &mdash;
            </Cell>

            <Cell label="Last seen" className="font-mono text-[12.5px] tabular-nums text-faint">
              &mdash;
            </Cell>

            <Cell>
              {/* A big wagerer with no account is the highest-value person on
                  this screen, so the action for them is "Invite". */}
              <button
                type="button"
                className="text-[13px] text-brand transition-colors duration-150 hover:text-brand-dim"
              >
                Invite
              </button>
            </Cell>
          </AdminRow>
        ))}
      </AdminTable>

      {/* State the ceiling plainly. Razed returns a top-N list and a moderator
          needs to know they are not looking at everybody. */}
      <p className="mt-3 font-mono text-[11.5px] tabular-nums text-faint">
        {feed?.ok
          ? feed.truncated
            ? `Showing ${feed.returned} of ${feed.total} — Razed paged the rest, so this is not everybody`
            : `Showing all ${feed.total} qualifying players Razed has for this period`
          : `Razed returned nothing — ${feedHealth.code}`}
      </p>

      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        This is a top-N feed, not a per-player lookup: someone below the cut-off does not appear
        here at all, and their absence is not evidence they did not wager. Matching a Razed player
        to a member is a moderator’s note for convenience — it is never used to pay a prize
        automatically.
      </p>
    </>
  );
}
