const { SOURCES, fetchUpstream, extractItemList, normalizeItem, interleave } = require('./_lib/shared');

// Otakudesu cuma punya ongoing/completed di dokumentasi endpoint;
// movie & upcoming cuma ada di Kuramanime.
const KRM_PATH = {
  ongoing: (p) => `/ongoing?page=${p}`,
  completed: (p) => `/completed?page=${p}`,
  movie: (p) => `/movie?page=${p}`,
  upcoming: (p) => `/upcoming?page=${p}`,
};
const OTD_PATH = {
  ongoing: (p) => `/ongoing?page=${p}`,
  completed: (p) => `/completed?page=${p}`,
};

module.exports = async (req, res) => {
  const type = String(req.query.type || 'ongoing');
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);

  const jobs = [];
  jobs.push(
    KRM_PATH[type]
      ? fetchUpstream(SOURCES.krm.base + KRM_PATH[type](page))
          .then((j) => extractItemList(j).map((o) => normalizeItem(o, 'krm')))
          .catch(() => [])
      : Promise.resolve([])
  );
  jobs.push(
    OTD_PATH[type]
      ? fetchUpstream(SOURCES.otd.base + OTD_PATH[type](page))
          .then((j) => extractItemList(j).map((o) => normalizeItem(o, 'otd')))
          .catch(() => [])
      : Promise.resolve([])
  );

  const [krmItems, otdItems] = await Promise.all(jobs);
  const items = interleave(krmItems, otdItems);

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  res.status(200).json({ type, page, items });
};
