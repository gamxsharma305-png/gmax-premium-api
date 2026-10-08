/**
 * POST /api/analytics  — app events (install, open, page, song_play)
 * GET  /api/analytics?days=14 — dashboard JSON
 */
const { recordEvent, getSummary } = require('../lib/analytics');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const list = Array.isArray(body.events) ? body.events : [body];
      const results = [];
      for (const ev of list.slice(0, 50)) {
        if (!ev || !ev.deviceId) continue;
        results.push(await recordEvent(ev));
      }
      res.status(200).json({ ok: true, count: results.length, results });
      return;
    }

    if (req.method === 'GET') {
      const days = Number(req.query?.days) || 14;
      const summary = await getSummary(days);
      res.status(200).json(summary);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Analytics error',
    });
  }
};
