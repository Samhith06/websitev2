import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, DollarSign, Trophy, Users } from 'lucide-react';
import { publicArchivedBoard, type StoredPeriod } from '@/lib/store/periods';
import { money, periodLabel } from '@/lib/format';
import { PastStandings } from '@/components/site/PastStandings';

export const dynamic = 'force-dynamic';

/**
 * The same boards the "Past winners" archive lists, and no others: a board that
 * is frozen but not yet paid is still being settled, and an open one is the live
 * leaderboard. Read without the real usernames — see `publicArchivedBoard`.
 */
async function archivedBoard(id: string): Promise<StoredPeriod | null> {
  if (!/^\d{1,15}$/.test(id)) return null;
  return publicArchivedBoard(Number(id));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const period = await archivedBoard(id);
  if (!period) return { title: 'Leaderboard' };
  const label = periodLabel(period.startsAt, period.endsAt);
  return {
    title: `${label} leaderboard`,
    description: `Final standings of the ${label} Razed wager race — every player, as frozen when the board locked.`,
  };
}

/**
 * One finished month, every position.
 *
 * Rendered from the frozen standings rather than by asking Razed again, so the
 * page shows exactly what the board said when it locked. Only masked names are
 * printed; the stored rows also hold the real ones, which is why the table is a
 * server component.
 */
export default async function PastLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const period = await archivedBoard(id);
  if (!period) notFound();

  const standings = period.frozenStandings ?? [];
  const label = periodLabel(period.startsAt, period.endsAt);
  const totalWagered = standings.reduce((sum, row) => sum + row.wagered, 0);
  const winner = standings[0];

  return (
    <div className="lbx">
      <div className="sec" style={{ marginTop: 10 }}>
        <Link href="/leaderboard" className="small muted lb-back">
          <ArrowLeft size={14} aria-hidden /> Back to the leaderboard
        </Link>
        <div className="sec-head">
          <div>
            <span className="eyebrow">Archive</span>
            <h2>{label}</h2>
            <div className="sh-sub">
              {winner
                ? `Won by ${winner.maskedUsername}. Final standings, as frozen when the board locked.`
                : 'Final standings, as frozen when the board locked.'}
            </div>
          </div>
        </div>
      </div>

      <section className="lb-stats">
        <div className="lb-stat">
          <span className="ring">
            <DollarSign size={18} aria-hidden />
          </span>
          <div className="v b">{standings.length ? money(Math.round(totalWagered)) : '—'}</div>
          <div className="l">Total wagered</div>
        </div>
        <div className="lb-stat">
          <span className="ring">
            <Trophy size={18} aria-hidden />
          </span>
          {/* A month recorded after the fact has no tiers, and "—" is true where "$0" is not. */}
          <div className="v g">{period.pot ? money(period.pot) : '—'}</div>
          <div className="l">Prize pool</div>
        </div>
        <div className="lb-stat">
          <span className="ring">
            <Users size={18} aria-hidden />
          </span>
          <div className="v">{standings.length.toLocaleString('en-GB')}</div>
          <div className="l">Players</div>
        </div>
      </section>

      {standings.length === 0 ? (
        <div className="emptyq">This period closed without frozen standings.</div>
      ) : (
        <PastStandings rows={standings} />
      )}
    </div>
  );
}
