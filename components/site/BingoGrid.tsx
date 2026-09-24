import type { CSSProperties } from 'react';
import { cellLabel } from '@/lib/bingo';
import { mult } from '@/lib/format';
import type { BingoTurn } from '@/lib/store/bingo';
import { SlotArt } from './SlotArt';

/**
 * A bingo card, drawn the same way on /bingo, the stream overlay and the
 * admin screen. A square is open (just its label), in play (the viewer and
 * slot drawn onto it, pulsing), or green — won by a viewer whose buy made a
 * profit. Green squares on a completed line glow gold: that is the BINGO.
 */
export function BingoGrid({
  size,
  green,
  playing,
  onLine,
  variant = 'site',
}: {
  size: number;
  green: Map<number, BingoTurn>;
  playing: BingoTurn | null;
  onLine: Set<number>;
  variant?: 'site' | 'ovl';
}) {
  return (
    <div className={`bingo bingo-${variant}`} style={{ '--n': size } as CSSProperties}>
      {[...Array(size * size).keys()].map((position) => {
        const turn = green.get(position) ?? (playing?.position === position ? playing : null);
        const state = green.has(position) ? 'won' : turn ? 'live' : 'open';
        const x = turn?.payout != null && turn.buyCost ? turn.payout / turn.buyCost : null;

        return (
          <div key={position} className={`bg-sq ${state} ${onLine.has(position) ? 'line' : ''}`}>
            {turn ? (
              <SlotArt src={turn.imageUrl} name={turn.slotName} className="bg-art" fallbackClassName="bg-art ph" />
            ) : null}
            <span className="bg-pos">{cellLabel(position, size)}</span>
            {turn ? (
              <span className="bg-body">
                <b className="bg-name">{turn.slotName}</b>
                <span className="bg-who">
                  {turn.kickUsername}
                  {x != null ? <b> · {mult(x)}</b> : null}
                </span>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
