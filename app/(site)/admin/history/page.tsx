import Link from 'next/link';
import { boardsWithStandings } from '@/lib/store/periods';
import { money, periodLabel } from '@/lib/format';

export const metadata = { title: 'Leaderboard history' };
export const dynamic = 'force-dynamic';

const STATUS_TAG: Record<string, string> = {
  frozen: 'warn',
  paid: 'green',
  archived: '',
};

/**
 * Every finished board, newest first.
 *
 * Read from the frozen standings, not from Razed, so each month shows what the
 * board said when it locked. That includes a board frozen but not yet paid,
 * which the public archive leaves out until it is settled.
 */
export default async function AdminHistoryPage() {
  const boards = await boardsWithStandings();

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Frozen standings</span>
          <h1>Leaderboard history</h1>
          <div className="sh-sub">
            Every past board with every player&apos;s final position. Open a month to see the full
            standings with real Razed usernames.
          </div>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="emptyq">
          No board has been frozen yet. Once a month is frozen on the Leaderboard screen, or a past
          month is recorded there, it appears here.
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Status</th>
                <th>Winner</th>
                <th>Players</th>
                <th>Total wagered</th>
                <th>Prize pool</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => {
                const standings = board.frozenStandings ?? [];
                const winner = standings[0];
                const total = standings.reduce((sum, row) => sum + row.wagered, 0);
                const href = `/admin/history/${board.id}`;
                return (
                  <tr key={board.id}>
                    <td className="n">
                      <Link href={href} style={{ color: 'var(--text)' }}>
                        {periodLabel(board.startsAt, board.endsAt)}
                      </Link>
                    </td>
                    <td>
                      <span className={`tag ${STATUS_TAG[board.status] ?? ''}`}>
                        {board.status}
                      </span>
                    </td>
                    <td className="n">
                      {winner ? (winner.username ?? winner.maskedUsername) : '—'}
                    </td>
                    <td className="n">{standings.length.toLocaleString('en-GB')}</td>
                    <td className="n">{money(Math.round(total))}</td>
                    <td className="g">{board.pot ? money(board.pot) : '—'}</td>
                    <td className="acts">
                      <Link className="btn sm" href={href}>
                        Full board
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        A <b>frozen</b> month is not on the public leaderboard yet: once its winners are tipped,
        open it and press <b>Mark as paid</b> to add it to Past winners.
      </p>
      <p className="small muted" style={{ marginTop: 8, maxWidth: '72ch' }}>
        Months are listed once their standings are stored: frozen from the live board, or recorded
        after the fact. Boards frozen before this screen existed hold the first 100 players Razed
        returned; boards frozen from now on hold everyone.
      </p>
    </>
  );
}
