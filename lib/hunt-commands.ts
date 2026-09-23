/**
 * The two chat commands the bonus hunt listens for.
 *
 *   !sr <slot name>        suggest a slot for the hunt
 *   !gtb <amount>          guess the final balance (also !guess)
 *
 * Pure parsing and nothing else, so it can be checked without a database or a
 * webhook. Anything that does not parse cleanly is simply not a command —
 * chat is full of near-misses, and answering them is not this layer's job.
 */

export type HuntCommand =
  | { kind: 'request'; slot: string }
  | { kind: 'guess'; amount: number };

/** Longer than any real slot name; stops a pasted paragraph becoming a request. */
const MAX_SLOT_LENGTH = 80;

/** A guess above this is a typo or a joke, and it would still win a hunt nobody else guessed. */
export const MAX_GUESS = 10_000_000;

export function parseHuntCommand(content: string): HuntCommand | null {
  const text = content.trim();

  const request = /^!sr\s+(.+)$/i.exec(text);
  if (request) {
    const slot = request[1].replace(/\s+/g, ' ').trim();
    if (!/[a-z0-9]/i.test(slot) || slot.length > MAX_SLOT_LENGTH) return null;
    return { kind: 'request', slot };
  }

  // "$1,234.50", "1234.5", "1,234" — and nothing after it but whitespace, so
  // "!gtb 1200 or maybe 900" is not quietly read as 1200.
  const guess = /^!(?:gtb|guess)\s+\$?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*$/i.exec(text);
  if (guess) {
    const amount = Number(guess[1].replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_GUESS) return null;
    return { kind: 'guess', amount };
  }

  return null;
}
