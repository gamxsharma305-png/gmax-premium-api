# GMAX Premium API (Vercel)

Secure unlock: **Razorpay payment must be `captured`** before Premium activates. The app cannot unlock without a real `pay_…` id verified by this server.

Repo: https://github.com/gamxsharma305-png/gmax-premium-api

## Endpoints

| Endpoint | Use |
|----------|-----|
| `POST /api/claim` | `{ paymentId, deviceId }` → Razorpay verify + unlock |
| `GET /api/status?deviceId=` | Is this device premium? |
| `POST /api/webhook` | Razorpay webhooks |
| `/payment-success.html` | Redirect after pay |

## 1. Deploy on Vercel

1. Open [vercel.com](https://vercel.com) → **Add New Project**
2. Import **gamxsharma305-png/gmax-premium-api**
3. Deploy (Framework: Other, no build command)
4. Copy URL, e.g. `https://gmax-premium-api-xxxx.vercel.app`

## 2. Env variables (Vercel → Project → Settings → Environment Variables)

| Name | Where from |
|------|------------|
| `RAZORPAY_KEY_ID` | Razorpay → Account & Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Same (never put in Android app) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret (step 3) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token |

Save → **Redeploy**.

### Upstash free Redis

1. [console.upstash.com](https://console.upstash.com) → Create Redis database
2. **REST API** tab → copy URL + token → Vercel env

Without Upstash, data is in-memory only (lost on cold start). Production ke liye Upstash zaroori hai.

## 3. Razorpay Webhook

1. Razorpay Dashboard → **Account & Settings → Webhooks → Add**
2. URL: `https://YOUR-VERCEL-URL/api/webhook`
3. Active events: `payment.captured`, `payment_link.paid`
4. Secret copy → `RAZORPAY_WEBHOOK_SECRET`

## 4. Payment Link redirect (dono links)

₹19: https://rzp.io/rzp/CXGmrGhC  
₹39: https://rzp.io/rzp/bNWwvel

Edit each link → **Callback / Redirect URL**:

```text
https://YOUR-VERCEL-URL/payment-success.html
```

## 5. Android app

After deploy, put base URL in app (`PREMIUM_API_BASE`). User pays → enters `pay_…` → app calls `/api/claim` → unlock only if Razorpay says captured.

## Flow

```text
Pay on Razorpay → money captured
       ↓
App sends paymentId + deviceId to /api/claim
       ↓
Server calls Razorpay API with Key Secret
       ↓
status captured + amount ₹19/₹39 → bind device → Premium
```
