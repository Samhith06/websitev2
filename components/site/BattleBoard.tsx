import type { CSSProperties } from 'react';
import { pointsOf, pts, TEAMS, type Team } from '@/lib/battle';
import type { Battle, BattleSummary, BattleTurn } from '@/lib/store/battle';
import { SlotArt } from './SlotArt';

/**
 * The battle, drawn the same way on /battle, the stream overlay and the
 * admin screen: the two teams' totals facing each other, a tug-of-war bar
 * between them, where the battle stands (round, tiebreaker, winner) and —
 * while a buy is in play — who is playing for which team.
 *
 * `player={false}` leaves the player out, for a layout that already shows who
 * is playing elsewhere.
 */
export function BattleBoard({
  battle,
  s,
  variant = 'site',
  player = true,
}: {
  battle: Battle;
  s: BattleSummary;
  variant?: 'site' | 'ovl';
  player?: boolean;
}) {
  const sum = s.total.a + s.total.b;
  // Blue's share of the bar; level (or nothing scored) sits in the middle.
  const aShare = sum ? s.total.a / sum : 0.5;

  return (
    <div className={`battle battle-${variant}`}>
      <div className="bt-board">
        <div className="bt-teams">
          {TEAMS.map((t) => (
            <div key={t} className={`bt-team bt-${t} ${s.winner === t ? 'won' : ''} ${s.winner && s.winner !== t ? 'lost' : ''}`}>
              <span className="bt-name">{battle.names[t]}</span>
              <b className="bt-total">{pts(s.total[t])}</b>
              <small className="bt-sub">
                {s.buys[t]}/{battle.rounds} buys · {s.sides[t].members} member{s.sides[t].members === 1 ? '' : 's'}
              </small>
            </div>
          ))}
        </div>
        <div className="bt-tug" style={{ '--a': `${aShare * 100}%` } as CSSProperties}>
          <span className="bt-tug-a" />
          <span className="bt-tug-b" />
        </div>
        <div className="bt-state">
          <State battle={battle} s={s} />
        </div>
      </div>
      {player && s.playing ? <Player battle={battle} turn={s.playing} /> : null}
    </div>
  );
}

function State({ battle, s }: { battle: Battle; s: BattleSummary }) {
  if (s.winner) {
    return (
      <>
        <b className={`bt-c-${s.winner}`}>{battle.names[s.winner]} win</b>
        {battle.prize ? ` · ${s.share ? `${s.share.toLocaleString('en-US')} MC each` : 'no linked members'}` : ''}
      </>
    );
  }
  if (s.tiebreak) return <b>Tied — tiebreaker</b>;
  const lead = s.total.a === s.total.b ? null : s.total.a > s.total.b ? 'a' : 'b';
  return (
    <>
      Round {Math.min(s.round, battle.rounds)} of {battle.rounds}
      {s.round > battle.rounds ? ' · tiebreaker' : ''}
      {lead ? (
        <>
          {' '}· <b className={`bt-c-${lead}`}>{battle.names[lead]}</b> lead by {pts(Math.abs(s.total.a - s.total.b))}
        </>
      ) : s.bought ? (
        ' · level'
      ) : null}
    </>
  );
}

function Player({ battle, turn }: { battle: Battle; turn: BattleTurn }) {
  return (
    <div className={`bt-player bt-${turn.team}`}>
      <SlotArt src={turn.imageUrl} name={turn.slotName} className="raid-atk-art" fallbackClassName="raid-atk-art ph" />
      <div className="boss-body">
        <span className="boss-label">Playing for {battle.names[turn.team]}</span>
        <b className="raid-atk-who">{turn.kickUsername}</b>
        <small className="boss-note">{turn.slotName}</small>
      </div>
    </div>
  );
}

/** Each team's members by points scored, side by side. */
export function BattleRosters({ battle, s, limit = 6 }: { battle: Battle; s: BattleSummary; limit?: number }) {
  return (
    <div className="bt-rosters">
      {TEAMS.map((t: Team) => (
        <div key={t} className={`bt-roster bt-${t}`}>
          <span className="bt-name">{battle.names[t]}</span>
          {s.sides[t].top.length === 0 ? (
            <small className="muted">{s.sides[t].members ? 'No buys yet' : 'Nobody yet'}</small>
          ) : (
            s.sides[t].top.slice(0, limit).map((m) => (
              <div key={m.kickUsername} className="bt-roster-row">
                <b>{m.kickUsername}</b>
                <span>{pts(m.points)}</span>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

/** A buy's points as the chip text: "+45", or "miss" for a buy that paid nothing. */
export function pointsChip(turn: BattleTurn): string {
  const p = pointsOf(turn);
  return p ? `+${pts(p)}` : 'miss';
}
