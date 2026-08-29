import type { Metadata } from 'next';
import { Display, Label } from '@/components/ui/typography';
import { Card } from '@/components/ui/surfaces';
import { VerifyForm } from './VerifyForm';

export const metadata: Metadata = {
  title: 'Verify a round',
  description:
    'Recompute any MattySpins game round or giveaway draw from the server seed, client seed and nonce.',
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; seed?: string; clientSeed?: string; nonce?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="max-w-3xl">
        <Label className="mb-3">Provable fairness</Label>
        <Display size="l" as="h1">
          Verify a round
        </Display>

        <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-ink-2">
          <p>
            Before you play, the server generates a random seed and publishes only its SHA-256 hash.
            That hash is a promise it cannot take back: any other seed produces a different hash.
          </p>
          <p>
            You choose your own client seed, and a nonce counts up by one every round. The outcome
            is derived from those three values and nothing else — not the size of your bet, not your
            balance, not the time of day.
          </p>
          <p>
            When you rotate your seed pair, the old server seed is revealed. Hash it yourself to
            check it matches what was published, then replay any round you played on it.
          </p>
          <p>
            Everything on this page works signed out, and it works on someone else’s round just as
            well as your own.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <VerifyForm
          initial={{
            game: params.game,
            serverSeed: params.seed,
            clientSeed: params.clientSeed,
            nonce: params.nonce,
          }}
        />
      </div>

      {/* The exact steps, in plain language, so a technical viewer can
          reimplement the check themselves. */}
      <Card className="mt-8">
        <div className="border-b border-line px-5 py-3.5">
          <Label>The exact steps</Label>
        </div>
        <div className="space-y-5 p-5 lg:p-6">
          <Step n={1} title="Check the commitment">
            Take the revealed server seed and hash it with SHA-256. The result must equal the hash
            the site showed you before the round. If it does, the seed could not have been chosen
            after you played.
            <Code>sha256(serverSeed) === publishedHash</Code>
          </Step>

          <Step n={2} title="Build the byte stream">
            HMAC-SHA256, keyed on the server seed, over the string{' '}
            <Mono>clientSeed:nonce:cursor</Mono>. The cursor starts at 0 and increases by one each
            time another 32 bytes are needed.
            <Code>{`hmacSha256(key = serverSeed, message = \`\${clientSeed}:\${nonce}:\${cursor}\`)`}</Code>
          </Step>

          <Step n={3} title="Turn bytes into numbers">
            Take four bytes at a time and divide them down into a number between 0 and 1, in the
            standard base-256 arrangement.
            <Code>{`float = b0/256 + b1/256² + b2/256³ + b3/256⁴`}</Code>
          </Step>

          <Step n={4} title="Apply the game">
            <ul className="mt-2 space-y-1.5">
              <li>
                <Mono>Keno</Mono> — ten floats drive a partial Fisher–Yates shuffle over 1–40; the
                first ten values are the draw.
              </li>
              <li>
                <Mono>Dice</Mono> — one float, scaled to 0.00–100.00 as{' '}
                <Mono>floor(f × 10001) / 100</Mono>.
              </li>
              <li>
                <Mono>Limbo</Mono> — one float, as <Mono>max(1, floor((1 / (1 − f)) × 0.99 × 100) / 100)</Mono>.
              </li>
            </ul>
          </Step>

          <p className="border-t border-line pt-5 text-[13.5px] leading-relaxed text-muted">
            The 0.99 in the limbo formula is the house edge, and it is the only place the edge
            enters the arithmetic for that game. Keno carries it in its paytables instead, and
            dice carries it in the payout multiplier. It is 99% everywhere.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[36px_1fr]">
      <span className="font-mono text-[13px] tabular-nums text-brand">{String(n).padStart(2, '0')}</span>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <div className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-[3px] border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[12.5px] text-ink-2">
      <code>{children}</code>
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12.5px] text-brand-dim">{children}</code>;
}
