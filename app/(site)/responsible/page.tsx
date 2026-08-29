import Link from 'next/link';
import type { Metadata } from 'next';
import { HELPLINE, MIN_AGE } from '@/lib/legal';
import { Bullets, LegalPage, Section, ToConfirm } from '@/components/site/LegalPage';
import { Card } from '@/components/ui/surfaces';
import { Label } from '@/components/ui/typography';

export const metadata: Metadata = {
  title: 'Responsible play',
  description: 'Where to get help, what the games on this site are and are not, and how to switch them off.',
};

export default function ResponsiblePage() {
  return (
    <LegalPage
      current="/responsible"
      title="Responsible play"
      intro="This site sits next to real-money gambling, and that is worth being straight about. Here is where to get help, what the games here actually are, and how to switch them off."
    >
      {/* Help first. Anyone arriving here in trouble should not have to scroll. */}
      <Card tone="gold" className="p-5 lg:p-6">
        <Label className="mb-3 text-gold/70">If you need help now</Label>
        <p className="text-[16px] leading-relaxed text-ink">
          <a
            href={HELPLINE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold underline underline-offset-2"
          >
            {HELPLINE.name}
          </a>{' '}
          — free, confidential, 24 hours a day.
        </p>
        <p className="mt-2 font-mono text-[15px] tabular-nums text-gold">{HELPLINE.phone}</p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
          {HELPLINE.region}. <ToConfirm>[ADD A HELPLINE FOR EACH MAJOR AUDIENCE REGION]</ToConfirm>
        </p>
      </Card>

      <Section n={1} title="What the games here are">
        <p>
          The games on this site are played with Matty Coins, which are earned by watching and{' '}
          <span className="text-ink">cannot be bought with money under any circumstances</span>.
          There is no payment path on this site. You cannot deposit, cannot withdraw, and cannot
          lose money here.
        </p>
        <p>
          That is a real difference, and it is the reason this site can offer games at all. But it
          is not a reason to treat them as harmless. They use the same loops as real gambling —
          uncertainty, near-misses, a house edge — and they can build the same habits. If you find
          yourself playing them the way you would play for money, that is worth noticing.
        </p>
      </Section>

      <Section n={2} title="The house edge is real">
        <p>
          Every game keeps a small edge, printed on every paytable and calculated from that exact
          table rather than quoted from a constant. Over enough rounds you will end up down. That is
          arithmetic, not luck, and no strategy changes it.
        </p>
        <p>
          Streaks mean nothing. Each round is derived independently from a seed pair and a nonce,
          and is unaffected by what came before, how much you have lost, or how long you have been
          playing. You can verify that yourself on the{' '}
          <Link href="/verify" className="text-brand underline underline-offset-2">verification page</Link>.
        </p>
      </Section>

      <Section n={3} title="Controls on this site">
        <Bullets
          items={[
            <>
              <span className="text-ink">Games are off by default.</span> They do not appear in the
              navigation until you confirm you are {MIN_AGE} or over and switch them on.
            </>,
            <>
              <span className="text-ink">Session reminders.</span> At an interval you choose, the site
              tells you how long you have played, how much you have wagered and where you stand —
              plain numbers, no encouragement. This cannot be switched off entirely.
            </>,
            <>
              <span className="text-ink">Per-round limits.</span> A round is 10–100 MC and can pay at
              most 20,000 MC.
            </>,
            <>
              <span className="text-ink">No autoplay.</span> Every round is a deliberate action.
              Rounds that keep firing while nobody is watching are the ones people regret.
            </>,
            <>
              <span className="text-ink">Self-exclusion.</span> Turn the games off for a day, a week,
              a month or permanently. It takes effect immediately, hides them from your navigation,
              and is enforced on the server so it holds everywhere you sign in.
            </>,
          ]}
        />
        <p>
          All of it lives on your{' '}
          <Link href="/me#limits" className="text-brand underline underline-offset-2">profile page</Link>.
        </p>
        <p className="text-muted">
          There is deliberately no daily wager limit on this site. If you would find one useful, use
          self-exclusion instead — it is the stronger control, and it cannot be undone in a weak
          moment.
        </p>
      </Section>

      <Section n={4} title="Self-exclusion cannot be reversed early">
        <p>
          When you switch the games off for a period, that is final for the period. No moderator can
          lift it, and asking will not change the answer. That is the point of it — a control you
          can talk yourself out of is not a control.
        </p>
        <p>
          The rest of the site keeps working normally throughout. You keep earning coins, the shop
          works, the giveaways work and the leaderboard works.
        </p>
      </Section>

      <Section n={5} title="Razed and real-money gambling">
        <p>
          This site carries an affiliate link to Razed and earns a commission on sign-ups. That
          commission does not depend on whether you win or lose, but you should know it exists.
        </p>
        <p>
          Razed is real-money gambling. Everything above about house edges applies there with actual
          money attached. Before depositing anywhere, set a deposit limit — every licensed operator
          has them built in, and setting one before your first deposit is easier than after.
        </p>
        <p>
          If you have self-excluded from real-money gambling elsewhere, do not use the affiliate
          link on this site.
        </p>
      </Section>

      <Section n={6} title="Signs worth taking seriously">
        <Bullets
          items={[
            'Playing longer, or for more, than you meant to.',
            'Chasing a loss — playing on specifically to get back to level.',
            'Hiding how much you play from people close to you.',
            'Feeling restless or irritable when you cannot play.',
            'Money that had somewhere else to be going on gambling instead.',
          ]}
        />
        <p>
          If more than one of those sounds familiar, talk to{' '}
          <a
            href={HELPLINE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-2"
          >
            {HELPLINE.name}
          </a>
          . It is free, it is confidential, and they have heard it all before.
        </p>
      </Section>

      <Section n={7} title="Under 18s">
        <p>
          This site is for over-{MIN_AGE}s only. If you are under {MIN_AGE}, do not use it. Accounts
          found to belong to under-{MIN_AGE}s are closed and their balances forfeited.
        </p>
        <p>
          If you share a device, parental control software such as Gamban, GamBlock or Net Nanny can
          block gambling content across the whole machine.
        </p>
      </Section>
    </LegalPage>
  );
}
