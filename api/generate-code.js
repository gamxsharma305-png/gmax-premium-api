/**
 * POST /api/generate-code
 * Body: { deviceId?, source? }
 * Returns: { ok, code, hours: 24, expiresInSec }
 * One-time code stored in Redis; enter in Music app within 30 min.
 */
const {
  getSecret,
  makeRandomCode,
  CODE_TTL_SEC,
  UNLOCK_MS,
} = require('../lib/arolinks-key');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

async function redisSet(key, value, exSeconds) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const path = `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${exSeconds}`;
    const r = await fetch(`${url}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!getSecret() && !process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const body = await readBody(req);
  const source = String(body.source || 'tools').slice(0, 40);

  let code = makeRandomCode();
  const key = `otc:${code}`;
  const payload = JSON.stringify({
    createdAt: Date.now(),
    source,
    used: false,
  });

  const saved = await redisSet(key, payload, CODE_TTL_SEC);
  if (!saved) {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return res.status(500).json({
        ok: false,
        error: 'Redis not configured — cannot issue one-time codes',
      });
    }
    code = makeRandomCode();
    const ok2 = await redisSet(`otc:${code}`, payload, CODE_TTL_SEC);
    if (!ok2) {
      return res.status(502).json({ ok: false, error: 'Could not store code' });
    }
  }

  return res.status(200).json({
    ok: true,
    code,
    hours: 24,
    days: 1,
    expiresInSec: CODE_TTL_SEC,
    unlockMs: UNLOCK_MS,
    message: 'Enter this code in GMAX Music app within 30 minutes',
  });
};
