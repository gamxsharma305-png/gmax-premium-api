/**
 * Shared key crypto — device-bound / one-time codes.
 * Unlock duration: 24 hours. Max 3 verifications / 7 days.
 */
const crypto = require('crypto');

const UNLOCK_MS = 24 * 60 * 60 * 1000; // 24 hours
const BUCKET_MS = UNLOCK_MS;
const MAX_PER_WINDOW = 3;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CODE_TTL_SEC = 30 * 60; // generated code valid 30 min to enter

function getSecret() {
  return (
    process.env.KEY_SECRET ||
    process.env.AROLINKS_TOKEN ||
    ''
  );
}

function normalizeDeviceId(deviceId) {
  const raw = String(deviceId || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const sliced = raw.slice(0, 8);
  return sliced.padEnd(8, '0');
}

function currentBucket(now = Date.now()) {
  return Math.floor(now / BUCKET_MS);
}

/**
 * HMAC-SHA256 → exact 12-digit numeric code (legacy device-bound)
 */
function makeCode(deviceId, secret, bucket) {
  const deviceSafe = normalizeDeviceId(deviceId);
  const payload = `${deviceSafe}:${bucket}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  let digits = '';
  for (let i = 0; i < hmac.length && digits.length < 12; i++) {
    const ch = hmac[i];
    if (ch >= '0' && ch <= '9') digits += ch;
  }
  if (digits.length < 12) {
    for (let i = 0; i < hmac.length && digits.length < 12; i++) {
      const c = hmac.charCodeAt(i);
      if (c >= 97 && c <= 102) digits += String(c - 97);
      else if (c >= 65 && c <= 70) digits += String(c - 65);
    }
  }
  return digits.slice(0, 12).padStart(12, '0');
}

/** Random one-time 12-digit code for Tools → Music flow */
function makeRandomCode() {
  let s = '';
  while (s.length < 12) {
    s += crypto.randomInt(0, 10).toString();
  }
  return s;
}

function verifyCode(code, deviceId, secret, now = Date.now()) {
  const clean = String(code || '').replace(/\D/g, '');
  if (!/^\d{12}$/.test(clean)) return { ok: false, reason: 'format' };
  if (!secret) return { ok: false, reason: 'no_secret' };

  const bucket = currentBucket(now);
  for (const b of [bucket, bucket - 1]) {
    if (b < 0) continue;
    const expected = makeCode(deviceId, secret, b);
    if (expected === clean) return { ok: true, bucket: b, mode: 'device' };
  }
  return { ok: false, reason: 'mismatch' };
}

module.exports = {
  UNLOCK_MS,
  BUCKET_MS,
  MAX_PER_WINDOW,
  WINDOW_MS,
  CODE_TTL_SEC,
  getSecret,
  normalizeDeviceId,
  currentBucket,
  makeCode,
  makeRandomCode,
  verifyCode,
};
