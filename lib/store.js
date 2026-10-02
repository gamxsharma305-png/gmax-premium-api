/**
 * Persistent store via Upstash Redis REST (free tier).
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * Without them, falls back to process memory (dev only — resets on cold start).
 */

const mem = {
  devices: new Map(),
  payments: new Map(),
};

function hasUpstash() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

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

async function getJson(key) {
  if (hasUpstash()) {
    const raw = await redis('GET', [key]);
    if (raw == null) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }
  if (key.startsWith('device:')) return mem.devices.get(key) || null;
  if (key.startsWith('payment:')) return mem.payments.get(key) || null;
  return null;
}

async function setJson(key, value) {
  const payload = JSON.stringify(value);
  if (hasUpstash()) {
    await redis('SET', [key, payload]);
    return;
  }
  if (key.startsWith('device:')) mem.devices.set(key, value);
  if (key.startsWith('payment:')) mem.payments.set(key, value);
}

async function getDevice(deviceId) {
  return getJson(`device:${deviceId}`);
}

async function setDevice(deviceId, data) {
  await setJson(`device:${deviceId}`, data);
}

async function getPaymentClaim(paymentId) {
  return getJson(`payment:${paymentId}`);
}

async function setPaymentClaim(paymentId, data) {
  await setJson(`payment:${paymentId}`, data);
}

module.exports = {
  hasUpstash,
  getDevice,
  setDevice,
  getPaymentClaim,
  setPaymentClaim,
};
