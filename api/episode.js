const { SOURCES, fetchUpstream, pick, deepFindArray } = require('./_lib/shared');

module.exports = async (req, res) => {
  const source = String(req.query.source || '');
  const slug = String(req.query.slug || '');
  const cfg = SOURCES[source];
  if (!cfg || !slug) return res.status(400).json({ error: 'source dan slug wajib diisi' });

  try {
    const json = await fetchUpstream(cfg.base + `/episode/${slug}`);
    const d = json.data || json.result || json;
    const title = pick(d, ['title', 'judul', 'episode_title', 'anime_title', 'nama'], slug);

    let servers =
      deepFindArray(
        d,
        (o) => o && typeof o === 'object' && !Array.isArray(o) && (o.url || o.link || o.embed || o.iframe) && (o.server || o.name || o.title || o.quality)
      ) || [];
    servers = servers
      .map((s) => ({ label: pick(s, ['server', 'name', 'title', 'quality'], 'Server'), url: pick(s, ['url', 'link', 'embed', 'iframe']) }))
      .filter((s) => s.url);

    const directEmbed = pick(d, ['stream_url', 'embed_url', 'iframe', 'player', 'default_stream_url', 'video']);
    if (directEmbed && !servers.length) servers.push({ label: 'Default', url: directEmbed });

    const prevRaw = pick(d, ['previous_episode_slug', 'prev_episode_slug', 'prev']);
    const nextRaw = pick(d, ['next_episode_slug', 'next']);
    const prevSlug = typeof prevRaw === 'object' ? pick(prevRaw, ['slug']) : prevRaw;
    const nextSlug = typeof nextRaw === 'object' ? pick(nextRaw, ['slug']) : nextRaw;

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ source, title, servers, prevSlug, nextSlug, raw: d });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
