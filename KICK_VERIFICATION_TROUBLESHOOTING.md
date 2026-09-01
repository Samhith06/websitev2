# 🔧 Kick Verification Not Working - Troubleshooting

## 🎯 Problem

You're typing the verification code (e.g., `MS-DWJC`) in Kick chat, but the account isn't getting verified.

## 🔍 Root Cause

**The Kick webhook is not configured yet**, so the website doesn't receive chat messages from Kick.

---

## 📊 How Verification Works

### Current Flow:

```
1. User clicks "Generate Code" on website
   ↓
2. Website creates code "MS-DWJC" in database
   ↓
3. User types "MS-DWJC" in Kick chat
   ↓
4. Kick sends webhook to your website ❌ (NOT CONFIGURED)
   ↓
5. Website links Kick account to Discord account
```

**Problem:** Step 4 is not happening because webhooks aren't configured.

---

## ✅ Solution: Set Up Kick Webhooks

### Step 1: Get Your Webhook URL

```
https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook
```

### Step 2: Configure in Kick Developer Portal

1. **Go to Kick Developer Portal:**
   - Visit: https://kick.com/dashboard/settings/developer
   - Or navigate: Dashboard → Settings → Developer

2. **Create a Webhook:**
   - Click "Add Webhook" or "Create Webhook"
   - **Webhook URL:** `https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook`

3. **Subscribe to Events:**
   ✅ `chat.message.sent` (REQUIRED for verification)
   ✅ `livestream.status.updated` (for live/offline)
   ✅ `channel.subscription.new` (for sub bonuses)
   ✅ `channel.subscription.renewal` (for sub bonuses)
   ✅ `channel.subscription.gifts` (for gifted subs)
   ✅ `moderation.banned` (for freezing banned users)

4. **Required Scopes:**
   - `events:subscribe`
   - `chat:write`
   - `channel:read`
   - `user:read`

5. **Get Public Key:**
   - Copy the webhook public key provided by Kick
   - You'll need this for the next step

### Step 3: Add Public Key to Railway

```bash
railway variables set KICK_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"
```

Or in Railway Dashboard:

1. Go to mattyspins-web service
2. Variables tab
3. Add `KICK_WEBHOOK_PUBLIC_KEY`
4. Paste the public key from Kick

### Step 4: Test the Webhook

After configuration, test it:

1. **Generate a new verification code** on your site
2. **Type the code in Kick chat** (e.g., `MS-ABCD`)
3. **Check if it verifies** - refresh the page

---

## 🧪 Testing Without Webhook (Temporary Solution)

While you're setting up webhooks, you can manually test the verification:

### Option A: Use the API Directly

```bash
# Replace with your actual values
curl -X POST https://mattyspins-web-production-75f8.up.railway.app/api/kick/verify \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MS-DWJC",
    "kickUserId": "your-kick-user-id",
    "kickUsername": "sunny_the_indian_gambler"
  }'
```

### Option B: Admin Manual Link (Best for Testing)

I can create an admin tool to manually link accounts. Would you like me to add this?

---

## 🔍 Debugging Steps

### 1. Check if Code Was Generated

Visit your database or check in admin panel:

- Does the code exist in `verification_codes` table?
- Has it expired? (codes expire after 10 minutes)
- Was it already consumed?

### 2. Check Railway Logs

```bash
railway logs --filter="kick"
```

Look for:

- `[kick] refused a delivery` - means webhook is receiving but signature is wrong
- `[kick] linked username to user` - means it worked!
- No logs = webhook not configured

### 3. Test Webhook Endpoint

```bash
# Check if endpoint is accessible
curl https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook
```

Should return: `{"ok":false,"error":"malformed"}` (this is expected for GET request)

### 4. Check if You're in the Right Chat

- Make sure you're typing in **mattyspinss** Kick channel
- Not in a different streamer's chat
- The channel slug must match the one in `lib/mock.ts`

---

## 📝 Quick Verification Checklist

- [ ] Kick webhook URL configured in Kick Developer Portal
- [ ] Webhook subscribed to `chat.message.sent` event
- [ ] Public key added to Railway environment variables
- [ ] Code generated on website (not expired)
- [ ] Typing code in correct Kick channel (mattyspinss)
- [ ] Code format is correct: `MS-XXXX`

---

## 🚨 Common Issues

### Issue 1: "No logs in Railway"

**Cause:** Webhook not configured in Kick  
**Solution:** Complete Step 2 above

### Issue 2: "refused a delivery: invalid-signature"

**Cause:** Wrong public key  
**Solution:** Copy the exact public key from Kick Developer Portal

### Issue 3: "Code expired"

**Cause:** Codes expire after 10 minutes  
**Solution:** Generate a new code

### Issue 4: "Code not found"

**Cause:** Code doesn't exist in database  
**Solution:** Check database connection, generate new code

### Issue 5: "Already consumed"

**Cause:** Code was already used  
**Solution:** Generate a new code (each code is single-use)

---

## 🎯 Expected Behavior (After Setup)

1. User generates code: `MS-DWJC`
2. User types `MS-DWJC` (or `ms-dwjc` or `my code is MS-DWJC`) in Kick chat
3. **Immediate response in chat** (via bot): "✅ Account linked! You're now earning coins."
4. **Page auto-updates** (polling detects the link)
5. User sees their Kick username on the profile page

---

## 📞 Still Not Working?

### Check Railway Logs:

```bash
railway logs --tail
```

### Check Database:

```sql
-- Check if code exists
SELECT * FROM verification_codes WHERE code = 'MS-DWJC';

-- Check if user has Kick link
SELECT k.* FROM kick_links k
JOIN users u ON k.user_id = u.id
WHERE u.discord_id = 'YOUR_DISCORD_ID';
```

### Test Webhook Locally:

1. **Run ngrok** (to expose localhost):

   ```bash
   ngrok http 3000
   ```

2. **Use ngrok URL** in Kick webhook temporarily:

   ```
   https://abc123.ngrok.io/api/kick/webhook
   ```

3. **Test locally** with real Kick chat messages

---

## 🔧 Want a Temporary Solution?

While webhooks are being set up, I can create:

1. **Manual Admin Link Tool** - Admin can manually link accounts
2. **API Key-based Verification** - Use Kick API directly to verify
3. **Test Mode** - Bypass verification for testing

Let me know if you want any of these!

---

## 📚 Related Documentation

- `README.md` - Section "Kick webhooks"
- `app/api/kick/webhook/route.ts` - Webhook handler code
- `lib/kick.ts` - Verification code finder

---

## ✅ Summary

**The core issue:** Kick webhooks are not configured yet.

**Quick fix:** Set up webhook in Kick Developer Portal (Steps 1-4 above)

**Time needed:** ~10 minutes

**Once done:** Verification will work automatically and instantly! 🎉
