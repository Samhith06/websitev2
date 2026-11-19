import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

/**
 * A looping promo card for OBS: five messages that fade into one another
 * forever. Outside the (site) group like the other overlays, on a transparent
 * background, and pure CSS — no polling, no data — so it can sit in every
 * scene without costing anything.
 *
 *   /overlay/promo              each message holds for 6 seconds
 *   /overlay/promo?seconds=8    or for as long as you like (3–30)
 *
 * Suggested browser source size: 760 × 240.
 */

export const metadata: Metadata = {
  title: 'Promo loop overlay',
  robots: { index: false, follow: false },
};

type Slide = { kicker: string; title: React.ReactNode; sub: string };

const SLIDES: Slide[] = [
  {
    kicker: 'Sign up on Razed',
    title: (
      <>
        Use code <span className="blue">MATTYSPINS</span>
      </>
    ),
    sub: 'Every bet counts toward the leaderboard and milestones',
  },
  {
    kicker: 'Every month',
    title: (
      <>
        <span className="gold">$3,000</span> leaderboard
      </>
    ),
    sub: 'Top wagerers under MATTYSPINS get paid',
  },
  {
    kicker: 'Claim as you wager',
    title: 'Monthly milestones',
    sub: 'Rewards that reset at the start of every month',
  },
  {
    kicker: 'Spend your Matty Coins',
    title: 'Weekly raffles',
    sub: 'Earn coins for watching, enter on mattyspins.com',
  },
];

export default async function PromoOverlay({ searchParams }: { searchParams: Promise<{ seconds?: string }> }) {
  const params = await searchParams;
  const asked = Number(params.seconds);
  const seconds = Number.isFinite(asked) && asked > 0 ? Math.min(30, Math.max(3, asked)) : 6;
  const count = SLIDES.length + 1; // the Discord card comes last

  const slide = (i: number): CSSProperties =>
    ({ '--promo-delay': `${i * seconds}s` }) as CSSProperties;

  return (
    <div
      className="ovl ovl-promo"
      style={{ '--promo-cycle': `${count * seconds}s` } as CSSProperties}
    >
      <div className="ovl-card promo-card">
        <img className="promo-coin" src="/brand/matty-coin.svg" alt="" />

        <div className="promo-stage">
          {SLIDES.map((s, i) => (
            <div className="promo-slide" style={slide(i)} key={i}>
              <span className="ovl-label">{s.kicker}</span>
              <b className="promo-title">{s.title}</b>
              <small className="promo-sub">{s.sub}</small>
            </div>
          ))}

          <div className="promo-slide promo-discord" style={slide(SLIDES.length)}>
            <div>
              <span className="ovl-label">Giveaways, wins &amp; alerts</span>
              <b className="promo-title">
                Join the <span className="discord">Discord</span>
              </b>
              <small className="promo-sub">discord.gg/mattyspins</small>
            </div>
            <img className="promo-qr" src="/brand/discord-qr.svg" alt="QR code for discord.gg/mattyspins" />
          </div>
        </div>

        <div className="promo-bar" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <i key={i} style={slide(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}
