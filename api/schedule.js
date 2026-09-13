const { SOURCES, fetchUpstream, extractItemList, normalizeItem, interleave } = require('./_lib/shared');

module.exports = async (req, res) => {
  const day = String(req.query.day || 'Senin');

  const [krm, otd] = await Promise.allSettled([
    fetchUpstream(SOURCES.krm.base + `/schedule?day=${encodeURIComponent(day)}`),
    fetchUpstream(SOURCES.otd.base + `/schedule?day=${encodeURIComponent(day)}`),
  ]);

  const krmItems = krm.status === 'fulfilled' ? extractItemList(krm.value).map((o) => normalizeItem(o, 'krm')) : [];
  const otdItems = otd.status === 'fulfilled' ? extractItemList(otd.value).map((o) => normalizeItem(o, 'otd')) : [];

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  res.status(200).json({ day, items: interleave(krmItems, otdItems) });
};
