# GMAX Premium API — **bina Live API Key / Secret**

Live API keys reject ho gaye? Theek hai.

**Payment Links** se paise lo + **Webhook** se server ko automatic notice — **Key Id / Key Secret ki zaroorat nahi**.

Webhook Secret ≠ API Key Secret. Yeh Webhook banate time Razorpay khud generate karta hai.

## Flow (automatic, no admin)

```text
User app me Pay → Razorpay Payment Link page
        ↓
Paise successful
        ↓
Razorpay → WEBHOOK → tumhara Vercel /api/webhook
        ↓
Server: yeh pay_… PAID mark
        ↓
App Payment ID bhejti hai /api/claim
        ↓
Server: webhook me paid hai? → Premium ON
```

Admin approve nahi. Manual nahi. Sirf Razorpay payment page + webhook.

## 1. Vercel deploy

1. https://vercel.com → Import `gamxsharma305-png/gmax-premium-api`
2. Deploy
3. URL note karo: `https://xxxxx.vercel.app`

## 2. Env (sirf yeh — API keys OPTIONAL)

| Name | Zaroori? | Kahan se |
|------|----------|----------|
| `RAZORPAY_WEBHOOK_SECRET` | Haan | Webhook create → Secret |
| `UPSTASH_REDIS_REST_URL` | Haan (prod) | upstash.com free Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Haan (prod) | Upstash |
| `RAZORPAY_KEY_ID` | Nahi | Skip if rejected |
| `RAZORPAY_KEY_SECRET` | Nahi | Skip if rejected |

Redeploy after env.

## 3. Razorpay Webhook (sabse important)

Dashboard login (jahan Payment Links hain):

1. **Account & Settings → Webhooks → Add**
2. URL:
   ```text
   https://YOUR-VERCEL-URL/api/webhook
   ```
3. Events:
   - `payment.captured`
   - `payment_link.paid`
4. **Secret** copy → Vercel `RAZORPAY_WEBHOOK_SECRET`
5. Active ON

Agar Webhooks menu hi nahi dikhta / create fail — account restrict ho sakta hai; tab bata dena.

## 4. Payment Link redirect

₹19 + ₹39 links pe Callback URL:

```text
https://YOUR-VERCEL-URL/payment-success.html
```

## 5. App

`src/services/PremiumApi.ts`:

```ts
export const PREMIUM_API_BASE = 'https://YOUR-VERCEL-URL';
```

## User steps

1. App → Pay ₹19/₹39 (Razorpay page)
2. Success
3. 5–20 sec wait (webhook aane do)
4. Payment ID (`pay_…`) → **Verify & Unlock**
5. Premium on

Agar turant claim pe error “WAIT_FOR_WEBHOOK” → 15 sec baad dubara Verify.

## Security

- Unlock tabhi jab **Razorpay webhook** ne payment paid mark kiya
- Fake `pay_` id se unlock nahi (webhook me entry nahi)
- Ek payment ek device
- Live API keys optional
