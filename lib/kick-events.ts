import 'server-only';

/**
 * Kick event subscriptions.
 *
 * Setting a webhook URL in the Kick dashboard says *where* deliveries go; it
 * does not say *what* to deliver. Each event has to be subscribed to through
 * the Events API, authenticated with an app access token — which is the one
 * thing on this integration that needs the Client ID and Secret.
 *
 * Nothing at request time uses this module. It exists for `npm run kick:events`,
 * run once at setup and again whenever the event list changes.
 */

const TOKEN_ENDPOINT = 'https://id.kick.com/oauth/token';
const SUBSCRIPTIONS_ENDPOINT = 'https://api.kick.com/public/v1/events/subscriptions';
const CHANNELS_ENDPOINT = 'https://api.kick.com/public/v1/channels';

/** Exactly the events `app/api/kick/webhook` knows how to handle. */
export const REQUIRED_EVENTS = [
  'chat.message.sent',
  'livestream.status.updated',
  'channel.subscription.new',
  'channel.subscription.renewal',
  'channel.subscription.gifts',
  'moderation.banned',
] as const;

export type KickEvent = (typeof REQUIRED_EVENTS)[number];

export type Failure = { ok: false; detail: string };

/**
 * An app access token, via client credentials.
 *
 * The secret is read from the environment here, server-side, and never leaves
 * it. Nothing returns the token to a caller that could log it.
 */
async function appToken(): Promise<{ ok: true; token: string } | Failure> {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      detail:
        'KICK_CLIENT_ID and KICK_CLIENT_SECRET are not set. Add them to the environment — they are only needed to manage subscriptions, never to serve a request.',
    };
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    return {
      ok: false,
      detail: `Kick refused the token request (${response.status} ${response.statusText}). Check the client id and secret.`,
    };
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    return { ok: false, detail: 'Kick returned a token response with no access_token in it.' };
  }
  return { ok: true, token: payload.access_token };
}

/** The numeric broadcaster id for a channel slug — what subscriptions key on. */
export async function broadcasterId(slug: string): Promise<{ ok: true; id: number } | Failure> {
  const token = await appToken();
  if (!token.ok) return token;

  const url = new URL(CHANNELS_ENDPOINT);
  url.searchParams.set('slug', slug);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.token}`, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    return { ok: false, detail: `Could not read channel "${slug}" (${response.status}).` };
  }

  const payload = (await response.json()) as {
    data?: Array<{ broadcaster_user_id?: number }>;
  };
  const id = payload.data?.[0]?.broadcaster_user_id;
  if (typeof id !== 'number') {
    return { ok: false, detail: `Kick returned no broadcaster id for "${slug}".` };
  }
  return { ok: true, id };
}

export type Subscription = { id: string; event: string; version: number };

export async function listSubscriptions(): Promise<
  { ok: true; subscriptions: Subscription[] } | Failure
> {
  const token = await appToken();
  if (!token.ok) return token;

  const response = await fetch(SUBSCRIPTIONS_ENDPOINT, {
    headers: { Authorization: `Bearer ${token.token}`, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    return { ok: false, detail: `Could not list subscriptions (${response.status}).` };
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string; event?: string; version?: number }>;
  };
  return {
    ok: true,
    subscriptions: (payload.data ?? []).map((s) => ({
      id: String(s.id ?? ''),
      event: String(s.event ?? ''),
      version: Number(s.version ?? 1),
    })),
  };
}

/**
 * Subscribe to events that are not already subscribed.
 *
 * Idempotent by intent: the caller passes only what is missing, so re-running
 * the setup is safe and does not produce duplicate deliveries.
 */
export async function subscribe(
  events: readonly string[],
  broadcasterUserId: number,
): Promise<{ ok: true; created: number } | Failure> {
  if (events.length === 0) return { ok: true, created: 0 };

  const token = await appToken();
  if (!token.ok) return token;

  const response = await fetch(SUBSCRIPTIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      broadcaster_user_id: broadcasterUserId,
      events: events.map((event) => ({ name: event, version: 1 })),
      method: 'webhook',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return {
      ok: false,
      detail: `Kick refused the subscription (${response.status}). ${detail.slice(0, 300)}`,
    };
  }

  return { ok: true, created: events.length };
}
