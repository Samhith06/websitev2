'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, activeNav } from '@/lib/nav';
import { coins } from '@/lib/format';
import type { Viewer } from '@/lib/types';

export function Logo() {
  return (
    <div className="logo" aria-hidden>
      <span>
        <span className="m">M</span>
        <span className="d">$</span>
      </span>
    </div>
  );
}

/**
 * The sticky top bar.
 *
 * The coin pill is the single most-looked-at element on the site, so it sits
 * to the right of the nav and never moves between pages. Its multiplier chip
 * is the only place the earn rate is visible at a glance, which is why it
 * survives on every screen except the narrowest phones.
 */
export function SiteHeader({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const active = activeNav(pathname);
  const staff = viewer.role === 'mod' || viewer.role === 'owner';
  const initial = (viewer.discordUsername || '?').charAt(0).toUpperCase();

  return (
    <header className="site">
      <div className="wrap">
        <div className="hd">
          <Link className="brand" href="/">
            <Logo />
            <div className="bt">
              MATTY<i>SPINS</i>
            </div>
          </Link>

          <nav className="mainnav" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={active === item.href ? 'on' : ''}
                aria-current={active === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hd-right">
            {viewer.signedIn ? (
              <>
                <Link className="coinpill" href="/profile" title="Matty Coins">
                  <div className="coin" aria-hidden>
                    M
                  </div>
                  <span className="cv">{coins(viewer.balance)}</span>
                  {viewer.multiplier.value > 1 ? (
                    <span className="mult">{viewer.multiplier.value}×</span>
                  ) : null}
                </Link>

                {staff ? (
                  <Link
                    className="btn sm ghost"
                    href="/admin"
                    title="Staff area"
                    style={{ borderColor: 'rgba(255,179,71,.35)', color: 'var(--warn)' }}
                  >
                    ◆ Staff
                  </Link>
                ) : null}

                <Link className="avatar" href="/profile" title="Profile">
                  {viewer.avatarUrl ? (
                    // Discord CDN avatars, unoptimised on purpose — they are
                    // already the right size and the loader would cost a hop.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={viewer.avatarUrl} alt="" width={34} height={34} />
                  ) : (
                    initial
                  )}
                </Link>
              </>
            ) : (
              <Link className="btn pri sm discord" href="/api/auth/signin?callbackUrl=/profile">
                Sign in with Discord
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
