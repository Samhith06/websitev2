import { Power } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins, maybe, mult, relativeTime } from '@/lib/format';
import { KENO_RISK_LABELS, kenoPaytable, kenoRtp } from '@/lib/games';
import { gameConfigs, gamesKilled } from '@/lib/mock';
import { hasDatabase } from '@/lib/db';
import { coinFlow } from '@/lib/store/coins';
import { biggestRoundsToday } from '@/lib/store/play';
import { AdminHeader } from '@/components/admin/AdminShell';
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

  const [flow, biggestHitsToday] = await Promise.all([
    hasDatabase() ? coinFlow(weekStart) : Promise.resolve(null),
    hasDatabase() ? biggestRoundsToday(25) : Promise.resolve([]),
  ]);

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
      <Card tone={gamesKilled ? 'danger' : 'default'} className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-start gap-3">
            <Power size={18} className={cn('mt-0.5 shrink-0', gamesKilled ? 'text-danger' : 'text-muted')} />
            <div>
              <p className="text-[15px] text-ink">
                {gamesKilled ? 'Every game is currently disabled' : 'Kill switch'}
              </p>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">
                Disables every game instantly, without a deploy. The lobby is replaced by a single
                message and every play endpoint refuses. Rounds already in progress still settle.
              </p>
            </div>
          </div>
          <Button variant={gamesKilled ? 'primary' : 'danger'}>
            {gamesKilled ? 'Bring games back' : 'Disable every game'}
          </Button>
        </div>
      </Card>

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
          <GameConfigCard key={game.slug} game={game} />
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

function GameConfigCard({ game }: { game: GameConfig }) {
  const showPaytable = game.slug === 'keno';
  const table = showPaytable ? kenoPaytable('classic', 6) : [];
  const rtp = showPaytable ? kenoRtp('classic', 6) : game.rtp;

  return (
    <Card className={cn(game.comingSoon && 'opacity-60')}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Label>{game.name}</Label>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            defaultChecked={game.enabled}
            disabled={game.comingSoon}
            className="size-4 accent-[#2B8FFF]"
          />
          Enabled
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <Field label="RTP" defaultValue={game.rtp} step="0.001" />
        <Field label="Min bet" defaultValue={game.minBet} />
        <Field label="Max bet" defaultValue={game.maxBet} />
        <Field label="Max win" defaultValue={game.maxWin} />
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
                <Input
                  defaultValue={multiplier}
                  className="h-7 w-24 text-[12px]"
                  type="number"
                  step="0.01"
                />
                <span className="font-mono text-[11.5px] text-faint">
                  {multiplier === 0 ? 'losing tier — shown to players explicitly' : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
            All forty tables (four risk levels × ten pick counts) are editable. The RTP above is
            recomputed from the table itself, so a bad edit shows up here before it ships.
          </p>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
        <Button variant="outline" size="sm" disabled={game.comingSoon}>Preview</Button>
        <Button size="sm" disabled={game.comingSoon}>Save</Button>
      </div>
    </Card>
  );
}

function Field({ label, defaultValue, step }: { label: string; defaultValue: number; step?: string }) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <Input type="number" step={step} defaultValue={defaultValue} className="h-9 text-[13px]" />
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
