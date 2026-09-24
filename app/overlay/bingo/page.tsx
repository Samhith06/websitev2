import type { Metadata } from 'next';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { BingoGrid } from '@/components/site/BingoGrid';
import { SlotArt } from '@/components/site/SlotArt';
import { cellLabel, completedLines, lineLabel } from '@/lib/bingo';
import { entriesFor, featuredCard, summarise, turnsFor, type BingoCard, type BingoSummary } from '@/lib/store/bingo';
import { coins, money } from '@/lib/format';

/**
 * Slot bingo as an OBS browser source, drawn like the hunt overlay: outside
 * the (site) group so none of the site's chrome comes with it, on a
 * transparent background.
 *
 *   /overlay/bingo                everything, stacked
 *   /overlay/bingo?panel=card     the card
 *   /overlay/bingo?panel=now      who was drawn and onto which square, or how to join
 *   /overlay/bingo?panel=stats    the figures, as a strip
 *
 * Before the first bingo it draws nothing, so it can stay in a scene.
 */

export const metadata: Metadata = {
  title: 'Bingo overlay',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Panel = 'all' | 'card' | 'now' | 'stats';
const PANELS: Panel[] = ['all', 'card', 'now', 'stats'];

export default async function BingoOverlay({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const params = await searchParams;
  const panel: Panel = PANELS.includes(params.panel as Panel) ? (params.panel as Panel) : 'all';

  const card = await featuredCard();
  if (!card) {
    return (
      <div className="ovl">
        <AutoRefresh seconds={10} />
      </div>
    );
  }

  const [turns, waiting] = await Promise.all([turnsFor(card.id), entriesFor(card.id, 'waiting')]);
  const s = summarise(turns);
  const lines = completedLines(card.size, s.green.keys());
  const running = card.status === 'running';
  const show = (p: Panel) => panel === 'all' || panel === p;

  return (
    <div className={`ovl ovl-p-${panel} ovl-bingo`}>
      <AutoRefresh seconds={running ? 3 : 15} />

      {panel === 'all' ? (
        <div className="ovl-card ovl-head">
          <span className={`ovl-phase ${running ? 'opening' : ''}`}>{running ? 'Live' : 'Ended'}</span>
          <b>{card.title}</b>
        </div>
      ) : null}
      {show('now') ? <Now card={card} s={s} waiting={waiting.length} lines={lines.map((l) => lineLabel(l, card.size))} /> : null}
      {show('card') ? (
        <div className="ovl-card">
          <BingoGrid
            size={card.size}
            green={s.green}
            playing={s.playing}
            onLine={new Set(lines.flatMap((l) => l.positions))}
            variant="ovl"
          />
        </div>
      ) : null}
      {show('stats') ? <Stats card={card} s={s} /> : null}
    </div>
  );
}

/** The headline: BINGO, the viewer being played, or the call to join. */
function Now({ card, s, waiting, lines }: { card: BingoCard; s: BingoSummary; waiting: number; lines: string[] }) {
  if (lines.length > 0) {
    return (
      <div className="ovl-card ovl-now ovl-now-text ovl-bingo-win">
        <span className="ovl-label">{lines.join(' · ')}</span>
        <b className="ovl-now-name gold">BINGO!</b>
        {card.squarePrize ? (
          <small>
            {s.green.size} green square{s.green.size === 1 ? '' : 's'} · {coins(card.squarePrize)} MC each
          </small>
        ) : null}
      </div>
    );
  }

  if (s.playing) {
    return (
      <div className="ovl-card ovl-now">
        <SlotArt
          src={s.playing.imageUrl}
          name={s.playing.slotName}
          className="ovl-art big"
          fallbackClassName="ovl-art big ph"
        />
        <div className="ovl-now-body">
          <span className="ovl-label">Square {cellLabel(s.playing.position, card.size)} · drawn</span>
          <b className="ovl-now-name">{s.playing.kickUsername}</b>
          <small>{s.playing.slotName}</small>
          <div className="ovl-now-meta">
            <span>Profit turns it <b className="green">green</b></span>
          </div>
        </div>
      </div>
    );
  }

  if (card.status !== 'running') return null;
  return (
    <div className="ovl-card ovl-now ovl-now-text">
      <span className="ovl-label">Slot bingo · {waiting} waiting</span>
      {card.requestsOpen ? (
        <div className="ovl-cta">
          Join: <code>!sr slot name</code>
        </div>
      ) : (
        <small>Joining is closed</small>
      )}
    </div>
  );
}

function Stats({ card, s }: { card: BingoCard; s: BingoSummary }) {
  const figures: Array<[string, string, string?]> = [
    ['Green', `${s.green.size}/${card.size * card.size}`, 'green'],
    ['Buys', String(s.bought)],
    ['Spent', money(s.cost)],
    ['Paid back', money(s.won), 'gold'],
    ['Profit', `${s.profit >= 0 ? '+' : ''}${money(s.profit)}`, s.profit >= 0 ? 'green' : 'red'],
  ];
  return (
    <div className="ovl-card ovl-stats">
      {figures.map(([label, value, tone]) => (
        <div key={label}>
          <span>{label}</span>
          <b className={tone}>{value}</b>
        </div>
      ))}
    </div>
  );
}
