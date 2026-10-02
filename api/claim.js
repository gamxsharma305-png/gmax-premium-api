const { fetchPayment } = require('../lib/razorpay');
const { planFromAmount } = require('../lib/plans');
const { getPaymentClaim, setPaymentClaim, getDevice, setDevice } = require('../lib/store');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

    // Already claimed by this or another device?
    const existingClaim = await getPaymentClaim(paymentId);
    if (existingClaim) {
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

    // Ask Razorpay (server has Key Secret) — only captured payments unlock
    const payment = await fetchPayment(paymentId);
    const status = String(payment.status || '').toLowerCase();
    if (status !== 'captured' && status !== 'authorized') {
      return res.status(402).json({
        error: `Payment not successful (status: ${status || 'unknown'})`,
      });
    }

    const amount = Number(payment.amount);
    const plan = planFromAmount(amount);
    if (!plan) {
      return res.status(400).json({
        error: `Unknown amount ${amount} paise. Expected 1900 (₹19) or 3900 (₹39).`,
      });
    }

    const now = Date.now();
    const prev = await getDevice(deviceId);
    const base = Math.max(now, prev?.expiresAt || 0);
    const expiresAt = base + plan.days * 24 * 60 * 60 * 1000;

    const entitlement = {
      deviceId,
      planId: plan.id,
      expiresAt,
      paymentId,
      amountPaise: amount,
      activatedAt: now,
    };

    await setPaymentClaim(paymentId, {
      deviceId,
      planId: plan.id,
      expiresAt,
      claimedAt: now,
    });
    await setDevice(deviceId, entitlement);

    return res.status(200).json({
      ok: true,
      active: true,
      planId: plan.id,
      expiresAt,
      days: plan.days,
      label: plan.label,
    });
  } catch (e) {
    console.error('claim error', e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return res.status(status).json({ error: e.message || 'Claim failed' });
  }
};
