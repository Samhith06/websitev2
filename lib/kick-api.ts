/**
 * Direct Kick API integration for checking live status
 * This bypasses the webhook system and directly queries Kick's public API
 */

import { channel } from "./mock";

interface KickChannelResponse {
  id: number;
  user_id: number;
  slug: string;
  is_banned: boolean;
  playback_url: string;
  name_updated_at: string | null;
  vod_enabled: boolean;
  subscription_enabled: boolean;
  can_host: boolean;
  user: {
    id: number;
    username: string;
    agreed_to_terms: boolean;
    email_verified_at: string | null;
    bio: string;
    country: string;
    state: string;
    city: string;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
    discord: string | null;
    tiktok: string | null;
    facebook: string | null;
  };
  chatroom: {
    id: number;
    chatable_type: string;
    channel_id: number;
    created_at: string;
    updated_at: string;
    chat_mode_old: string;
    chat_mode: string;
    slow_mode: boolean;
    chatable_id: number;
    followers_mode: boolean;
    subscribers_mode: boolean;
    emotes_mode: boolean;
    message_interval: number;
    following_min_duration: number;
  };
  livestream: {
    id: number;
    slug: string;
    channel_id: number;
    created_at: string;
    session_title: string;
    is_live: boolean;
    risk_level_id: number | null;
    start_time: string;
    source: string | null;
    twitch_channel: string | null;
    duration: number;
    language: string;
    is_mature: boolean;
    viewer_count: number;
    thumbnail: {
      src: string;
      srcset: string;
    };
    viewers: number;
  } | null;
}

/**
 * Fetch current live status directly from Kick's public API.
 * No authentication required — this is public data.
 *
 * `checked` says whether Kick actually answered. Without it a network blip and
 * a genuinely offline channel are the same value, and a caller acting on
 * "offline" would end a stream that is still running.
 */
export async function fetchKickLiveStatus(): Promise<{
  checked: boolean;
  isLive: boolean;
  title: string | null;
  viewers: number | null;
  startTime: string | null;
  thumbnailUrl: string | null;
}> {
  try {
    const response = await fetch(
      `https://kick.com/api/v2/channels/${channel}`,
      {
        headers: {
          Accept: "application/json",
        },
        // Cache for 30 seconds to avoid rate limiting
        next: { revalidate: 30 },
      },
    );

    if (!response.ok) {
      console.error(`[kick-api] Failed to fetch channel: ${response.status}`);
      return {
        checked: false,
        isLive: false,
        title: null,
        viewers: null,
        startTime: null,
        thumbnailUrl: null,
      };
    }

    const data: KickChannelResponse = await response.json();

    if (data.livestream && data.livestream.is_live) {
      return {
        checked: true,
        isLive: true,
        title: data.livestream.session_title || "Live on Kick",
        viewers:
          data.livestream.viewer_count || data.livestream.viewers || null,
        startTime: data.livestream.start_time,
        thumbnailUrl: data.livestream.thumbnail?.src || null,
      };
    }

    return {
      checked: true,
      isLive: false,
      title: null,
      viewers: null,
      startTime: null,
      thumbnailUrl: null,
    };
  } catch (error) {
    console.error("[kick-api] Error fetching live status:", error);
    return {
      checked: false,
      isLive: false,
      title: null,
      viewers: null,
      startTime: null,
      thumbnailUrl: null,
    };
  }
}

/**
 * Get the last VOD from the channel
 */
export async function fetchLastVOD(): Promise<{
  url: string;
  title: string;
  thumbnail: string;
} | null> {
  try {
    const response = await fetch(
      `https://kick.com/api/v2/channels/${channel}/videos`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data && Array.isArray(data) && data.length > 0) {
      const lastVod = data[0];
      return {
        url: `https://kick.com/video/${lastVod.uuid}`,
        title: lastVod.session_title || "Latest stream",
        thumbnail: lastVod.thumbnail || "/brand/stream-thumb.svg",
      };
    }

    return null;
  } catch (error) {
    console.error("[kick-api] Error fetching VODs:", error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Clips                                                                      */
/* -------------------------------------------------------------------------- */

interface KickClipResponse {
  clip?: {
    id: string;
    title: string | null;
    thumbnail_url: string | null;
    duration: number | null;
    views: number | null;
    view_count: number | null;
    created_at: string | null;
    started_at: string | null;
  };
}

export type ClipMetadata = {
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  views: number | null;
  title: string | null;
  occurredAt: string | null;
};

/**
 * Real metadata for one Kick clip.
 *
 * This exists because the thumbnail URL cannot be derived from the clip id.
 * `parseSourceUrl` used to build `clips.kick.com/clips/60/<id>/thumbnail.webp`
 * from a hardcoded `60`, but that segment is a per-clip shard — the same clip
 * that 403s under `60` returns 200 under `3d` — so every Kick clip added
 * through the admin screen rendered a broken image. The only way to know the
 * segment is to ask, so we ask.
 *
 * The duration comes back here too, which is why clips used to show 0:00: the
 * column was inserted as a literal zero and nothing ever filled it in.
 *
 * Returns nulls rather than throwing. A clip whose metadata cannot be fetched
 * is still a clip worth having — it renders with a placeholder instead of a
 * broken image, and `refreshClipMetadata` can pick it up later.
 */
export async function fetchKickClip(clipId: string): Promise<ClipMetadata> {
  const empty: ClipMetadata = {
    thumbnailUrl: null,
    durationSeconds: null,
    views: null,
    title: null,
    occurredAt: null,
  };

  try {
    const response = await fetch(`https://kick.com/api/v2/clips/${clipId}`, {
      headers: {
        Accept: "application/json",
        // Kick answers an unadorned request with a challenge page rather than
        // JSON, so this is required rather than decorative.
        "User-Agent": "Mozilla/5.0 (compatible; MattySpins/1.0)",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(`[kick-api] Clip ${clipId} returned ${response.status}`);
      return empty;
    }

    const data: KickClipResponse = await response.json();
    const clip = data.clip;
    if (!clip) return empty;

    return {
      thumbnailUrl: clip.thumbnail_url || null,
      durationSeconds:
        typeof clip.duration === "number" && clip.duration > 0 ? Math.round(clip.duration) : null,
      views: clip.view_count ?? clip.views ?? null,
      title: clip.title || null,
      occurredAt: clip.started_at || clip.created_at || null,
    };
  } catch (error) {
    console.error(`[kick-api] Error fetching clip ${clipId}:`, error);
    return empty;
  }
}
