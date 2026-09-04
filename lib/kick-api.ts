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
