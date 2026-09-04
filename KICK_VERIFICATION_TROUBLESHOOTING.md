# � Kick Verification Troubleshooting

## Quick Diagnosis

Run through these checks in order:

---

## ✅ Check 1: Are Webhooks Configured?

**Test:** Check Railway logs after typing in Kick chat

```bash
railway logs --tail
```

**Expected:** You should see `[kick]` messages

**Result:**

- ✅ **See logs** → Webhooks working, go to Check 2
- ❌ **No logs** → Webhooks NOT configured, see [KICK_WEBHOOK_SETUP.md](./KICK_WEBHOOK_SETUP.md)

---

## ✅ Check 2: Is KICK_WEBHOOK_PUBLIC_KEY Set?

**Test:** Check Railway environment variables

1. Go to https://railway.app
2. Your project → mattyspins-web → Variables
3. Look for `KICK_WEBHOOK_PUBLIC_KEY`

**Result:**

- ✅ **Variable exists** → Good, go to Check 3
- ❌ **Variable missing** → Add it from Kick Developer Portal

---

## ✅ Check 3: Is the Code Valid?

**Test:** Check the code on `/me` page

**Requirements:**

- ✅ Format: `MS-XXXX` (exactly 4 characters after MS-)
- ✅ Not expired (codes expire after 10 minutes)
- ✅ Not already used (codes are single-use)

**Solution:**

- Generate a fresh code
- Use it within 10 minutes
- Type it exactly as shown

---

## ✅ Check 4: Are You Typing in the Right Chat?

**Test:** Verify channel name

**Must type in:** mattyspinss's Kick chat
**Not in:** DMs, other channels, or Discord

---

## ✅ Check 5: Is Database Connected?

**Test:** Check Railway logs for database errors

```bash
railway logs --filter="database"
```

**Result:**

- ✅ **No errors** → Database working
- ❌ **Connection errors** → Check DATABASE_URL in Railway variables

---

## � Common Issues & Fixes

### Issue: "Webhook signature verification failed"

**Cause:** Public key not set correctly

**Fix:**

1. Go to Kick Developer Portal
2. Copy the PUBLIC KEY (entire thing including BEGIN/END)
3. In Railway: Variables → KICK_WEBHOOK_PUBLIC_KEY → Paste
4. Make sure no extra spaces
5. Redeploy: Railway does this automatically

**Test:**

```bash
railway logs --filter="signature"
```

---

### Issue: "Code not detected in chat message"

**Cause:** Code format wrong or expired

**Fix:**

1. Generate NEW code on `/me` page
2. Copy it exactly (e.g., `MS-DWJC`)
3. Type ONLY the code in Kick chat: `MS-DWJC`
4. Do it within 10 minutes

**Accepted formats:**

- ✅ `MS-DWJC`
- ✅ `my code is MS-DWJC`
- ✅ `ms-dwjc` (case insensitive)
- ❌ `!verify MS-DWJC` (! not needed)

---

### Issue: "Page not updating after typing code"

**Cause:** Page needs refresh or code already used

**Fix:**

1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Check Railway logs:
   ```bash
   railway logs --filter="linked"
   ```
3. If you see "linked mattyspinss to user X" → It worked!
4. If you see "code already used" → Generate new code

---

### Issue: "User not found" or "Account not created"

**Cause:** Haven't signed in with Discord yet

**Fix:**

1. Go to homepage
2. Click "Sign in with Discord"
3. Authorize the app
4. Go back to `/me`
5. Generate code
6. Type in Kick chat

---

### Issue: "Webhook endpoint not found (404)"

**Cause:** Railway deployment failed or URL wrong

**Fix:**

1. Check Railway status: `railway status`
2. Check deployment: `railway logs`
3. Verify webhook URL in Kick settings:
   ```
   https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook
   ```
4. No trailing slash!
5. HTTPS not HTTP

---

## 📋 Step-by-Step Verification Test

Follow this exact sequence:

### 1. **Sign in with Discord**

```
Go to: https://mattyspins-web-production-75f8.up.railway.app
Click: "Sign in with Discord"
Authorize the app
```

### 2. **Go to Profile Page**

```
Go to: https://mattyspins-web-production-75f8.up.railway.app/me
```

### 3. **Generate Code**

```
Click: "Generate my code"
See code appear: MS-XXXX
Copy the code
```

### 4. **Open Kick in Another Tab**

```
Go to: https://kick.com/mattyspinss
Open chat
```

### 5. **Type Code in Chat**

```
Type exactly: MS-XXXX (your actual code)
Press Enter
```

### 6. **Watch Profile Page**

```
Page should auto-update within 5 seconds
Status changes to: "Verified ✅"
Shows your Kick username
```

### 7. **Check Logs (If Not Working)**

```bash
railway logs --tail
```

Look for:

```
[kick] chat.message.sent
[kick] linked mattyspinss to user 123
```

---

## � Advanced Debugging

### Check If Webhook Endpoint Exists

```bash
curl -I https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook
```

**Expected:** `401 Unauthorized` or `503 Service Unavailable` (both are OK)
**Bad:** `404 Not Found` (means endpoint doesn't exist)

### Check Database Connection

```bash
curl https://mattyspins-web-production-75f8.up.railway.app/api/health
```

**Expected:** `{"ok": true, "database": "connected"}`
**Bad:** `{"ok": false, "database": "disconnected"}`

### Check Railway Service Status

```bash
railway status
```

**Expected:**

```
Project: miraculous-wholeness
Environment: production
Service: mattyspins-web
```

### View All Environment Variables

```bash
railway variables
```

**Should have:**

- `DATABASE_URL`
- `KICK_WEBHOOK_PUBLIC_KEY`
- `AUTH_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

---

## 🎯 Quick Fixes Checklist

- [ ] Signed in with Discord first
- [ ] Generated fresh code (< 10 min old)
- [ ] Typed code in mattyspinss's Kick chat
- [ ] Code format is MS-XXXX (4 chars)
- [ ] Webhooks configured in Kick Developer Portal
- [ ] KICK_WEBHOOK_PUBLIC_KEY set in Railway
- [ ] Railway service is running
- [ ] Database is connected
- [ ] Hard refreshed browser page
- [ ] Checked Railway logs for errors

---

## 📞 Still Not Working?

### Collect This Information:

1. **Railway logs:**

   ```bash
   railway logs --tail 100 > logs.txt
   ```

2. **Environment variables** (without revealing secrets):

   ```bash
   railway variables | grep "KICK"
   ```

3. **Browser console errors:**
   - Open DevTools (F12)
   - Go to Console tab
   - Copy any red errors

4. **Exact steps you followed**

5. **What you see vs what you expect**

---

## 🎉 Success Looks Like This

### In Railway Logs:

```
[kick] chat.message.sent received
[kick] code MS-DWJC from mattyspinss
[kick] linked mattyspinss to user 123
```

### On Profile Page:

```
✅ Verified
Kick: mattyspinss
Linked: 2 minutes ago
```

### In Database:

```sql
SELECT * FROM kick_links WHERE user_id = 123;
-- Shows row with kick_user_id and kick_username
```

---

## 📚 Related Guides

- **Full Webhook Setup:** [KICK_WEBHOOK_SETUP.md](./KICK_WEBHOOK_SETUP.md)
- **Deployment Info:** [DEPLOYMENT_SUCCESS.md](./DEPLOYMENT_SUCCESS.md)
- **Auto Stream Detection:** [AUTOMATIC_STREAM_DETECTION.md](./AUTOMATIC_STREAM_DETECTION.md)

---

**Remember:** The most common issue is webhooks not being configured yet. Start there! 🎯
