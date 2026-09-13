const { SOURCES, fetchUpstream, extractItemList, normalizeItem, interleave } = require('./_lib/shared');

module.exports = async (req, res) => {
  const [krm, otd] = await Promise.allSettled([
    fetchUpstream(SOURCES.krm.base + '/home'),
    fetchUpstream(SOURCES.otd.base + '/home'),
  ]);

  const errors = [];
  const krmItems = krm.status === 'fulfilled' ? extractItemList(krm.value).map((o) => normalizeItem(o, 'krm')) : [];
  const otdItems = otd.status === 'fulfilled' ? extractItemList(otd.value).map((o) => normalizeItem(o, 'otd')) : [];
  if (krm.status === 'rejected') errors.push('krm: ' + krm.reason.message);
  if (otd.status === 'rejected') errors.push('otd: ' + otd.reason.message);

  const all = interleave(krmItems, otdItems);
  const ongoing = all.filter((i) => /ongoing|airing/i.test(i.status));
  const completed = all.filter((i) => /completed|selesai|tamat/i.test(i.status));
  const rest = all.filter((i) => !ongoing.includes(i) && !completed.includes(i));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  res.status(200).json({
    ongoing: (ongoing.length ? ongoing : rest).slice(0, 24),
    completed: completed.slice(0, 24),
    errors,
  });
};
