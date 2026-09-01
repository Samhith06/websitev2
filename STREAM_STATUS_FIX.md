# Stream Status Fix - Manual Control

## 🎯 Problem

The website shows "OFFLINE" even when Matty is streaming on Kick.

## 🔍 Why This Happens

The live status comes from the database table `stream_sessions`, which is populated by the Kick webhook when it receives a `livestream.status.updated` event. Until the webhook is properly configured, the site has no way to know when streams start/stop.

## ✅ Solution: Manual Stream Control

I've added a manual control in the admin panel that lets you set the stream status while you're waiting for webhooks to be configured.

---

## 🚀 How to Use

### 1. Access Admin Panel

Go to: `http://localhost:3000/admin` (or your production URL + /admin)

### 2. Find Stream Control

You'll see a new "Manual Stream Control" card on the admin dashboard overview page.

### 3. Mark Stream as Live

1. Enter a stream title (e.g., "Saturday Night Slots Session")
2. Click **"Mark as Live"**
3. The page will refresh and show the site as LIVE

### 4. Mark Stream as Offline

When the stream ends:

1. Click **"Mark as Offline"**
2. The page will refresh and show offline state

---

## 🔧 Technical Details

### New Files Created:

1. **`app/api/admin/stream-status/route.ts`** - API endpoint for stream control
2. **`components/admin/StreamControl.tsx`** - Admin UI component

### How It Works:

The manual control calls the same functions that the Kick webhook uses:

- `streamWentLive(title)` - Opens a new stream session in the database
- `streamWentOffline()` - Closes the active stream session

### Database Changes:

When you mark as live:

```sql
INSERT INTO stream_sessions (started_at, title)
VALUES (NOW(), 'Your Stream Title');
```

When you mark as offline:

```sql
UPDATE stream_sessions
SET ended_at = NOW()
WHERE ended_at IS NULL;
```

---

## 📡 Setting Up Kick Webhooks (Production)

Once you're ready to make this automatic:

### 1. Configure Webhook in Kick

In your Kick Developer Dashboard:

- **Webhook URL**: `https://your-domain.com/api/kick/webhook`
- **Events to Subscribe**:
  - `livestream.status.updated` ✅ (for live/offline)
  - `chat.message.sent` (for coin earning)
  - `channel.subscription.new`
  - `channel.subscription.renewal`
  - `channel.subscription.gifts`
  - `moderation.banned`

### 2. Set Environment Variables

```env
KICK_WEBHOOK_PUBLIC_KEY=your_kick_webhook_public_key
```

### 3. Test the Webhook

Start a test stream on Kick and watch the admin panel. The "Kick webhook" status should show "Receiving" when a stream goes live.

---

## 🧪 API Testing

You can also test the API directly:

### Mark as Live

```bash
curl -X POST http://localhost:3000/api/admin/stream-status \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "action": "live",
    "title": "Test Stream"
  }'
```

### Mark as Offline

```bash
curl -X POST http://localhost:3000/api/admin/stream-status \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"action": "offline"}'
```

### Check Current Status

```bash
curl http://localhost:3000/api/admin/stream-status \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

---

## 🎮 What Changes When Live

When the stream is marked as live:

### Homepage (`/`)

- ✅ Hero changes from "Back live Wednesday, 10am" to "Live now"
- ✅ Shows viewer count (if available)
- ✅ "Watch the stream" button links to Kick
- ✅ Countdown changes to stream uptime
- ✅ Live badge in nav shows "LIVE NOW" (green)

### User Experience

- ✅ Users can start earning coins
- ✅ Presence windows open on chat messages
- ✅ Tick job awards coins every 3 minutes

---

## ⚠️ Important Notes

1. **Manual Control is for Testing Only**
   - Once webhooks are configured, they will override manual settings
   - Don't rely on this for production use

2. **Database Required**
   - The manual control requires a database connection
   - Set `DATABASE_URL` environment variable

3. **Admin Access Only**
   - Only users in `OWNER_DISCORD_IDS` can access this

4. **Page Refresh**
   - After changing status, the page auto-refreshes to update UI
   - This is intentional to show immediate results

---

## 🐛 Troubleshooting

### "Unauthorized" Error

- Make sure you're signed in as an admin
- Check that your Discord ID is in `OWNER_DISCORD_IDS`

### Status Not Changing

1. Check browser console for errors
2. Verify database connection in admin panel
3. Check server logs for errors

### Homepage Still Shows Offline

1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Check `/api/admin/stream-status` to verify database state
3. Clear your browser cache

---

## 🎯 Quick Test Checklist

- [ ] Access admin panel at `/admin`
- [ ] See "Manual Stream Control" card
- [ ] Mark stream as live with a title
- [ ] Visit homepage - should show LIVE
- [ ] Check nav - should show green "LIVE NOW" badge
- [ ] Mark stream as offline
- [ ] Visit homepage - should show offline state
- [ ] Webhook setup instructions understood

---

## 🚀 Next Steps

1. **Immediate**: Use manual control for testing/demos
2. **Short-term**: Configure Kick webhooks for automatic updates
3. **Long-term**: Remove manual control once webhooks are stable

---

Your stream status is now controllable! 🎉
