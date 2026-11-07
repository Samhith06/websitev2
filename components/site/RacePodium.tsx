import { Crown } from 'lucide-react';
import { money } from '@/lib/format';
import type { LeaderboardRow } from '@/lib/types';

/** Dollars at full size, cents small, split so neither can round the other. */
function Wagered({ amount }: { amount: number }) {
  const [dollars, cents] = amount.toFixed(2).split('.');
  return (
    <div className="lbp-sum">
      {money(Number(dollars))}
      <small>.{cents}</small>
    </div>
  );
}

function Spot({ row, place }: { row: LeaderboardRow; place: 1 | 2 | 3 }) {
  return (
    <div className={`lbp-spot r${place}`}>
      {place === 1 ? <Crown className="lbp-crown" size={24} fill="currentColor" aria-hidden /> : null}
      <div className="lbp-face" aria-hidden>
        {row.maskedUsername.charAt(0).toUpperCase()}
        <i>{place}</i>
      </div>
      <div className="lbp-name">
        <span className="sr-only">Place {place}: </span>
        {row.maskedUsername}
      </div>
      <Wagered amount={row.wagered} />
      <div className="lbp-cap">Wagered</div>
      <div className="lbp-prize">
        <span>Prize</span>
        <b>{row.prize ? money(row.prize) : '—'}</b>
      </div>
      <div className="lbp-plinth" aria-hidden>
        {place}
      </div>
    </div>
  );
}

/**
 * The top three, in the order a podium stands: second, first, third. Reading
 * order follows it too, so each spot says its own place out loud rather than
 * leaving a screen reader to imply it from where the column sits.
 */
export function RacePodium({ rows }: { rows: LeaderboardRow[] }) {
  const [first, second, third] = rows;
  return (
    <div className="lbp" role="group" aria-label="Top three">
      {second ? <Spot row={second} place={2} /> : <div />}
      {first ? <Spot row={first} place={1} /> : <div />}
      {third ? <Spot row={third} place={3} /> : <div />}
    </div>
  );
}
