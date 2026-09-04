'use client';

import { useState, useTransition } from 'react';
import { excludeSelf, pinBadge, savePokerHandle, saveRazedUsername, toggleSetting } from '@/app/(site)/profile/actions';
import type { Badge } from '@/lib/store/badges';

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

type SettingKey = 'gamesEnabled' | 'gameSound' | 'publicProfile' | 'streamNotifications';

export function SettingToggle({
  label,
  setting,
  value,
  note,
}: {
  label: string;
  setting: SettingKey;
  value: boolean;
  note?: string;
}) {
  const [on, setOn] = useState(value);
  const [pending, startTransition] = useTransition();

  return (
    <div className="linkrow">
      <span>
        {label}
        {note ? (
          <div className="small muted" style={{ marginTop: 2 }}>
            {note}
          </div>
        ) : null}
      </span>
      <button
        className={`btn sm ${on ? '' : 'ghost'}`}
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          startTransition(async () => {
            const result = await toggleSetting(setting, next);
            // Put it back if the server refused, rather than showing a state
            // the server does not agree with.
            if (!result.ok) setOn(!next);
          });
        }}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

/**
 * Self-exclusion.
 *
 * Behind a confirm because it cannot be undone early — that is the point of
 * it, and someone should meet that fact before the write rather than after.
 */
export function SelfExclude({ excludedUntil }: { excludedUntil: string | null }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = excludedUntil && new Date(excludedUntil).getTime() > Date.now();

  if (active) {
    return (
      <div className="linkrow">
        <span style={{ color: 'var(--red)' }}>
          Self-excluded
          <div className="small muted" style={{ marginTop: 2 }}>
            Games stay off until {new Date(excludedUntil!).toLocaleDateString('en-GB')}. This cannot
            be shortened, by you or by a mod.
          </div>
        </span>
        <span className="tag red">Active</span>
      </div>
    );
  }

  if (message) {
    return (
      <div className="linkrow">
        <span className="small" style={{ color: 'var(--green)' }}>
          {message}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="linkrow">
        <span style={{ color: 'var(--red)' }}>Self-exclude from games</span>
        <button className="btn sm ghost" onClick={() => setOpen(true)}>
          Set up
        </button>
      </div>

      {open ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Self-exclude from games">
          <div className="mbox">
            <h2>Take a break from games</h2>
            <p>
              Games will be switched off for your account, and the server will refuse every bet for
              the whole period. <b style={{ color: 'var(--text)' }}>It cannot be lifted early</b> —
              not by you, and not by a mod.
            </p>
            <div className="field" style={{ textAlign: 'left' }}>
              <label htmlFor="exclude-period">How long</label>
              <select
                id="exclude-period"
                className="inp"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="1d">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="permanent">Permanently</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost wide" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button
                className="btn danger wide"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await excludeSelf(period);
                    if (result.ok) {
                      setMessage(result.message);
                      setOpen(false);
                    }
                  })
                }
              >
                {pending ? 'Setting…' : 'Switch games off'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Accounts                                                                   */
/* -------------------------------------------------------------------------- */

export function AccountForms({
  razedUsername,
  razedStatus,
  pokerHandle,
}: {
  razedUsername: string;
  razedStatus: 'none' | 'pending' | 'approved' | 'rejected';
  pokerHandle: string;
}) {
  const [razedNote, setRazedNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pokerNote, setPokerNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const statusTag =
    razedStatus === 'approved' ? (
      <span className="tag green">Approved by mod</span>
    ) : razedStatus === 'pending' ? (
      <span className="tag warn">Matched — awaiting mod approval</span>
    ) : razedStatus === 'rejected' ? (
      <span className="tag red">Rejected — message a mod</span>
    ) : (
      <span className="tag">Not submitted</span>
    );

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Casino &amp; poker accounts</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Your Razed username is checked against wagering under the code, then approved by a mod
        before milestones unlock.
      </p>

      <div className="acctgrid">
        <form
          className="field"
          style={{ margin: 0 }}
          action={(formData) =>
            startTransition(async () => {
              const result = await saveRazedUsername(formData);
              setRazedNote(
                result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
              );
            })
          }
        >
          <label htmlFor="razed-username">Razed username</label>
          <input
            id="razed-username"
            name="username"
            className="inp"
            defaultValue={razedUsername}
            placeholder="your Razed username"
            autoComplete="off"
          />
          <div className="small" style={{ marginTop: 7 }}>
            {razedNote ? (
              <span style={{ color: razedNote.ok ? 'var(--green)' : 'var(--red)' }}>
                {razedNote.text}
              </span>
            ) : (
              statusTag
            )}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} disabled={pending}>
            Save Razed username
          </button>
        </form>

        <form
          className="field"
          style={{ margin: 0 }}
          action={(formData) =>
            startTransition(async () => {
              const result = await savePokerHandle(formData);
              setPokerNote(
                result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
              );
            })
          }
        >
          <label htmlFor="poker-handle">PokerNow username</label>
          <input
            id="poker-handle"
            name="handle"
            className="inp"
            defaultValue={pokerHandle}
            placeholder="for community poker nights"
            autoComplete="off"
          />
          <div className="small muted" style={{ marginTop: 7 }}>
            {pokerNote ? (
              <span style={{ color: pokerNote.ok ? 'var(--green)' : 'var(--red)' }}>
                {pokerNote.text}
              </span>
            ) : (
              "Used to seat you in Matty's poker nights."
            )}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} disabled={pending}>
            Save handle
          </button>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const [state, setState] = useState(badges);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const earned = state.filter((b) => b.earnedAt).length;

  return (
    <div className="card">
      <div className="sec-head" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15 }}>Badges</h3>
        <span className="small muted">
          {earned} of {state.length} earned · pin up to 3
        </span>
      </div>

      {error ? (
        <div className="small" style={{ color: 'var(--red)', marginBottom: 10 }}>
          {error}
        </div>
      ) : null}

      <div className="bgrid">
        {state.map((badge) => {
          const isEarned = Boolean(badge.earnedAt);
          return (
            <div
              key={badge.id}
              className={`bdg ${isEarned ? 'earned' : 'locked'} ${badge.gold ? 'gold' : ''} ${
                badge.pinned ? 'pinned' : ''
              }`}
            >
              {isEarned ? (
                <button
                  className="pinbtn"
                  disabled={pending}
                  title={badge.pinned ? 'Unpin' : 'Pin to your profile'}
                  onClick={() => {
                    setError(null);
                    const next = !badge.pinned;
                    setState((all) =>
                      all.map((b) => (b.id === badge.id ? { ...b, pinned: next } : b)),
                    );
                    startTransition(async () => {
                      const result = await pinBadge(badge.id, next);
                      if (!result.ok) {
                        setError(result.error);
                        setState((all) =>
                          all.map((b) => (b.id === badge.id ? { ...b, pinned: !next } : b)),
                        );
                      }
                    });
                  }}
                >
                  {badge.pinned ? 'PINNED' : 'PIN'}
                </button>
              ) : null}
              <div className="bi" aria-hidden>
                {badge.name.charAt(0)}
              </div>
              <div className="bn">{badge.name}</div>
              <div className="bd">{badge.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
