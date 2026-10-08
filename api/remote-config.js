/**
 * GET /api/remote-config
 * Public — app fetches update + ads without rebuild.
 */
const data = require('../lib/remote-config-data');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const update = data.update || {};
  const ads = data.ads || {};
  const items = Array.isArray(ads.items)
    ? ads.items.filter((a) => a && a.enabled !== false).slice(0, Number(ads.maxAds) || 2)
    : [];

  res.status(200).json({
    ok: true,
    fetchedAt: Date.now(),
    update: {
      enabled: update.enabled !== false,
      version: update.version || '1.2.4',
      versionCode: Number(update.versionCode) || 0,
      buildId: update.buildId || '',
      apkUrl: update.apkUrl || '',
      force: !!update.force,
      notes: update.notes || '',
    },
    ads: {
      enabled: !!ads.enabled && items.length > 0,
      delaySeconds: Number(ads.delaySeconds) >= 0 ? Number(ads.delaySeconds) : 10,
      maxAds: Math.min(2, Number(ads.maxAds) || 2),
      skipAfterRatio:
        typeof ads.skipAfterRatio === 'number' ? ads.skipAfterRatio : 0.5,
      oncePerDay: ads.oncePerDay !== false,
      items,
    },
  });
};
