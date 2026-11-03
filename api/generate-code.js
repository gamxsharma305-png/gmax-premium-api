/**
 * POST /api/generate-code
 * Body: { deviceId?, source? }
 * Returns one-time 12-digit code for Music app (24h unlock).
 */
const crypto = require('crypto');

const CODE_TTL_SEC = 30 * 60;
const UNLOCK_MS = 24 * 60 * 60 * 1000;

function makeRandomCode() {
  let s = '';
  while (s.length < 12) {
    s += String(crypto.randomInt(0, 10));
  }
  return s;
}

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

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'Redis not configured — set UPSTASH_REDIS_REST_URL and TOKEN on Vercel',
    });
  }

  const body = await readBody(req);
  const source = String(body.source || 'tools').slice(0, 40);

  let code = makeRandomCode();
  const payload = JSON.stringify({
    createdAt: Date.now(),
    source,
    used: false,
  });

  let saved = await redisSet(`otc:${code}`, payload, CODE_TTL_SEC);
  if (!saved) {
    code = makeRandomCode();
    saved = await redisSet(`otc:${code}`, payload, CODE_TTL_SEC);
  }
  if (!saved) {
    return res.status(502).json({ ok: false, error: 'Could not store code in Redis' });
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
