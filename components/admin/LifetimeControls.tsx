'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  addLifetimeByHandle,
  searchLifetimeCandidates,
  setLifetimeMember,
} from '@/app/(site)/admin/actions';
import type { MemberMatch } from '@/lib/store/milestones';

function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return (
    <div className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 8 }}>
      {note.text}
    </div>
  );
}

/** Long enough that one letter does not list half the site. */
const MIN_SEARCH = 2;
const SEARCH_DELAY_MS = 180;

/**
 * The add box on the lifetime list.
 *
 * Typing offers matching members. Choosing one only selects them, and the button
 * is what adds them: this list decides who is owed what, so one stray click or
 * Enter in the dropdown should not be able to change it. A full name or Discord id
 * can still be typed and added without choosing, through the exact lookup.
 */
export function LifetimeAddForm() {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<MemberMatch | null>(null);
  const [matches, setMatches] = useState<MemberMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Only the newest search may answer: a slow reply for "ma" must not replace
  // the list already showing for "matty".
  const latest = useRef(0);

  useEffect(() => {
    const ticket = ++latest.current;
    const wanted = query.trim();
    if (picked || wanted.length < MIN_SEARCH) {
      setMatches([]);
      setSearched(false);
      setActive(-1);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await searchLifetimeCandidates(wanted).catch(() => null);
      if (ticket !== latest.current) return;
      if (!result) {
        setNote({ ok: false, text: 'The search did not go through. Try typing again.' });
        return;
      }
      if (!result.ok) {
        setNote({ ok: false, text: result.error });
        return;
      }
      setMatches(result.matches);
      setSearched(true);
      setActive(result.matches.length ? 0 : -1);
      setOpen(true);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, picked]);

  function choose(match: MemberMatch) {
    if (match.onList) return;
    setPicked(match);
    setQuery(match.username);
    setOpen(false);
    setNote(null);
  }

  function clear() {
    setQuery('');
    setPicked(null);
    setOpen(false);
  }

  const showList = open && matches.length > 0;
  const showNone = open && searched && matches.length === 0;

  return (
    <>
      <form
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = picked
              ? await setLifetimeMember(picked.userId, picked.username, true)
              : await addLifetimeByHandle(query);
            if (result.ok) {
              clear();
              setNote({ ok: true, text: result.message });
            } else {
              setNote({ ok: false, text: result.error });
            }
          });
        }}
      >
        <div className="combo" style={{ flex: 1, minWidth: 220 }}>
          <input
            className="inp s"
            role="combobox"
            aria-expanded={showList}
            aria-controls="lifetime-matches"
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `lifetime-match-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPicked(null);
              setNote(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
              } else if (showList && event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((index) => (index + 1) % matches.length);
              } else if (showList && event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((index) => (index <= 0 ? matches.length : index) - 1);
              } else if (showList && event.key === 'Enter' && active >= 0) {
                // Selects rather than submits, so Enter can never add somebody
                // from the list without the button being pressed.
                event.preventDefault();
                choose(matches[active]);
              }
            }}
            aria-label="Find a member by username or Discord id"
            placeholder="Start typing a Discord, Kick or Razed name, or a Discord id"
          />

          {showList ? (
            <ul className="combo-list" id="lifetime-matches" role="listbox" aria-label="Matching members">
              {matches.map((match, index) => (
                <li
                  key={match.userId}
                  id={`lifetime-match-${index}`}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={match.onList}
                  className={[
                    'combo-opt',
                    index === active ? 'on' : '',
                    match.onList ? 'off' : '',
                  ].join(' ')}
                  // Before the input's blur, which would close the list first.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(match);
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  <span className="who">
                    <b>{match.username}</b>
                    <small>
                      Kick: {match.kickUsername ?? '—'} · Razed: {match.razedUsername ?? '—'}
                    </small>
                  </span>
                  {match.onList ? <span className="tag">On the list</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {showNone ? (
            <div className="combo-list combo-none" role="status">
              Nobody matches &ldquo;{query.trim()}&rdquo;. They have to have signed in to the site once.
            </div>
          ) : null}
        </div>

        <button className="btn pri sm" disabled={pending || !query.trim()}>
          Add to lifetime list
        </button>
      </form>

      {picked ? (
        <div className="small muted" style={{ marginTop: 8 }}>
          Selected <b style={{ color: 'var(--text)' }}>{picked.username}</b> · Kick:{' '}
          {picked.kickUsername ?? '—'} · Razed: {picked.razedUsername ?? '—'}
        </div>
      ) : null}
      <Note note={note} />
    </>
  );
}

/** Add or remove one known member, from the list or from their member page. */
export function LifetimeToggle({
  userId,
  username,
  member,
}: {
  userId: number;
  username: string;
  member: boolean;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        className={`btn sm ${member ? 'ghost' : ''}`}
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setLifetimeMember(userId, username, !member);
            setNote(
              result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
            );
          })
        }
      >
        {member ? 'Remove from lifetime list' : 'Add to lifetime list'}
      </button>
      <Note note={note} />
    </div>
  );
}
