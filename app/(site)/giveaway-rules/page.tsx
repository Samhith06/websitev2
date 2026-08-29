import Link from 'next/link';
import type { Metadata } from 'next';
import { COIN_RULES, EXCLUDED_TERRITORIES, GOVERNING_LAW, MIN_AGE, OPERATOR } from '@/lib/legal';
import { Bullets, LegalPage, Section, ToConfirm } from '@/components/site/LegalPage';

export const metadata: Metadata = {
  title: 'Giveaway rules',
  description: 'The rules for MattySpins giveaways and leaderboard prizes — eligibility, draws, claims and how fairness is proved.',
};

export default function GiveawayRulesPage() {
  return (
    <LegalPage
      current="/giveaway-rules"
      title="Giveaway and prize rules"
      intro="These rules cover both the coin-entry giveaways and the cash prizes on the Razed leaderboard. They are written to be checkable — every draw can be verified by anyone, after the fact."
    >
      <Section n={1} title="Who runs the giveaways">
        <p>
          Every giveaway and every leaderboard prize on this site is promoted, funded and paid by{' '}
          <ToConfirm>{OPERATOR.name}</ToConfirm>, {OPERATOR.entity}, at{' '}
          <ToConfirm>{OPERATOR.address}</ToConfirm>.
        </p>
        <p>
          <span className="text-ink">Razed does not run these promotions.</span> Razed supplies the
          wagering figures the leaderboard is built from, and nothing else. It does not fund the
          prizes, does not choose the winners and is not responsible for either.
        </p>
        <p>
          These promotions are not sponsored, endorsed or administered by Discord, Kick, YouTube,
          Instagram or X.
        </p>
      </Section>

      <Section n={2} title="Who can enter">
        <Bullets
          items={[
            <>You must be {MIN_AGE} or over.</>,
            <>You must hold a MattySpins account with a verified Kick link.</>,
            <>
              You must not be resident in an excluded territory:{' '}
              {EXCLUDED_TERRITORIES.join(', ')}.
            </>,
            <>
              Moderators, the operator, and anyone living in their household are not eligible for
              prizes.
            </>,
            <>One account per person. Entries from duplicate accounts are void.</>,
          ]}
        />
        <p>
          We may ask you to prove your age and your identity before a prize is released, and we may
          withhold a prize where you cannot.
        </p>
      </Section>

      <Section n={3} title="How to enter a giveaway">
        <p>
          Entries are bought with Matty Coins, which are earned by watching and cannot be purchased.
          There is no other way to enter, and no purchase of any kind can improve your chances,
          because there is nothing on this site to purchase.
        </p>
        <p>
          Each giveaway states its entry cost and a cap on entries per person. The cap exists so a
          draw is not simply won by whoever has the largest balance.
        </p>
        <p>Coins spent on entries are not refundable once a draw has run.</p>
      </Section>

      <Section n={4} title="How the winner is chosen">
        <p>
          Before entries open we generate a random server seed and publish only its SHA-256 hash.
          That hash is a commitment: no other seed produces it, so the seed cannot be swapped
          afterwards.
        </p>
        <p>
          When the draw runs, the seed is revealed. The winning entry is derived from{' '}
          <code className="font-mono text-[13px] text-brand-dim">HMAC(seed, giveaway id)</code> across
          the final entry count. Anyone can hash the revealed seed to confirm it matches the
          published commitment, then recompute the winning row themselves.
        </p>
        <p>
          The full method is written out on the{' '}
          <Link href="/verify" className="text-brand underline underline-offset-2">verification page</Link>.
          Every past draw keeps its seed on the giveaways page permanently.
        </p>
      </Section>

      <Section n={5} title="Leaderboard prizes">
        <p>
          Leaderboard positions are ranked on wagering figures supplied by Razed for accounts
          registered under our referral code, over the stated period, in UTC.
        </p>
        <Bullets
          items={[
            <>
              <span className="text-ink">Ties</span> are broken in favour of whoever reached the
              total first, on Razed&rsquo;s timestamps.
            </>,
            <>
              <span className="text-ink">A board freezes</span> at the end of its period and is
              verified for {COIN_RULES.verificationHours} hours before claims open.
            </>,
            <>
              <span className="text-ink">Prize tables may change</span> between periods. A change made
              during a live period is logged and shown on the board with a timestamp.
            </>,
            <>
              <span className="text-ink">We publish the figures we are given.</span> We cannot amend
              Razed&rsquo;s data; a dispute about what you wagered is a matter for Razed.
            </>,
          ]}
        />
      </Section>

      <Section n={6} title="Claiming">
        <p>
          Giveaway winners are announced on the site and contacted through Discord. You have{' '}
          {COIN_RULES.giveawayClaimWindowDays} days to claim; after that the prize is redrawn from
          the remaining entries, and the redraw is published with its own seed.
        </p>
        <p>
          Leaderboard prizes are claimed on this site by selecting your position and stating the
          full Razed username behind it. A moderator checks it against the frozen snapshot before
          anything is paid. An unclaimed leaderboard prize rolls into the next pot after{' '}
          {COIN_RULES.prizeClaimWindowDays} days.
        </p>
        <p>
          <span className="text-ink">Nobody will ever ask you to pay a fee to release a prize.</span>{' '}
          Matty will never message you first. If someone claiming to be him contacts you, check the{' '}
          <Link href="/official" className="text-brand underline underline-offset-2">official accounts page</Link>.
        </p>
      </Section>

      <Section n={7} title="Prizes">
        <p>
          Prizes are as described at the time of the draw. Cash prizes are paid by{' '}
          <ToConfirm>[PAYMENT METHOD — TO CONFIRM]</ToConfirm> within{' '}
          <ToConfirm>[PAYMENT WINDOW — TO CONFIRM]</ToConfirm> of a claim being verified.
        </p>
        <p>
          Prizes are not transferable. There is no cash alternative to a physical prize unless we
          offer one. We may substitute a prize of equal or greater value where we cannot supply the
          one advertised.
        </p>
        <p>
          <span className="text-ink">Tax is the winner&rsquo;s responsibility.</span> Where a prize
          creates a tax liability in your country, it is yours to declare and pay.{' '}
          <ToConfirm>[TAX AND WITHHOLDING POSITION — TO CONFIRM WITH COUNSEL]</ToConfirm>
        </p>
      </Section>

      <Section n={8} title="Disqualification">
        <p>
          We may void entries, withhold a prize and close an account where we reasonably believe
          someone has used duplicate accounts, automated chat or the site, manipulated wagering to
          game a board, or claimed a position that is not theirs.
        </p>
        <p>
          Claiming someone else&rsquo;s leaderboard position is attempted fraud, and a second
          claimant on one position is reviewed by a moderator rather than treated as a race.
        </p>
      </Section>

      <Section n={9} title="If something goes wrong">
        <p>
          If a draw cannot run as described — a technical fault, an error in the entry count — we
          will say so publicly, refund the coins spent on entries, and rerun it with a fresh
          published seed.
        </p>
        <p>
          These rules are governed by the law of <ToConfirm>{GOVERNING_LAW}</ToConfirm>.{' '}
          <ToConfirm>
            [WHETHER ANY DRAW REQUIRES REGISTRATION, BONDING OR A LICENCE IN A TARGET MARKET — TO
            CONFIRM WITH COUNSEL]
          </ToConfirm>
        </p>
      </Section>
    </LegalPage>
  );
}
