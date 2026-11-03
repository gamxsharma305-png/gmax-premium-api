/**
 * POST /api/verify
 * Body: { code, deviceId }
 * - one-time codes from /api/generate-code (Tools app)
 * - legacy device-bound HMAC codes
 * Success → 24h unlock
 */
const {
  getSecret,
  verifyCode,
  normalizeDeviceId,
  UNLOCK_MS,
  MAX_PER_WINDOW,
  WINDOW_MS,
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

async function redisGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.result;
  } catch {
    return null;
  }
}

async function redisSet(key, value, exSeconds) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const path = exSeconds
      ? `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${exSeconds}`
      : `/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
    const r = await fetch(`${url}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function redisDel(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const r = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
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

  const secret = getSecret();
  const body = await readBody(req);
  const code = String(body.code || '').replace(/\D/g, '');
  const deviceId = normalizeDeviceId(body.deviceId);

  if (!/^\d{12}$/.test(code)) {
    return res.status(400).json({ ok: false, error: '12-digit code required' });
  }
  if (!body.deviceId || deviceId.length < 4) {
    return res.status(400).json({ ok: false, error: 'deviceId required' });
  }

  const now = Date.now();
  let accepted = false;
  let mode = '';

  // 1) One-time code from Tools app
  const otcKey = `otc:${code}`;
  const otcRaw = await redisGet(otcKey);
  if (otcRaw) {
    try {
      const otc = typeof otcRaw === 'string' ? JSON.parse(otcRaw) : otcRaw;
      if (otc && otc.used) {
        return res.status(400).json({ ok: false, error: 'Code already used' });
      }
      accepted = true;
      mode = 'otc';
      await redisDel(otcKey);
    } catch {
      /* fall through to legacy */
    }
  }

  // 2) Legacy device-bound HMAC
  if (!accepted && secret) {
    const check = verifyCode(code, deviceId, secret, now);
    if (check.ok) {
      const usedKey = `arolinks:used:${code}`;
      const already = await redisGet(usedKey);
      if (already) {
        return res.status(400).json({ ok: false, error: 'Code already used' });
      }
      accepted = true;
      mode = 'device';
      await redisSet(usedKey, '1', Math.ceil(UNLOCK_MS / 1000) + 86400);
    }
  }

  if (!accepted) {
    return res.status(400).json({ ok: false, error: 'Invalid or expired code' });
  }

  const countKey = `arolinks:count:${deviceId}`;
  let stamps = [];
  try {
    const raw = await redisGet(countKey);
    if (raw) stamps = JSON.parse(raw);
    if (!Array.isArray(stamps)) stamps = [];
  } catch {
    stamps = [];
  }
  stamps = stamps.filter((t) => typeof t === 'number' && now - t < WINDOW_MS);
  if (stamps.length >= MAX_PER_WINDOW) {
    const oldest = Math.min(...stamps);
    const waitDays = Math.ceil((WINDOW_MS - (now - oldest)) / (24 * 60 * 60 * 1000));
    return res.status(429).json({
      ok: false,
      error: `Limit ${MAX_PER_WINDOW} codes / 7 days. Try in ~${waitDays} days`,
    });
  }

  stamps.push(now);
  await redisSet(countKey, JSON.stringify(stamps), Math.ceil(WINDOW_MS / 1000));

  const until = now + UNLOCK_MS;
  return res.status(200).json({
    ok: true,
    until,
    days: 1,
    hours: 24,
    plan: mode === 'otc' ? 'tools-otc' : 'arolinks',
  });
};
