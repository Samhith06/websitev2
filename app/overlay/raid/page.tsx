import type { Metadata } from 'next';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { BossCard, RaidDamageBoard } from '@/components/site/BossCard';
import { SlotArt } from '@/components/site/SlotArt';
import { damageOf, hp } from '@/lib/raid';
import { featuredRaid, raidEntriesFor, raidTurnsFor, summariseRaid, type Raid, type RaidSummary } from '@/lib/store/raid';
import { coins, money } from '@/lib/format';

/**
 * The boss raid as an OBS browser source, drawn like the other stream-game
 * overlays: outside the (site) group so none of the site's chrome comes with
 * it, on a transparent background.
 *
 *   /overlay/raid                everything, stacked
 *   /overlay/raid?panel=boss     the boss and its health bar
 *   /overlay/raid?panel=now      who is attacking and what finishes it, or how to join
 *   /overlay/raid?panel=board    damage by viewer
 *   /overlay/raid?panel=stats    the figures, as a strip
 *
 * Before the first raid it draws nothing, so it can stay in a scene.
 */

export const metadata: Metadata = {
  title: 'Boss raid overlay',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Panel = 'all' | 'boss' | 'now' | 'board' | 'stats';
const PANELS: Panel[] = ['all', 'boss', 'now', 'board', 'stats'];

export default async function RaidOverlay({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const params = await searchParams;
  const panel: Panel = PANELS.includes(params.panel as Panel) ? (params.panel as Panel) : 'all';

  const raid = await featuredRaid();
  if (!raid) {
    return (
      <div className="ovl">
        <AutoRefresh seconds={10} />
      </div>
    );
  }

  const [turns, waiting] = await Promise.all([raidTurnsFor(raid.id), raidEntriesFor(raid.id, 'waiting')]);
  const s = summariseRaid(raid, turns);
  const running = raid.status === 'running';
  const show = (p: Panel) => panel === 'all' || panel === p;

  return (
    <div className={`ovl ovl-p-${panel} ovl-raid`}>
      <AutoRefresh seconds={running ? 3 : 15} />

      {panel === 'all' ? (
        <div className="ovl-card ovl-head">
          <span className={`ovl-phase ${running ? 'opening' : ''}`}>{running ? 'Live' : 'Ended'}</span>
          <b>Boss Raid</b>
        </div>
      ) : null}
      {show('now') ? <Now raid={raid} s={s} waiting={waiting.length} /> : null}
      {show('boss') ? (
        <div className="ovl-card">
          {/* Stacked under "now", the attacker is already on screen. */}
          <BossCard raid={raid} s={s} variant="ovl" attacker={panel !== 'all'} />
        </div>
      ) : null}
      {show('board') && s.raiders.length > 0 ? (
        <div className="ovl-card">
          <span className="ovl-label">Top damage</span>
          <RaidDamageBoard s={s} limit={panel === 'all' ? 5 : 8} />
        </div>
      ) : null}
      {show('stats') ? <Stats s={s} /> : null}
    </div>
  );
}

/** The headline: SLAIN, the raider attacking, or the call to join. */
function Now({ raid, s, waiting }: { raid: Raid; s: RaidSummary; waiting: number }) {
  if (s.slain && s.killer) {
    return (
      <div className="ovl-card ovl-now ovl-now-text ovl-bingo-win">
        <span className="ovl-label">{raid.boss} · killing blow −{hp(damageOf(s.killer) ?? 0)}</span>
        <b className="ovl-now-name gold">SLAIN by {s.killer.kickUsername}</b>
        {raid.prize ? <small>{s.killer.slotName} · {coins(raid.prize)} MC</small> : <small>{s.killer.slotName}</small>}
      </div>
    );
  }

  if (raid.status !== 'running') return null;

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
          <span className="ovl-label">Attacking {raid.boss}</span>
          <b className="ovl-now-name">{s.playing.kickUsername}</b>
          <small>{s.playing.slotName}</small>
          <div className="ovl-now-meta">
            <span>
              <b className="gold">{hp(s.hpLeft)}×</b> finishes it
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ovl-card ovl-now ovl-now-text">
      <span className="ovl-label">Boss raid · {waiting} waiting</span>
      {raid.requestsOpen ? (
        <div className="ovl-cta">
          Join the raid: <code>!sr slot name</code>
        </div>
      ) : (
        <small>Joining is closed</small>
      )}
    </div>
  );
}

function Stats({ s }: { s: RaidSummary }) {
  const figures: Array<[string, string, string?]> = [
    ['HP left', hp(s.hpLeft), s.slain ? 'green' : 'red'],
    ['Hits', String(s.bought)],
    ['Damage', hp(s.dealt), 'gold'],
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
