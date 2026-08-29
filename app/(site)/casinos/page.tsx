import type { Metadata } from 'next';
import { razed } from '@/lib/mock';
import { Display, Label } from '@/components/ui/typography';
import { ButtonLink } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { RazedWordmark } from '@/components/ui/marks';
import { CopyButton } from '@/components/ui/CopyButton';
import type { Casino } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Razed',
  description:
    'Sign up to Razed under the MattySpins referral code and every dollar you wager counts towards the weekly leaderboard.',
};

/** One partner today, structured as a list so a second is data entry (§12). */
const casinos: Casino[] = [razed];

export default function CasinosPage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <div className="max-w-2xl">
        <Label className="mb-3">Where the leaderboard comes from</Label>
        <Display size="l" as="h1">
          Razed
        </Display>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Matty streams on Razed and the weekly board is pulled straight from their referral feed.
          Signing up under his code is what puts you on it — there is nothing to link on this site
          and nothing to claim until a period closes.
        </p>
      </div>

      <div className="mt-10 space-y-6">
        {casinos.map((casino) => (
          <Card key={casino.id}>
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
              <div>
                <RazedWordmark size="lg" />
                <h2 className="mt-5 text-[20px] font-semibold leading-snug text-ink">{casino.offer}</h2>
                <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">
                  {casino.offerDetail}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Label>Referral code</Label>
                  <code className="rounded-[3px] border border-line-2 bg-surface-2 px-3 py-2 font-mono text-[15px] tracking-[0.12em] text-brand">
                    {casino.referralCode}
                  </code>
                  <CopyButton value={casino.referralCode} label="Copy code" />
                </div>
              </div>

              <div className="lg:pl-8">
                <ButtonLink href={casino.affiliateUrl} external variant="primary" size="lg" full>
                  Sign up with the code
                </ButtonLink>
                <p className="mt-3 max-w-[240px] font-mono text-[11px] leading-relaxed text-faint">
                  This is an affiliate link. Matty earns a commission if you sign up.
                </p>
              </div>
            </div>

            {/* Three steps, one line each. */}
            <div className="grid gap-px border-t border-line bg-line md:grid-cols-3 [&>div]:bg-surface">
              <Step n={1} title="Sign up with the code">
                Use {casino.referralCode} when you create the account. It cannot be added afterwards.
              </Step>
              <Step n={2} title="Wager as you normally would">
                There is no minimum bet size and no special game. Everything counts.
              </Step>
              <Step n={3} title="Appear on the board">
                The feed is polled every ten minutes, so you show up within about that.
              </Step>
            </div>
          </Card>
        ))}
      </div>

      {/* The responsible-gambling block, larger here than in the footer. */}
      <Card tone="gold" className="mt-8 p-6 lg:p-8">
        <Label className="text-gold/70">Before you sign up</Label>
        <h2 className="mt-3 text-[20px] font-semibold text-ink">Play with money you can lose</h2>
        <div className="mt-4 grid gap-4 text-[14px] leading-relaxed text-ink-2 md:grid-cols-2">
          <p>
            Every casino keeps an edge and the house wins over time — that is how the business
            works. A bonus does not change it. If you are chasing a loss, or betting money that has
            somewhere else to be, stop for the night.
          </p>
          <p>
            Set a deposit limit before your first deposit rather than after. Razed has them built
            in, as does every licensed operator. Free, confidential help is available at{' '}
            <a
              href="https://www.begambleaware.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline underline-offset-2"
            >
              BeGambleAware.org
            </a>
            , 24 hours a day.
          </p>
        </div>
      </Card>

      <div className="mt-6 rounded-[3px] border border-line bg-surface px-6 py-5">
        <Label className="mb-2">Affiliate disclosure</Label>
        <p className="max-w-3xl text-[13.5px] leading-relaxed text-muted">
          MattySpins earns a commission from Razed when someone signs up under the referral code on
          this page, and that commission is not affected by whether you win or lose. Prizes,
          giveaways and Matty Coins are funded and operated by Matty personally — Razed does not run
          them, fund them or decide who wins them.
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">Step {n}</span>
      <h3 className="mt-2 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
