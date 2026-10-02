const { getDevice } = require('../lib/store');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId || deviceId.length < 8) {
      return res.status(400).json({ error: 'deviceId required' });
    }

    const dev = await getDevice(deviceId);
    const now = Date.now();
    if (!dev || !dev.expiresAt || dev.expiresAt <= now) {
      return res.status(200).json({ active: false, expiresAt: 0, planId: null });
    }

    return res.status(200).json({
      active: true,
      planId: dev.planId,
      expiresAt: dev.expiresAt,
      daysLeft: Math.ceil((dev.expiresAt - now) / (24 * 60 * 60 * 1000)),
    });
  } catch (e) {
    console.error('status error', e);
    return res.status(500).json({ error: e.message || 'Status failed' });
  }
};
