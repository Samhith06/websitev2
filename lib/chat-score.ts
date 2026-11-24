/**
 * The weekly chat leaderboard: the rules, and the part of the spam filter that
 * needs no database.
 *
 * A linked viewer earns one point for a chat message during a live stream,
 * but only a message that reads like somebody talking. Each message is judged
 * twice:
 *
 *   1. On its own, here. Commands, emote-only messages, one- and two-letter
 *      messages ("W", "gg") and one word said over and over do not count.
 *   2. Against the sender's recent history, in `lib/store/chat-board.ts`. A
 *      message inside the cooldown, a repeat of one of their last few, or one
 *      past the hourly cap does not count.
 *
 * Every limit is here so the page explaining them reads the same numbers the
 * filter uses.
 */

export const CHAT_RULES = {
  /** Seconds after a counted message before the next one can count. */
  cooldownSeconds: 30,
  /** Most points one viewer can earn in a clock hour. */
  hourlyCap: 40,
  /** How many of a viewer's recent counted messages a new one is compared with. */
  recentMemory: 10,
  /** Letters or digits a message needs, after repeats are squeezed out. */
  minChars: 3,
} as const;

/** The weekly pool, in Matty Coins, and how it splits across the top ten. */
export const CHAT_PRIZES = [1500, 1000, 700, 500, 400, 300, 200, 150, 150, 100] as const;
export const CHAT_POOL = CHAT_PRIZES.reduce((sum, prize) => sum + prize, 0);

/** A place is only paid to somebody who actually chatted that week. */
export const CHAT_MIN_POINTS = 10;

/** Weeks run Monday 00:00 to Monday 00:00 on stream time. */
export const CHAT_TIMEZONE = 'Europe/London';

export function chatPrizeFor(rank: number, points: number): number {
  if (points < CHAT_MIN_POINTS) return 0;
  return CHAT_PRIZES[rank - 1] ?? 0;
}

export type ChatRejection =
  | 'command'
  | 'emote-only'
  | 'too-short'
  | 'repetitive'
  | 'cooldown'
  | 'duplicate'
  | 'hourly-cap';

export type ChatVerdict =
  | { counts: true; key: string }
  | { counts: false; reason: ChatRejection };

/** Kick sends emotes inline in the text as `[emote:37226:KEKW]`. */
const EMOTE = /\[emote:\d+:[^\]]*\]/gi;

/**
 * The comparison key: lower case, punctuation gone, any run of one character
 * squeezed to one ("niiiice!!!" and "nice" match), and numbers folded together
 * so "hi 1", "hi 2", "hi 3" are one message said three times.
 */
export function chatKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(EMOTE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\d+/g, '#')
    .replace(/(.)\1+/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Step 1: does this message, on its own, look like somebody talking? */
export function judgeChatMessage(content: string): ChatVerdict {
  const text = content.trim();
  if (text.startsWith('!')) return { counts: false, reason: 'command' };

  const key = chatKey(text);
  if (!key) {
    // A fresh regex: `test` on the shared global one would carry its lastIndex over.
    return { counts: false, reason: new RegExp(EMOTE.source, 'i').test(text) ? 'emote-only' : 'too-short' };
  }

  const chars = key.replace(/[^\p{L}\p{N}#]/gu, '');
  if (chars.length < CHAT_RULES.minChars) return { counts: false, reason: 'too-short' };
  if (new Set(chars).size < 2) return { counts: false, reason: 'repetitive' };

  // "lol lol lol", or a short phrase pasted four times over.
  const words = key.split(' ');
  const distinct = new Set(words).size;
  if (words.length >= 3 && distinct === 1) return { counts: false, reason: 'repetitive' };
  if (words.length >= 6 && distinct / words.length <= 0.4) return { counts: false, reason: 'repetitive' };

  return { counts: true, key };
}

export const REJECTION_LABEL: Record<ChatRejection, string> = {
  command: 'Bot commands',
  'emote-only': 'Emotes only',
  'too-short': 'Too short',
  repetitive: 'Same word repeated',
  cooldown: `Within ${CHAT_RULES.cooldownSeconds}s of the last`,
  duplicate: 'Repeat of a recent message',
  'hourly-cap': 'Over the hourly cap',
};
