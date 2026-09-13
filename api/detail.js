const { SOURCES, fetchUpstream, pick, deepFindArray } = require('./_lib/shared');

module.exports = async (req, res) => {
  const source = String(req.query.source || '');
  const slug = String(req.query.slug || '');
  const cfg = SOURCES[source];
  if (!cfg || !slug) return res.status(400).json({ error: 'source dan slug wajib diisi' });

  const path = source === 'otd' ? `/anime/${slug}` : `/detail/${slug}`;
  try {
    const json = await fetchUpstream(cfg.base + path);
    const d = json.data || json.result || json;

    const title = pick(d, ['title', 'judul', 'name', 'anime_title', 'nama']);
    const image = pick(d, ['poster', 'image', 'thumbnail', 'cover', 'poster_url', 'thumb', 'cover_image']);
    const synopsis = pick(d, ['synopsis', 'sinopsis', 'description', 'deskripsi'], 'Sinopsis tidak tersedia.');
    const status = pick(d, ['status']);
    const rating = pick(d, ['score', 'rating', 'nilai']);
    const totalEp = pick(d, ['total_episode', 'episodes_count', 'episode_count']);
    const studio = pick(d, ['studio', 'producer', 'produser']);
    const released = pick(d, ['released', 'release_date', 'tanggal_rilis', 'aired']);
    const duration = pick(d, ['duration', 'durasi']);

    let genres = pick(d, ['genre', 'genres', 'genre_list'], []);
    if (!Array.isArray(genres)) genres = [];
    genres = genres.map((g) => (typeof g === 'string' ? g : g.name || g.title || '')).filter(Boolean);

    const episodeItems =
      deepFindArray(
        d,
        (o) =>
          o &&
          typeof o === 'object' &&
          !Array.isArray(o) &&
          (o.episode !== undefined || o.episode_number !== undefined || (o.slug && /episode|eps/i.test(JSON.stringify(o))))
      ) || [];

    const episodes = episodeItems.map((e) => {
      const epNum = pick(e, ['episode', 'episode_number', 'title', 'name'], '?');
      let epSlug = pick(e, ['slug']);
      if (!epSlug) {
        const link = pick(e, ['link', 'url']);
        if (link) {
          const p = String(link).split('/').filter(Boolean);
          epSlug = p[p.length - 1];
        }
      }
      return { episode: epNum, slug: epSlug };
    });

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({
      source,
      title,
      image,
      synopsis,
      status,
      rating,
      totalEp,
      studio,
      released,
      duration,
      genres,
      episodes,
      raw: d,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
