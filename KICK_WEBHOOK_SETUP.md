# 🎯 Kick Webhook Setup Guide

## Why Verification Isn't Working

The verification code system requires Kick webhooks to be configured. When someone types a code in chat, Kick needs to send that message to your server via webhook.

**Currently:** Kick doesn't know where to send chat messages → Your server never receives them → Verification doesn't work

**After Setup:** Kick sends chat messages to your server → Server sees the code → Verification works!

---

## 📋 Prerequisites

Before you start, you need:

1. ✅ **Kick Account** - The channel account (mattyspinss)
2. ✅ **Kick Developer Access** - Access to Kick's developer portal
3. ✅ **Website URL** - Your Railway deployment URL
4. ✅ **Database** - PostgreSQL connected to Railway

---

## 🚀 Step-by-Step Setup

### **Step 1: Access Kick Developer Portal**

1. Go to **https://kick.com/settings/developer**
   - Or navigate: Profile → Settings → Developer

2. Sign in with the channel account (mattyspinss)

3. Look for **"Webhooks"** or **"Developer Settings"** section

---

### **Step 2: Create Webhook**

1. Click **"Create Webhook"** or **"Add Webhook"**

2. **Webhook Configuration:**

   **Webhook URL:**

   ```
   https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook
   ```

   **Description:** (Optional)

   ```
   MattySpins verification and coin system
   ```

   **Events to Subscribe:**
   Select these events:
   - ✅ `chat.message.sent` - **REQUIRED** for verification
   - ✅ `livestream.status.updated` - For automatic live/offline detection
   - ✅ `channel.subscription.new` - For subscriber tracking
   - ✅ `channel.subscription.renewal` - For subscriber tracking
   - ✅ `channel.subscription.gifts` - For gifted subs
   - ✅ `moderation.banned` - For freezing banned users

3. Click **"Create"** or **"Save"**

---

### **Step 3: Get Webhook Public Key**

After creating the webhook, Kick will show you:

1. **Webhook Public Key** - A long RSA public key
   - It looks like:

   ```
   -----BEGIN PUBLIC KEY-----
   MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
   -----END PUBLIC KEY-----
   ```

2. **Copy the entire public key** (including BEGIN/END lines)

---

### **Step 4: Add Environment Variable**

1. **Go to Railway Dashboard:**
   - https://railway.app
   - Select your project: "miraculous-wholeness"
   - Click on service: "mattyspins-web"

2. **Click on "Variables" tab**

3. **Add new variable:**
   - **Name:** `KICK_WEBHOOK_PUBLIC_KEY`
   - **Value:** Paste the entire public key (including BEGIN/END lines)

   **Important:** Make sure you paste it exactly as shown by Kick, including all line breaks.

4. **Click "Add"**

5. **Service will automatically redeploy** (wait ~2 minutes)

---

### **Step 5: Verify Webhook is Receiving**

1. **Test by typing in Kick chat:**

   ```
   test message
   ```

2. **Check Railway logs:**

   ```bash
   railway logs
   ```

   Look for:

   ```
   [kick] chat.message.sent
   ```

3. **If you see the log** → Webhook is working! ✅

4. **If you don't see logs** → See troubleshooting below

---

### **Step 6: Test Verification**

1. **Generate code on website:**
   - Go to https://mattyspins-web-production-75f8.up.railway.app/me
   - Click "Generate my code"
   - You'll get something like: `MS-DWJC`

2. **Type the code in Kick chat:**

   ```
   MS-DWJC
   ```

3. **The page should update automatically** showing your Kick account is linked!

4. **Check Railway logs for confirmation:**
   ```
   [kick] linked mattyspinss to user 123
   ```

---

## 🔍 Detailed Webhook Configuration

### Required Events Explained:

| Event                          | Why It's Needed               | What Happens                                     |
| ------------------------------ | ----------------------------- | ------------------------------------------------ |
| `chat.message.sent`            | **CRITICAL** for verification | Server reads messages to find verification codes |
| `livestream.status.updated`    | Auto live/offline detection   | Opens/closes stream sessions automatically       |
| `channel.subscription.new`     | Subscriber tracking           | Sets 2× coin multiplier                          |
| `channel.subscription.renewal` | Subscriber tracking           | Maintains 2× multiplier                          |
| `channel.subscription.gifts`   | Gifted subs tracking          | Applies multiplier to gift recipients            |
| `moderation.banned`            | Ban handling                  | Freezes coin earning for banned users            |

### Optional Events (Not Required Yet):

- `channel.follower.created` - Future feature
- `message.deleted` - Not currently used
- `raid.started` - Future feature

---

## 🧪 Testing the Webhook

### Test 1: Basic Connectivity

**In Railway logs**, after typing in Kick chat, you should see:

```
[kick] chat.message.sent
[kick] ignoring message from unlinked user
```

This means webhook is working but user isn't verified yet.

### Test 2: Verification Flow

1. Generate code on `/me` page
2. Type code in Kick chat
3. Watch Railway logs:
   ```
   [kick] linked mattyspinss to user 123
   ```
4. Page should auto-update showing verified status

### Test 3: Coin Earning

1. Make sure stream is live (either manually via `/admin` or automatically)
2. Type any message in Kick chat
3. Check logs:
   ```
   [kick] opened presence window for user 123
   ```

---

## 🐛 Troubleshooting

### Problem: "Webhook URL is invalid"

**Solutions:**

1. Make sure URL is exactly: `https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook`
2. No trailing slash
3. HTTPS not HTTP
4. Check Railway deployment is live: `railway status`

### Problem: "No logs appearing in Railway"

**Solutions:**

1. **Check webhook is active in Kick settings**
2. **Verify URL is correct**
3. **Test webhook endpoint manually:**
   ```bash
   curl https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook
   ```
   Should return error (that's OK - it means endpoint exists)

### Problem: "Signature verification failed"

**Solutions:**

1. **Check KICK_WEBHOOK_PUBLIC_KEY is set correctly in Railway**
2. **Make sure you copied the ENTIRE key including:**
   ```
   -----BEGIN PUBLIC KEY-----
   (key content)
   -----END PUBLIC KEY-----
   ```
3. **No extra spaces or line breaks**
4. **Redeploy after adding the key**

### Problem: "Code not detected in chat"

**Solutions:**

1. **Make sure webhooks are working first** (see test above)
2. **Check the code format:** `MS-XXXX` (4 characters)
3. **Code must be valid:** Check it exists in database
4. **Code not expired:** Codes expire after 10 minutes
5. **Check Railway logs:**
   ```bash
   railway logs --filter="verification"
   ```

### Problem: "Page not updating after typing code"

**Solutions:**

1. **Hard refresh the page:** Ctrl+Shift+R or Cmd+Shift+R
2. **Check Railway logs** to see if verification succeeded
3. **Check browser console** for JavaScript errors
4. **Try clicking "Check Status" button** on the page

---

## 📝 Environment Variables Summary

After webhook setup, you should have these in Railway:

```env
# Required for webhooks
KICK_WEBHOOK_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...

# Required for app functionality
DATABASE_URL=<set by Railway Postgres>
AUTH_SECRET=<random string>
AUTH_URL=https://mattyspins-web-production-75f8.up.railway.app
DISCORD_CLIENT_ID=<from Discord>
DISCORD_CLIENT_SECRET=<from Discord>
OWNER_DISCORD_IDS=<your Discord numeric ID>

# Optional but recommended
RAZED_REFERRAL_KEY=<for leaderboards>
CRON_SECRET=<for coin tick job>
```

---

## 🎯 Verification Checklist

- [ ] Accessed Kick Developer Portal
- [ ] Created webhook with correct URL
- [ ] Subscribed to `chat.message.sent` event
- [ ] Copied webhook public key
- [ ] Added `KICK_WEBHOOK_PUBLIC_KEY` to Railway
- [ ] Waited for Railway redeploy (~2 min)
- [ ] Typed test message in Kick chat
- [ ] Saw logs in Railway
- [ ] Generated verification code on `/me`
- [ ] Typed code in Kick chat
- [ ] Page updated showing linked status
- [ ] Verified in Railway logs

---

## 🔐 Security Notes

1. **Never share your webhook public key publicly**
2. **The webhook endpoint automatically verifies all requests**
3. **Unsigned requests are rejected** (403 Unauthorized)
4. **All verification codes are single-use**
5. **Codes expire after 10 minutes**

---

## 📊 Expected Behavior After Setup

### When Someone Types in Chat:

```
User types: "hello"
↓
Kick sends webhook: chat.message.sent
↓
Your server receives message
↓
If message contains MS-XXXX code → Link account
If user is linked → Open 15-min presence window
↓
Logs show: [kick] opened presence window for user 123
```

### When Stream Goes Live:

```
Stream starts on Kick
↓
Kick sends webhook: livestream.status.updated
↓
Your server receives event
↓
Creates stream_sessions row with ended_at = NULL
↓
Website automatically shows "LIVE NOW"
```

---

## 🆘 Still Having Issues?

### Check Railway Logs:

```bash
railway logs --tail
```

Look for:

- `[kick]` messages - Webhook processing
- Error messages - What's failing
- Signature verification - Public key issues

### Test Webhook Endpoint:

```bash
curl -X POST https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

Should return 401 (that's expected - means endpoint is working but signature missing)

### Check Database:

If you have database access:

```sql
-- Check if code was created
SELECT * FROM verification_codes ORDER BY created_at DESC LIMIT 5;

-- Check if webhook events are being recorded
SELECT * FROM kick_events ORDER BY received_at DESC LIMIT 10;

-- Check if Kick link exists
SELECT * FROM kick_links WHERE user_id = YOUR_USER_ID;
```

---

## 🎉 Success Indicators

You know it's working when:

1. ✅ Railway logs show `[kick]` messages when you type in chat
2. ✅ Verification code links your account on first use
3. ✅ Page auto-updates after typing code
4. ✅ Can see "Verified" status on `/me` page
5. ✅ Typing in chat opens presence window (visible in logs)
6. ✅ Stream going live automatically updates website

---

## 📞 Quick Reference

**Webhook URL:**

```
https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook
```

**Required Events:**

- `chat.message.sent`
- `livestream.status.updated`
- `channel.subscription.new`
- `channel.subscription.renewal`
- `channel.subscription.gifts`
- `moderation.banned`

**Environment Variable:**

```
KICK_WEBHOOK_PUBLIC_KEY=<your-key-here>
```

**Test Command:**

```bash
railway logs --filter="kick"
```

---

Good luck with the setup! Once webhooks are configured, verification will work perfectly. 🚀
