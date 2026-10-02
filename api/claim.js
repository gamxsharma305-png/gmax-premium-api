const { fetchPayment, hasApiKeys } = require('../lib/razorpay');
const { planFromAmount, PLANS } = require('../lib/plans');
const { getPaymentClaim, setPaymentClaim, getDevice, setDevice } = require('../lib/store');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function planById(id) {
  return PLANS.find((p) => p.id === id) || null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const paymentId = String(body.paymentId || '').trim();
    const deviceId = String(body.deviceId || '').trim();

    if (!paymentId || !deviceId) {
      return res.status(400).json({ error: 'paymentId and deviceId required' });
    }
    if (paymentId.length < 8 || deviceId.length < 8) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const existingClaim = await getPaymentClaim(paymentId);

    // Already bound to a device
    if (existingClaim && existingClaim.deviceId) {
      if (existingClaim.deviceId === deviceId) {
        const dev = await getDevice(deviceId);
        return res.status(200).json({
          ok: true,
          alreadyClaimed: true,
          active: !!(dev && dev.expiresAt > Date.now()),
          planId: dev?.planId || existingClaim.planId,
          expiresAt: dev?.expiresAt || existingClaim.expiresAt,
        });
      }
      return res.status(409).json({ error: 'This payment was already claimed on another device' });
    }

    let plan = null;
    let amountPaise = 0;
    let source = '';

    // Path 1 (NO Live API keys): payment must already be marked paid by Razorpay WEBHOOK
    if (existingClaim && (existingClaim.reserved || existingClaim.paidAt || existingClaim.status)) {
      plan = planById(existingClaim.planId) || planFromAmount(existingClaim.amountPaise);
      amountPaise = existingClaim.amountPaise || plan?.amountPaise || 0;
      source = 'webhook';
    }

    // Path 2 (optional): if Live API keys exist later, verify directly with Razorpay
    if (!plan && hasApiKeys()) {
      try {
        const payment = await fetchPayment(paymentId);
        const status = String(payment.status || '').toLowerCase();
        if (status === 'captured' || status === 'authorized') {
          plan = planFromAmount(Number(payment.amount));
          amountPaise = Number(payment.amount);
          source = 'api';
        }
      } catch (e) {
        console.warn('API verify skipped/failed', e.message);
      }
    }

    if (!plan) {
      return res.status(402).json({
        error:
          'Payment abhi confirm nahi hua. 10–20 sec wait karke phir Verify dabao. ' +
          'Razorpay webhook ko payment pehle server tak bhejna chahiye (Live API keys ki zaroorat nahi).',
        code: 'WAIT_FOR_WEBHOOK',
      });
    }

    const now = Date.now();
    const prev = await getDevice(deviceId);
    const base = Math.max(now, prev?.expiresAt || 0);
    const expiresAt = base + plan.days * 24 * 60 * 60 * 1000;

    await setPaymentClaim(paymentId, {
      deviceId,
      planId: plan.id,
      expiresAt,
      claimedAt: now,
      amountPaise,
      source,
    });
    await setDevice(deviceId, {
      deviceId,
      planId: plan.id,
      expiresAt,
      paymentId,
      amountPaise,
      activatedAt: now,
    });

    return res.status(200).json({
      ok: true,
      active: true,
      planId: plan.id,
      expiresAt,
      days: plan.days,
      label: plan.label,
      source,
    });
  } catch (e) {
    console.error('claim error', e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return res.status(status).json({ error: e.message || 'Claim failed' });
  }
};
