// Konfigurasi & helper yang dipakai semua endpoint di /api.
// Kalau ShivraAPI ubah struktur field, cukup sesuaikan fungsi normalisasi di sini.

const SOURCES = {
  krm: { key: 'krm', name: 'Kuramanime', base: 'https://shivraapi.my.id/krm' },
  otd: { key: 'otd', name: 'Otakudesu', base: 'https://shivraapi.my.id/otd' },
};

async function fetchUpstream(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} dari ${url}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function pick(obj, keys, fallback = '') {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function looksLikeAnimeItem(o) {
  return (
    o &&
    typeof o === 'object' &&
    !Array.isArray(o) &&
    (o.title || o.judul || o.name || o.anime_title || o.nama)
  );
}

function deepFindArray(obj, predicate, depth = 0, seen = new Set()) {
  if (depth > 5 || obj == null || typeof obj !== 'object') return null;
  if (seen.has(obj)) return null;
  seen.add(obj);
  if (Array.isArray(obj)) {
    if (obj.length && predicate(obj[0])) return obj;
    for (const item of obj) {
      const found = deepFindArray(item, predicate, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }
  for (const k of Object.keys(obj)) {
    const found = deepFindArray(obj[k], predicate, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function extractItemList(json) {
  return deepFindArray(json, looksLikeAnimeItem) || [];
}

function normalizeItem(o, source) {
  const title = pick(o, ['title', 'judul', 'name', 'anime_title', 'nama']);
  const image = pick(o, ['poster', 'image', 'thumbnail', 'cover', 'poster_url', 'thumb', 'gambar', 'cover_image']);
  let slug = pick(o, ['slug', 'anime_slug']);
  if (!slug) {
    const link = pick(o, ['link', 'url']);
    if (link) {
      const parts = String(link).split('/').filter(Boolean);
      slug = parts[parts.length - 1];
    }
  }
  if (!slug) slug = slugify(title);
  const episode = pick(o, ['current_episode', 'episode', 'latest_episode', 'total_episode', 'eps']);
  const status = pick(o, ['status', 'type']);
  const score = pick(o, ['score', 'rating', 'nilai']);
  return { title, image, slug, episode, status, score, source };
}

function interleave(...lists) {
  const out = [];
  const len = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < len; i++) {
    for (const l of lists) if (l[i]) out.push(l[i]);
  }
  return out;
}

module.exports = {
  SOURCES,
  fetchUpstream,
  pick,
  slugify,
  looksLikeAnimeItem,
  deepFindArray,
  extractItemList,
  normalizeItem,
  interleave,
};
