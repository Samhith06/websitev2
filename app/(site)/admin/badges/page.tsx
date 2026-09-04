import { rows } from '@/lib/db';
import { badgesFor } from '@/lib/store/badges';

export const metadata = { title: 'Badges' };
export const dynamic = 'force-dynamic';

/**
 * Badge definitions.
 *
 * Criteria are JSON on the row and evaluated by a job, so a new badge is an
 * insert rather than a deploy. The criteria column is shown raw here on
 * purpose — staff editing these need to see the actual rule, not a prettified
 * summary of it that might be wrong.
 */
export default async function AdminBadgesPage() {
  const [badges, holders] = await Promise.all([
    badgesFor(null),
    rows<{ badge_id: string; n: string }>(
      'SELECT badge_id::text, COUNT(*)::text AS n FROM user_badges GROUP BY badge_id',
    ),
  ]);

  const counts = new Map(holders.map((h) => [Number(h.badge_id), Number(h.n)]));

  const criteria = await rows<{ id: string; criteria: Record<string, unknown> }>(
    'SELECT id::text, criteria FROM badges',
  );
  const criteriaById = new Map(criteria.map((c) => [Number(c.id), c.criteria]));

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{badges.length} defined</span>
          <h1>Badges</h1>
          <div className="sh-sub">
            Criteria are stored as data and re-evaluated by a job. Manual grants are logged.
          </div>
        </div>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Badge</th>
              <th>Description</th>
              <th>Criteria</th>
              <th>Holders</th>
            </tr>
          </thead>
          <tbody>
            {badges.map((badge) => (
              <tr key={badge.id}>
                <td>
                  <span className={`tag ${badge.gold ? 'gold' : 'blue'}`}>{badge.name}</span>
                </td>
                <td className="muted">{badge.description}</td>
                <td className="n" style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {JSON.stringify(criteriaById.get(badge.id) ?? {})}
                </td>
                <td className="n">{counts.get(badge.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Badges marked <b>manual</b> are only ever granted by hand — Founder, for instance, belongs to
        the first thirty accounts and no rule can recompute that after the fact.
      </p>
    </>
  );
}
