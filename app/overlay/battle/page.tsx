import type { Metadata } from 'next';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { BattleBoard, BattleRosters } from '@/components/site/BattleBoard';
import { SlotArt } from '@/components/site/SlotArt';
import { pts } from '@/lib/battle';
import {
  battleEntriesFor,
  battleTurnsFor,
  featuredBattle,
  summariseBattle,
  type Battle,
  type BattleSummary,
} from '@/lib/store/battle';
import { coins, money } from '@/lib/format';

/**
 * The team battle as an OBS browser source, drawn like the other stream-game
 * overlays: outside the (site) group so none of the site's chrome comes with
 * it, on a transparent background.
 *
 *   /overlay/battle                everything, stacked
 *   /overlay/battle?panel=score    the two totals and the tug-of-war bar
 *   /overlay/battle?panel=now      who is playing for which team, or how to join
 *   /overlay/battle?panel=teams    each team's top scorers
 *   /overlay/battle?panel=stats    the figures, as a strip
 *
 * Before the first battle it draws nothing, so it can stay in a scene.
 */

export const metadata: Metadata = {
  title: 'Team battle overlay',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Panel = 'all' | 'score' | 'now' | 'teams' | 'stats';
const PANELS: Panel[] = ['all', 'score', 'now', 'teams', 'stats'];

export default async function BattleOverlay({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const params = await searchParams;
  const panel: Panel = PANELS.includes(params.panel as Panel) ? (params.panel as Panel) : 'all';

  const battle = await featuredBattle();
  if (!battle) {
    return (
      <div className="ovl">
        <AutoRefresh seconds={10} />
      </div>
    );
  }

  const [turns, entries] = await Promise.all([battleTurnsFor(battle.id), battleEntriesFor(battle.id)]);
  const s = summariseBattle(battle, turns, entries);
  const running = battle.status === 'running';
  const show = (p: Panel) => panel === 'all' || panel === p;

  return (
    <div className={`ovl ovl-p-${panel} ovl-battle`}>
      <AutoRefresh seconds={running ? 3 : 15} />

      {panel === 'all' ? (
        <div className="ovl-card ovl-head">
          <span className={`ovl-phase ${running ? 'opening' : ''}`}>{running ? 'Live' : 'Ended'}</span>
          <b>{battle.title}</b>
        </div>
      ) : null}
      {show('now') ? <Now battle={battle} s={s} /> : null}
      {show('score') ? (
        <div className="ovl-card">
          {/* Stacked under "now", the player is already on screen. */}
          <BattleBoard battle={battle} s={s} variant="ovl" player={panel !== 'all'} />
        </div>
      ) : null}
      {show('teams') ? (
        <div className="ovl-card">
          <BattleRosters battle={battle} s={s} limit={panel === 'all' ? 4 : 6} />
        </div>
      ) : null}
      {show('stats') ? <Stats battle={battle} s={s} /> : null}
    </div>
  );
}

/** The headline: the winners, the member playing, or the call to join. */
function Now({ battle, s }: { battle: Battle; s: BattleSummary }) {
  if (s.winner) {
    return (
      <div className="ovl-card ovl-now ovl-now-text ovl-bingo-win">
        <span className="ovl-label">
          {pts(s.total.a)} – {pts(s.total.b)}
        </span>
        <b className={`ovl-now-name bt-c-${s.winner}`}>{battle.names[s.winner]} win!</b>
        {battle.prize && s.share ? (
          <small>
            {coins(s.share)} MC each to {s.sides[s.winner].linked} member{s.sides[s.winner].linked === 1 ? '' : 's'}
          </small>
        ) : null}
      </div>
    );
  }

  if (battle.status !== 'running') return null;

  if (s.playing) {
    return (
      <div className={`ovl-card ovl-now bt-now-${s.playing.team}`}>
        <SlotArt
          src={s.playing.imageUrl}
          name={s.playing.slotName}
          className="ovl-art big"
          fallbackClassName="ovl-art big ph"
        />
        <div className="ovl-now-body">
          <span className={`ovl-label bt-c-${s.playing.team}`}>Playing for {battle.names[s.playing.team]}</span>
          <b className="ovl-now-name">{s.playing.kickUsername}</b>
          <small>{s.playing.slotName}</small>
          <div className="ovl-now-meta">
            <span>
              {battle.names.a} <b>{pts(s.total.a)}</b> – <b>{pts(s.total.b)}</b> {battle.names.b}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ovl-card ovl-now ovl-now-text">
      <span className="ovl-label">Team battle · pick a side</span>
      {battle.requestsOpen ? (
        <div className="ovl-cta">
          <code>!sr {battle.names.a.toLowerCase()} slot</code> or <code>!sr {battle.names.b.toLowerCase()} slot</code>
        </div>
      ) : (
        <small>Joining is closed</small>
      )}
    </div>
  );
}

function Stats({ battle, s }: { battle: Battle; s: BattleSummary }) {
  const figures: Array<[string, string, string?]> = [
    [battle.names.a, pts(s.total.a), 'blue'],
    [battle.names.b, pts(s.total.b), 'red'],
    ['Round', s.winner ? 'Done' : s.tiebreak || s.round > battle.rounds ? 'Tiebreak' : `${s.round}/${battle.rounds}`],
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
