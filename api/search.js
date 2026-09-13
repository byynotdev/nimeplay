const { SOURCES, fetchUpstream, extractItemList, normalizeItem, interleave } = require('./_lib/shared');

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(200).json({ items: [] });

  const [otdResult, krmResult] = await Promise.allSettled([
    fetchUpstream(SOURCES.otd.base + '/search?q=' + encodeURIComponent(q)),
    // Kuramanime belum punya endpoint search khusus -> ambil /list lalu filter di sini
    fetchUpstream(SOURCES.krm.base + '/list?page=1'),
  ]);

  const otdItems = otdResult.status === 'fulfilled' ? extractItemList(otdResult.value).map((o) => normalizeItem(o, 'otd')) : [];
  let krmItems = [];
  if (krmResult.status === 'fulfilled') {
    krmItems = extractItemList(krmResult.value)
      .map((o) => normalizeItem(o, 'krm'))
      .filter((i) => i.title.toLowerCase().includes(q.toLowerCase()));
  }

  res.status(200).json({ items: interleave(otdItems, krmItems) });
};
