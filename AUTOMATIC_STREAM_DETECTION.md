# ✨ Automatic Stream Detection

## 🎉 Good News!

**The site now automatically detects when Matty is live on Kick!**

No manual control needed. No webhook configuration required. It just works™.

---

## 🚀 How It Works

The system checks if Matty is live using **3 methods in priority order**:

### 1. Database Webhook (Most Reliable)

If webhooks are configured, stream sessions are stored in the database.

- ✅ Most accurate
- ✅ Real-time updates
- ✅ No API rate limits
- ⚠️ Requires webhook setup

### 2. Direct Kick API (Automatic Fallback)

If no database session exists, directly queries Kick's public API.

- ✅ **No configuration needed**
- ✅ Works immediately
- ✅ Shows viewer count
- ✅ Gets stream title
- ⚙️ Cached for 30 seconds

### 3. Offline State (Default)

If both above methods fail or show offline.

- ✅ Shows last VOD
- ✅ Shows next stream time

---

## 📊 What This Means

### Before (Manual):

```
❌ Site shows offline even when live
❌ Admin must click "Mark as Live"
❌ Manual control every stream
```

### Now (Automatic):

```
✅ Site automatically detects live status
✅ Updates every 30 seconds
✅ Shows real viewer count
✅ Gets actual stream title
✅ Works without any configuration
```

---

## 🎯 Features

### Automatic Features:

- ✨ **Live Detection** - Checks Kick API every page load
- 👥 **Viewer Count** - Shows real-time viewer numbers
- 📝 **Stream Title** - Displays actual stream title from Kick
- 🖼️ **Live Thumbnail** - Uses current stream thumbnail
- 📺 **Last VOD** - Shows most recent VOD when offline
- 🔄 **Auto-Sync** - Keeps database in sync (if enabled)

### What Changes on Live:

- Hero section: "Back live Wednesday" → "Live now on Kick"
- Nav badge: "Offline" → "LIVE NOW" (green + pulsing)
- Viewer count appears
- Stream uptime shown
- "Watch the stream" button active

---

## ⚡ Performance

### Caching Strategy:

- **Live status**: Cached 30 seconds
- **VOD list**: Cached 5 minutes
- **No rate limit issues**

### Speed:

- First check: ~200-500ms (Kick API call)
- Subsequent: Instant (from cache)

---

## 🔧 Optional: Background Sync

For even better performance, set up a background job:

### Option 1: Railway Cron

```yaml
# railway.toml
[[crons]]
schedule = "*/30 * * * * *"  # Every 30 seconds
command = "curl https://your-domain.com/api/stream/sync"
```

### Option 2: GitHub Actions

```yaml
# .github/workflows/stream-sync.yml
name: Stream Sync
on:
  schedule:
    - cron: "*/1 * * * *" # Every minute
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://your-domain.com/api/stream/sync
```

### Option 3: External Cron Service

Use services like:

- **cron-job.org** (free)
- **EasyCron** (free tier)
- **UptimeRobot** (free)

Set them to call: `https://your-domain.com/api/stream/sync` every 30-60 seconds

---

## 🧪 Testing

### Test Automatic Detection:

1. Visit homepage: `http://localhost:3000`
2. Check if Matty is actually live on Kick
3. If live → Site should show LIVE automatically
4. If offline → Site should show offline state

### Test API Directly:

```bash
# Check sync status
curl http://localhost:3000/api/stream/sync

# Response when live:
{
  "ok": true,
  "action": "synced",
  "isLive": true,
  "viewers": 1234,
  "title": "Saturday Night Slots"
}
```

### Test in Browser Console:

```javascript
// Check Kick API directly
fetch("https://kick.com/api/v2/channels/mattyspinss")
  .then((r) => r.json())
  .then((data) => {
    console.log("Is Live:", data.livestream?.is_live);
    console.log("Viewers:", data.livestream?.viewer_count);
    console.log("Title:", data.livestream?.session_title);
  });
```

---

## 🎮 How It Updates

### Page Load (SSR):

Every time someone visits the site:

1. Server checks database for webhook session
2. If none, queries Kick API automatically
3. Returns correct live/offline state
4. Result cached for 30 seconds

### Background Sync (Optional):

If you set up the cron job:

1. Every 30-60 seconds, `/api/stream/sync` is called
2. Checks Kick API vs database
3. Opens/closes sessions as needed
4. Keeps database perfectly in sync

---

## 📁 New Files

### Core Detection:

- ✅ `lib/kick-api.ts` - Direct Kick API integration
- ✅ `lib/store/stream.ts` - Updated with automatic detection

### Background Sync:

- ✅ `app/api/stream/sync/route.ts` - Sync endpoint

### Documentation:

- ✅ `AUTOMATIC_STREAM_DETECTION.md` (this file)

---

## 🔍 How to Verify It's Working

### Check 1: Homepage

Visit `http://localhost:3000` and look at:

- Hero section (should say "Live now" if Matty is streaming)
- Nav badge (should be green if live)

### Check 2: API Response

```bash
curl http://localhost:3000/api/stream/sync
```

Should return `isLive: true` if streaming.

### Check 3: Browser DevTools

Open Network tab:

- Look for requests to `/` (homepage)
- Server should return correct live status
- No errors in console

### Check 4: Database (if configured)

```sql
SELECT * FROM stream_sessions WHERE ended_at IS NULL;
```

Should have a row if live.

---

## 🎯 Migration Path

### Current Setup:

1. ✅ Automatic detection works immediately
2. ✅ No configuration needed
3. ✅ Shows correct live/offline status

### Optional Improvements:

1. **Add Background Sync** (30s-1min interval)
   - Keeps database perfectly in sync
   - Better for coin earning (needs DB session)
2. **Configure Webhooks** (best long-term)
   - Instant updates (no 30s delay)
   - Most reliable
   - No API polling

---

## 💡 Pro Tips

### For Development:

- Automatic detection works great
- No setup needed
- Just start coding

### For Production:

1. **Week 1-2**: Use automatic detection
2. **Week 3+**: Add background sync cron
3. **Month 2+**: Configure Kick webhooks

### For Best Performance:

- Keep automatic detection (fallback)
- Add background sync (sync to DB)
- Configure webhooks (instant updates)
- All three together = bulletproof system

---

## 🐛 Troubleshooting

### Still Shows Offline When Live?

**Check 1: Is Matty Actually Live?**

```bash
curl https://kick.com/api/v2/channels/mattyspinss | jq '.livestream.is_live'
```

**Check 2: Hard Refresh**

- Press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clears 30-second cache

**Check 3: Check Logs**
Look for `[kick-api]` in server logs

**Check 4: Test API**

```bash
curl http://localhost:3000/api/stream/sync
```

### Shows Live When Offline?

**Check 1: Database Session**
There might be an old open session:

```sql
UPDATE stream_sessions SET ended_at = NOW() WHERE ended_at IS NULL;
```

**Check 2: Cache**
Wait 30 seconds for cache to expire

---

## ✅ Summary

### What You Get:

- ✅ Automatic live detection
- ✅ No configuration required
- ✅ Real viewer counts
- ✅ Actual stream titles
- ✅ Current thumbnails
- ✅ Last VOD when offline
- ✅ 30-second updates
- ✅ Optional background sync
- ✅ Webhook-compatible

### What You Don't Need:

- ❌ Manual "Mark as Live" clicks
- ❌ Webhook setup (optional)
- ❌ API keys (uses public API)
- ❌ Configuration files
- ❌ Environment variables (for basic function)

---

## 🎉 You're All Set!

The site now automatically detects when Matty is live. Just deploy and it works!

**No more manual control. No more "why is it offline" questions. Just automatic, reliable stream detection.** 🚀
