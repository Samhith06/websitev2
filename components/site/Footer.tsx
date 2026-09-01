import Link from 'next/link';
import { Label } from '@/components/ui/typography';
import { Wordmark } from '@/components/ui/marks';

const COLUMNS = [
  {
    heading: 'The site',
    links: [
      { href: '/leaderboard', label: 'Leaderboards' },
      { href: '/shop', label: 'Coin shop' },
      { href: '/giveaways', label: 'Giveaways' },
      { href: '/wins', label: 'Wall of fame' },
      { href: '/clips', label: 'Clips' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { href: '/verify', label: 'Verify a round' },
      { href: '/official', label: 'Official accounts' },
      { href: '/leaderboard', label: 'How the board works' },
      { href: '/casinos', label: 'Razed hub' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/giveaway-rules', label: 'Giveaway rules' },
      { href: '/responsible', label: 'Responsible play' },
    ],
  },
];

/** The 18+ roundel. A persistent footer notice, required at launch (§12). */
function AgeRoundel() {
  return (
    <span
      className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink-2 font-mono text-[13px] font-bold text-ink-2"
      aria-label="Eighteen plus"
    >
      18+
    </span>
  );
}

export function Footer() {
  return (
    <footer className="mt-[72px] border-t border-line bg-surface/40">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark markSize={34} />
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-muted">
              A community site for MattySpins. Earn Matty Coins by watching, spend them on
              entries, Discord perks and merch. Coins cannot be bought and have no cash value.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <Label className="mb-4">{col.heading}</Label>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13.5px] text-ink-2 transition-colors duration-150 hover:text-brand-dim"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-6 py-8 md:flex-row md:items-start md:gap-8">
          <AgeRoundel />
          <div className="space-y-3 text-[12.5px] leading-relaxed text-muted">
            <p>
              <span className="text-ink-2">Play responsibly.</span> This site is for
              over-18s. Matty Coins are a promotional currency: they cannot be purchased, hold no
              cash value, are non-transferable and may be revoked for abuse. Gambling with real
              money carries real risk — if it stops being fun, stop. Free, confidential help is
              available at{' '}
              <a
                href="https://www.begambleaware.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-2 underline underline-offset-2 hover:text-brand-dim"
              >
                BeGambleAware.org
              </a>
              .
            </p>
            <p>
              <span className="text-ink-2">Affiliate disclosure.</span> MattySpins earns a
              commission when you sign up to Razed under the referral code on this site. Prizes and
              giveaways are funded and operated by Matty personally, not by Razed.
            </p>
            <p className="text-ink-2">
              Matty will never DM you first and will never ask you to deposit. Check{' '}
              <Link href="/official" className="text-brand underline underline-offset-2 hover:text-brand-dim">
                the official accounts page
              </Link>{' '}
              before you trust anyone claiming to be him.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
