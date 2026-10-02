const crypto = require('crypto');

function authHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing on server');
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return `Basic ${token}`;
}

/** Fetch payment from Razorpay — only server, uses Key Secret. */
async function fetchPayment(paymentId) {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader() },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.description || body.error?.code || res.statusText;
    const err = new Error(msg || 'Payment fetch failed');
    err.status = res.status;
    throw err;
  }
  return body;
}

/** Verify Razorpay webhook signature. */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

module.exports = { fetchPayment, verifyWebhookSignature, authHeader };
