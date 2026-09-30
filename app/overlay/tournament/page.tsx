import type { Metadata } from 'next';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { TourneyBracket, TourneyVersus } from '@/components/site/TourneyBracket';
import { roundName, roundShort } from '@/lib/tourney';
import {
  featuredTourney,
  summariseTourney,
  tourneyEntriesFor,
  tourneyMatchesFor,
  tourneyTurnsFor,
  type Tourney,
  type TourneyEntry,
  type TourneySummary,
} from '@/lib/store/tourney';
import { coins, money } from '@/lib/format';

/**
 * The slot tournament as an OBS browser source, drawn like the other
 * stream-game overlays: outside the (site) group so none of the site's chrome
 * comes with it, on a transparent background.
 *
 *   /overlay/tournament                 everything, stacked
 *   /overlay/tournament?panel=bracket   the bracket
 *   /overlay/tournament?panel=match     the match being played, head to head;
 *                                       during sign-ups, how to enter
 *   /overlay/tournament?panel=stats     the figures, as a strip
 *
 * Before the first tournament it draws nothing, so it can stay in a scene.
 */

export const metadata: Metadata = {
  title: 'Tournament overlay',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Panel = 'all' | 'bracket' | 'match' | 'stats';
const PANELS: Panel[] = ['all', 'bracket', 'match', 'stats'];

export default async function TourneyOverlay({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const params = await searchParams;
  const panel: Panel = PANELS.includes(params.panel as Panel) ? (params.panel as Panel) : 'all';

  const t = await featuredTourney();
  if (!t) {
    return (
      <div className="ovl">
        <AutoRefresh seconds={10} />
      </div>
    );
  }

  const [entries, matches, turns] = await Promise.all([
    tourneyEntriesFor(t.id),
    tourneyMatchesFor(t.id),
    tourneyTurnsFor(t.id),
  ]);
  const s = summariseTourney(t, entries, matches, turns);
  const live = t.status !== 'finished';
  const show = (p: Panel) => panel === 'all' || panel === p;

  return (
    <div className={`ovl ovl-p-${panel} ovl-tourney`}>
      <AutoRefresh seconds={live ? 3 : 15} />

      {panel === 'all' ? (
        <div className="ovl-card ovl-head">
          <span className={`ovl-phase ${live ? 'opening' : ''}`}>
            {t.status === 'signup' ? 'Sign-ups' : live ? 'Live' : 'Ended'}
          </span>
          <b>{t.title}</b>
        </div>
      ) : null}
      {show('match') ? <Match t={t} s={s} entries={entries} /> : null}
      {show('bracket') && t.status !== 'signup' ? (
        <div className="ovl-card">
          <TourneyBracket s={s} variant="ovl" />
        </div>
      ) : null}
      {show('stats') ? <Stats t={t} s={s} entries={entries} /> : null}
    </div>
  );
}

/** The headline: how to enter, the match being played, or the champion. */
function Match({ t, s, entries }: { t: Tourney; s: TourneySummary; entries: TourneyEntry[] }) {
  if (t.status === 'signup') {
    return (
      <div className="ovl-card ovl-now ovl-now-text">
        <span className="ovl-label">
          Slot tournament · {entries.length} of {t.size} signed up
        </span>
        {t.requestsOpen ? (
          <div className="ovl-cta">
            Enter: <code>!sr slot name</code>
          </div>
        ) : (
          <small>Sign-ups are closed</small>
        )}
      </div>
    );
  }
  if (s.champion) {
    // The prize is shown while it is still to be paid, or once it has been —
    // not after an ending that could not pay it (no linked account).
    const champ = entries.find((e) => e.id === s.champion?.entryId);
    const prize = t.prize && (t.status === 'running' || (champ?.paid ?? 0) > 0) ? ` · ${coins(t.prize)} MC` : '';
    return (
      <div className="ovl-card ovl-now ovl-now-text ovl-bingo-win">
        <span className="ovl-label">{t.title} · champion</span>
        <b className="ovl-now-name gold">♜ {s.champion.kickUsername}</b>
        <small>
          {s.runnerUp ? `beat ${s.runnerUp.kickUsername} in the final` : ''}
          {prize}
        </small>
      </div>
    );
  }
  if (!s.current) return null;
  return (
    <div className="ovl-card">
      <TourneyVersus s={s} round={roundName(s.current.round, s.rounds)} />
    </div>
  );
}

function Stats({ t, s, entries }: { t: Tourney; s: TourneySummary; entries: TourneyEntry[] }) {
  const figures: Array<[string, string, string?]> = [
    ['Round', s.champion ? 'Done' : s.current ? roundShort(s.current.round, s.rounds) : t.status === 'signup' ? 'Sign-up' : '—', 'gold'],
    ['Still in', t.status === 'signup' ? String(entries.length) : String(s.alive.size), 'blue'],
    ['Buys', String(s.bought)],
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
