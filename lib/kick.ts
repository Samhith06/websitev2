import 'server-only';
import { createVerify } from 'node:crypto';

/**
 * Kick webhooks (Master Plan §5).
 *
 * Kick signs every delivery. The signature is what makes the endpoint safe to
 * expose: without it, anyone who found the URL could post a `chat.message.sent`
 * carrying somebody else's verification code and take over their account. So an
 * unverifiable request is refused, never processed "just in case".
 *
 * NOT YET VERIFIED against real Kick traffic. The header names, the signed
 * string and the payload shapes below follow Kick's published webhook docs, but
 * nothing here has seen a real delivery. Two things to confirm on the first one:
 *   1. that `${messageId}.${timestamp}.${rawBody}` is the exact signed string;
 *   2. the field names on each payload — `parse*` below is deliberately
 *      forgiving, and logs what it could not read rather than dropping it.
 */

const PUBLIC_KEY_ENDPOINT = 'https://api.kick.com/public/v1/public-key';

const globalStore = globalThis as unknown as { __msKickKey?: string | null };

/**
 * Kick's public key. Prefer the environment — a key pinned at deploy time
 * cannot be swapped by anyone who can answer DNS for api.kick.com — and fall
 * back to fetching it once per process.
 */
async function publicKey(): Promise<string | null> {
  const configured = process.env.KICK_WEBHOOK_PUBLIC_KEY;
  if (configured) return configured.replace(/\\n/g, '\n');

  if (globalStore.__msKickKey !== undefined) return globalStore.__msKickKey;

  try {
    const response = await fetch(PUBLIC_KEY_ENDPOINT, { cache: 'no-store' });
    if (!response.ok) {
      globalStore.__msKickKey = null;
      return null;
    }
    const payload = (await response.json()) as { data?: { public_key?: string } };
    const key = payload?.data?.public_key ?? null;
    globalStore.__msKickKey = key;
    return key;
  } catch {
    globalStore.__msKickKey = null;
    return null;
  }
}

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: 'no-key' | 'missing-headers' | 'bad-signature' | 'stale'; detail: string };

/** Deliveries older than this are refused, so a captured one cannot be replayed. */
const MAX_AGE_MINUTES = 10;

export async function verifySignature(
  headers: Headers,
  rawBody: string,
): Promise<SignatureCheck> {
  const messageId = headers.get('kick-event-message-id');
  const timestamp = headers.get('kick-event-message-timestamp');
  const signature = headers.get('kick-event-signature');

  if (!messageId || !timestamp || !signature) {
    return { ok: false, reason: 'missing-headers', detail: 'Not a signed Kick delivery.' };
  }

  const sentAt = Date.parse(timestamp);
  if (Number.isFinite(sentAt) && Math.abs(Date.now() - sentAt) > MAX_AGE_MINUTES * 60_000) {
    return { ok: false, reason: 'stale', detail: 'Delivery timestamp is outside the accepted window.' };
  }

  const key = await publicKey();
  if (!key) {
    return {
      ok: false,
      reason: 'no-key',
      detail: 'Kick’s public key is unavailable, so the signature cannot be checked.',
    };
  }

  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${messageId}.${timestamp}.${rawBody}`);
    verifier.end();
    if (!verifier.verify(key, Buffer.from(signature, 'base64'))) {
      return { ok: false, reason: 'bad-signature', detail: 'Signature did not match.' };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: 'bad-signature',
      detail: error instanceof Error ? error.message : 'Signature check failed.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Payload shapes                                                             */
/* -------------------------------------------------------------------------- */

export type ChatMessage = {
  senderId: string;
  senderUsername: string;
  content: string;
  isSubscriber: boolean;
  isVip: boolean;
};

function readUser(node: unknown): { id: string; username: string } | null {
  const user = node as Record<string, unknown> | null;
  if (!user) return null;
  const id = user.user_id ?? user.id ?? user.userId;
  const username = user.username ?? user.slug ?? user.name;
  if (id === undefined || id === null || typeof username !== 'string') return null;
  return { id: String(id), username };
}

/** Badges are instant; the subscription webhooks are authoritative (§5). */
function readBadges(node: unknown): { isSubscriber: boolean; isVip: boolean } {
  const sender = node as Record<string, unknown> | null;
  const identity = sender?.identity as Record<string, unknown> | undefined;
  const badges = (identity?.badges ?? sender?.badges) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(badges)) return { isSubscriber: false, isVip: false };

  const types = badges
    .map((badge) => String(badge.type ?? badge.text ?? '').toLowerCase())
    .filter(Boolean);

  return {
    isSubscriber: types.some((t) => t.includes('subscriber') || t.includes('founder')),
    isVip: types.some((t) => t.includes('vip')),
  };
}

export function parseChatMessage(payload: unknown): ChatMessage | null {
  const body = payload as Record<string, unknown> | null;
  if (!body) return null;

  const sender = readUser(body.sender);
  const content = body.content ?? body.message ?? (body.data as Record<string, unknown>)?.content;
  if (!sender || typeof content !== 'string') return null;

  const badges = readBadges(body.sender);
  return {
    senderId: sender.id,
    senderUsername: sender.username,
    content,
    isSubscriber: badges.isSubscriber,
    isVip: badges.isVip,
  };
}

export function parseLivestreamStatus(
  payload: unknown,
): { live: boolean; title: string | null } | null {
  const body = payload as Record<string, unknown> | null;
  if (!body) return null;
  const live = body.is_live ?? body.isLive ?? body.live;
  if (typeof live !== 'boolean') return null;
  const title = body.title ?? body.stream_title;
  return { live, title: typeof title === 'string' && title.trim() ? title.trim() : null };
}

export type SubscriptionEvent = {
  users: Array<{ id: string; username: string }>;
  expiresAt: string | null;
};

export function parseSubscription(payload: unknown): SubscriptionEvent | null {
  const body = payload as Record<string, unknown> | null;
  if (!body) return null;

  const single = readUser(body.subscriber);
  const giftees = Array.isArray(body.giftees)
    ? (body.giftees.map(readUser).filter(Boolean) as Array<{ id: string; username: string }>)
    : [];

  const users = single ? [single, ...giftees] : giftees;
  if (!users.length) return null;

  const expires = body.expires_at ?? body.expiresAt;
  return {
    users,
    expiresAt: typeof expires === 'string' ? expires : null,
  };
}

export function parseBan(
  payload: unknown,
): { user: { id: string; username: string }; reason: string; expiresAt: string | null } | null {
  const body = payload as Record<string, unknown> | null;
  if (!body) return null;
  const user = readUser(body.banned_user ?? body.user);
  if (!user) return null;

  const metadata = (body.metadata ?? body) as Record<string, unknown>;
  const expires = metadata.expires_at ?? metadata.expiresAt;
  return {
    user,
    reason: typeof metadata.reason === 'string' ? metadata.reason : 'Banned in Kick chat',
    expiresAt: typeof expires === 'string' ? expires : null,
  };
}

/**
 * Finds a verification code inside a chat message.
 *
 * Deliberately anchored to the `MS-XXXX` shape and case-insensitive, so a
 * viewer who types it in lower case or wraps it in a sentence still gets
 * linked. Anything else in the message is ignored.
 */
export function findVerificationCode(content: string): string | null {
  const match = content.match(/\bMS-[A-Z2-9]{4}\b/i);
  return match ? match[0].toUpperCase() : null;
}
