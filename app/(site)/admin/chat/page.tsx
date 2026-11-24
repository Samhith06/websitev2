import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { SettleChatWeeksButton } from '@/components/admin/ChatBoardControls';
import { staffRole } from '@/lib/admin-gate';
import { CHAT_MIN_POINTS, CHAT_POOL, CHAT_RULES } from '@/lib/chat-score';
import { coins, dateTime } from '@/lib/format';
import {
  chatBoard,
  currentChatWeek,
  pastChatWeeks,
  unsettledChatWeeks,
  weekLabel,
} from '@/lib/store/chat-board';

export const metadata = { title: 'Chat leaderboard' };
export const dynamic = 'force-dynamic';

/**
 * The chat board with the working shown: every message seen against the ones
 * that counted, so a mod can see who is being filtered and by how much.
 */
export default async function AdminChatBoardPage() {
  const role = await staffRole();
  if (!role) return null;

  const week = await currentChatWeek();
  const [board, history, owed] = await Promise.all([
    chatBoard(week.weekStart, 100),
    pastChatWeeks(12),
    unsettledChatWeeks(),
  ]);

  return (
    <>
      <AutoRefresh seconds={30} />
      <div className="sec-head">
        <div>
          <span className="eyebrow">Moderation</span>
          <h1>Chat leaderboard</h1>
          <div className="sh-sub">
            Week of {weekLabel(week.weekStart)}, ends {dateTime(week.endsAt)}. {coins(CHAT_POOL)} MC to the top ten
            (minimum {CHAT_MIN_POINTS} points), paid automatically after Monday 00:00 UK time. One point per message
            during a live stream, at most one every {CHAT_RULES.cooldownSeconds}s and {CHAT_RULES.hourlyCap} an hour.
            The public page is <Link href="/leaderboard/chat">/leaderboard/chat</Link>.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <SettleChatWeeksButton pending={owed.length} />
        {owed.length ? (
          <p className="small muted" style={{ marginTop: 8 }}>
            Waiting: {owed.map(weekLabel).join(', ')}. The scheduler pays these on its next tick if you leave them.
          </p>
        ) : null}
      </div>

      {board.length === 0 ? (
        <div className="emptyq">No points yet this week. They start with the first chat message on a live stream.</div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Kick</th>
                <th>Points</th>
                <th>Messages</th>
                <th>Filtered</th>
                <th>Prize</th>
              </tr>
            </thead>
            <tbody>
              {board.map((row) => {
                const filtered = row.messages - row.points;
                const ratio = row.messages ? filtered / row.messages : 0;
                return (
                  <tr key={row.userId}>
                    <td className="n">{row.rank}</td>
                    <td>
                      <Link href={`/admin/users/${row.userId}`}>{row.name}</Link>
                    </td>
                    <td className="n">{coins(row.points)}</td>
                    <td className="n">{coins(row.messages)}</td>
                    <td className="n" style={{ color: ratio > 0.5 ? 'var(--red)' : undefined }}>
                      {coins(filtered)} ({Math.round(ratio * 100)}%)
                    </td>
                    <td className="g">{row.prize ? `${coins(row.prize)} MC` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 ? (
        <div className="sec" style={{ marginTop: 30 }}>
          <div className="sec-head">
            <div>
              <h2>Paid weeks</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Week of</th>
                  <th>Winner</th>
                  <th>Winners</th>
                  <th>Paid</th>
                  <th>Settled</th>
                </tr>
              </thead>
              <tbody>
                {history.map((w) => (
                  <tr key={w.weekStart}>
                    <td>{weekLabel(w.weekStart)}</td>
                    <td>{w.standings[0] ? `${w.standings[0].name} · ${coins(w.standings[0].points)} pts` : '—'}</td>
                    <td className="n">{w.standings.length}</td>
                    <td className="g">{coins(w.paid)} MC</td>
                    <td className="small muted">{dateTime(w.settledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
