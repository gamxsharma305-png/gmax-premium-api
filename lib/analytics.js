/**
 * App analytics — anonymous device + daily aggregates in Upstash Redis.
 * Keys:
 *   analytics:meta          → { totalDevices }
 *   analytics:device:{id}   → { firstSeen, lastSeen, version }
 *   analytics:day:{YYYY-MM-DD} → daily counters + unique device maps
 *
 * "Current installs" = active devices (opened app in last N days).
 * True uninstall count is impossible without Play Store / push death signals.
 */

const { hasUpstash } = require('./store');

const mem = {
  meta: { totalDevices: 0 },
  devices: new Map(),
  days: new Map(),
};

function todayIST() {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function dayOffsetIST(offsetDays) {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
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
  if (key === 'analytics:meta') return mem.meta;
  if (key.startsWith('analytics:device:')) return mem.devices.get(key) || null;
  if (key.startsWith('analytics:day:')) return mem.days.get(key) || null;
  return null;
}

async function setJson(key, value) {
  const payload = JSON.stringify(value);
  if (hasUpstash()) {
    await redis('SET', [key, payload]);
    return;
  }
  if (key === 'analytics:meta') mem.meta = value;
  else if (key.startsWith('analytics:device:')) mem.devices.set(key, value);
  else if (key.startsWith('analytics:day:')) mem.days.set(key, value);
}

function emptyDay() {
  return {
    installs: 0,
    opens: 0,
    songPlays: 0,
    uniqueOpenDevices: {},
    uniquePlayDevices: {},
    pages: {},
  };
}

function mergeIds(targetSet, map) {
  if (!map || typeof map !== 'object') return;
  for (const id of Object.keys(map)) {
    if (id) targetSet.add(id);
  }
}

async function recordEvent(ev) {
  const deviceId = String(ev.deviceId || '').trim().slice(0, 64);
  if (!deviceId) throw new Error('deviceId required');

  const type = String(ev.type || '').toLowerCase();
  const day = todayIST();
  const now = Date.now();

  const deviceKey = `analytics:device:${deviceId}`;
  let device = (await getJson(deviceKey)) || null;
  let isNew = false;

  if (!device) {
    isNew = true;
    device = {
      firstSeen: now,
      lastSeen: now,
      version: ev.version || '',
    };
    const meta = (await getJson('analytics:meta')) || { totalDevices: 0 };
    meta.totalDevices = (meta.totalDevices || 0) + 1;
    await setJson('analytics:meta', meta);
  } else {
    device.lastSeen = now;
    if (ev.version) device.version = String(ev.version).slice(0, 32);
  }
  await setJson(deviceKey, device);

  const dayKey = `analytics:day:${day}`;
  const dayData = (await getJson(dayKey)) || emptyDay();
  if (!dayData.uniqueOpenDevices) dayData.uniqueOpenDevices = {};
  if (!dayData.uniquePlayDevices) dayData.uniquePlayDevices = {};
  if (!dayData.pages) dayData.pages = {};

  if (type === 'install' || isNew) {
    dayData.installs = (dayData.installs || 0) + 1;
  }

  if (type === 'open' || type === 'install') {
    dayData.opens = (dayData.opens || 0) + 1;
    dayData.uniqueOpenDevices[deviceId] = 1;
  }

  if (type === 'page' && ev.page) {
    const page = String(ev.page).slice(0, 48);
    dayData.pages[page] = (dayData.pages[page] || 0) + 1;
  }

  if (type === 'song_play') {
    dayData.songPlays = (dayData.songPlays || 0) + 1;
    dayData.uniquePlayDevices[deviceId] = 1;
  }

  await setJson(dayKey, dayData);

  return { ok: true, isNew, day };
}

async function getSummary(days = 14) {
  const n = Math.min(60, Math.max(1, Number(days) || 14));
  // Always load enough history for active windows (30d)
  const fetchDays = Math.max(n, 30);
  const meta = (await getJson('analytics:meta')) || { totalDevices: 0 };
  const today = todayIST();

  const open1 = new Set();
  const open7 = new Set();
  const open30 = new Set();
  const play1 = new Set();
  const play7 = new Set();
  const play30 = new Set();

  const allDays = [];
  for (let i = fetchDays - 1; i >= 0; i--) {
    const d = dayOffsetIST(-i);
    const raw = (await getJson(`analytics:day:${d}`)) || emptyDay();
    const daysAgo = i;

    if (daysAgo === 0) {
      mergeIds(open1, raw.uniqueOpenDevices);
      mergeIds(play1, raw.uniquePlayDevices);
    }
    if (daysAgo <= 6) {
      mergeIds(open7, raw.uniqueOpenDevices);
      mergeIds(play7, raw.uniquePlayDevices);
    }
    if (daysAgo <= 29) {
      mergeIds(open30, raw.uniqueOpenDevices);
      mergeIds(play30, raw.uniquePlayDevices);
    }

    allDays.push({ date: d, raw, daysAgo });
  }

  // series only for requested n days (most recent n)
  const recent = allDays.slice(allDays.length - n);
  const series = recent.map(({ date, raw }) => ({
    date,
    installs: raw.installs || 0,
    opens: raw.opens || 0,
    songPlays: raw.songPlays || 0,
    uniqueOpens: Object.keys(raw.uniqueOpenDevices || {}).length,
    uniquePlays: Object.keys(raw.uniquePlayDevices || {}).length,
    pages: raw.pages || {},
  }));

  const todayRow = series.find((r) => r.date === today) || {
    date: today,
    installs: 0,
    opens: 0,
    songPlays: 0,
    uniqueOpens: 0,
    uniquePlays: 0,
    pages: {},
  };

  const pagesAll = {};
  for (const row of series) {
    for (const [p, c] of Object.entries(row.pages || {})) {
      pagesAll[p] = (pagesAll[p] || 0) + c;
    }
  }

  return {
    ok: true,
    timezone: 'Asia/Kolkata',
    totalDevices: meta.totalDevices || 0,
    /** Approx "still installed" — unique devices that opened app recently */
    active: {
      today: open1.size,
      d7: open7.size,
      d30: open30.size,
    },
    /** True unique persons who played at least one song */
    uniquePlayers: {
      today: play1.size,
      d7: play7.size,
      d30: play30.size,
    },
    today: todayRow,
    series,
    pagesAll,
    generatedAt: Date.now(),
  };
}

module.exports = {
  recordEvent,
  getSummary,
  todayIST,
};
