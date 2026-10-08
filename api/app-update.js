/**
 * GET /api/app-update — update block only (compat with update.json shape)
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
  const u = data.update || {};
  if (u.enabled === false) {
    res.status(200).json({
      version: u.version || '1.2.4',
      versionCode: Number(u.versionCode) || 39,
      buildId: u.buildId || '',
      apkUrl: '',
      force: false,
      notes: '',
    });
    return;
  }
  res.status(200).json({
    version: u.version || '1.2.4',
    versionCode: Number(u.versionCode) || 0,
    buildId: u.buildId || '',
    apkUrl: u.apkUrl || '',
    force: !!u.force,
    notes: u.notes || '',
  });
};
