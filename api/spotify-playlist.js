/**
 * GET /api/spotify-playlist?id=PLAYLIST_ID
 * or ?url=https://open.spotify.com/playlist/...
 *
 * Returns { ok, name, description, cover, tracks: [{ title, artist, album, duration }] }
 *
 * Token priority:
 * 1) SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET (official client-credentials)
 * 2) Anonymous web-player token (best-effort, public playlists only)
 */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function extractId(q) {
  if (!q) return null;
  const s = String(q).trim();
  if (/^[0-9A-Za-z]{22}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('playlist');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].split('?')[0];
  } catch {
    /* ignore */
  }
  const m = s.match(/playlist[\/:\s]+([0-9A-Za-z]{22})/i);
  return m?.[1] || null;
}

async function tokenFromClientCredentials() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.access_token || null;
}

async function tokenAnonymous() {
  try {
    const res = await fetch(
      'https://open.spotify.com/get_access_token?reason=transport&productType=web_player',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j.accessToken || j.access_token || null;
  } catch {
    return null;
  }
}

async function getToken() {
  return (await tokenFromClientCredentials()) || (await tokenAnonymous());
}

async function fetchAllTracks(playlistId, token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers,
  });
  if (!metaRes.ok) {
    const errText = await metaRes.text().catch(() => '');
    throw new Error(`Spotify playlist ${metaRes.status}: ${errText.slice(0, 120)}`);
  }
  const meta = await metaRes.json();

  const tracks = [];
  let next = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  let pages = 0;
  while (next && pages < 20) {
    pages++;
    const r = await fetch(next, { headers });
    if (!r.ok) break;
    const body = await r.json();
    for (const item of body.items || []) {
      const t = item?.track;
      if (!t || t.is_local) continue;
      const artists = (t.artists || []).map((a) => a.name).filter(Boolean).join(', ');
      tracks.push({
        title: t.name || '',
        artist: artists || 'Unknown',
        album: t.album?.name || '',
        duration: Math.round((t.duration_ms || 0) / 1000),
        cover: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
      });
    }
    next = body.next || null;
  }

  return {
    name: meta.name || 'Spotify Playlist',
    description: meta.description || '',
    cover: meta.images?.[0]?.url || tracks[0]?.cover || '',
    tracks: tracks.filter((t) => t.title),
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const id = extractId(req.query.id || req.query.url || '');
  if (!id) {
    return res.status(400).json({
      ok: false,
      error: 'Valid Spotify playlist id or open.spotify.com/playlist/… url required',
    });
  }

  try {
    const token = await getToken();
    if (!token) {
      return res.status(503).json({
        ok: false,
        error:
          'Spotify token unavailable. Set SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET on Vercel, or retry later.',
      });
    }
    const data = await fetchAllTracks(id, token);
    return res.status(200).json({ ok: true, id, ...data });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: e instanceof Error ? e.message : 'Spotify fetch failed',
    });
  }
};
