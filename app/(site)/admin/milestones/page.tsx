import Link from 'next/link';
import { rows } from '@/lib/db';
import { listLifetimeMembers, listTiers } from '@/lib/store/milestones';
import { dateShort, maybe, money } from '@/lib/format';
import { saveTierForm } from '@/app/(site)/admin/actions';
import { LifetimeAddForm, LifetimeToggle } from '@/components/admin/LifetimeControls';
import { TierControls } from '@/components/admin/TierControls';

export const metadata = { title: 'Milestone tiers' };
export const dynamic = 'force-dynamic';

/**
 * The ladder, as data.
 *
 * Editing a tier needs no deploy, and never touches a claim that has already
 * been made — a claim froze its own reward and wager figure when it was
 * created, precisely so that retuning the ladder later cannot rewrite history.
 *
 * The lifetime list lives here too. There is one ladder of tiers, and the list
 * only decides which figure and which claims it is measured against.
 */
export default async function AdminMilestonesPage() {
  const [tiers, counts, lifetimeMembers] = await Promise.all([
    listTiers(true),
    rows<{ tier_id: string; n: string }>(
      `SELECT tier_id::text, COUNT(*)::text AS n FROM milestone_claims GROUP BY tier_id`,
    ),
    listLifetimeMembers(),
  ]);

  const claimed = new Map(counts.map((c) => [Number(c.tier_id), Number(c.n)]));

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Monthly wager ladder</span>
          <h1>Milestone tiers</h1>
          <div className="sh-sub">
            Resets automatically on the 1st of every month (UTC), and each tier can be claimed once
            a month. Stored as data — editing a tier needs no deploy. Existing claims are never
            affected. The ladder always sorts by threshold, so changing one moves the tier into
            place.
          </div>
        </div>
      </div>

      <div className="card">
        {tiers.map((tier, i) => (
          <div
            className="editrow"
            key={tier.id}
            style={{ gridTemplateColumns: '28px 150px 1fr 1fr auto auto auto' }}
          >
            <span className="er" title="Position on the ladder">
              {i + 1}
            </span>
            {/* `display: contents` lets the form's fields sit directly in the
                row's grid, so the controls beside it are not inside the form —
                a client component nested in a server-action form does not
                hydrate, and its buttons come out inert. */}
            <form action={saveTierForm} style={{ display: 'contents' }}>
              <input type="hidden" name="id" value={tier.id} />
            <input
              className="inp s"
              name="name"
              defaultValue={tier.name}
              aria-label={`Tier ${i + 1} name`}
              placeholder="Name"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="er">Wager $</span>
              <input
                className="inp s"
                style={{ width: 110 }}
                name="threshold"
                type="number"
                step="1"
                min="1"
                defaultValue={tier.threshold}
                aria-label={`Tier ${i + 1} threshold`}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="er">Reward $</span>
              <input
                className="inp s"
                style={{ width: 90 }}
                name="reward"
                type="number"
                step="1"
                min="0"
                defaultValue={tier.reward}
                aria-label={`Tier ${i + 1} reward`}
              />
            </div>

              <div className="er">
                {claimed.get(tier.id) ?? 0} claimed
                {tier.active ? null : <span className="tag" style={{ marginLeft: 6 }}>off</span>}
              </div>
              <button className="btn sm">Save</button>
            </form>
            <TierControls
              tierId={tier.id}
              name={tier.name || String(tier.threshold)}
              active={tier.active}
              claims={claimed.get(tier.id) ?? 0}
            />
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Add a tier</h2>
        <form
          className="editrow"
          action={saveTierForm}
          style={{ gridTemplateColumns: '150px 1fr 1fr auto', borderBottom: 0 }}
        >
          <input className="inp s" name="name" required aria-label="New tier name" placeholder="Name" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="er">Wager $</span>
            <input
              className="inp s"
              name="threshold"
              type="number"
              step="1"
              min="1"
              required
              aria-label="New tier threshold"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="er">Reward $</span>
            <input
              className="inp s"
              name="reward"
              type="number"
              step="1"
              min="0"
              required
              aria-label="New tier reward"
            />
          </div>
          <button className="btn pri sm">Add tier</button>
        </form>
      </div>

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Total on the ladder as it stands:{' '}
        {money(tiers.filter((t) => t.active).reduce((sum, t) => sum + t.reward, 0))} per member, per
        month, for anyone who reaches the top. A tier with claims against it cannot be deleted —
        switching it off takes it off the ladder and keeps the record of what was paid.
      </p>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 15, marginBottom: 6 }}>Lifetime milestones</h2>
        <p className="small muted" style={{ margin: '0 0 12px', maxWidth: '72ch' }}>
          Members on this list do not reset. Their progress is their lifetime wager, and each tier
          can be claimed once ever, including any they already claimed on a monthly ladder. Removing
          someone puts them back on the monthly ladder, and their claims are kept.
        </p>

        <LifetimeAddForm />

        {lifetimeMembers.length === 0 ? (
          <div className="emptyq" style={{ marginTop: 12 }}>
            Nobody is on the list, so everyone is on the monthly ladder.
          </div>
        ) : (
          <div className="tw" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Razed</th>
                  <th>Lifetime wagered</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lifetimeMembers.map((member) => (
                  <tr key={member.userId}>
                    <td>
                      <Link href={`/admin/users/${member.userId}`}>{member.username}</Link>
                    </td>
                    <td>{member.razedUsername ?? '—'}</td>
                    <td className="n">{maybe(member.wagered, money)}</td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {dateShort(member.addedAt)} by {member.addedBy}
                    </td>
                    <td>
                      <LifetimeToggle
                        userId={member.userId}
                        username={member.username}
                        member
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
