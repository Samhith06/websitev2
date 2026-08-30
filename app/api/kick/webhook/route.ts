import { NextResponse } from 'next/server';
import { hasDatabase, write } from '@/lib/db';
import {
  findVerificationCode, parseBan, parseChatMessage, parseLivestreamStatus, parseSubscription,
  verifySignature,
} from '@/lib/kick';
import {
  freezeUser, redeemVerificationCode, refreshKickUsername, setSubState, unfreezeUser,
  userIdByKickId,
} from '@/lib/store/accounts';
import { openWindow, streamWentLive, streamWentOffline } from '@/lib/store/presence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The one endpoint Kick talks to.
 *
 * Three rules, in order of how much damage getting them wrong would do:
 *
 *   1. **Verify the signature first.** An unsigned request could carry any
 *      viewer's verification code and hand their account to whoever sent it.
 *      A delivery that cannot be verified is refused and nothing is read from
 *      it — not even to log.
 *
 *   2. **De-duplicate on message id.** Kick retries. A retried chat message
 *      must not open a second window or pay a second time.
 *
 *   3. **Answer fast.** Kick expects a prompt 200. The work here is a handful
 *      of indexed statements; when it grows past that it moves to a queue and
 *      this becomes an enqueue.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  const signature = await verifySignature(request.headers, raw);
  if (!signature.ok) {
    // 'no-key' is our problem, not the sender's, so it gets a 503 — Kick will
    // retry it, and a 401 would make it give up on a delivery that was fine.
    const status = signature.reason === 'no-key' ? 503 : 401;
    console.warn(`[kick] refused a delivery: ${signature.reason} — ${signature.detail}`);
    return NextResponse.json({ ok: false, error: signature.reason }, { status });
  }

  if (!hasDatabase()) {
    // Nothing can be recorded, so tell Kick to retry rather than swallowing it.
    return NextResponse.json({ ok: false, error: 'no-database' }, { status: 503 });
  }

  const messageId = request.headers.get('kick-event-message-id') ?? '';
  const eventType = request.headers.get('kick-event-type') ?? 'unknown';

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: 'malformed' }, { status: 400 });
  }

  // The insert is the de-duplication: a repeat conflicts and returns nothing.
  const first = await write<{ message_id: string }>(
    `INSERT INTO kick_events (message_id, event_type) VALUES ($1, $2)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING message_id`,
    [messageId, eventType],
  );
  if (messageId && first.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await handle(eventType, payload);
  } catch (error) {
    console.error(`[kick] ${eventType} failed`, error);
    // Let Kick retry, and drop the de-dupe row so the retry is not swallowed.
    if (messageId) {
      await write('DELETE FROM kick_events WHERE message_id = $1', [messageId]).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: 'handler-failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handle(eventType: string, payload: unknown): Promise<void> {
  switch (eventType) {
    case 'chat.message.sent':
      return onChatMessage(payload);
    case 'livestream.status.updated':
      return onStreamStatus(payload);
    case 'channel.subscription.new':
    case 'channel.subscription.renewal':
    case 'channel.subscription.gifts':
      return onSubscription(payload);
    case 'moderation.banned':
      return onBanned(payload);
    default:
      console.log(`[kick] ignoring ${eventType}`);
  }
}

/**
 * A chat message does one of two things: it links an account, or it opens a
 * presence window for one that is already linked. It never does both — a
 * message carrying a code is the linking message, and earning starts at the
 * next one.
 */
async function onChatMessage(payload: unknown): Promise<void> {
  const message = parseChatMessage(payload);
  if (!message) {
    console.warn('[kick] chat.message.sent did not match a shape we recognise');
    return;
  }

  const code = findVerificationCode(message.content);
  if (code) {
    const outcome = await redeemVerificationCode({
      code,
      kickUserId: message.senderId,
      kickUsername: message.senderUsername,
    });
    if (outcome.ok) {
      console.log(`[kick] linked ${message.senderUsername} to user ${outcome.userId}`);
      await applyBadges(outcome.userId, message);
      return;
    }
    console.log(`[kick] code ${code} from ${message.senderUsername} refused: ${outcome.reason}`);
    return;
  }

  // Only a verified link can earn. An unlinked chatter is simply somebody the
  // site does not know yet, so there is nothing to open a window against.
  const userId = await userIdByKickId(message.senderId);
  if (!userId) return;

  await refreshKickUsername(message.senderId, message.senderUsername);
  await applyBadges(userId, message);
  await openWindow(userId, 'chat');
}

/** Badge state is instant but not authoritative; the webhooks correct it. */
async function applyBadges(
  userId: number,
  message: { isSubscriber: boolean; isVip: boolean },
): Promise<void> {
  if (!message.isSubscriber && !message.isVip) return;
  await setSubState({
    userId,
    isVip: message.isVip,
    // A badge proves a sub right now but says nothing about when it lapses, so
    // it is trusted for the length of one stream and no longer.
    subActiveUntil: message.isSubscriber ? new Date(Date.now() + 6 * 3_600_000) : null,
    source: 'badge',
  });
}

async function onStreamStatus(payload: unknown): Promise<void> {
  const status = parseLivestreamStatus(payload);
  if (!status) {
    console.warn('[kick] livestream.status.updated did not match a shape we recognise');
    return;
  }
  if (status.live) await streamWentLive(status.title);
  else await streamWentOffline();
}

async function onSubscription(payload: unknown): Promise<void> {
  const event = parseSubscription(payload);
  if (!event) return;

  for (const user of event.users) {
    const userId = await userIdByKickId(user.id);
    if (!userId) continue;
    await setSubState({
      userId,
      subActiveUntil: event.expiresAt ? new Date(event.expiresAt) : new Date(Date.now() + 30 * 86_400_000),
      source: 'webhook',
    });
  }
}

/** A chat ban freezes accrual for its duration. Coins already held are kept. */
async function onBanned(payload: unknown): Promise<void> {
  const ban = parseBan(payload);
  if (!ban) return;
  const userId = await userIdByKickId(ban.user.id);
  if (!userId) return;

  if (ban.expiresAt && new Date(ban.expiresAt).getTime() <= Date.now()) {
    await unfreezeUser(userId);
    return;
  }
  await freezeUser(userId, ban.reason, ban.expiresAt ? new Date(ban.expiresAt) : null);
  await write('DELETE FROM presence_windows WHERE user_id = $1', [userId]);
}
