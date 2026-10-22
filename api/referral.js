const {
  ensureReferralCode,
  claimReferral,
  useFreeGeneration,
  FREE_GEN_DAYS,
} = require('../lib/referral');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // GET — my code + stats
    if (req.method === 'GET') {
      const deviceId = String(req.query.deviceId || '').trim();
      if (!deviceId || deviceId.length < 8) {
        return res.status(400).json({ error: 'deviceId required' });
      }
      const data = await ensureReferralCode(deviceId);
      return res.status(200).json({
        ok: true,
        ...data,
        freeGenDays: FREE_GEN_DAYS,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'GET or POST only' });
    }

    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const action = String(body.action || '').toLowerCase();
    const deviceId = String(body.deviceId || '').trim();

    if (!deviceId || deviceId.length < 8) {
      return res.status(400).json({ error: 'deviceId required' });
    }

    // Claim friend's code
    if (action === 'claim') {
      const result = await claimReferral(deviceId, body.code);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      // Also ensure friend has their own code
      const me = await ensureReferralCode(deviceId);
      return res.status(200).json({ ...result, me });
    }

    // Use 1 free generation → premium days
    if (action === 'use' || action === 'redeem') {
      const result = await useFreeGeneration(deviceId);
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.status(200).json(result);
    }

    // Default POST without action = ensure code (same as GET)
    const data = await ensureReferralCode(deviceId);
    return res.status(200).json({
      ok: true,
      ...data,
      freeGenDays: FREE_GEN_DAYS,
    });
  } catch (e) {
    console.error('referral error', e);
    return res.status(500).json({ error: e.message || 'Referral failed' });
  }
};
