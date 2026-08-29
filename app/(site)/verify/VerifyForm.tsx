'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';

type Game = 'keno' | 'dice' | 'limbo';

type Response = {
  ok: true;
  serverSeedHash: string;
  display: string;
  outcome: unknown;
} | { ok: false; detail: string };

/**
 * Three inputs, a game selector, and a Verify button (UI Spec §36).
 *
 * The recomputation runs on the server for one reason only: the hashing code
 * lives in one place, so the verifier and the games can never drift apart. The
 * exact steps are printed below the form so anyone can reimplement the check
 * themselves — someone doing that and posting the result in Discord is the best
 * advertising this feature can get.
 */
export function VerifyForm({
  initial,
}: {
  initial: { game?: string; serverSeed?: string; clientSeed?: string; nonce?: string };
}) {
  const [game, setGame] = useState<Game>((initial.game as Game) || 'keno');
  const [serverSeed, setServerSeed] = useState(initial.serverSeed ?? '');
  const [clientSeed, setClientSeed] = useState(initial.clientSeed ?? '');
  const [nonce, setNonce] = useState(initial.nonce ?? '0');
  const [result, setResult] = useState<Response | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          game,
          serverSeed: serverSeed.trim(),
          clientSeed,
          nonce: Number(nonce),
        }),
      });
      setResult(await response.json());
    } catch {
      setResult({ ok: false, detail: 'The verifier could not be reached. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const ready = serverSeed.trim().length > 0 && Number.isFinite(Number(nonce));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr] lg:items-start">
      <Card>
        <div className="border-b border-line px-5 py-3.5">
          <Label>Recompute a round</Label>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <Label className="mb-1.5">Game</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['keno', 'dice', 'limbo'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGame(g)}
                  aria-pressed={game === g}
                  className={cn(
                    'h-10 rounded-[3px] border font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150',
                    game === g
                      ? 'border-brand-line bg-brand-bg text-brand'
                      : 'border-line bg-surface-2 text-muted hover:border-line-2',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Server seed (revealed)</Label>
            <Input
              aria-label="Server seed, as revealed on rotation"
              value={serverSeed}
              onChange={(e) => setServerSeed(e.target.value)}
              placeholder="the 64-character seed revealed on rotation"
            />
          </div>

          <div>
            <Label className="mb-1.5">Client seed</Label>
            <Input aria-label="Client seed" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
          </div>

          <div>
            <div>
              <Label className="mb-1.5">Nonce</Label>
              <Input aria-label="Nonce" type="number" min="0" value={nonce} onChange={(e) => setNonce(e.target.value)} />
            </div>
          </div>

          <Button full size="lg" onClick={verify} disabled={!ready || busy}>
            {busy ? 'Recomputing…' : 'Verify'}
          </Button>
        </div>
      </Card>

      <Card tone={result?.ok ? 'brand' : 'default'}>
        <div className="border-b border-line px-5 py-3.5">
          <Label>Result</Label>
        </div>
        <div className="p-5">
          {!result ? (
            <p className="text-[14px] leading-relaxed text-muted">
              Paste the three values from any round — yours or someone else’s — and the outcome is
              recomputed here from scratch. Nothing is looked up; it is derived.
            </p>
          ) : !result.ok ? (
            <p className="flex items-start gap-2.5 text-[14px] text-danger">
              <X size={17} className="mt-0.5 shrink-0" />
              {result.detail}
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <Label className="mb-2">Outcome</Label>
                <Num tone="gold" className="text-[24px] font-medium leading-tight lg:text-[28px]">
                  {result.display}
                </Num>
              </div>

              <div>
                <Label className="mb-1.5">SHA-256 of the server seed you gave</Label>
                <code className="block break-all rounded-[3px] border border-line bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink-2">
                  {result.serverSeedHash}
                </code>
                <p className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-brand" />
                  Compare this against the hash the site published before the round. If they match,
                  the seed was fixed before you played and this outcome is the only one it could have
                  produced.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
