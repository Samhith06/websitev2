import type { Metadata } from 'next';
import {
  bonusesFor,
  featuredHunt,
  guessesFor,
  huntStats,
  type Bonus,
  type Guess,
  type Hunt,
  type HuntStats,
} from '@/lib/store/hunts';
import { coins, money, mult } from '@/lib/format';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { SlotArt } from '@/components/site/SlotArt';

/**
 * The bonus hunt as an OBS browser source.
 *
 * Deliberately outside the (site) route group, so none of the site's chrome —
 * header, footer, nav, age gate, ambient background — is drawn, and the page
 * background is transparent so it sits over the game capture.
 *
 *   /overlay/hunt                 everything, stacked (a ~420px wide column)
 *   /overlay/hunt?panel=stats     the figures, as a strip or a block
 *   /overlay/hunt?panel=now       the bonus being opened
 *   /overlay/hunt?panel=bonuses   the bonus list  (&rows=N, default 10)
 *   /overlay/hunt?panel=gtb       guess the balance
 *
 * With no hunt at all it draws nothing, so a scene can keep the source in
 * place between streams without showing an empty box.
 */

export const metadata: Metadata = {
  title: 'Hunt overlay',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Panel = 'all' | 'stats' | 'now' | 'bonuses' | 'gtb';
const PANELS: Panel[] = ['all', 'stats', 'now', 'bonuses', 'gtb'];

export default async function HuntOverlay({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string; rows?: string }>;
}) {
  const params = await searchParams;
  const panel: Panel = PANELS.includes(params.panel as Panel) ? (params.panel as Panel) : 'all';
  const rows = Math.min(30, Math.max(3, Number(params.rows) || 10));

  const hunt = await featuredHunt();
  if (!hunt) {
    return (
      <div className="ovl">
        <AutoRefresh seconds={10} />
      </div>
    );
  }

  const [bonuses, guesses] = await Promise.all([bonusesFor(hunt.id), guessesFor(hunt.id)]);
  const stats = huntStats(hunt, bonuses);
  const current = hunt.status === 'opening' ? bonuses.find((b) => b.payout == null) ?? null : null;
  const live = hunt.status !== 'finished' || hunt.gtbStatus === 'locked';

  const show = (p: Panel) => panel === 'all' || panel === p;

  return (
    <div className={`ovl ovl-p-${panel}`}>
      {/* Fast while a hunt is running so a payout reaches stream within a
          couple of seconds; slow once it is over. */}
      <AutoRefresh seconds={live ? 3 : 15} />

      {panel === 'all' ? <Header hunt={hunt} /> : null}
      {show('now') ? <Now hunt={hunt} current={current} stats={stats} /> : null}
      {show('stats') ? <Stats hunt={hunt} stats={stats} /> : null}
      {show('bonuses') ? <Bonuses hunt={hunt} bonuses={bonuses} current={current} best={stats.best} rows={rows} /> : null}
      {show('gtb') ? <GuessTheBalance hunt={hunt} guesses={guesses} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const PHASE = { collecting: 'Collecting', opening: 'Opening', finished: 'Finished' } as const;

function Header({ hunt }: { hunt: Hunt }) {
  return (
    <div className="ovl-card ovl-head">
      <span className={`ovl-phase ${hunt.status}`}>{PHASE[hunt.status]}</span>
      <b>{hunt.title}</b>
    </div>
  );
}

function Stats({ hunt, stats }: { hunt: Hunt; stats: HuntStats }) {
  const figures: Array<[string, string, string?]> = [
    ['Start', money(hunt.startCost)],
    ['Bonuses', `${stats.opened}/${stats.bonuses}`],
    ['Won', money(stats.won), 'gold'],
    ['Profit', `${stats.profit >= 0 ? '+' : ''}${money(stats.profit)}`, stats.profit >= 0 ? 'green' : 'red'],
    ['Average', stats.averageX == null ? '—' : mult(stats.averageX)],
    ['Break-even', stats.breakEvenX == null ? '—' : mult(stats.breakEvenX), 'blue'],
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

/**
 * The headline card. What it says depends on the phase: the bonus being
 * opened, or while collecting, the invitation to !sr; once finished, the
 * result.
 */
function Now({ hunt, current, stats }: { hunt: Hunt; current: Bonus | null; stats: HuntStats }) {
  if (current) {
    return (
      <div className="ovl-card ovl-now">
        <Art bonus={current} big />
        <div className="ovl-now-body">
          <span className="ovl-label">Now opening · {stats.opened + 1} of {stats.bonuses}</span>
          <b className="ovl-now-name">{current.slotName}</b>
          <small>{current.provider || ' '}</small>
          <div className="ovl-now-meta">
            <span>Bet <b>{money(current.bet)}</b></span>
            {current.requestedBy ? <span>!sr by <b>{current.requestedBy}</b></span> : null}
          </div>
        </div>
      </div>
    );
  }

  if (hunt.status === 'collecting') {
    return (
      <div className="ovl-card ovl-now ovl-now-text">
        <span className="ovl-label">Collecting bonuses</span>
        <b className="ovl-now-name">
          {stats.bonuses} {stats.bonuses === 1 ? 'bonus' : 'bonuses'} · {money(stats.totalBet)} in bets
        </b>
        {hunt.requestsOpen ? (
          <div className="ovl-cta">
            Suggest a slot: <code>!sr slot name</code>
          </div>
        ) : null}
      </div>
    );
  }

  if (hunt.status === 'finished') {
    return (
      <div className="ovl-card ovl-now ovl-now-text">
        <span className="ovl-label">Hunt finished</span>
        <b className={`ovl-now-name ${stats.profit >= 0 ? 'green' : 'red'}`}>
          {money(stats.won)} · {stats.profit >= 0 ? '+' : ''}
          {money(stats.profit)}
        </b>
        {stats.best?.payout != null ? (
          <small>
            Best: {stats.best.slotName} {mult(stats.best.payout / stats.best.bet)}
          </small>
        ) : null}
      </div>
    );
  }

  return null;
}

/**
 * A fixed-height window onto the list, so the source never grows past the box
 * it was given: while opening it follows the current bonus (two opened ones
 * above it for context), otherwise it shows the newest additions or, once
 * finished, the top of the list.
 */
function Bonuses({
  hunt,
  bonuses,
  current,
  best,
  rows,
}: {
  hunt: Hunt;
  bonuses: Bonus[];
  current: Bonus | null;
  best: Bonus | null;
  rows: number;
}) {
  if (bonuses.length === 0) return null;

  let start = 0;
  if (current) {
    const index = bonuses.indexOf(current);
    start = Math.max(0, Math.min(index - 2, bonuses.length - rows));
  } else if (hunt.status === 'collecting') {
    start = Math.max(0, bonuses.length - rows);
  }
  const visible = bonuses.slice(start, start + rows);

  return (
    <div className="ovl-card ovl-list">
      {visible.map((b) => {
        const x = b.payout == null ? null : b.payout / b.bet;
        const tone =
          b.id === best?.id ? 'best' : x == null ? '' : x >= 100 ? 'gold' : x < 20 ? 'dim' : '';
        return (
          <div key={b.id} className={`ovl-row ${b.id === current?.id ? 'now' : ''} ${x == null ? 'pending' : ''}`}>
            <span className="ovl-n">{bonuses.indexOf(b) + 1}</span>
            <Art bonus={b} />
            <span className="ovl-name">
              <b>{b.slotName}</b>
              <small>{money(b.bet)}{b.requestedBy ? ` · ${b.requestedBy}` : ''}</small>
            </span>
            <span className={`ovl-x ${tone}`}>
              {x == null ? '—' : mult(x)}
              {b.payout != null ? <small>{money(b.payout)}</small> : null}
            </span>
          </div>
        );
      })}
      {bonuses.length > visible.length ? (
        <div className="ovl-more">
          {start > 0 ? `${start} above` : ''}
          {start > 0 && start + rows < bonuses.length ? ' · ' : ''}
          {start + rows < bonuses.length ? `${bonuses.length - start - rows} more` : ''}
        </div>
      ) : null}
    </div>
  );
}

function GuessTheBalance({ hunt, guesses }: { hunt: Hunt; guesses: Guess[] }) {
  if (hunt.gtbStatus === 'closed') return null;

  return (
    <div className={`ovl-card ovl-gtb ${hunt.gtbStatus}`}>
      <div className="ovl-gtb-head">
        <span className="ovl-label">Guess the balance</span>
        {hunt.gtbPrize ? <b className="gold">{coins(hunt.gtbPrize)} MC</b> : null}
      </div>

      {hunt.gtbStatus === 'open' ? (
        <>
          <div className="ovl-cta">
            Type <code>!gtb amount</code> in chat
          </div>
          <small>{coins(guesses.length)} {guesses.length === 1 ? 'guess' : 'guesses'} so far</small>
        </>
      ) : null}

      {hunt.gtbStatus === 'locked' ? (
        <small>Guessing locked · {coins(guesses.length)} {guesses.length === 1 ? 'guess' : 'guesses'}</small>
      ) : null}

      {hunt.gtbStatus === 'settled' ? (
        hunt.gtbWinner ? (
          <div className="ovl-winner">
            <span>Winner</span>
            <b>{hunt.gtbWinner.name}</b>
            <small>
              guessed {money(guesses.find((g) => g.kickUserId === hunt.gtbWinner?.kickUserId)?.guess ?? 0)} · final{' '}
              {money(hunt.finalBalance ?? 0)}
            </small>
          </div>
        ) : (
          <small>Final {money(hunt.finalBalance ?? 0)} · no linked guess</small>
        )
      ) : null}
    </div>
  );
}

function Art({ bonus, big = false }: { bonus: Bonus; big?: boolean }) {
  const base = big ? 'ovl-art big' : 'ovl-art';
  return (
    <SlotArt src={bonus.imageUrl} name={bonus.slotName} className={base} fallbackClassName={`${base} ph`} />
  );
}
