const { verifyWebhookSignature } = require('../lib/razorpay');
const { planFromAmount } = require('../lib/plans');
const { getPaymentClaim, setPaymentClaim } = require('../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('POST only');

  try {
    // Vercel may parse JSON already — re-stringify for HMAC when needed
    const raw =
      typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (secret) {
      const ok = verifyWebhookSignature(raw, signature);
      if (!ok) {
        console.warn('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } else {
      console.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping signature check');
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventName = event?.event || '';

    // payment.captured | payment_link.paid
    let payment = null;
    if (eventName === 'payment.captured' && event.payload?.payment?.entity) {
      payment = event.payload.payment.entity;
    } else if (eventName === 'payment_link.paid') {
      payment =
        event.payload?.payment?.entity ||
        event.payload?.order?.entity ||
        null;
      // payment_link.paid often nests payment under payload.payment.entity
    }

    if (payment && payment.id) {
      const plan = planFromAmount(Number(payment.amount));
      if (plan) {
        const existing = await getPaymentClaim(payment.id);
        if (!existing) {
          // Mark payment as known-paid but unclaimed until device claims it
          await setPaymentClaim(payment.id, {
            deviceId: null,
            planId: plan.id,
            expiresAt: 0,
            paidAt: Date.now(),
            status: payment.status,
            amountPaise: Number(payment.amount),
            reserved: true,
          });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('webhook error', e);
    // Still 200 so Razorpay does not retry forever on our bugs for non-critical path
    return res.status(200).json({ received: true, error: e.message });
  }
};
