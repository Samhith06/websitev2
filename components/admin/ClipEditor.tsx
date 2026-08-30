'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { coins, dateShort, formatMultiplier, relativeTime } from '@/lib/format';
import { Button, Chip, ChipRow, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { SOURCE_LABELS } from '@/components/ui/marks';
import { StatusPill } from './Table';
import {
  inspectUrl, publishClip, removeClip, saveClip, togglePin, unpublishClip,
  type ActionResult,
} from '@/app/admin/clips/actions';
import type { Clip } from '@/lib/types';

/**
 * A two-column card (UI Spec §19). The multiplier is an inset panel labelled
 * "calculated" — never an editable field, so it can never disagree with the bet
 * and payout beside it.
 *
 * The buttons write to the database through server actions. Every one of those
 * actions re-checks the caller: a server action is a public endpoint, and being
 * rendered inside /admin protects nothing on its own.
 */
export function ClipEditor({ clips, pinnedCount }: { clips: Clip[]; pinnedCount: number }) {
  const [mode, setMode] = useState<'big_win' | 'clip'>('big_win');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [slot, setSlot] = useState('');
  const [date, setDate] = useState('');
  const [bet, setBet] = useState('');
  const [payout, setPayout] = useState('');
  const [pin, setPin] = useState(false);
  const [announce, setAnnounce] = useState(false);

  const [preview, setPreview] = useState<{ source: string; thumbUrl: string } | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const betNum = Number(bet) || 0;
  const payoutNum = Number(payout) || 0;

  function submit(status: 'draft' | 'published') {
    const data = new FormData();
    data.set('kind', mode);
    data.set('status', status);
    data.set('url', url);
    data.set('title', title);
    data.set('slot', slot);
    data.set('date', date);
    data.set('bet', bet);
    data.set('payout', payout);
    if (pin) data.set('pinned', 'on');

    start(async () => {
      const outcome = await saveClip(data);
      setResult(outcome);
      if (outcome.ok) {
        setUrl('');
        setTitle('');
        setSlot('');
        setBet('');
        setPayout('');
        setPin(false);
        setPreview(null);
      }
    });
  }

  function fetchPreview() {
    if (!url.trim()) return;
    start(async () => {
      const outcome = await inspectUrl(url);
      if (outcome.ok) {
        setPreview({ source: outcome.source, thumbUrl: outcome.thumbUrl });
        setResult(null);
      } else {
        setPreview(null);
        setResult(outcome);
      }
    });
  }

  return (
    <>
      <Card>
        <div className="grid gap-px bg-line lg:grid-cols-2 [&>div]:bg-surface">
          {/* --------------------------------------------------------- */}
          {/* Left column                                               */}
          {/* --------------------------------------------------------- */}
          <div className="p-5">
            <ChipRow label="Entry type" className="mb-5">
              <Chip active={mode === 'big_win'} onClick={() => setMode('big_win')}>Big win</Chip>
              <Chip active={mode === 'clip'} onClick={() => setMode('clip')}>Regular clip</Chip>
            </ChipRow>

            <Label className="mb-1.5">Source URL</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="paste a Kick, YouTube, Instagram or X link"
                className="flex-1"
              />
              <Button variant="outline" onClick={fetchPreview} disabled={pending || !url.trim()}>
                Fetch
              </Button>
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Kick, YouTube, Instagram and X. Kick and YouTube also give us a thumbnail from the
              link alone; the other two need one uploaded, which is why their card falls back to a
              drawn preview.
            </p>

            <div className="mt-5">
              <Label className="mb-1.5">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="what people read in the carousel"
              />
            </div>

            {mode === 'big_win' ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5">Slot</Label>
                    <Input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Gates of Olympus" />
                  </div>
                  <div>
                    <Label className="mb-1.5">Date of the win</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-1.5">Bet</Label>
                    <Input type="number" value={bet} onChange={(e) => setBet(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-1.5">Payout</Label>
                    <Input type="number" value={payout} onChange={(e) => setPayout(e.target.value)} />
                  </div>
                </div>

                <div className="mt-4 rounded-[3px] border border-gold-line bg-gold-bg px-4 py-3.5">
                  <Label className="mb-2 text-gold/70">Multiplier · calculated</Label>
                  <Num tone="gold" className="text-[30px] font-bold leading-none lg:text-[34px]">
                    {betNum > 0 && payoutNum > 0 ? formatMultiplier(betNum, payoutNum) : '—'}
                  </Num>
                  <p className="mt-2 text-[12px] text-muted">
                    Derived from the bet and payout above. There is deliberately no field for it.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* --------------------------------------------------------- */}
          {/* Right column — live preview                               */}
          {/* --------------------------------------------------------- */}
          <div className="flex flex-col p-5">
            <Label className="mb-3">Preview</Label>
            <div className="relative aspect-video overflow-hidden rounded-[3px] border border-line bg-surface-2">
              {preview?.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.thumbUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="px-4 text-center font-mono text-[11.5px] uppercase tracking-[0.16em] text-faint">
                    {pending ? 'Checking the link…'
                      : preview ? `${preview.source} — no thumbnail from the link alone`
                      : url ? 'Press Fetch to check the link'
                      : 'Paste a URL to preview'}
                  </span>
                </div>
              )}
              {mode === 'big_win' && betNum > 0 && payoutNum > 0 ? (
                <span className="absolute left-3 top-3 font-mono text-[28px] font-bold leading-none tabular-nums text-gold [text-shadow:0_2px_12px_rgba(0,0,0,0.95)]">
                  {formatMultiplier(betNum, payoutNum)}
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              <Toggle
                checked={pin}
                onChange={setPin}
                label="Pin to the homepage wall"
                hint={`${pinnedCount} of 3 pins used. A fourth is refused with a message, not silently dropped.`}
                disabled={!pin && pinnedCount >= 3}
              />
              <Toggle
                checked={announce}
                onChange={setAnnounce}
                label="Announce in Discord"
                hint="Not wired up yet — there is no Discord bot behind this switch, so it does nothing."
                disabled
              />
            </div>

            {result ? (
              <p
                className={cn(
                  'mt-4 text-[13px] leading-relaxed',
                  result.ok ? 'text-brand' : 'text-danger',
                )}
                role="status"
              >
                {result.ok ? result.message : result.error}
              </p>
            ) : null}

            <div className="mt-auto flex gap-2 pt-5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => submit('draft')}
                disabled={pending}
              >
                Save as draft
              </Button>
              <Button className="flex-1" onClick={() => submit('published')} disabled={pending}>
                {pending ? 'Saving…' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>

        <p className="border-t border-line px-5 py-3 text-[12.5px] leading-relaxed text-muted">
          Nothing reaches the site until someone publishes it, which is what stops the carousel
          filling with filler inside a week. Drafts are visible here and nowhere else.
        </p>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* The list                                                      */}
      {/* ------------------------------------------------------------- */}
      <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        All clips and wins
      </h2>

      <Card>
        {clips.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-muted">
            Nothing added yet. Paste a link above and it appears here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {clips.map((clip) => (
              <ClipRow key={clip.id} clip={clip} onDone={setResult} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function ClipRow({ clip, onDone }: { clip: Clip; onDone: (r: ActionResult) => void }) {
  const [pending, start] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    start(async () => onDone(await action()));
  }

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', pending && 'opacity-50')}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-ink">{clip.title}</span>
        <span className="mt-0.5 block font-mono text-[11.5px] tabular-nums text-faint">
          {SOURCE_LABELS[clip.source]} · {clip.aspect} · {dateShort(clip.occurredAt)}
          {clip.bet && clip.payout
            ? ` · ${coins(clip.bet)} → ${coins(clip.payout)} (${formatMultiplier(clip.bet, clip.payout)})`
            : ''}
        </span>
      </span>

      <span className="shrink-0">
        <StatusPill tone={clip.status === 'published' ? 'brand' : 'muted'}>{clip.status}</StatusPill>
      </span>

      <span className="flex shrink-0 items-center gap-3 font-mono text-[11.5px]">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => togglePin(clip.id, !clip.pinned))}
          className={cn('hover:underline', clip.pinned ? 'text-gold' : 'text-muted')}
        >
          {clip.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => (clip.status === 'published' ? unpublishClip(clip.id) : publishClip(clip.id)))
          }
          className="text-brand hover:underline"
        >
          {clip.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removeClip(clip.id))}
          className="text-danger hover:underline"
        >
          Delete
        </button>
      </span>

      <span className="w-[70px] shrink-0 text-right font-mono text-[11px] text-faint">
        {relativeTime(clip.occurredAt)}
      </span>
    </li>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[#2B8FFF]"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] text-ink">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{hint}</span>
      </span>
    </label>
  );
}
