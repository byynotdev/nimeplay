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

// Bentuk umum di ShivraAPI Otakudesu: array grup per kualitas, tiap grup punya
// sub-array provider sendiri, mis:
// stream: [{ quality: "360p", providers: [{ provider: "mega", url: "..." }] }]
// Field sub-array & label provider namanya bisa beda-beda antar endpoint,
// makanya dicek beberapa kemungkinan nama.
const GROUP_QUALITY_KEYS = ['quality', 'resolution', 'label'];
const GROUP_SUBLIST_KEYS = ['providers', 'links', 'urls', 'mirror', 'servers'];
const PROVIDER_LABEL_KEYS = ['provider', 'server', 'name', 'title'];
const PROVIDER_URL_KEYS = ['url', 'link', 'embed', 'iframe'];

function findGroupSublist(item) {
  for (const k of GROUP_SUBLIST_KEYS) {
    if (Array.isArray(item[k]) && item[k].length) return item[k];
  }
  return null;
}

function looksLikeQualityGroupArray(arr) {
  return (
    Array.isArray(arr) &&
    arr.length > 0 &&
    arr.some((item) => item && typeof item === 'object' && pick(item, GROUP_QUALITY_KEYS) && findGroupSublist(item))
  );
}

function flattenQualityGroups(arr) {
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const quality = pick(item, GROUP_QUALITY_KEYS, '');
    const sublist = findGroupSublist(item) || [];
    for (const p of sublist) {
      if (!p || typeof p !== 'object') continue;
      const url = pick(p, PROVIDER_URL_KEYS);
      if (!url) continue;
      const providerName = pick(p, PROVIDER_LABEL_KEYS, 'Server');
      out.push({ label: quality ? `${providerName} ${quality}` : providerName, url });
    }
  }
  return out;
}

// Cari array bentuk "grup kualitas + provider" di key yang namanya masuk akal
// dulu (stream/streaming/servers), baru kalau tidak ada, telusuri seluruh
// object secara rekursif (tapi lewati "download"/"downloads" karena itu link
// unduhan, bukan buat player).
function extractGroupedServers(d) {
  if (!d || typeof d !== 'object') return [];
  const preferredKeys = ['stream', 'streaming', 'servers', 'server_list', 'video'];
  for (const key of preferredKeys) {
    if (looksLikeQualityGroupArray(d[key])) return flattenQualityGroups(d[key]);
  }
  function scan(obj, depth = 0, seen = new Set()) {
    if (depth > 6 || obj == null || typeof obj !== 'object' || seen.has(obj)) return null;
    seen.add(obj);
    if (Array.isArray(obj)) {
      if (looksLikeQualityGroupArray(obj)) return obj;
      for (const item of obj) {
        const found = scan(item, depth + 1, seen);
        if (found) return found;
      }
      return null;
    }
    for (const k of Object.keys(obj)) {
      if (/download/i.test(k)) continue;
      const found = scan(obj[k], depth + 1, seen);
      if (found) return found;
    }
    return null;
  }
  const found = scan(d);
  return found ? flattenQualityGroups(found) : [];
}

// Pola host embed/streaming yang umum dipakai situs anime (Otakudesu, Kuramanime, dll).
// Dipakai sebagai fallback kalau nama field JSON dari upstream tidak dikenali.
const EMBED_HOST_PATTERNS = [
  /mega\.nz/i,
  /vidhide/i,
  /vidguard/i,
  /kraken/i,
  /streamtape/i,
  /dailymotion/i,
  /mp4upload/i,
  /dood(stream)?\./i,
  /filemoon/i,
  /blogger\.com/i,
  /blogspot/i,
  /ok\.ru/i,
  /sbembed|streamsb/i,
  /wibufile/i,
  /pixeldrain/i,
  /gofile/i,
  /acefile/i,
  /uploadhaven/i,
  /desustream/i,
  /odstream/i,
  /playeriframe/i,
  /embed/i, // fallback generik: banyak upstream taruh kata "embed" di path-nya
  /\.m3u8(\?|$)/i,
  /\.mp4(\?|$)/i,
];

// Menelusuri seluruh object/array secara rekursif, kumpulkan setiap string yang:
// (a) terlihat seperti URL, dan
// (b) host/path-nya cocok salah satu pola embed di atas.
// Untuk tiap URL, key JSON tempat ia ditemukan dipakai sebagai label server
// (mis. "server_url" -> "Server Url"), supaya tombol server di UI tetap ada nama.
function deepFindEmbedUrls(obj, depth = 0, seen = new Set(), out = [], parentKey = '') {
  if (depth > 8 || obj == null) return out;
  if (typeof obj === 'string') {
    if (/^https?:\/\//i.test(obj) && EMBED_HOST_PATTERNS.some((re) => re.test(obj))) {
      out.push({ url: obj, keyHint: parentKey });
    }
    return out;
  }
  if (typeof obj !== 'object') return out;
  if (seen.has(obj)) return out;
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) deepFindEmbedUrls(item, depth + 1, seen, out, parentKey);
    return out;
  }
  for (const k of Object.keys(obj)) {
    deepFindEmbedUrls(obj[k], depth + 1, seen, out, k);
  }
  return out;
}

function humanizeKey(k) {
  return String(k || 'Server')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Ubah hasil deepFindEmbedUrls jadi format {label, url} siap pakai frontend,
// dedupe URL yang sama, dan kasih label berbeda kalau ada beberapa server.
function findServersFallback(d) {
  const found = deepFindEmbedUrls(d);
  const seenUrl = new Set();
  const servers = [];
  for (const { url, keyHint } of found) {
    if (seenUrl.has(url)) continue;
    seenUrl.add(url);
    let label = humanizeKey(keyHint);
    if (!label || /^(Url|Link|Embed|Iframe|Src)$/i.test(label)) {
      try {
        label = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        label = `Server ${servers.length + 1}`;
      }
    }
    servers.push({ label, url });
  }
  return servers;
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
  extractGroupedServers,
  findServersFallback,
};
