import { money } from '@/lib/format';
import type { LeaderboardRow } from '@/lib/types';

/**
 * Every row of a finished board, as it was frozen.
 *
 * A server component on purpose. Frozen standings carry the real Razed
 * usernames (payouts are tipped by hand and need them), so the rows must never
 * be handed to a client component, where they would be serialised into the page
 * whether or not a column printed them. Public callers leave `reveal` off and
 * only the masked name reaches the HTML.
 */
export function PastStandings({
  rows,
  reveal = false,
}: {
  rows: LeaderboardRow[];
  /** Print the real username. Staff screens only. */
  reveal?: boolean;
}) {
  return (
    <div className="tw lb-table">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Wagered</th>
            <th>Prize</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rank}>
              <td className="n">
                <span className={`rank ${row.rank <= 3 ? `r${row.rank}` : ''}`}>{row.rank}</span>
              </td>
              <td className="n">
                {reveal ? (row.username ?? row.maskedUsername) : row.maskedUsername}
              </td>
              <td className="n">{money(row.wagered)}</td>
              <td className="g">
                {row.prize ? (
                  money(row.prize)
                ) : (
                  <span style={{ color: 'var(--muted-2)' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
