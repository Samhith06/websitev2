import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { mc } from '@/lib/format';
import { featuredCard } from '@/lib/store/bingo';
import { featuredHunt } from '@/lib/store/hunts';
import { featuredRaid } from '@/lib/store/raid';

/**
 * A looping promo card for OBS, shown only while a bonus hunt, slot bingo or
 * boss raid is running; the rest of the time it draws nothing, so it can stay
 * in a scene. While it shows, the standing messages fade into one another, and
 * if that game is taking entries its "how to join" card comes right after the
 * code. Outside the (site) group like the other overlays, on a transparent
 * background.
 *
 *   /overlay/promo              each card holds for 6 seconds
 *   /overlay/promo?seconds=8    or for as long as you like (3–30)
 *
 * Suggested browser source size: 760 × 240.
 */

export const metadata: Metadata = {
  title: 'Promo loop overlay',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Slide = { key: string; kicker: string; title: ReactNode; sub: ReactNode; live?: boolean; qr?: boolean };

const CODE: Slide = {
  key: 'code',
  kicker: 'Sign up on Razed',
  title: (
    <>
      Use code <span className="blue">MATTYSPINS</span>
    </>
  ),
  sub: 'Every bet counts toward the leaderboard and milestones',
};

/**
 * Poker night, Sunday 22 November 2026. The card drops out of the loop by
 * itself once the day is over in the UK, so nothing needs undoing afterwards.
 */
const POKER_ENDS = Date.parse('2026-11-23T00:00:00Z');
const POKER: Slide = {
  key: 'poker',
  kicker: '♠ Poker is back · Sunday 22 November · 11:30 AM UK',
  title: (
    <>
      <span className="gold">$50</span> poker tournament
    </>
  ),
  sub: 'Free entry · 5h Kick watch time this week · Kick verified on mattyspins.com',
};

const STANDING: Slide[] = [
  {
    key: 'leaderboard',
    kicker: 'Every month',
    title: (
      <>
        <span className="gold">$2,000</span> leaderboard
      </>
    ),
    sub: 'Top wagerers under MATTYSPINS get paid',
  },
  {
    key: 'milestones',
    kicker: 'Claim as you wager',
    title: 'Monthly milestones',
    sub: 'Rewards that reset at the start of every month',
  },
  {
    key: 'coins',
    kicker: 'Watch on Kick',
    title: (
      <>
        Earn <span className="gold">Matty Coins</span>
      </>
    ),
    sub: 'Just for watching. Spend them in the store and on raffles',
  },
  {
    key: 'raffles',
    kicker: 'Spend your Matty Coins',
    title: 'Weekly raffles',
    sub: 'Enter with your coins on mattyspins.com',
  },
  {
    key: 'discord',
    kicker: 'Giveaways, wins & alerts',
    title: (
      <>
        Join the <span className="discord">Discord</span>
      </>
    ),
    sub: 'discord.gg/NWbKHHmuem',
    qr: true,
  },
];

const FADE = 0.6; // seconds to fade in, and again to fade out

/** A game lookup that fails leaves its card out rather than the whole overlay. */
const safe = <T,>(p: Promise<T>) => p.catch(() => null);

const sr = <code>!sr slot name</code>;
const withPrize = (label: string, prize: number) => (prize > 0 ? `${label} · ${mc(prize)} up for grabs` : label);

/**
 * Whether a bonus hunt, slot bingo or boss raid is running, and a join card
 * for each one taking entries right now.
 */
async function liveGames(): Promise<{ running: boolean; slides: Slide[] }> {
  const [hunt, bingo, raid] = await Promise.all([safe(featuredHunt()), safe(featuredCard()), safe(featuredRaid())]);
  const huntOn = !!hunt && hunt.status !== 'finished';
  const bingoOn = bingo?.status === 'running';
  const raidOn = raid?.status === 'running';
  const slides: Slide[] = [];

  if (huntOn && hunt.status === 'collecting' && hunt.requestsOpen) {
    slides.push({ key: 'hunt', live: true, kicker: 'Bonus hunt · collecting', title: 'Suggest a slot', sub: <>Type {sr} in chat</> });
  }
  if (huntOn && hunt.gtbStatus === 'open') {
    slides.push({
      key: 'gtb',
      live: true,
      kicker: withPrize('Bonus hunt', hunt.gtbPrize),
      title: 'Guess the balance',
      sub: <>Type <code>!gtb amount</code> in chat</>,
    });
  }
  if (bingoOn && bingo.requestsOpen) {
    slides.push({ key: 'bingo', live: true, kicker: 'Slot bingo', title: 'Join slot bingo', sub: <>Type {sr} in chat</> });
  }
  if (raidOn && raid.requestsOpen) {
    slides.push({ key: 'raid', live: true, kicker: withPrize('Boss raid', raid.prize), title: `Raid ${raid.boss}`, sub: <>Type {sr} in chat</> });
  }
  return { running: huntOn || bingoOn || raidOn, slides };
}

/**
 * The card count changes whenever a game opens or closes, so the keyframes
 * are written per loop: each card owns `seconds` of the cycle, fades in over
 * FADE, holds, and fades out by the end of its slot.
 */
function keyframes(name: string, seconds: number, count: number) {
  const cycle = seconds * count;
  const p = (s: number) => `${((s / cycle) * 100).toFixed(3)}%`;
  const hidden = 'opacity:0;filter:blur(4px)';
  return `
@keyframes ${name}-slide {
  0% { ${hidden}; transform: translateY(14px); }
  ${p(FADE)}, ${p(seconds - FADE)} { opacity: 1; filter: none; transform: none; }
  ${p(seconds)}, 100% { ${hidden}; transform: translateY(-14px); }
}
@keyframes ${name}-fill {
  0% { transform: scaleX(0); }
  ${p(seconds)} { transform: scaleX(1); }
  ${p(seconds + 0.01)}, 100% { transform: scaleX(0); }
}
.ovl-promo .promo-slide { animation-name: ${name}-slide; }
.ovl-promo .promo-bar i::after { animation-name: ${name}-fill; }`;
}

export default async function PromoOverlay({ searchParams }: { searchParams: Promise<{ seconds?: string }> }) {
  const params = await searchParams;
  const asked = Number(params.seconds);
  const seconds = Number.isFinite(asked) && asked > 0 ? Math.min(30, Math.max(3, asked)) : 6;

  const live = await liveGames();
  if (!live.running) {
    return (
      <div className="ovl">
        <AutoRefresh seconds={10} />
      </div>
    );
  }

  const poker = Date.now() < POKER_ENDS ? [POKER] : [];
  const slides = [CODE, ...live.slides, ...poker, ...STANDING];
  const count = slides.length;
  // A new set of cards restarts the loop from the top instead of jumping mid-fade.
  const signature = slides.map((s) => s.key).join('.');
  const name = `promo-${count}-${String(seconds).replace('.', '_')}`;

  const delay = (i: number): CSSProperties => ({ '--promo-delay': `${i * seconds}s` }) as CSSProperties;

  return (
    <div className="ovl ovl-promo" style={{ '--promo-cycle': `${count * seconds}s` } as CSSProperties}>
      <AutoRefresh seconds={20} />
      <style>{keyframes(name, seconds, count)}</style>

      <div className="ovl-card promo-card" key={signature}>
        <img className="promo-coin" src="/brand/ms-coin.png" alt="" />

        <div className="promo-stage">
          {slides.map((s, i) => (
            <div className={`promo-slide ${s.qr ? 'promo-discord' : ''} ${s.live ? 'promo-live' : ''}`} style={delay(i)} key={s.key}>
              <div className="promo-copy">
                <span className="ovl-label">
                  {s.live ? <i className="promo-dot" aria-hidden /> : null}
                  {s.kicker}
                </span>
                <b className="promo-title">{s.title}</b>
                <small className="promo-sub">{s.sub}</small>
              </div>
              {s.qr ? <img className="promo-qr" src="/brand/discord-qr.svg" alt="QR code for discord.gg/NWbKHHmuem" /> : null}
            </div>
          ))}
        </div>

        <div className="promo-bar" aria-hidden>
          {slides.map((s, i) => (
            <i key={s.key} style={delay(i)} className={s.live ? 'live' : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}
