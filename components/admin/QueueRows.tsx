'use client';

import { useState, useTransition } from 'react';
import { coins, money, relativeTime } from '@/lib/format';
import {
  approveRazedLink,
  holdClaim,
  markPaid,
  rejectRazedLink,
  resolveOrder,
} from '@/app/(site)/admin/actions';
import type { QueueRow } from '@/lib/store/razed-links';
import type { PayoutRow } from '@/lib/store/milestones';
import type { Redemption } from '@/lib/types';

function Done({ text }: { text: string }) {
  return <span className="tag green">{text}</span>;
}

function Failed({ text }: { text: string }) {
  return (
    <span className="small" style={{ color: 'var(--red)' }}>
      {text}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Razed link requests                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One link request, with every signal the decision should be made on.
 *
 * Mod judgement is the only defence against someone claiming a stranger's
 * wager history, so the screen is the control: account age, Kick verification,
 * previous claims and the wager total are all here, before the approve button,
 * rather than a lookup away.
 */
export function RazedLinkRow({ row }: { row: QueueRow }) {
  const [state, setState] = useState<'idle' | 'approved' | 'rejected'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (state !== 'idle') {
    return (
      <div className="qrow">
        <div>
          <div className="qm">
            {row.discordUsername} → {row.username}
          </div>
          <div className="qd">
            <Done text={state === 'approved' ? 'Approved' : 'Rejected'} />
          </div>
        </div>
      </div>
    );
  }

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, next: 'approved' | 'rejected') =>
    start(async () => {
      const result = await fn();
      if (result.ok) setState(next);
      else setError(result.error ?? 'That did not work.');
    });

  return (
    <>
      <div
        className="qrow"
        style={row.flagged ? { borderColor: 'rgba(255,92,122,.4)' } : undefined}
      >
        <div>
          <div className="qm">
            {row.discordUsername} → {row.username}
            <span className={`risk ${row.flagged ? 'hi' : 'ok'}`}>
              {row.flagged ? '⚠ high value, new account' : '✓ looks consistent'}
            </span>
          </div>
          <div className="qd">
            Account age <b>{row.accountAgeDays}d</b> · Kick{' '}
            <b>{row.kickVerified ? 'verified' : 'not verified'}</b> · wagered{' '}
            <b>{row.matchedWagered == null ? 'unknown' : money(row.matchedWagered)}</b> · previous
            claims <b>{row.previousClaims}</b> · submitted {relativeTime(row.createdAt)}
          </div>
          {error ? <Failed text={error} /> : null}
        </div>
        <div className="qacts">
          <button
            className="btn green sm"
            disabled={pending}
            onClick={() =>
              row.flagged
                ? setConfirming(true)
                : act(() => approveRazedLink(row.userId, row.username), 'approved')
            }
          >
            Approve
          </button>
          <button
            className="btn sm ghost"
            disabled={pending}
            onClick={() =>
              act(
                () => rejectRazedLink(row.userId, row.username, 'Could not be verified'),
                'rejected',
              )
            }
          >
            Reject
          </button>
        </div>
      </div>

      {/* A flagged request is the exact shape of an impersonation attempt, so
          approving one asks for a second look rather than accepting a click. */}
      {confirming ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Approve flagged request">
          <div className="mbox">
            <h2>This request is flagged</h2>
            <p>
              <b style={{ color: 'var(--text)' }}>{row.username}</b> has wagered{' '}
              {row.matchedWagered == null ? 'an unknown amount' : money(row.matchedWagered)} and the
              site account is {row.accountAgeDays} days old. That is what an impersonation attempt
              looks like.
            </p>
            <p>
              Do not approve this without a message from that person in Discord confirming it is
              them. Approving hands them somebody else&rsquo;s milestone money.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost wide" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                className="btn danger wide"
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  act(() => approveRazedLink(row.userId, row.username), 'approved');
                }}
              >
                I have confirmed in Discord
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Milestone claims                                                           */
/* -------------------------------------------------------------------------- */

function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ClaimRow({ row }: { row: PayoutRow }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const overdue = row.hoursWaiting > 48;
  const target = row.razedUsername ?? row.username;

  if (done) {
    return (
      <div className="qrow">
        <div>
          <div className="qm">
            {row.username} · {money(row.reward)}
          </div>
          <div className="qd">
            <Done text={done} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qrow" style={overdue ? { borderColor: 'rgba(255,92,122,.4)' } : undefined}>
      <div>
        <div className="qm">
          {row.username} · {money(row.threshold)} tier →{' '}
          <span style={{ color: 'var(--gold)' }}>{money(row.reward)}</span>
          <span className={`risk ${overdue ? 'hi' : 'ok'}`}>
            {overdue ? '⚠ ' : ''}waiting {ageLabel(row.hoursWaiting)}
          </span>
        </div>
        <div className="qd">
          Razed username <b>{target}</b> · tier unlocked and claimed · send the tip on Razed first,
          then mark it here
        </div>
        {error ? <Failed text={error} /> : null}
      </div>
      <div className="qacts">
        <button
          className="btn sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${target} $${row.reward}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* the figures are on screen */
            }
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <button
          className="btn gold sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await markPaid(row.claimId, row.username, row.reward);
              if (result.ok) setDone('Paid');
              else setError(result.error);
            })
          }
        >
          Mark paid
        </button>
        <button
          className="btn sm ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await holdClaim(row.claimId, row.username);
              if (result.ok) setDone('Held');
              else setError(result.error);
            })
          }
        >
          Hold
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Store redemptions                                                          */
/* -------------------------------------------------------------------------- */

export function RedemptionRow({ row }: { row: Redemption }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="qrow">
        <div>
          <div className="qm">
            {row.member} · {row.itemName}
          </div>
          <div className="qd">
            <Done text={done} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="qrow">
        <div>
          <div className="qm">
            {row.member} · {row.itemName}
          </div>
          <div className="qd">
            {coins(row.cost)} coins · redeemed {relativeTime(row.createdAt)}
          </div>
          {error ? <Failed text={error} /> : null}
        </div>
        <div className="qacts">
          <button
            className="btn green sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await resolveOrder(Number(row.id), 'fulfilled');
                if (result.ok) setDone('Fulfilled');
                else setError(result.error);
              })
            }
          >
            Fulfil
          </button>
          <button className="btn sm ghost" disabled={pending} onClick={() => setRejecting(true)}>
            Reject &amp; refund
          </button>
        </div>
      </div>

      {rejecting ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Reject redemption">
          <div className="mbox">
            <h2>Reject and refund?</h2>
            <p>
              {coins(row.cost)} coins go back to {row.member} as a normal refund row, and the stock
              is returned. They are shown the reason, so write it for them rather than for us.
            </p>
            <div className="field" style={{ textAlign: 'left' }}>
              <label htmlFor="reject-reason">Reason</label>
              <input
                id="reject-reason"
                className="inp"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Out of stock in your size"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost wide" onClick={() => setRejecting(false)}>
                Cancel
              </button>
              <button
                className="btn danger wide"
                disabled={pending || !reason.trim()}
                onClick={() =>
                  start(async () => {
                    const result = await resolveOrder(Number(row.id), 'rejected', reason);
                    if (result.ok) {
                      setDone('Refunded');
                      setRejecting(false);
                    } else setError(result.error);
                  })
                }
              >
                Reject &amp; refund
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
