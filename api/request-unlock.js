const { getDevice, setDevice, setPaymentClaim, getPaymentClaim } = require('../lib/store');
const { PLANS } = require('../lib/plans');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * User ne Payment Link se pay kar liya, lekin Live API keys nahi hain.
 * Yeh endpoint sirf "pending" request banata hai.
 * Owner admin page se approve karega (Razorpay dashboard dekh kar).
 */
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const deviceId = String(body.deviceId || '').trim();
    const planId = body.planId === 'bimonthly' ? 'bimonthly' : 'monthly';
    const paymentRef = String(body.paymentRef || body.paymentId || '').trim().slice(0, 80);
    const note = String(body.note || '').trim().slice(0, 120);

    if (!deviceId || deviceId.length < 8) {
      return res.status(400).json({ error: 'deviceId required' });
    }

    const plan = PLANS.find((p) => p.id === planId) || PLANS[0];
    const now = Date.now();

    const existing = await getDevice(deviceId);
    if (existing && existing.expiresAt > now && existing.active !== false) {
      return res.status(200).json({
        ok: true,
        status: 'active',
        expiresAt: existing.expiresAt,
        planId: existing.planId,
      });
    }

    const pending = {
      deviceId,
      planId: plan.id,
      paymentRef: paymentRef || null,
      note: note || null,
      status: 'pending',
      requestedAt: now,
      amountPaise: plan.amountPaise,
      days: plan.days,
    };

    await setDevice(deviceId, {
      ...pending,
      active: false,
      expiresAt: 0,
    });

    // list key for admin
    const listKey = `pending:${deviceId}`;
    await setPaymentClaim(listKey, pending);
    if (paymentRef) {
      await setPaymentClaim(`ref:${paymentRef}`, { deviceId, planId: plan.id, requestedAt: now });
    }

    return res.status(200).json({
      ok: true,
      status: 'pending',
      message:
        'Request saved. Owner will confirm payment on Razorpay dashboard and approve. Then tap Check status in app.',
      planId: plan.id,
    });
  } catch (e) {
    console.error('request-unlock', e);
    return res.status(500).json({ error: e.message || 'Failed' });
  }
};
