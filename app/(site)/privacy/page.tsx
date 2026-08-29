import Link from 'next/link';
import type { Metadata } from 'next';
import { COIN_RULES, GOVERNING_LAW, OPERATOR } from '@/lib/legal';
import { Bullets, LegalPage, Section, ToConfirm } from '@/components/site/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What MattySpins stores about you, why, and how to get rid of it.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy policy"
      intro="What this site stores about you, why it stores it, who else sees it, and how to make it go away. It is short because the site collects very little."
    >
      <Section n={1} title="Who is responsible">
        <p>
          The data controller is <ToConfirm>{OPERATOR.name}</ToConfirm>, {OPERATOR.entity}, at{' '}
          <ToConfirm>{OPERATOR.address}</ToConfirm>. Data questions go to{' '}
          <ToConfirm>{OPERATOR.email}</ToConfirm>.
        </p>
        <p>
          <ToConfirm>
            [WHETHER A UK/EU REPRESENTATIVE OR ICO REGISTRATION IS REQUIRED — TO CONFIRM]
          </ToConfirm>
        </p>
      </Section>

      <Section n={2} title="What we store">
        <Bullets
          items={[
            <>
              <span className="text-ink">Your Discord account id, username and avatar.</span> This is
              your identity on the site. We ask Discord for the <code className="font-mono text-[13px] text-brand-dim">identify</code>{' '}
              and <code className="font-mono text-[13px] text-brand-dim">guilds</code> scopes so we can
              confirm you are a member of the server. We never see your Discord password or email.
            </>,
            <>
              <span className="text-ink">Your Kick user id and username</span>, once you verify by
              typing a short code in chat. We key off the numeric id, because usernames change.
            </>,
            <>
              <span className="text-ink">Your coin ledger.</span> Every coin earned, spent, won, lost
              or adjusted, with the reason. This is an accounting record and it is append-only.
            </>,
            <>
              <span className="text-ink">Game rounds you play</span> — the bet, the outcome, the
              payout, and the seed values that let anyone verify the round.
            </>,
            <>
              <span className="text-ink">A Razed username, if you claim a prize.</span> You give it to
              us; we check it against the frozen leaderboard snapshot. We do not have access to your
              Razed account.
            </>,
            <>
              <span className="text-ink">A hash of your IP address</span>, used to spot networks of
              duplicate accounts. We store the hash, not the address, and we never ban on it alone.
            </>,
          ]}
        />
        <p>
          We do not store payment details, because there is nothing on this site to pay for. We do
          not ask for your real name or address unless you redeem something that has to be posted to
          you.
        </p>
      </Section>

      <Section n={3} title="Why we are allowed to store it">
        <p>
          For your account, your coins and your redemptions, we process your data to perform the
          agreement you entered into by signing up.
        </p>
        <p>
          For fraud and multi-account detection, and for keeping prize records, we rely on our
          legitimate interest in running a fair site and being able to show that prizes went where
          we said they did.
        </p>
        <p>
          <ToConfirm>[LAWFUL BASES TO BE CONFIRMED BY COUNSEL]</ToConfirm>
        </p>
      </Section>

      <Section n={4} title="Who else sees it">
        <p>
          The site runs on hosting, database and error-monitoring services acting on our
          instructions. They process data to keep the site running and for nothing else.
        </p>
        <p>
          <span className="text-ink">Masked usernames are public.</span> Leaderboard positions,
          giveaway winners and big wins appear on the site in masked form. Prize records are kept
          permanently, because a giveaway nobody can audit is not a giveaway.
        </p>
        <p>
          <span className="text-ink">We do not sell your data</span>, and we do not share it with
          Razed. Razed sends us wagering figures for accounts under our referral code; nothing goes
          the other way.
        </p>
        <p>
          <ToConfirm>[FULL PROCESSOR LIST AND ANY INTERNATIONAL TRANSFERS — TO CONFIRM]</ToConfirm>
        </p>
      </Section>

      <Section n={5} title="Cookies">
        <p>
          We use a session cookie to keep you signed in, and browser storage to remember that you
          confirmed your age. Both are necessary for the site to work and neither tracks you across
          other websites.
        </p>
        <p>
          <ToConfirm>[ANALYTICS — IF PLAUSIBLE/UMAMI IS ADDED, DESCRIBE IT HERE]</ToConfirm>
        </p>
      </Section>

      <Section n={6} title="How long we keep it">
        <p>
          Your account and its data are kept while the account is open. A balance is forfeited after{' '}
          {COIN_RULES.inactivityExpiryDays} days of inactivity, though the account remains.
        </p>
        <p>
          Ledger rows and prize records outlive the account in anonymised form. They are the record
          of every coin issued and every prize paid, and removing them would make the site
          unauditable.
        </p>
      </Section>

      <Section n={7} title="Deleting your account">
        <p>
          There is a delete button on your{' '}
          <Link href="/me" className="text-brand underline underline-offset-2">profile page</Link>. It
          removes your Discord link, your Kick link and your balance immediately and permanently.
        </p>
        <p>
          What survives: ledger rows with your identity stripped out; any giveaway you won, because
          the winner list is never edited; and any prize claim already paid, because that is a
          financial record.
        </p>
      </Section>

      <Section n={8} title="Your rights">
        <p>
          You can ask for a copy of what we hold, ask us to correct it, ask us to delete it, object
          to how we are using it, or ask us to restrict it. Write to{' '}
          <ToConfirm>{OPERATOR.email}</ToConfirm> and we will respond within one month.
        </p>
        <p>
          If you are not satisfied you can complain to your data protection regulator — in the UK,
          the Information Commissioner&rsquo;s Office at ico.org.uk. This policy is governed by the
          law of <ToConfirm>{GOVERNING_LAW}</ToConfirm>.
        </p>
      </Section>

      <Section n={9} title="Children">
        <p>
          The site is not for anyone under 18 and we do not knowingly hold data about anyone under
          18. If you believe we do, tell us and we will delete it.
        </p>
      </Section>
    </LegalPage>
  );
}
