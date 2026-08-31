import Link from 'next/link';

export const metadata = { title: 'Page not found' };

/**
 * The branded 404. Without this Next renders its own black-on-white page inside
 * our chrome, which reads as a broken deployment rather than a wrong address.
 *
 * It offers the four places people actually mistype their way towards, rather
 * than only a "go home" link that makes them start again.
 */
export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-20">
      <div className="max-w-lg text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Error 404</p>
        <h1 className="display mt-3 text-[38px] leading-none text-ink">
          That page does not exist
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          The address is wrong, or whatever used to be here has moved. Nothing is broken — the rest
          of the site is working normally.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            { href: '/', label: 'Home' },
            { href: '/leaderboard', label: 'Leaderboard' },
            { href: '/games', label: 'Games' },
            { href: '/shop', label: 'Shop' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[3px] border border-line bg-surface px-4 py-2.5 text-[14px] text-ink-2 transition-colors duration-150 hover:border-line-2 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
