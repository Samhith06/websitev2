# ⚡ Quick Fix: Kick Verification Not Working

## 🎯 The Problem

You're typing the verification code in Kick chat but your account isn't getting linked.

## 🔧 The Solution (5 Minutes)

### **Step 1: Set Up Kick Webhook** (⏱️ 2 min)

1. **Go to Kick Developer Portal:**
   - Visit: https://kick.com/settings/developer
   - Sign in as mattyspinss

2. **Create Webhook:**
   - Click "Create Webhook" or "Add Webhook"
   - **URL:** `https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook`
   - **Events:** Select `chat.message.sent` (required!)
   - Also select: `livestream.status.updated`, `channel.subscription.new`
   - Click "Create"

3. **Copy Public Key:**
   - Kick will show you a "Webhook Public Key"
   - Copy the ENTIRE key (including BEGIN/END lines):
   ```
   -----BEGIN PUBLIC KEY-----
   MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
   -----END PUBLIC KEY-----
   ```

---

### **Step 2: Add Public Key to Railway** (⏱️ 2 min)

1. **Go to Railway Dashboard:**
   - Visit: https://railway.app
   - Click your project: "miraculous-wholeness"
   - Click service: "mattyspins-web"

2. **Add Environment Variable:**
   - Click "Variables" tab
   - Click "Add Variable" or "New Variable"
   - **Name:** `KICK_WEBHOOK_PUBLIC_KEY`
   - **Value:** Paste the entire public key
   - Click "Add"

3. **Wait for Redeploy:**
   - Railway automatically redeploys (takes ~2 minutes)
   - Watch for "Build succeeded" notification

---

### **Step 3: Test It** (⏱️ 1 min)

1. **Generate Code:**
   - Go to: https://mattyspins-web-production-75f8.up.railway.app/me
   - Sign in with Discord if needed
   - Click "Generate my code"
   - Copy the code (e.g., `MS-DWJC`)

2. **Type in Kick Chat:**
   - Go to https://kick.com/mattyspinss
   - Type the code: `MS-DWJC`
   - Press Enter

3. **Check Result:**
   - Profile page should auto-update within 5 seconds
   - Shows "✅ Verified" and your Kick username

---

## ✅ Verification Checklist

Before typing the code, ensure:

- [ ] Signed in with Discord on the website
- [ ] Generated a fresh verification code (< 10 min old)
- [ ] Kick webhook is created in Developer Portal
- [ ] `KICK_WEBHOOK_PUBLIC_KEY` is set in Railway
- [ ] Railway has finished redeploying (check status)

Then:

- [ ] Type code in mattyspinss's Kick chat
- [ ] Code format is exactly `MS-XXXX`
- [ ] Wait 5 seconds for page to update
- [ ] See "Verified ✅" status

---

## 🐛 If It Still Doesn't Work

### **Check Railway Logs:**

```bash
railway logs --tail
```

**Type a message in Kick chat**, then look for:

**✅ Working:**

```
[kick] chat.message.sent
[kick] linked mattyspinss to user 123
```

**❌ Not Working:**

- No logs → Webhook not configured
- "signature failed" → Wrong public key
- "code not found" → Code expired or wrong format

---

## 🎬 Visual Guide

### What to Copy from Kick:

```
Kick Developer Portal
└── Webhooks
    └── Your Webhook
        └── Public Key: [Copy This Entire Block]
            -----BEGIN PUBLIC KEY-----
            MIIBIjANBgkqhkiG9w0BAQ...
            (multiple lines)
            ...xyz123==
            -----END PUBLIC KEY-----
```

### Where to Paste in Railway:

```
Railway Dashboard
└── mattyspins-web
    └── Variables Tab
        └── [+ New Variable]
            Name:  KICK_WEBHOOK_PUBLIC_KEY
            Value: [Paste Entire Key Here]
```

---

## 🎯 Common Mistakes

### ❌ Wrong Webhook URL

```
Wrong: https://mattyspins-web-production-75f8.up.railway.app/api/kick/webhook/
                                                                               ↑ no trailing slash!
```

### ❌ Missing Event Subscription

```
Make sure "chat.message.sent" is checked in Kick webhook settings!
```

### ❌ Partial Public Key

```
Wrong: MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
Right: -----BEGIN PUBLIC KEY-----
       MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
       -----END PUBLIC KEY-----
```

### ❌ Using Old Code

```
Codes expire after 10 minutes!
Generate a fresh one if needed.
```

---

## 🚀 After It Works

Once verification works, you can:

1. **Start earning coins** by chatting (when stream is live)
2. **See your balance** on profile page
3. **Spend coins** in the shop
4. **Track earnings** in the ledger

---

## 📚 Need More Help?

- **Full Setup Guide:** [KICK_WEBHOOK_SETUP.md](./KICK_WEBHOOK_SETUP.md)
- **Detailed Troubleshooting:** [KICK_VERIFICATION_TROUBLESHOOTING.md](./KICK_VERIFICATION_TROUBLESHOOTING.md)
- **Check Railway Logs:** `railway logs`

---

**TL;DR:**

1. Create Kick webhook → `chat.message.sent` event
2. Copy public key → Add to Railway as `KICK_WEBHOOK_PUBLIC_KEY`
3. Generate code → Type in Kick chat → Done! ✅
