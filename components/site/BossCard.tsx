import type { CSSProperties } from 'react';
import { damageOf, hp } from '@/lib/raid';
import type { Raid, RaidSummary, RaidTurn } from '@/lib/store/raid';
import { SlotArt } from './SlotArt';

/**
 * The boss, drawn the same way on /raid, the stream overlay and the admin
 * screen: its name and health bar, the last hit it took, and — while a buy is
 * in play — the raider attacking it. Once the killing blow lands it is struck
 * through and names who slew it.
 *
 * `attacker={false}` leaves the attacker out, for a layout that already shows
 * who is playing elsewhere.
 */
export function BossCard({
  raid,
  s,
  variant = 'site',
  attacker = true,
}: {
  raid: Raid;
  s: RaidSummary;
  variant?: 'site' | 'ovl';
  attacker?: boolean;
}) {
  const left = s.maxHp ? s.hpLeft / s.maxHp : 0;
  const tone = s.slain ? 'dead' : left <= 0.25 ? 'low' : left <= 0.5 ? 'mid' : 'high';

  return (
    <div className={`raid raid-${variant}`}>
      <div className={`boss boss-${tone}`}>
        <BossGlyph />
        <div className="boss-body">
          <span className="boss-label">{s.slain ? 'Slain' : 'Boss'}</span>
          <b className="boss-name">{raid.boss}</b>
          <div className="boss-bar" role="meter" aria-valuemin={0} aria-valuemax={s.maxHp / 100} aria-valuenow={s.hpLeft / 100} aria-label="Boss HP">
            <span style={{ '--hp': `${Math.max(0, Math.min(1, left)) * 100}%` } as CSSProperties} />
          </div>
          <span className="boss-hp">
            <b>{hp(s.hpLeft)}</b> / {hp(s.maxHp)} HP
          </span>
          {s.slain && s.killer ? (
            <small className="boss-note">
              Killing blow: <b>{s.killer.kickUsername}</b> for {hp(damageOf(s.killer) ?? 0)}
              {s.overkill ? ` (${hp(s.overkill)} overkill)` : ''}
            </small>
          ) : s.lastHit ? (
            <small className="boss-note">
              {damageOf(s.lastHit) ? (
                <>
                  Last hit: <b>−{hp(damageOf(s.lastHit) ?? 0)}</b> from {s.lastHit.kickUsername}
                </>
              ) : (
                <>
                  Last hit: <b>missed</b> — {s.lastHit.kickUsername}&apos;s buy paid nothing
                </>
              )}
            </small>
          ) : (
            <small className="boss-note">Untouched. The first hit is yours.</small>
          )}
        </div>
      </div>
      {attacker && s.playing ? <Attacker turn={s.playing} hpLeft={s.hpLeft} /> : null}
    </div>
  );
}

function Attacker({ turn, hpLeft }: { turn: RaidTurn; hpLeft: number }) {
  return (
    <div className="raid-atk">
      <SlotArt src={turn.imageUrl} name={turn.slotName} className="raid-atk-art" fallbackClassName="raid-atk-art ph" />
      <div className="boss-body">
        <span className="boss-label">Attacking now</span>
        <b className="raid-atk-who">{turn.kickUsername}</b>
        <small className="boss-note">{turn.slotName}</small>
        <span className="raid-atk-need">
          A <b>{hp(hpLeft)}×</b> hit finishes it
        </span>
      </div>
    </div>
  );
}

/** A horned head, drawn in currentColor so the card's state colours it. */
function BossGlyph() {
  return (
    <svg className="boss-glyph" viewBox="0 0 120 120" aria-hidden="true">
      <path className="boss-horn" d="M26 50 C14 36 12 18 20 6 C24 22 32 32 44 38 Z" />
      <path className="boss-horn" d="M94 50 C106 36 108 18 100 6 C96 22 88 32 76 38 Z" />
      <path
        className="boss-head"
        d="M60 28 C84 28 98 44 98 66 C98 86 86 104 72 110 L66 102 L60 110 L54 102 L48 110 C34 104 22 86 22 66 C22 44 36 28 60 28 Z"
      />
      <path className="boss-eye" d="M36 60 L54 66 L50 74 C42 74 37 69 36 60 Z" />
      <path className="boss-eye" d="M84 60 L66 66 L70 74 C78 74 83 69 84 60 Z" />
      <path className="boss-mouth" d="M42 86 L48 92 L54 86 L60 92 L66 86 L72 92 L78 86" />
    </svg>
  );
}

/**
 * Damage by viewer, most first. The prize is the killing blow's; this is for
 * bragging. The viewer who landed it is marked ⚔ and in gold.
 */
export function RaidDamageBoard({ s, limit = 8 }: { s: RaidSummary; limit?: number }) {
  if (s.raiders.length === 0) return null;
  const top = s.raiders[0].damage || 1;
  return (
    <div className="raid-board">
      {s.raiders.slice(0, limit).map((r, i) => (
        <div
          key={r.kickUsername}
          className={`raid-board-row ${s.killer?.kickUsername === r.kickUsername ? 'killer' : ''}`}
          title={s.killer?.kickUsername === r.kickUsername ? 'Landed the killing blow' : undefined}
        >
          <span className="raid-board-rank">{i + 1}</span>
          <b>
            {r.kickUsername}
            {s.killer?.kickUsername === r.kickUsername ? ' ⚔' : ''}
          </b>
          <span className="raid-board-bar">
            <span style={{ width: `${(r.damage / top) * 100}%` }} />
          </span>
          <span className="raid-board-dmg">{hp(r.damage)}</span>
        </div>
      ))}
    </div>
  );
}
