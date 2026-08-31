import { Power } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins, maybe, mult, relativeTime } from '@/lib/format';
import { KENO_RISK_LABELS, kenoPaytable, kenoRtp } from '@/lib/games';
import { gameConfigs } from '@/lib/mock';
import { disabledGames, gamesAreKilled } from '@/lib/store/settings';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { hasDatabase } from '@/lib/db';
import { coinFlow } from '@/lib/store/coins';
import { biggestRoundsToday } from '@/lib/store/play';
import { AdminHeader } from '@/components/admin/AdminShell';
import { GameToggle, KillSwitch } from '@/components/admin/GameSwitches';
import { AdminRow, AdminTable, Cell, FilterBar } from '@/components/admin/Table';
import { Button, Chip, ChipRow, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import type { GameConfig } from '@/lib/types';

export const metadata = { title: 'Games' };

const FEED_COLS = 'lg:grid-cols-[1fr_100px_100px_110px_120px_110px]';

export const dynamic = 'force-dynamic';

export default async function AdminGamesPage() {
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const [flow, biggestHitsToday, killed, disabled, identity] = await Promise.all([
    hasDatabase() ? coinFlow(weekStart) : Promise.resolve(null),
    hasDatabase() ? biggestRoundsToday(25) : Promise.resolve([]),
    gamesAreKilled(),
    disabledGames(),
    currentIdentity(),
  ]);
  const isOwner = roleFor(identity?.discordId) === 'owner';

  const minted = flow?.minted ?? null;
  const destroyed = flow?.destroyed ?? null;
  const netFlow = minted !== null && destroyed !== null ? minted - destroyed : null;

  return (
    <>
      <AdminHeader
        eyebrow="Everything is data, nothing is deployed"
        title="Games"
      />

      {/* ------------------------------------------------------------- */}
      {/* Kill switch, owner-only, at the top                           */}
      {/* ------------------------------------------------------------- */}
      <KillSwitch killed={killed} isOwner={isOwner} />

      {/* ------------------------------------------------------------- */}
      {/* Coin flow — the number Matty actually needs                   */}
      {/* ------------------------------------------------------------- */}
      <Card className="mb-5">
        <div className="border-b border-line px-4 py-3">
          <Label>Coin flow this week</Label>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3 [&>div]:bg-surface">
          <Figure label="Minted by watching" value={maybe(minted, (n) => `+${coins(n)}`)} tone="brand" />
          <Figure label="Destroyed by the edge" value={maybe(destroyed, (n) => `−${coins(n)}`)} tone="gold" />
          <Figure label="Net" value={maybe(netFlow, (n) => `+${coins(n)}`)} />
        </div>
        <p className="border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          If the games drain faster than the stream mints, the site feels punishing; slower, and the
          shop inflates. At 99% RTP the games are close to neutral rather than a real sink, so the
          lever is shop prices — never the advertised RTP.
        </p>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Per-game config cards                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {gameConfigs.map((game) => (
          <GameConfigCard
            key={game.slug}
            game={game}
            enabled={!disabled.includes(game.slug)}
            isOwner={isOwner}
          />
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Live round feed with the anomaly filters that matter          */}
      {/* ------------------------------------------------------------- */}
      <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Live round feed
      </h2>

      <FilterBar>
        <div className="min-w-[200px]">
          <Label className="mb-1.5">Player</Label>
          <Input placeholder="any player" className="h-9 text-[13px]" />
        </div>
        <ChipRow label="Anomaly filters" className="pb-0.5">
          <Chip active>Biggest wins today</Chip>
          <Chip>Longest win streaks</Chip>
          <Chip>Most rounds per hour</Chip>
        </ChipRow>
      </FilterBar>

      <AdminTable cols={FEED_COLS} columns={['Player', 'Game', 'Bet', 'Multiplier', 'Payout', 'When']}>
        {biggestHitsToday.length === 0 ? (
          <p className="px-4 py-6 text-[13.5px] text-muted">
            No rounds today. Anomalies show up in this feed before they show up in the balances,
            so an empty one is the good case.
          </p>
        ) : null}
        {biggestHitsToday.map((round) => (
          <AdminRow key={round.id} cols={FEED_COLS} tint={round.multiplier > 200 ? 'gold' : undefined}>
            <Cell className="truncate text-ink">{round.player}</Cell>
            <Cell label="Game" className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
              {round.game}
            </Cell>
            <Cell label="Bet" className="font-mono tabular-nums text-ink-2">{coins(round.bet)}</Cell>
            <Cell label="Multi" className="font-mono tabular-nums text-gold">{mult(round.multiplier)}</Cell>
            <Cell label="Payout" className="font-mono tabular-nums text-gold">{coins(round.payout)}</Cell>
            <Cell className="font-mono text-[12px] tabular-nums text-faint">
              {relativeTime(round.createdAt)}
            </Cell>
          </AdminRow>
        ))}
      </AdminTable>

      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        Bots and exploits show up in this feed before they show up in the balances. A player
        appearing under all three anomaly filters at once is worth a look even if no single figure
        is alarming.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function GameConfigCard({
  game,
  enabled,
  isOwner,
}: {
  game: GameConfig;
  enabled: boolean;
  isOwner: boolean;
}) {
  const showPaytable = game.slug === 'keno';
  const table = showPaytable ? kenoPaytable('classic', 6) : [];
  const rtp = showPaytable ? kenoRtp('classic', 6) : game.rtp;

  return (
    <Card className={cn(game.comingSoon && 'opacity-60')}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Label>{game.name}</Label>
        <GameToggle
          slug={game.slug}
          enabled={enabled && !game.comingSoon}
          disabled={Boolean(game.comingSoon)}
          isOwner={isOwner}
        />
      </div>

      {/* Read-only, deliberately. These live in `lib/games.ts` and the keno
          tables in `data/keno-paytables.json`, where `npm run check:rtp`
          verifies all forty land on 99%. A box here that let somebody type an
          arbitrary RTP would make the figure printed on every game page untrue
          with no check in the way, which is a worse outcome than editing a
          file and shipping it. */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <Field label="RTP" value={`${(game.rtp * 100).toFixed(2)}%`} />
        <Field label="Min bet" value={`${game.minBet} MC`} />
        <Field label="Max bet" value={`${game.maxBet} MC`} />
        <Field label="Max win" value={`${coins(game.maxWin)} MC`} />
      </div>

      {showPaytable ? (
        <div className="border-t border-line">
          <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
            <Label>Paytable · {KENO_RISK_LABELS.classic}, 6 picks</Label>
            <Num tone="muted" className="text-[11.5px]">
              RTP {(rtp * 100).toFixed(2)}%
            </Num>
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {table.map((multiplier, hits) => (
              <div key={hits} className="flex items-center gap-3 border-b border-line px-4 py-1.5 last:border-b-0">
                <span className="w-16 shrink-0 font-mono text-[12px] tabular-nums text-muted">
                  {hits} hit{hits === 1 ? '' : 's'}
                </span>
                <span className="w-24 shrink-0 font-mono text-[12.5px] tabular-nums text-ink-2">
                  {mult(multiplier)}
                </span>
                <span className="font-mono text-[11.5px] text-faint">
                  {multiplier === 0 ? 'losing tier — shown to players explicitly' : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
            All forty tables (four risk levels × ten pick counts) live in
            <code className="mx-1 font-mono">data/keno-paytables.json</code> and are checked by
            <code className="mx-1 font-mono">npm run check:rtp</code>. The RTP above is recomputed
            from the table itself, so a bad edit fails the check before it ships.
          </p>
        </div>
      ) : null}

    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <Num className="text-[15px]">{value}</Num>
    </div>
  );
}

function Figure({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'brand' | 'gold' }) {
  return (
    <div className="px-4 py-4">
      <Label className="mb-2">{label}</Label>
      <Num tone={tone} className="text-[24px] leading-none">
        {value}
      </Num>
    </div>
  );
}
