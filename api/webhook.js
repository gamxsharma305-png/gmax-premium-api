const { verifyWebhookSignature } = require('../lib/razorpay');
const { planFromAmount } = require('../lib/plans');
const { getPaymentClaim, setPaymentClaim } = require('../lib/store');

function pickPayment(event) {
  const name = event?.event || '';
  const p = event?.payload || {};

  if (name === 'payment.captured' && p.payment?.entity) return p.payment.entity;

  if (name === 'payment_link.paid') {
    if (p.payment?.entity?.id) return p.payment.entity;
    if (p.payment_link?.entity) {
      // sometimes amount on link; id may be on nested payment
      const link = p.payment_link.entity;
      if (p.payment?.entity) return p.payment.entity;
      return {
        id: link.order_id || link.id,
        amount: link.amount,
        status: 'captured',
      };
    }
  }

  // Fallback: any payload with payment entity
  if (p.payment?.entity?.id) return p.payment.entity;
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('POST only');

  try {
    const raw =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (secret) {
      const ok = verifyWebhookSignature(raw, signature);
      if (!ok) {
        console.warn('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } else {
      console.warn('RAZORPAY_WEBHOOK_SECRET not set — accepting webhook without verify');
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payment = pickPayment(event);

    if (payment && payment.id) {
      const amount = Number(payment.amount);
      const plan = planFromAmount(amount);
      if (plan) {
        const existing = await getPaymentClaim(payment.id);
        if (!existing || !existing.deviceId) {
          await setPaymentClaim(payment.id, {
            deviceId: existing?.deviceId || null,
            planId: plan.id,
            expiresAt: existing?.expiresAt || 0,
            paidAt: Date.now(),
            status: payment.status || 'captured',
            amountPaise: amount,
            reserved: true,
            event: event.event,
          });
          console.log('Marked paid', payment.id, plan.id);
        }
      } else {
        console.warn('Unknown amount', amount, payment.id);
      }
    } else {
      console.log('Webhook event (no payment entity)', event?.event);
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('webhook error', e);
    return res.status(200).json({ received: true, error: e.message });
  }
};
