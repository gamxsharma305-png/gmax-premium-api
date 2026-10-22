/**
 * Referral system
 * - Each device gets a short referral code (GMAX-XXXX)
 * - Friend enters code once → referrer gets +1 freeGeneration
 * - freeGeneration = 7 days premium unlock when redeemed
 *
 * Redis keys:
 *   refcode:{CODE} → deviceId of owner
 *   device:{id} fields: referralCode, freeGens, referralCount, referredBy
 */

const { getDevice, setDevice, hasUpstash } = require('./store');

const FREE_GEN_DAYS = 7;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const memCodes = new Map(); // code → deviceId (dev fallback)

async function redis(command, args = []) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Redis ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.result;
}

async function getCodeOwner(code) {
  const key = `refcode:${code}`;
  if (hasUpstash()) {
    const raw = await redis('GET', [key]);
    return raw ? String(raw) : null;
  }
  return memCodes.get(code) || null;
}

async function setCodeOwner(code, deviceId) {
  const key = `refcode:${code}`;
  if (hasUpstash()) {
    await redis('SET', [key, deviceId]);
    return;
  }
  memCodes.set(code, deviceId);
}

function makeCode() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `GMAX-${s}`;
}

function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^GMAX/, 'GMAX');
}

async function ensureReferralCode(deviceId) {
  const id = String(deviceId || '').trim().slice(0, 64);
  if (!id || id.length < 8) throw new Error('deviceId required');

  let dev = (await getDevice(id)) || { deviceId: id };
  if (dev.referralCode) {
    return {
      code: dev.referralCode,
      freeGens: Number(dev.freeGens) || 0,
      referralCount: Number(dev.referralCount) || 0,
      referredBy: dev.referredBy || null,
      shareUrl: shareUrlFor(dev.referralCode),
    };
  }

  let code = makeCode();
  for (let i = 0; i < 8; i++) {
    const owner = await getCodeOwner(code);
    if (!owner) break;
    code = makeCode();
  }
  await setCodeOwner(code, id);
  dev = {
    ...dev,
    deviceId: id,
    referralCode: code,
    freeGens: Number(dev.freeGens) || 0,
    referralCount: Number(dev.referralCount) || 0,
  };
  await setDevice(id, dev);

  return {
    code,
    freeGens: dev.freeGens,
    referralCount: dev.referralCount,
    referredBy: dev.referredBy || null,
    shareUrl: shareUrlFor(code),
  };
}

function shareUrlFor(code) {
  const base =
    process.env.REFERRAL_SHARE_BASE ||
    'https://gmaxmusify.edgeone.dev/';
  const clean = base.replace(/\/$/, '');
  return `${clean}?ref=${encodeURIComponent(code)}`;
}

/**
 * Friend claims a referral code.
 * - Friend can only claim once (referredBy set)
 * - Cannot claim own code
 * - Referrer gets +1 freeGens
 */
async function claimReferral(friendDeviceId, rawCode) {
  const friendId = String(friendDeviceId || '').trim().slice(0, 64);
  const code = normalizeCode(rawCode);

  if (!friendId || friendId.length < 8) {
    return { ok: false, error: 'deviceId required' };
  }
  if (!code || code.length < 8) {
    return { ok: false, error: 'Valid referral code daalo (GMAX-XXXXXX)' };
  }

  const referrerId = await getCodeOwner(code);
  if (!referrerId) {
    return { ok: false, error: 'Invalid referral code' };
  }
  if (referrerId === friendId) {
    return { ok: false, error: 'Apna code use nahi kar sakte' };
  }

  let friend = (await getDevice(friendId)) || { deviceId: friendId };
  if (friend.referredBy) {
    return {
      ok: false,
      error: 'Is device pe pehle se referral lag chuka hai',
      alreadyReferred: true,
    };
  }

  // Mark friend
  friend = {
    ...friend,
    deviceId: friendId,
    referredBy: referrerId,
    referredAt: Date.now(),
    referredCode: code,
  };
  await setDevice(friendId, friend);

  // Credit referrer
  let referrer = (await getDevice(referrerId)) || { deviceId: referrerId };
  const freeGens = (Number(referrer.freeGens) || 0) + 1;
  const referralCount = (Number(referrer.referralCount) || 0) + 1;
  referrer = {
    ...referrer,
    deviceId: referrerId,
    freeGens,
    referralCount,
  };
  await setDevice(referrerId, referrer);

  return {
    ok: true,
    message: 'Referral success! Friend linked.',
    referrerFreeGens: freeGens,
  };
}

/**
 * Redeem 1 free generation → +7 days premium on this device.
 */
async function useFreeGeneration(deviceId) {
  const id = String(deviceId || '').trim().slice(0, 64);
  if (!id || id.length < 8) {
    return { ok: false, error: 'deviceId required' };
  }

  let dev = (await getDevice(id)) || { deviceId: id };
  const freeGens = Number(dev.freeGens) || 0;
  if (freeGens < 1) {
    return { ok: false, error: 'Koi free generation nahi bachi. Dost ko refer karo.' };
  }

  const now = Date.now();
  const base = Math.max(now, Number(dev.expiresAt) || 0);
  const expiresAt = base + FREE_GEN_DAYS * 24 * 60 * 60 * 1000;

  dev = {
    ...dev,
    deviceId: id,
    freeGens: freeGens - 1,
    planId: dev.planId || 'monthly',
    expiresAt,
    activatedAt: now,
    lastFreeGenAt: now,
  };
  await setDevice(id, dev);

  return {
    ok: true,
    active: true,
    planId: dev.planId,
    expiresAt,
    days: FREE_GEN_DAYS,
    freeGensLeft: dev.freeGens,
    label: `${FREE_GEN_DAYS} days free (referral)`,
  };
}

module.exports = {
  ensureReferralCode,
  claimReferral,
  useFreeGeneration,
  FREE_GEN_DAYS,
};
