const { SOURCES, fetchUpstream, pick, deepFindArray, extractItemList, normalizeItem, slugify, interleave } = require('./_lib/shared');

module.exports = async (req, res) => {
  const name = req.query.name ? String(req.query.name) : null;
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);

  if (!name) {
    const [krm, otd] = await Promise.allSettled([
      fetchUpstream(SOURCES.krm.base + '/genre?genre_type=all'),
      fetchUpstream(SOURCES.otd.base + '/genres'),
    ]);
    const map = new Map();
    const collect = (result) => {
      if (result.status !== 'fulfilled') return;
      const list = deepFindArray(result.value, (o) => o && (o.name || o.title || o.slug)) || [];
      for (const g of list) {
        const gName = pick(g, ['name', 'title'], '');
        if (!gName) continue;
        map.set(gName.toLowerCase(), gName);
      }
    };
    collect(krm);
    collect(otd);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ genres: [...map.values()].sort() });
  }

  // Genre detail: kedua sumber biasanya pakai slug bahasa Inggris sederhana
  // (mis. "action"), jadi kita coba slug dari nama yang sama di dua-duanya.
  const key = slugify(name);
  const [krm, otd] = await Promise.allSettled([
    fetchUpstream(SOURCES.krm.base + `/genre/${key}?page=${page}`),
    fetchUpstream(SOURCES.otd.base + `/genres/${key}?page=${page}`),
  ]);
  const krmItems = krm.status === 'fulfilled' ? extractItemList(krm.value).map((o) => normalizeItem(o, 'krm')) : [];
  const otdItems = otd.status === 'fulfilled' ? extractItemList(otd.value).map((o) => normalizeItem(o, 'otd')) : [];

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  res.status(200).json({ name, page, items: interleave(krmItems, otdItems) });
};
