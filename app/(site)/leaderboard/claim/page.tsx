import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { dateRange } from '@/lib/format';
import { frozenPeriod, toUiPeriod } from '@/lib/store/periods';
import { viewerOrSignedOut } from '@/lib/viewer';
import { Display, Label } from '@/components/ui/typography';
import { ButtonLink } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { PlatformMark, RazedZ } from '@/components/ui/marks';
import { ClaimFlow } from '@/components/site/ClaimFlow';

export const metadata: Metadata = {
  title: 'Claim a prize',
  description: 'Claim your position on a frozen MattySpins leaderboard period.',
};

export const dynamic = 'force-dynamic';

export default async function ClaimPage() {
  const [viewer, frozen] = await Promise.all([viewerOrSignedOut(), frozenPeriod()]);

  // Nothing to claim until a board has actually been frozen. Saying so beats a
  // form that looks ready and has no period behind it.
  if (!frozen) {
    return (
      <div className="container-page py-10 lg:py-14">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back to the board
        </Link>
        <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
          <p className="text-[15px] text-ink">No board is waiting on claims.</p>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
            Claims open once a period closes and its ranks are frozen. The board stays visible
            the whole time.
          </p>
          <ButtonLink href="/leaderboard" variant="outline" className="mt-5">
            See the current board
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const period = toUiPeriod(frozen, []);

  return (
    <div className="container-page py-10 lg:py-14">
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-1.5 text-[13.5px] text-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft size={15} />
        Back to the board
      </Link>

      <div className="mt-6 max-w-2xl">
        <Label className="mb-3 flex items-center gap-2">
          <RazedZ size={16} />
          Frozen board · {dateRange(period.startsAt, period.endsAt)}
        </Label>
        <Display size="l" as="h1">
          Claim your prize
        </Display>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Positions on the board are Razed usernames, not site accounts, so nothing is paid
          automatically. Pick the position you believe is yours and tell us the Razed username
          behind it. A moderator checks it against the frozen snapshot before any money moves.
        </p>
      </div>

      <div className="mt-10">
        {viewer.signedIn ? (
          <ClaimFlow period={period} />
        ) : (
          <Card className="mx-auto max-w-lg p-8 text-center">
            <p className="text-[15px] text-ink">Sign in to open a claim.</p>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
              Claims are tied to a site account so a moderator has somewhere to send the outcome.
              The board itself stays fully visible whether you are signed in or not.
            </p>
            <div className="mt-6 flex justify-center">
              <ButtonLink href="/api/auth/signin?callbackUrl=%2F" variant="discord" size="lg">
                <PlatformMark platform="discord" size={17} />
                Sign in with Discord
              </ButtonLink>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
