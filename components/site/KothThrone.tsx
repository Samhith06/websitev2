import { mult, money } from '@/lib/format';
import { score } from '@/lib/koth';
import type { KothSummary, KothTurn } from '@/lib/store/koth';
import { SlotArt } from './SlotArt';

/**
 * The hill, drawn the same way on /koth, the stream overlay and the admin
 * screen: the king on top — their slot's art, who called it and the
 * multiplier to beat — and, while a buy is in play, the challenger beneath
 * them. An empty hill says the first buy takes it.
 *
 * `challenger={false}` leaves the challenger out, for a layout that already
 * shows who is playing elsewhere.
 */
export function KothThrone({
  s,
  variant = 'site',
  challenger = true,
}: {
  s: KothSummary;
  variant?: 'site' | 'ovl';
  challenger?: boolean;
}) {
  return (
    <div className={`koth koth-${variant}`}>
      {s.king ? <King turn={s.king} defences={s.defences} /> : <EmptyHill />}
      {challenger && s.playing ? <Challenger turn={s.playing} toBeat={s.toBeat} /> : null}
    </div>
  );
}

function King({ turn, defences }: { turn: KothTurn; defences: number }) {
  return (
    <div className="kt kt-king">
      <SlotArt src={turn.imageUrl} name={turn.slotName} className="kt-art" fallbackClassName="kt-art ph" />
      <div className="kt-body">
        <span className="kt-label">♛ King of the hill</span>
        <b className="kt-who">{turn.kickUsername}</b>
        <small className="kt-slot">{turn.slotName}</small>
        <span className="kt-x">{mult(score(turn) ?? 0)}</span>
        <small className="kt-meta">
          {turn.payout != null && turn.buyCost ? `${money(turn.payout)} from ${money(turn.buyCost)}` : null}
          {defences > 0 ? ` · held off ${defences}` : ''}
        </small>
      </div>
    </div>
  );
}

function Challenger({ turn, toBeat }: { turn: KothTurn; toBeat: number | null }) {
  return (
    <div className="kt kt-challenger">
      <SlotArt src={turn.imageUrl} name={turn.slotName} className="kt-art" fallbackClassName="kt-art ph" />
      <div className="kt-body">
        <span className="kt-label">Challenger · playing now</span>
        <b className="kt-who">{turn.kickUsername}</b>
        <small className="kt-slot">{turn.slotName}</small>
        <span className="kt-need">{toBeat == null ? 'Takes the empty hill' : <>Needs over <b>{mult(toBeat)}</b></>}</span>
      </div>
    </div>
  );
}

function EmptyHill() {
  return (
    <div className="kt kt-empty">
      <span className="kt-crown">♛</span>
      <div className="kt-body">
        <span className="kt-label">The hill is empty</span>
        <small className="kt-slot">The first buy takes it.</small>
      </div>
    </div>
  );
}
