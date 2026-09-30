import type { Metadata } from 'next';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { KothThrone } from '@/components/site/KothThrone';
import { SlotArt } from '@/components/site/SlotArt';
import { score } from '@/lib/koth';
import { featuredGame, kothEntriesFor, kothTurnsFor, summariseKoth, type KothGame, type KothSummary } from '@/lib/store/koth';
import { coins, money, mult } from '@/lib/format';

/**
 * King of the hill as an OBS browser source, drawn like the bingo overlay:
 * outside the (site) group so none of the site's chrome comes with it, on a
 * transparent background.
 *
 *   /overlay/koth                everything, stacked
 *   /overlay/koth?panel=hill     the king, and the challenger while one plays
 *   /overlay/koth?panel=now      who is up and what they need, or how to join
 *   /overlay/koth?panel=stats    the figures, as a strip
 *
 * Before the first game it draws nothing, so it can stay in a scene.
 */

export const metadata: Metadata = {
  title: 'King of the hill overlay',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Panel = 'all' | 'hill' | 'now' | 'stats';
const PANELS: Panel[] = ['all', 'hill', 'now', 'stats'];

export default async function KothOverlay({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const params = await searchParams;
  const panel: Panel = PANELS.includes(params.panel as Panel) ? (params.panel as Panel) : 'all';

  const game = await featuredGame();
  if (!game) {
    return (
      <div className="ovl">
        <AutoRefresh seconds={10} />
      </div>
    );
  }

  const [turns, waiting] = await Promise.all([kothTurnsFor(game.id), kothEntriesFor(game.id, 'waiting')]);
  const s = summariseKoth(turns);
  const running = game.status === 'running';
  const show = (p: Panel) => panel === 'all' || panel === p;

  return (
    <div className={`ovl ovl-p-${panel} ovl-koth`}>
      <AutoRefresh seconds={running ? 3 : 15} />

      {panel === 'all' ? (
        <div className="ovl-card ovl-head">
          <span className={`ovl-phase ${running ? 'opening' : ''}`}>{running ? 'Live' : 'Ended'}</span>
          <b>{game.title}</b>
        </div>
      ) : null}
      {show('now') ? <Now game={game} s={s} waiting={waiting.length} /> : null}
      {show('hill') ? (
        <div className="ovl-card">
          {/* Stacked under "now", the challenger is already on screen. */}
          <KothThrone s={s} variant="ovl" challenger={panel !== 'all'} />
        </div>
      ) : null}
      {show('stats') ? <Stats s={s} running={running} /> : null}
    </div>
  );
}

/** The headline: the crowned king once it ends, the challenger, or the call to join. */
function Now({ game, s, waiting }: { game: KothGame; s: KothSummary; waiting: number }) {
  if (game.status !== 'running') {
    if (!s.king) return null;
    return (
      <div className="ovl-card ovl-now ovl-now-text ovl-bingo-win">
        <span className="ovl-label">King of the hill · {mult(score(s.king) ?? 0)}</span>
        <b className="ovl-now-name gold">♛ {s.king.kickUsername}</b>
        {game.prize ? <small>{s.king.slotName} · {coins(game.prize)} MC</small> : <small>{s.king.slotName}</small>}
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
          <span className="ovl-label">Challenger</span>
          <b className="ovl-now-name">{s.playing.kickUsername}</b>
          <small>{s.playing.slotName}</small>
          <div className="ovl-now-meta">
            {s.toBeat == null ? (
              <span>Takes the <b className="green">empty hill</b></span>
            ) : (
              <span>Needs over <b className="gold">{mult(s.toBeat)}</b></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ovl-card ovl-now ovl-now-text">
      <span className="ovl-label">King of the hill · {waiting} waiting</span>
      {game.requestsOpen ? (
        <div className="ovl-cta">
          Join: <code>!sr slot name</code>
        </div>
      ) : (
        <small>Joining is closed</small>
      )}
    </div>
  );
}

function Stats({ s, running }: { s: KothSummary; running: boolean }) {
  const figures: Array<[string, string, string?]> = [
    [running ? 'To beat' : 'King', s.toBeat == null ? '—' : mult(s.toBeat), 'gold'],
    ['Challengers', String(s.bought)],
    ['Dethroned', String(s.dethroned)],
    ['Spent', money(s.cost)],
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
