import { recent } from '@/lib/store/audit';
import { dateTime, relativeTime } from '@/lib/format';

export const metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

/** Append-only. Nothing in the codebase deletes or updates a row here. */
export default async function AdminAuditPage() {
  const entries = await recent(200);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Append-only</span>
          <h1>Audit log</h1>
          <div className="sh-sub">
            Every staff action, with who did it and what it touched. Nothing here can be deleted.
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="emptyq">Nothing logged yet.</div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Detail</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span className={`tag ${entry.actor === 'system' ? '' : 'blue'}`}>
                      {entry.actor}
                    </span>
                  </td>
                  <td className="n">{entry.action}</td>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {entry.target || '—'}
                  </td>
                  <td className="small muted" style={{ maxWidth: 280 }}>
                    {entry.detail
                      ? Object.entries(entry.detail)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(' · ')
                      : '—'}
                  </td>
                  <td className="n" style={{ color: 'var(--muted)' }} title={dateTime(entry.createdAt)}>
                    {relativeTime(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
