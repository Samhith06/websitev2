import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';

/** One family carries the whole site, loaded as a variable font: 400 for prose,
 *  600 for labels and 800 for headings, buttons and figures. */
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mattyspins.com'),
  title: {
    default: 'MattySpins — the official community hub',
    template: '%s · MattySpins',
  },
  description:
    'Earn Matty Coins for watching on Kick, climb the monthly Razed wager leaderboard, claim monthly milestones, and spend coins on raffles and the store. Live every day at 7pm UK.',
  openGraph: {
    type: 'website',
    siteName: 'MattySpins',
    title: 'MattySpins',
    description: 'Earn coins for watching. Monthly leaderboard prizes tipped straight from Razed.',
  },
  // Search engines stay out until the legal review has landed and the
  // geo-block list is in place. Flip ALLOW_INDEXING to 'true' to open it up.
  robots:
    process.env.ALLOW_INDEXING === 'true'
      ? { index: true, follow: true }
      : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#111319',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[400] focus:bg-blue focus:px-4 focus:py-2 focus:text-[#111319]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
