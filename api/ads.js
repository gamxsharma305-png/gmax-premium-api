/**
 * GET /api/ads — home ads only
 */
const data = require('../lib/remote-config-data');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const ads = data.ads || {};
  const items = Array.isArray(ads.items)
    ? ads.items.filter((a) => a && a.enabled !== false).slice(0, Number(ads.maxAds) || 2)
    : [];
  res.status(200).json({
    enabled: !!ads.enabled && items.length > 0,
    delaySeconds: Number(ads.delaySeconds) >= 0 ? Number(ads.delaySeconds) : 10,
    maxAds: Math.min(2, Number(ads.maxAds) || 2),
    skipAfterRatio: typeof ads.skipAfterRatio === 'number' ? ads.skipAfterRatio : 0.5,
    oncePerDay: ads.oncePerDay !== false,
    items,
  });
};
