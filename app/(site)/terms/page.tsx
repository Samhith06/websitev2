import Link from 'next/link';
import type { Metadata } from 'next';
import { COIN_RULES, GOVERNING_LAW, MIN_AGE, OPERATOR } from '@/lib/legal';
import { Bullets, LegalPage, Section, ToConfirm } from '@/components/site/LegalPage';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms of use for MattySpins, including how Matty Coins work and what they are not.',
};

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of use"
      intro="These terms cover the MattySpins website — the coins, the shop, the giveaways, the leaderboard and the games. Using the site means accepting them."
    >
      <Section n={1} title="Who runs this site">
        <p>
          MattySpins is operated by <ToConfirm>{OPERATOR.name}</ToConfirm>, {OPERATOR.entity}. All
          references to &ldquo;we&rdquo; and &ldquo;us&rdquo; mean the operator personally.
        </p>
        <p>
          Written notice can be sent to <ToConfirm>{OPERATOR.address}</ToConfirm>, or by email to{' '}
          <ToConfirm>{OPERATOR.email}</ToConfirm>.
        </p>
        <p>
          The operator is not a casino, is not licensed as a gambling operator, and does not accept
          money from users of this site for any purpose.
        </p>
      </Section>

      <Section n={2} title={`You must be ${MIN_AGE} or over`}>
        <p>
          This site is for people aged {MIN_AGE} and over. It covers online casino streaming and
          links to a real-money gambling operator. If you are under {MIN_AGE} you must not use it,
          and any account found to belong to someone under {MIN_AGE} will be closed and its balance
          forfeited.
        </p>
        <p>
          We may ask for proof of age before paying any prize, and we may refuse a prize where age
          cannot be established.
        </p>
      </Section>

      <Section n={3} title="Matty Coins are not money">
        <p>This is the most important section on the page, so it is stated plainly.</p>
        <Bullets
          items={[
            <>
              <span className="text-ink">Coins cannot be bought.</span> There is no way to purchase
              them, no packages, no top-ups, and no payment path anywhere on this site. If a website
              or person offers to sell you Matty Coins, they are not us.
            </>,
            <>
              <span className="text-ink">Coins have no cash value</span> and are not currency, credit,
              a deposit, a security, or property. They cannot be exchanged for money.
            </>,
            <>
              <span className="text-ink">Coins are non-transferable.</span> They cannot be gifted,
              sold or moved between accounts.
            </>,
            <>
              <span className="text-ink">Coins are a licence, not a possession.</span> They are a
              revocable promotional entitlement, and we may adjust, withhold or remove them where
              these terms have been broken.
            </>,
            <>
              <span className="text-ink">Coins expire.</span> A balance is forfeited after{' '}
              {COIN_RULES.inactivityExpiryDays} days without activity on the account, and on closure
              or deletion of the account for any reason.
            </>,
          ]}
        />
        <p>
          Playing the games on this site is not gambling, because nothing of monetary value is
          staked and nothing of monetary value can be won.
        </p>
      </Section>

      <Section n={4} title="Earning coins">
        <p>
          Coins are earned by being present in Matty&rsquo;s Kick chat while he is streaming, at the
          rates published on the site. Earning requires a verified Kick account linked to your site
          account.
        </p>
        <p>
          Rates, multipliers and bonuses are promotional and may change at any time. We will not
          reduce a balance you have already earned when we change a rate.
        </p>
        <p>Earning is suspended while an account is frozen, or while you are banned in Kick chat.</p>
      </Section>

      <Section n={5} title="One person, one account">
        <p>
          You may hold one account. One Discord account may link to one Kick account and vice versa.
        </p>
        <p>
          Creating additional accounts, using someone else&rsquo;s account, automating chat messages,
          scripting the site, or otherwise manufacturing activity to earn coins is a breach of these
          terms. Accounts doing so may be frozen, have coins removed, be excluded from prizes and
          giveaways, and be closed.
        </p>
      </Section>

      <Section n={6} title="The leaderboard and prizes">
        <p>
          Leaderboard positions come from data supplied by Razed for accounts registered under our
          referral code. We publish that data; we do not produce it and cannot correct it. If you
          believe Razed&rsquo;s figures are wrong, that is a matter between you and Razed.
        </p>
        <p>
          A board freezes at the end of its period and is verified for{' '}
          {COIN_RULES.verificationHours} hours before claims open. Prizes are claimed on this site by
          stating the Razed username behind a position; a moderator checks it against the frozen
          snapshot before anything is paid.
        </p>
        <p>
          Claiming a position that is not yours is fraud. It will cost you your account, your
          balance and any future eligibility, and may be reported.
        </p>
        <p>
          A prize unclaimed after {COIN_RULES.prizeClaimWindowDays} days rolls into the following
          period&rsquo;s pot. Prizes are funded and paid by the operator personally, not by Razed.
        </p>
      </Section>

      <Section n={7} title="The shop and redemptions">
        <p>
          Coins may be redeemed for the items listed in the shop. Some redemptions are automatic;
          others are reviewed by a moderator, usually within a day.
        </p>
        <p>
          A rejected redemption is refunded in coins, in full, with a reason. Physical items are
          subject to stock and to where we can lawfully post them. We may substitute an item of
          equal or greater value where we cannot supply the one listed.
        </p>
      </Section>

      <Section n={8} title="The games">
        <p>
          The games are played with Matty Coins only. Every round is decided by a published
          commit–reveal scheme and can be recomputed by anyone from the{' '}
          <Link href="/verify" className="text-brand underline underline-offset-2">verifier</Link>.
          The return-to-player figure shown on each paytable is calculated from that exact table.
        </p>
        <p>
          Games are off by default and appear only after you confirm your age and switch them on.
          You can switch them off again at any time, for a period you choose, and we cannot lift
          that early — see{' '}
          <Link href="/responsible" className="text-brand underline underline-offset-2">
            responsible play
          </Link>
          .
        </p>
        <p>
          We may void a round, and return the coins staked, where it resulted from a fault, an
          error in a paytable, or manipulation.
        </p>
      </Section>

      <Section n={9} title="Razed and affiliate links">
        <p>
          We earn a commission when someone signs up to Razed through the referral code on this
          site. That commission does not depend on whether you win or lose.
        </p>
        <p>
          Razed is a separate company. Its terms, its bonuses, its verification and its payouts are
          its own. We are not responsible for them and cannot resolve a dispute with them on your
          behalf.
        </p>
      </Section>

      <Section n={10} title="Suspension and closure">
        <p>
          We may freeze or close an account, and remove coins from it, where we reasonably believe
          these terms have been broken. Where we do, we will say why.
        </p>
        <p>
          You may delete your account at any time from your profile page. Deleting forfeits the
          balance. Some records are retained in anonymised form — see the{' '}
          <Link href="/privacy" className="text-brand underline underline-offset-2">privacy policy</Link>.
        </p>
      </Section>

      <Section n={11} title="What we do not promise">
        <p>
          The site is provided as it is. We do not promise it will be uninterrupted, that figures
          will always be current, or that the Razed feed will always be available. Where the feed is
          stale we say so on the board.
        </p>
        <p>
          Nothing in these terms limits liability for death or personal injury caused by negligence,
          for fraud, or for anything else that cannot lawfully be limited.{' '}
          <ToConfirm>[LIABILITY CAP AND EXCLUSIONS — TO BE SETTLED BY COUNSEL]</ToConfirm>
        </p>
      </Section>

      <Section n={12} title="Changes and governing law">
        <p>
          We may change these terms. Where a change is material we will say so on the site. Carrying
          on using the site after a change means accepting it.
        </p>
        <p>
          These terms are governed by the law of <ToConfirm>{GOVERNING_LAW}</ToConfirm>.
        </p>
      </Section>
    </LegalPage>
  );
}
