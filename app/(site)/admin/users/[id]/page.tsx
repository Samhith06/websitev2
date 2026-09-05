import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { devBypass, roleFor } from '@/lib/admin';
import {
  memberById,
  multiplierFor,
  subStateFor,
  verificationStateFor,
} from '@/lib/store/accounts';
import { memberActivity } from '@/lib/store/member-detail';
import { ledgerFor } from '@/lib/store/coins';
import { recentRounds } from '@/lib/store/play';
import { redemptionsFor } from '@/lib/store/shop';
import { badgesFor } from '@/lib/store/badges';
import { claimsFor, listTiers } from '@/lib/store/milestones';
import { pokerHandleFor, settingsFor } from '@/lib/store/profile';
import { wagerStateFor } from '@/lib/store/wager';
import {
  coins,
  dateShort,
  dateTime,
  duration,
  formatMultiplier,
  maybe,
  money,
  mult,
  relativeTime,
} from '@/lib/format';
import { AdjustBalance } from '@/components/admin/AdjustBalance';
import { RecheckBadgesButton } from '@/components/admin/AdminButtons';

export const metadata = { title: 'Member' };
export const dynamic = 'force-dynamic';

/** How many rows each history card shows before it stops being a summary. */
const HISTORY = 25;

/**
 * One member, in full.
 *
 * The list at /admin/users answers "who is here". This answers "what has this
 * person actually done", which is the question behind every message a mod
 * gets: why has my payout not landed, why did my coins drop, is this account
 * the same person as that one. Everything the database holds about them is on
 * this page, because the alternative is a mod guessing from the one figure
 * their current screen happens to show.
 *
 * Nothing here is public. It is the staff view, and it deliberately includes
 * the figures the public profile hides — balance, orders, the Razed username —
 * because a moderator who cannot see them cannot moderate.
 */
export default async function AdminMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) notFound();

  const session = devBypass() ? null : await auth();
  const isOwner = devBypass() || roleFor(session?.user?.discordId ?? null) === 'owner';

  const member = await memberById(userId);
  if (!member) notFound();

  const [
    activity,
    ledger,
    rounds,
    redemptions,
    badges,
    claims,
    tiers,
    settings,
    poker,
    wager,
    sub,
    verification,
  ] = await Promise.all([
    memberActivity(userId),
    ledgerFor(userId, HISTORY),
    recentRounds(userId, HISTORY),
    redemptionsFor(userId, HISTORY),
    badgesFor(userId),
    claimsFor(userId),
    listTiers(true),
    settingsFor(userId),
    pokerHandleFor(userId),
    wagerStateFor(userId),
    subStateFor(userId),
    verificationStateFor(userId),
  ]);

  const tierName = new Map(tiers.map((t) => [t.id, t.name || money(t.threshold)]));
  const earned = badges.filter((b) => b.earnedAt);
  const staffRole = roleFor(member.discordId);
  const frozen = member.status === 'frozen';
  const multiplier = multiplierFor(sub);

  // Milestone money is the figure that gets asked about, so it is split by what
  // has actually been sent rather than shown as one total.
  const paidOut = claims.filter((c) => c.status === 'paid').reduce((n, c) => n + c.reward, 0);
  const owed = claims.filter((c) => c.status === 'pending').reduce((n, c) => n + c.reward, 0);

  // Coins staked across both tables. Blackjack lives in its own and would
  // otherwise be missing from every "total wagered" on the page.
  const coinsStaked = activity.games.wagered + activity.blackjack.staked;
  const coinsReturned = activity.games.returned + activity.blackjack.returned;

  const excluded =
    settings.excludedUntil && new Date(settings.excludedUntil).getTime() > Date.now();

  return (
    <>
      <div className="sec-head">
        <div>
          <Link href="/admin/users" className="eyebrow">
            ← Users
          </Link>
          <h1>{member.discordUsername}</h1>
          <div className="sh-sub">
            Everything on this account. Account id {member.id} · joined{' '}
            {dateShort(member.createdAt)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {frozen ? <span className="tag red">Frozen</span> : null}
          {activity.presence.open ? <span className="tag green">Watching now</span> : null}
          {staffRole ? (
            <span className={`tag ${staffRole === 'owner' ? 'gold' : 'blue'}`}>{staffRole}</span>
          ) : null}
          <Link
            className="btn sm ghost"
            href={`/u/${encodeURIComponent(member.discordUsername)}`}
          >
            Public profile →
          </Link>
          {isOwner ? (
            <AdjustBalance
              userId={member.id}
              username={member.discordUsername}
              balance={member.balance}
            />
          ) : null}
        </div>
      </div>

      {frozen ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(255,92,122,.35)' }}>
          <div className="small" style={{ color: 'var(--red)' }}>
            Frozen — {member.frozenReason ?? 'no reason recorded'}
            {member.frozenUntil ? ` · until ${dateTime(member.frozenUntil)}` : ' · no end date'}.
            Coins already held stay; nothing accrues while this is set.
          </div>
        </div>
      ) : null}

      <div className="pgrid">
        {/* ---------------------------------------------------------------- */}
        {/* Identity, links, settings                                         */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="idcard">
            <div className="big" aria-hidden>
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt="" />
              ) : (
                member.discordUsername.charAt(0).toUpperCase()
              )}
            </div>
            <div className="un">{member.discordUsername}</div>
            <div className="sub">Member since {dateShort(member.createdAt)}</div>

            <div style={{ marginTop: 18 }}>
              <Row label="Discord id" value={member.discordId} mono />
              <Row
                label="Kick"
                value={member.kick ? `${member.kick.kickUsername} ✓` : 'Not linked'}
                tone={member.kick ? 'green' : 'muted'}
              />
              <Row
                label="Kick id"
                value={member.kick?.kickUserId ? String(member.kick.kickUserId) : '—'}
                mono
              />
              <Row
                label="Verified"
                value={member.kick ? dateShort(member.kick.verifiedAt) : verification.status}
              />
              <Row
                label="Razed"
                value={wager.link ? wager.link.username : 'Not linked'}
                tone={
                  wager.link?.status === 'approved'
                    ? 'green'
                    : wager.link?.status === 'rejected'
                      ? 'red'
                      : wager.link
                        ? 'warn'
                        : 'muted'
                }
              />
              <Row label="Razed status" value={wager.link?.status ?? '—'} />
              <Row label="PokerNow" value={poker ?? '—'} />
              <Row label="Tier" value={`${multiplier.label} · ${multiplier.value}×`} tone="blue" />
              <Row
                label="Sub until"
                value={sub.subActiveUntil ? dateShort(sub.subActiveUntil) : '—'}
              />
              <Row label="VIP" value={sub.isVip ? 'Yes' : 'No'} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Their settings</h3>
            <Row label="Games enabled" value={settings.gamesEnabled ? 'On' : 'Off'} />
            <Row label="Game sound" value={settings.gameSound ? 'On' : 'Off'} />
            <Row label="Public profile" value={settings.publicProfile ? 'On' : 'Off'} />
            <Row
              label="Stream notifications"
              value={settings.streamNotifications ? 'On' : 'Off'}
            />
            <Row
              label="Self-excluded"
              value={excluded ? `Until ${dateShort(settings.excludedUntil!)}` : 'No'}
              tone={excluded ? 'warn' : 'muted'}
            />
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Presence</h3>
            <Row
              label="Window"
              value={activity.presence.open ? 'Open — earning' : 'Closed'}
              tone={activity.presence.open ? 'green' : 'muted'}
            />
            <Row
              label="Expires"
              value={
                activity.presence.expiresAt ? relativeTime(activity.presence.expiresAt) : '—'
              }
            />
            <Row label="Source" value={activity.presence.source ?? '—'} />
            <Row label="Tick streak" value={String(activity.presence.streak)} />
            <Row
              label="Last tick"
              value={
                activity.presence.lastTickAt ? relativeTime(activity.presence.lastTickAt) : '—'
              }
            />
            <p className="small muted" style={{ marginTop: 10 }}>
              A chat message opens a 15-minute window; only an open window earns.
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* The figures, and every history behind them                        */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="statgrid">
            <Stat label="Coin balance" value={coins(member.balance)} tone="g" />
            <Stat label="Lifetime coins" value={coins(member.lifetimeEarned)} />
            <Stat label="Watch time" value={duration(activity.watch.minutes * 60)} />
            <Stat label="Days active" value={String(activity.watch.daysActive)} />
            <Stat label="Lifetime wagered" value={maybe(wager.lifetime, money)} tone="b" />
            <Stat label="Coins staked" value={coins(coinsStaked)} />
            <Stat
              label="Rounds played"
              value={String(activity.games.rounds + activity.blackjack.rounds)}
            />
            <Stat label="Milestones paid" value={money(paidOut)} />
          </div>

          {/* Watching ---------------------------------------------------- */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Watch time</h3>
            <div className="statgrid">
              <Stat label="Paid ticks" value={coins(activity.watch.ticks)} />
              <Stat label="Hours" value={activity.watch.hours.toFixed(1)} />
              <Stat label="Watch coins" value={coins(activity.watch.watchCoins)} tone="g" />
              <Stat
                label="Hour bonuses"
                value={`${activity.watch.bonuses} · ${coins(activity.watch.bonusCoins)}`}
              />
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Counted from paid ticks at three minutes each, not from coins — a VIP earns 2.5 coins
              for the same three minutes, so dividing coins by the rate would overstate them.
              {activity.watch.firstSeenAt
                ? ` First earned ${dateShort(activity.watch.firstSeenAt)}, last ${relativeTime(activity.watch.lastSeenAt!)}.`
                : ' Nothing earned by watching yet.'}
            </p>
          </div>

          {/* Wager and milestones ---------------------------------------- */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Razed wager and milestones</h3>
            <div className="statgrid">
              <Stat label="Lifetime wagered" value={maybe(wager.lifetime, money)} tone="b" />
              <Stat label="Claims" value={String(claims.length)} />
              <Stat label="Paid out" value={money(paidOut)} tone="g" />
              <Stat label="Awaiting payout" value={money(owed)} tone={owed > 0 ? 'g' : undefined} />
            </div>

            {wager.lifetime === null ? (
              <p className="small muted" style={{ marginTop: 12 }}>
                No wager figure — either no Razed link, or no snapshot has been synced yet. That is
                not the same as zero.
              </p>
            ) : null}

            {claims.length > 0 ? (
              <div className="tw" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>Wagered at claim</th>
                      <th>Reward</th>
                      <th>Claimed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <tr key={claim.id}>
                        <td>{tierName.get(claim.tierId) ?? `Tier ${claim.tierId}`}</td>
                        <td className="n">{money(claim.wageredAtClaim)}</td>
                        <td className="n g">{money(claim.reward)}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {dateShort(claim.createdAt)}
                        </td>
                        <td>
                          <span
                            className={`tag ${
                              claim.status === 'paid'
                                ? 'green'
                                : claim.status === 'rejected'
                                  ? 'red'
                                  : 'warn'
                            }`}
                          >
                            {claim.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyq" style={{ marginTop: 12 }}>
                No milestone claimed.
              </div>
            )}
          </div>

          {/* Play -------------------------------------------------------- */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Games played</h3>
            <div className="statgrid">
              <Stat label="Coins staked" value={coins(coinsStaked)} />
              <Stat label="Coins returned" value={coins(coinsReturned)} />
              <Stat
                label="Net"
                value={`${coinsReturned - coinsStaked >= 0 ? '+' : '−'}${coins(Math.abs(coinsReturned - coinsStaked))}`}
                tone={coinsReturned - coinsStaked >= 0 ? 'g' : undefined}
              />
              <Stat label="Biggest win" value={coins(activity.games.biggestWin)} tone="g" />
            </div>

            {activity.gamesByGame.length > 0 || activity.blackjack.rounds > 0 ? (
              <div className="tw" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Rounds</th>
                      <th>Staked</th>
                      <th>Returned</th>
                      <th>Net</th>
                      <th>Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.gamesByGame.map((row) => (
                      <tr key={row.game}>
                        <td>{row.game}</td>
                        <td className="n">{coins(row.rounds)}</td>
                        <td className="n">{coins(row.wagered)}</td>
                        <td className="n">{coins(row.returned)}</td>
                        <td
                          className="n"
                          style={{ color: row.net >= 0 ? 'var(--green)' : 'var(--red)' }}
                        >
                          {row.net >= 0 ? '+' : '−'}
                          {coins(Math.abs(row.net))}
                        </td>
                        <td className="n">{mult(row.bestMultiplier)}</td>
                      </tr>
                    ))}
                    {activity.blackjack.rounds > 0 ? (
                      <tr>
                        <td>
                          blackjack{' '}
                          {activity.blackjack.open > 0 ? (
                            <span className="tag warn">hand open</span>
                          ) : null}
                        </td>
                        <td className="n">{coins(activity.blackjack.rounds)}</td>
                        <td className="n">{coins(activity.blackjack.staked)}</td>
                        <td className="n">{coins(activity.blackjack.returned)}</td>
                        <td
                          className="n"
                          style={{
                            color:
                              activity.blackjack.net >= 0 ? 'var(--green)' : 'var(--red)',
                          }}
                        >
                          {activity.blackjack.net >= 0 ? '+' : '−'}
                          {coins(Math.abs(activity.blackjack.net))}
                        </td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          —
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyq" style={{ marginTop: 12 }}>
                Never played a round.
              </div>
            )}
          </div>

          {/* Bets -------------------------------------------------------- */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>
              Recent bets{' '}
              <span className="small muted" style={{ fontWeight: 400 }}>
                · last {HISTORY}
              </span>
            </h3>
            {rounds.length === 0 ? (
              <div className="emptyq">No rounds to show.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Game</th>
                      <th>Bet</th>
                      <th>Payout</th>
                      <th>Multiplier</th>
                      <th>Nonce</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((round) => (
                      <tr key={round.id}>
                        <td>{round.game}</td>
                        <td className="n">{coins(round.bet)}</td>
                        <td
                          className="n"
                          style={{
                            color: round.payout > 0 ? 'var(--green)' : 'var(--muted)',
                          }}
                        >
                          {coins(round.payout)}
                        </td>
                        <td className="n">{formatMultiplier(round.bet, round.payout)}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {round.nonce}
                        </td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {relativeTime(round.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Coins ------------------------------------------------------- */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Coins by source</h3>
            {activity.coinTotals.length === 0 ? (
              <div className="emptyq">No coin movement yet.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Rows</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.coinTotals.map((row) => (
                      <tr key={row.kind}>
                        <td>{row.kind}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {coins(row.entries)}
                        </td>
                        <td className="n" style={{ color: 'var(--green)' }}>
                          {row.inCoins ? `+${coins(row.inCoins)}` : '—'}
                        </td>
                        <td className="n" style={{ color: 'var(--red)' }}>
                          {row.outCoins ? `−${coins(row.outCoins)}` : '—'}
                        </td>
                        <td className="n">
                          {row.inCoins - row.outCoins >= 0 ? '+' : '−'}
                          {coins(Math.abs(row.inCoins - row.outCoins))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>
              Coin history{' '}
              <span className="small muted" style={{ fontWeight: 400 }}>
                · last {HISTORY}
              </span>
            </h3>
            {ledger.length === 0 ? (
              <div className="emptyq">Nothing in the ledger.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Reason</th>
                      <th>Kind</th>
                      <th>When</th>
                      <th>Change</th>
                      <th>Balance after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          {entry.reason}
                          {entry.detail ? (
                            <span className="small muted"> · {entry.detail}</span>
                          ) : null}
                        </td>
                        <td>
                          <span className="tag">{entry.kind}</span>
                        </td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {relativeTime(entry.createdAt)}
                        </td>
                        <td
                          className="n"
                          style={{ color: entry.delta >= 0 ? 'var(--green)' : 'var(--red)' }}
                        >
                          {entry.delta >= 0 ? '+' : '−'}
                          {coins(Math.abs(entry.delta))}
                        </td>
                        <td className="n g">{coins(entry.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Orders and raffles ------------------------------------------ */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Store orders</h3>
            {redemptions.length === 0 ? (
              <div className="emptyq">Nothing redeemed.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Cost</th>
                      <th>Ordered</th>
                      <th>Handled by</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.itemName}
                          {r.reason ? <span className="small muted"> · {r.reason}</span> : null}
                        </td>
                        <td className="n">{coins(r.cost)}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {dateShort(r.createdAt)}
                        </td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {r.handledBy ?? '—'}
                        </td>
                        <td>
                          <span
                            className={`tag ${
                              r.status === 'fulfilled'
                                ? 'green'
                                : r.status === 'rejected'
                                  ? 'red'
                                  : 'warn'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Raffle entries</h3>
            {activity.raffles.length === 0 ? (
              <div className="emptyq">Never entered a raffle.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Raffle</th>
                      <th>Entries</th>
                      <th>Spent</th>
                      <th>Last entered</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.raffles.map((r) => (
                      <tr key={r.raffleId}>
                        <td>{r.title}</td>
                        <td className="n">{coins(r.entries)}</td>
                        <td className="n">{coins(r.spent)}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {dateShort(r.lastEnteredAt)}
                        </td>
                        <td>
                          {r.won ? (
                            <span className="tag gold">Won</span>
                          ) : (
                            <span className="tag">{r.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Badges ------------------------------------------------------ */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <h3 style={{ fontSize: 15 }}>
                Badges{' '}
                <span className="small muted" style={{ fontWeight: 400 }}>
                  · {earned.length} of {badges.length}
                </span>
              </h3>
              <RecheckBadgesButton userId={member.id} />
            </div>
            {earned.length === 0 ? (
              <div className="emptyq">No badge earned.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {earned.map((badge) => (
                  <span
                    key={badge.id}
                    className={`tag ${badge.gold ? 'gold' : 'blue'}`}
                    title={`${badge.description}${badge.earnedAt ? ` · ${dateShort(badge.earnedAt)}` : ''}`}
                  >
                    {badge.name}
                    {badge.pinned ? ' ★' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Staff trail ------------------------------------------------- */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Staff actions on this account</h3>
            {activity.staffActions.length === 0 ? (
              <div className="emptyq">No staff action has ever touched this account.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>By</th>
                      <th>When</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.staffActions.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <span className="tag">{entry.action}</span>
                        </td>
                        <td>{entry.actor}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {dateTime(entry.createdAt)}
                        </td>
                        <td className="small muted" style={{ wordBreak: 'break-word' }}>
                          {entry.detail ? JSON.stringify(entry.detail) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="small muted" style={{ marginTop: 12 }}>
              Read from the audit log by account id. The full log, across everybody, is at{' '}
              <Link href="/admin/audit">/admin/audit</Link>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'g' | 'b' }) {
  return (
    <div className="sbox">
      <div className="sl">{label}</div>
      <div className={`sv ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'var(--green)',
  red: 'var(--red)',
  warn: 'var(--warn)',
  blue: 'var(--blue)',
  muted: 'var(--muted)',
};

function Row({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone?: keyof typeof TONES | string;
  mono?: boolean;
}) {
  return (
    <div className="linkrow">
      <span className="lk">{label}</span>
      <span
        className="lv"
        style={{
          color: tone ? TONES[tone] : undefined,
          fontFamily: mono ? 'var(--mono)' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
