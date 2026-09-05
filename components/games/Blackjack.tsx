'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { coins, mult } from '@/lib/format';
import { LIMITS } from '@/lib/games';
import {
  HOUSE_RULES, MAX_SEATS, PERFECT_PAIRS, TWENTY_ONE_PLUS_THREE,
  type Action, type Card, type RoundState,
  handTotal, isSoft,
} from '@/lib/blackjack';
import { CoinMark } from '@/components/ui/marks';
import { readSoundPreference, sounds, writeSoundPreference } from '@/lib/sound';
import { FairnessDrawer, SignInToPlay } from './shared';

type View = {
  roundId: number | null;
  state: RoundState;
  actions: Action[];
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  balance: number;
  staked: number;
  returned: number | null;
};

type Refusal = { ok: false; error: string; detail?: string };

/** Chips in coins rather than dollars — the design's ladder, our currency. */
const CHIPS = [1, 5, 10, 25, 50];

type Bet = { main: number; pairs: number; plusThree: number };
const emptyBets = (n: number): Bet[] =>
  Array.from({ length: n }, () => ({ main: 0, pairs: 0, plusThree: 0 }));

/**
 * Blackjack, built from the supplied Claude Design table.
 *
 * The layout follows it closely — a dealer box above a row of seats, each seat
 * carrying Pairs, Main and 21+3 spots, with the chip ladder and the action bar
 * beneath. What is different sits underneath the surface: the shoe is committed
 * on the server before a card is dealt, so a hand can be recomputed afterwards
 * from the same three values as every other game here.
 *
 * Insurance is absent on purpose. At the usual 2:1 it returns 92.6%, and the
 * page promises 99%; priced fairly it is exactly neutral and only adds a
 * decision. The paytable says so rather than leaving people wondering.
 */
export function Blackjack({ limits = LIMITS }: { limits?: { minBet: number; maxBet: number } }) {
  const [view, setView] = useState<View | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  const [seatCount, setSeatCount] = useState(1);
  const [chip, setChip] = useState(10);
  const [bets, setBets] = useState<Bet[]>(emptyBets(MAX_SEATS));
  const [lastBets, setLastBets] = useState<Bet[] | null>(null);
  const [message, setMessage] = useState('Back a seat, then deal.');

  const keyRef = useRef<string | null>(null);

  useEffect(() => setSoundOn(readSoundPreference()), []);

  /**
   * Whatever is on the table, including a hand left mid-play by a refresh.
   *
   * One failed read used to leave the table blank for good: no balance, no
   * seed, and no reason given. A player would see a dash where their coins
   * belong and have no way to tell a broken table from an empty account. So a
   * refusal is now said out loud, and a request that simply did not land is
   * tried again before giving up.
   */
  const load = useCallback(async (attempt = 0): Promise<void> => {
    const retry = async (reason: string) => {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        return load(attempt + 1);
      }
      setError(reason);
    };

    try {
      const response = await fetch('/api/games/blackjack', { cache: 'no-store' });
      if (response.status === 401) {
        setSignedOut(true);
        return;
      }
      if (!response.ok) {
        const refusal = await response.json().catch(() => null);
        return retry(refusal?.detail ?? 'The table could not be loaded. Nothing has been staked.');
      }

      const data = await response.json();
      // roundId 0 means "nothing dealt yet" — still worth taking, because it
      // carries the balance and the seed commitment.
      if (data.roundId === null || data.roundId === undefined) {
        return retry('The table could not be loaded. Nothing has been staked.');
      }
      setView(data);
      setError(null);
    } catch {
      return retry('Could not reach the table. Nothing has been staked.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // A view with no seats is the empty table, not a finished round.
  const state = view && view.state.seats.length > 0 ? view.state : null;
  const settled = state?.phase === 'settled';
  const playing = state?.phase === 'playing';
  const betting = !state || settled;

  const balance = view?.balance ?? 0;
  const staged = bets.slice(0, seatCount).reduce((s, b) => s + b.main + b.pairs + b.plusThree, 0);

  /* ---------------------------------------------------------------- */

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/games/blackjack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as View | Refusal;

      if ('ok' in data) {
        if (data.error === 'not-signed-in') setSignedOut(true);
        setError(data.detail ?? 'That could not be done.');
        return null;
      }
      setView(data);
      return data;
    } catch {
      setError('Could not reach the table. Nothing has been staked.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function deal() {
    if (staged < limits.minBet || staged > balance) return;
    keyRef.current = keyRef.current ?? `bj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const placed = bets.slice(0, seatCount).map((b) => ({ ...b }));

    const data = await send({ op: 'deal', bets: placed, idempotencyKey: keyRef.current });
    keyRef.current = null;
    if (!data) return;

    setLastBets(placed);
    setBets(emptyBets(MAX_SEATS));
    if (soundOn) sounds.pick();
    announce(data);
  }

  async function act(action: Action) {
    const data = await send({ op: 'act', action });
    if (!data) return;
    if (soundOn) (action === 'double' || action === 'split' ? sounds.quickPick(2) : sounds.draw(0));
    announce(data);
  }

  function announce(data: View) {
    if (data.state.phase !== 'settled') {
      setMessage(
        data.state.activeSeat >= 0
          ? `Seat ${data.state.activeSeat + 1} to act.`
          : 'Dealing.',
      );
      return;
    }
    const back = data.returned ?? 0;
    setMessage(
      back > 0
        ? `Round paid ${coins(back)} MC. Dealer ${handTotal(data.state.dealer)}.`
        : `House takes the round. Dealer ${handTotal(data.state.dealer)}.`,
    );
    if (soundOn) (back > data.staked ? sounds.win(back >= data.staked * 3) : sounds.settle());
  }

  function stake(seat: number, spot: keyof Bet) {
    if (!betting || busy) return;
    if (staged + chip > balance) {
      setError('Not enough coins for that chip.');
      return;
    }
    setBets((prev) => {
      const next = prev.map((b) => ({ ...b }));
      if (spot !== 'main' && next[seat].main === 0) {
        setError('Side bets need a main bet on that seat first.');
        return prev;
      }
      next[seat][spot] += chip;
      return next;
    });
    setError(null);
    if (soundOn) sounds.pick();
  }

  function clearBets() {
    setBets(emptyBets(MAX_SEATS));
    setError(null);
  }

  function rebet() {
    if (!lastBets) return;
    const next = emptyBets(MAX_SEATS);
    lastBets.forEach((b, i) => { next[i] = { ...b }; });
    setBets(next);
    setSeatCount(Math.max(seatCount, lastBets.length));
  }

  if (signedOut) return <SignInToPlay game="Blackjack" />;

  const upcardOnly = state?.holeHidden
    ? handTotal(state.dealer.filter((_, i) => i === 0))
    : state ? handTotal(state.dealer) : 0;

  const actions = view?.actions ?? [];

  const dealLabel =
    busy ? 'Dealing…'
    : staged === 0 ? 'Place a bet'
    : staged > balance ? 'Not enough coins'
    : staged > limits.maxBet ? `Max ${limits.maxBet}`
    : staged < limits.minBet ? `Min ${limits.minBet}`
    : `Deal · ${coins(staged)}`;

  const dealBlocked =
    busy || staged < limits.minBet || staged > balance || staged > limits.maxBet;

  return (
    <div className="bj" style={FELT}>
      {/* ================================================================ */}
      {/* Header — the design's own chrome, so the table reads as one piece */}
      {/* ================================================================ */}
      <header
        className="flex flex-wrap items-center justify-between gap-x-7 gap-y-3 px-4 py-4 sm:px-7"
        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <div className="flex items-baseline gap-3.5">
          <h1 className="text-[15px] font-semibold uppercase tracking-[0.16em]">Blackjack</h1>
          <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
            Multi-seat · six decks · dealer stands all 17
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          <Figure label="In play" value={coins(betting ? staged : state?.staked ?? 0)} />

          <button
            type="button"
            onClick={() => { const next = !soundOn; setSoundOn(next); writeSoundPreference(next); }}
            className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ border: `1px solid ${LINE}`, color: 'oklch(0.8 0.01 255)' }}
          >
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: soundOn ? ACCENT : 'oklch(0.45 0.01 255)' }}
            />
            {soundOn ? 'Sound on' : 'Muted'}
          </button>

          <span className="hidden h-[26px] w-px sm:block" style={{ background: 'oklch(1 0 0 / 0.1)' }} />

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: FAINT }}>
              Balance
            </span>
            <span
              className="flex items-center gap-1.5 text-[24px] font-medium leading-none"
              style={{ fontFamily: SERIF, color: ACCENT }}
            >
              <CoinMark className="h-[15px] w-[15px]" />
              {view ? coins(balance) : '—'}
            </span>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* Felt                                                             */}
      {/* ================================================================ */}
      <div className="flex flex-col px-4 pt-6 sm:px-7 lg:flex-row lg:items-stretch lg:gap-7">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Dealer */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'oklch(0.6 0.01 255)' }}>
                Dealer
              </span>
              {state?.dealer.length ? (
                <span
                  className="rounded-full px-2.5 py-[3px] text-[14px]"
                  style={{ fontFamily: SERIF, background: 'oklch(1 0 0 / 0.08)', color: 'oklch(0.92 0.01 255)' }}
                >
                  {state.holeHidden ? `${upcardOnly}+` : handTotal(state.dealer)}
                </span>
              ) : null}
            </div>

            <div className="flex min-h-[96px] items-start gap-[7px]">
              {state?.dealer.length ? (
                state.dealer.map((card, i) => (
                  <PlayingCard
                    key={`${card.r}${card.s}-${i}`}
                    card={card}
                    faceDown={state.holeHidden && i === 1}
                    big
                  />
                ))
              ) : (
                <span className="self-center text-[12.5px]" style={{ color: FAINT }}>
                  Waiting for bets
                </span>
              )}
            </div>
          </div>

          {/* Message strip */}
          <div className="my-5 flex justify-center">
            <p
              className="rounded-full px-5 py-2 text-center text-[12.5px] tracking-[0.05em]"
              style={{
                border: `1px solid ${error ? 'oklch(0.55 0.15 22 / 0.5)' : 'oklch(1 0 0 / 0.09)'}`,
                background: error ? 'oklch(0.42 0.13 22 / 0.14)' : 'oklch(1 0 0 / 0.03)',
                color: error ? 'oklch(0.86 0.09 22)' : 'oklch(0.78 0.01 255)',
              }}
            >
              {error ?? message}
            </p>
          </div>

          {/* Seats */}
          <div className="flex flex-1 flex-wrap items-end justify-center gap-3.5 pb-5">
            {Array.from({ length: seatCount }, (_, i) => (
              <SeatPanel
                key={i}
                index={i}
                seat={state?.seats[i]}
                bet={bets[i]}
                betting={betting}
                active={playing && state?.activeSeat === i}
                activeHand={state?.activeHand ?? 0}
                onStake={stake}
              />
            ))}
          </div>
        </div>

        {/* Paytable rail */}
        <aside className="flex shrink-0 flex-col gap-3 pb-5 lg:w-[228px]">
          <Paytable
            title="21 + 3"
            rows={Object.entries(TWENTY_ONE_PLUS_THREE).map(
              ([k, v]) => [PLUS_THREE_LABELS[k] ?? k, v] as [string, number],
            )}
          />
          <Paytable
            title="Perfect pairs"
            rows={Object.entries(PERFECT_PAIRS).map(
              ([k, v]) => [PAIR_LABELS[k] ?? k, v] as [string, number],
            )}
          />
          <div className="rounded-[15px] p-4" style={{ background: PANEL, border: `1px solid ${PANEL_LINE}` }}>
            <p className="mb-2.5 text-[9px] uppercase tracking-[0.18em]" style={{ color: FAINT }}>
              Table
            </p>
            {HOUSE_RULES.map((rule) => (
              <div
                key={rule.label}
                className="flex justify-between py-[3px] text-[11.5px]"
                style={{ color: 'oklch(0.7 0.01 255)' }}
              >
                <span>{rule.label}</span>
                <span style={{ fontFamily: SERIF, color: 'oklch(0.92 0.01 255)' }}>{rule.value}</span>
              </div>
            ))}
            <p className="mt-3 text-[10.5px] leading-relaxed" style={{ color: FAINT }}>
              Both side bets return 99%, same as every other game here. Insurance is not
              offered — at 2:1 it returns 92.6%, and priced fairly it is neutral.
            </p>
          </div>
        </aside>
      </div>

      {/* ================================================================ */}
      {/* Control bar                                                      */}
      {/* ================================================================ */}
      <div
        className="flex flex-col gap-4 px-4 py-4 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
        style={{ borderTop: `1px solid ${HAIRLINE}`, background: 'oklch(0.165 0.012 255)' }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: FAINT }}>
            Chip
          </span>
          <div className="flex gap-2.5">
            {CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={String(c)}
                aria-pressed={chip === c}
                onClick={() => setChip(c)}
                className="relative h-[46px] w-[46px] rounded-full text-[14px]"
                style={{
                  fontFamily: SERIF,
                  background: CHIP_TONE[c].bg,
                  border: `2px dashed ${CHIP_TONE[c].edge}`,
                  color: CHIP_TONE[c].ink,
                }}
              >
                {c}
                {chip === c ? (
                  <span
                    className="pointer-events-none absolute rounded-full"
                    style={{ inset: -5, border: `1.5px solid ${ACCENT}` }}
                  />
                ) : null}
              </button>
            ))}
          </div>

          <span className="hidden h-[26px] w-px sm:block" style={{ background: 'oklch(1 0 0 / 0.1)' }} />

          <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: FAINT }}>
            Hands
          </span>
          <div className="flex gap-2">
            {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={String(n)}
                aria-pressed={seatCount === n}
                disabled={!betting || busy}
                onClick={() => { setSeatCount(n); clearBets(); }}
                className="h-[34px] w-[34px] rounded-full text-[13px] disabled:opacity-40"
                style={
                  seatCount === n
                    ? { fontFamily: SERIF, background: ACCENT, color: ACCENT_INK }
                    : { fontFamily: SERIF, border: `1px solid ${LINE}`, color: 'oklch(0.8 0.01 255)' }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {betting ? (
            <>
              <Pill onClick={clearBets} disabled={busy || staged === 0}>Clear</Pill>
              <Pill onClick={rebet} disabled={busy || !lastBets}>Rebet</Pill>
              <Pill onClick={deal} disabled={dealBlocked} primary>{dealLabel}</Pill>
            </>
          ) : (
            <>
              {actions.includes('split') ? (
                <Pill onClick={() => act('split')} disabled={busy}>Split</Pill>
              ) : null}
              {actions.includes('double') ? (
                <Pill onClick={() => act('double')} disabled={busy}>Double</Pill>
              ) : null}
              <Pill onClick={() => act('stand')} disabled={busy}>Stand</Pill>
              <Pill onClick={() => act('hit')} disabled={busy} primary>Hit</Pill>
            </>
          )}
        </div>
      </div>

      {/* The commitment, unchanged — it is what makes the shoe checkable. */}
      <div className="px-4 pb-4 sm:px-7">
        <FairnessDrawer
          state={view ? {
            serverSeedHash: view.serverSeedHash,
            clientSeed: view.clientSeed,
            nonce: view.nonce,
            balance: view.balance,
            wageredToday: 0,
            netToday: 0,
            rounds: [],
          } : null}
          game="blackjack"
          onRotate={async () => { await load(); }}
        />
      </div>

      <style>{TABLE_KEYFRAMES}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Design tokens, lifted from the supplied table                              */
/* -------------------------------------------------------------------------- */

const ACCENT = 'oklch(0.84 0.16 150)';
const ACCENT_INK = 'oklch(0.17 0.03 150)';
const DIM = 'oklch(0.62 0.01 255)';
const FAINT = 'oklch(0.55 0.01 255)';
const LINE = 'oklch(1 0 0 / 0.12)';
const HAIRLINE = 'oklch(1 0 0 / 0.07)';
const PANEL = 'oklch(0.2 0.014 255)';
const PANEL_LINE = 'oklch(1 0 0 / 0.06)';
const SERIF = 'var(--font-spectral), Georgia, serif';
const CARD_INK = 'oklch(0.22 0.012 255)';
const CARD_RED = 'oklch(0.52 0.19 25)';

const FELT: React.CSSProperties = {
  fontFamily: 'var(--font-archivo), Helvetica, sans-serif',
  color: 'oklch(0.95 0.005 255)',
  background:
    'radial-gradient(120% 90% at 50% 0%, oklch(0.215 0.018 255) 0%, oklch(0.135 0.012 255) 70%)',
  borderRadius: 18,
  border: `1px solid ${PANEL_LINE}`,
  overflow: 'hidden',
};

/** The design's ladder is 1/5/25/100/500 dollars. Ours has to sit inside a
 *  10–100 MC table, so the denominations change and the colours stay. */
const CHIP_TONE: Record<number, { bg: string; edge: string; ink: string }> = {
  1: { bg: 'oklch(0.32 0.012 255)', edge: 'oklch(0.62 0.01 255)', ink: 'oklch(0.92 0.01 255)' },
  5: { bg: 'oklch(0.4 0.11 22)', edge: 'oklch(0.62 0.14 22)', ink: 'oklch(0.96 0.02 22)' },
  10: { bg: 'oklch(0.36 0.07 255)', edge: 'oklch(0.6 0.11 255)', ink: 'oklch(0.96 0.02 255)' },
  25: { bg: 'oklch(0.38 0.09 150)', edge: 'oklch(0.6 0.12 150)', ink: 'oklch(0.96 0.02 150)' },
  50: { bg: 'oklch(0.34 0.08 300)', edge: 'oklch(0.62 0.12 300)', ink: 'oklch(0.96 0.02 300)' },
};

const PLUS_THREE_LABELS: Record<string, string> = {
  suitedTrips: 'Suited trips',
  straightFlush: 'Straight flush',
  trips: 'Three of a kind',
  straight: 'Straight',
  flush: 'Flush',
};
const PAIR_LABELS: Record<string, string> = {
  perfect: 'Perfect pair',
  coloured: 'Coloured pair',
  mixed: 'Mixed pair',
};

/** The design deals each card in. Honour that, but not for anyone who has
 *  asked their system to stop moving things. */
const TABLE_KEYFRAMES = `
@keyframes bjDealIn { from { opacity: 0; transform: translateY(-14px) scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes bjPopIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: none; } }
.bj .bj-deal { animation: bjDealIn 240ms ease-out both; }
.bj .bj-pop { animation: bjPopIn 200ms ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .bj .bj-deal, .bj .bj-pop { animation: none; }
}
`;

/* -------------------------------------------------------------------------- */

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: FAINT }}>
        {label}
      </span>
      <span className="text-[19px] leading-none" style={{ fontFamily: SERIF, color: 'oklch(0.88 0.02 255)' }}>
        {value}
      </span>
    </div>
  );
}

const SUIT_GLYPH: Record<Card['s'], string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_NAME: Record<Card['s'], string> = {
  S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs',
};

function PlayingCard({ card, faceDown, big }: { card: Card; faceDown?: boolean; big?: boolean }) {
  const size = big
    ? { width: 64, height: 92, borderRadius: 7 }
    : { width: 50, height: 72, borderRadius: 6 };

  if (faceDown) {
    return (
      <div
        className="bj-deal"
        role="img"
        aria-label="Face-down card"
        style={{
          ...size,
          background:
            'repeating-linear-gradient(45deg, oklch(0.28 0.02 255) 0 5px, oklch(0.235 0.018 255) 5px 10px)',
          border: `1px solid ${LINE}`,
          boxShadow: '0 8px 20px oklch(0.1 0 0 / 0.5)',
        }}
      />
    );
  }

  const ink = card.s === 'H' || card.s === 'D' ? CARD_RED : CARD_INK;
  return (
    <div
      className="bj-deal flex flex-col items-center justify-center"
      role="img"
      aria-label={`${card.r} of ${SUIT_NAME[card.s]}`}
      style={{
        ...size,
        background: 'oklch(0.955 0.006 255)',
        boxShadow: big ? '0 8px 20px oklch(0.1 0 0 / 0.5)' : '0 6px 14px oklch(0.1 0 0 / 0.45)',
      }}
    >
      <span
        style={{ fontFamily: SERIF, fontSize: big ? 27 : 21, fontWeight: 500, lineHeight: 1, color: ink }}
      >
        {card.r}
      </span>
      <span style={{ fontSize: big ? 17 : 13, lineHeight: 1, color: ink }}>{SUIT_GLYPH[card.s]}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SeatPanel({
  index,
  seat,
  bet,
  betting,
  active,
  activeHand,
  onStake,
}: {
  index: number;
  seat: RoundState['seats'][number] | undefined;
  bet: Bet;
  betting: boolean;
  active: boolean;
  activeHand: number;
  onStake: (seat: number, spot: keyof Bet) => void;
}) {
  return (
    <div
      className="relative flex min-w-[196px] max-w-[262px] flex-1 flex-col items-center gap-2.5 rounded-[15px] px-2.5 pb-3 pt-3.5"
      style={{ background: PANEL, border: `1px solid ${PANEL_LINE}` }}
    >
      {active ? (
        <span
          className="pointer-events-none absolute rounded-[16px]"
          style={{
            inset: -1,
            border: `1.5px solid ${ACCENT}`,
            boxShadow: `0 0 0 5px oklch(0.84 0.16 150 / 0.08)`,
          }}
        />
      ) : null}

      {/* Cards */}
      <div className="flex min-h-[128px] items-end gap-3">
        {seat?.hands.length ? (
          seat.hands.map((hand, h) => {
            const total = handTotal(hand.cards);
            const soft = isSoft(hand.cards) && total <= 21;
            return (
              <div key={h} className="flex flex-col items-center gap-[7px]">
                <div className="flex gap-[5px]">
                  {hand.cards.map((card, c) => (
                    <PlayingCard key={`${card.r}${card.s}-${c}`} card={card} />
                  ))}
                </div>
                <div className="flex min-h-[22px] items-center gap-1.5">
                  <span
                    className="rounded-full px-2.5 py-[2px] text-[13px]"
                    style={{
                      fontFamily: SERIF,
                      background: active && h === activeHand ? 'oklch(0.84 0.16 150 / 0.18)' : 'oklch(1 0 0 / 0.09)',
                      color: 'oklch(0.9 0.01 255)',
                    }}
                  >
                    {soft ? `${total} soft` : total}
                  </span>
                  {hand.resultLabel ? (
                    <span
                      className="bj-pop rounded-full px-2.5 py-[2px] text-[9.5px] font-bold uppercase tracking-[0.1em]"
                      style={RESULT_TONE[hand.result ?? 'lose']}
                    >
                      {hand.resultLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <span className="self-center text-[11.5px]" style={{ color: FAINT }}>
            No cards
          </span>
        )}
      </div>

      {/* Betting spots. While betting these show the stake being built, not the
          one from the hand that just settled — that hand is still in `seat`
          until the next deal replaces it. */}
      <div className="flex items-end gap-2.5">
        <Spot
          label="Pairs"
          amount={betting ? bet.pairs : seat?.pairs ?? bet.pairs}
          onClick={() => onStake(index, 'pairs')}
          disabled={!betting}
          size={42}
          tone={{ bg: 'oklch(0.3 0.03 300)', edge: 'oklch(0.72 0.14 300)', ink: 'oklch(0.94 0.03 300)' }}
        />
        <Spot
          label="Main"
          amount={betting ? bet.main : seat?.main ?? bet.main}
          onClick={() => onStake(index, 'main')}
          disabled={!betting}
          size={64}
          tone={{ bg: 'oklch(0.29 0.02 255)', edge: ACCENT, ink: 'oklch(0.95 0.01 255)' }}
        />
        <Spot
          label="21+3"
          amount={betting ? bet.plusThree : seat?.plusThree ?? bet.plusThree}
          onClick={() => onStake(index, 'plusThree')}
          disabled={!betting}
          size={42}
          tone={{ bg: 'oklch(0.3 0.05 60)', edge: 'oklch(0.75 0.14 60)', ink: 'oklch(0.95 0.03 60)' }}
        />
      </div>

      {seat?.notes.length ? (
        <ul className="w-full space-y-0.5 text-center">
          {seat.notes.map((note) => (
            <li key={note} className="text-[10.5px]" style={{ color: DIM }}>
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      <span className="text-[8.5px] uppercase tracking-[0.13em]" style={{ color: FAINT }}>
        Seat {index + 1}
      </span>
    </div>
  );
}

const RESULT_TONE: Record<string, React.CSSProperties> = {
  win: { background: ACCENT, color: ACCENT_INK },
  push: { background: 'oklch(1 0 0 / 0.14)', color: 'oklch(0.85 0.01 255)' },
  lose: { background: 'oklch(0.42 0.13 22)', color: 'oklch(0.94 0.03 22)' },
};

function Spot({
  label,
  amount,
  onClick,
  disabled,
  size,
  tone,
}: {
  label: string;
  amount: number;
  onClick: () => void;
  disabled: boolean;
  size: number;
  tone: { bg: string; edge: string; ink: string };
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[8.5px] uppercase tracking-[0.13em]" style={{ color: FAINT }}>
        {label}
      </span>
      <button
        type="button"
        aria-label={`${label} bet on this seat`}
        onClick={onClick}
        disabled={disabled}
        className="flex items-center justify-center rounded-full p-0 disabled:cursor-default"
        style={{
          width: size,
          height: size,
          border: amount > 0 ? 'none' : `1.5px dashed ${LINE}`,
          background: amount > 0 ? 'transparent' : 'oklch(1 0 0 / 0.03)',
        }}
      >
        {amount > 0 ? (
          <span
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{
              fontFamily: SERIF,
              fontSize: size > 50 ? 16 : 13,
              background: tone.bg,
              border: `2px solid ${tone.edge}`,
              color: tone.ink,
            }}
          >
            {amount}
          </span>
        ) : (
          <span className="sr-only">empty</span>
        )}
      </button>
    </div>
  );
}

function Paytable({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div className="rounded-[15px] p-4" style={{ background: PANEL, border: `1px solid ${PANEL_LINE}` }}>
      <p className="mb-2.5 text-[9px] uppercase tracking-[0.18em]" style={{ color: FAINT }}>
        {title}
      </p>
      {rows.map(([name, multiplier]) => (
        <div
          key={name}
          className="flex justify-between py-[3px] text-[11.5px]"
          style={{ color: 'oklch(0.7 0.01 255)' }}
        >
          <span>{name}</span>
          <span style={{ fontFamily: SERIF, color: 'oklch(0.92 0.01 255)' }}>{mult(multiplier)}</span>
        </div>
      ))}
    </div>
  );
}

function Pill({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full text-[11.5px] font-semibold uppercase tracking-[0.1em] transition-opacity',
        primary ? 'px-9 py-[13px] font-bold tracking-[0.14em]' : 'px-5 py-3',
        disabled && 'cursor-default opacity-40',
      )}
      style={
        primary
          ? { background: ACCENT, color: ACCENT_INK }
          : { border: `1px solid ${LINE}`, color: 'oklch(0.85 0.01 255)' }
      }
    >
      {children}
    </button>
  );
}
