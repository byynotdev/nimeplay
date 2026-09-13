const NAV_ITEMS = [
  { label: 'Beranda', hash: '#/home' },
  { label: 'Ongoing', hash: '#/list/ongoing' },
  { label: 'Completed', hash: '#/list/completed' },
  { label: 'Movie', hash: '#/list/movie' },
  { label: 'Jadwal', hash: '#/schedule' },
  { label: 'Genre', hash: '#/genre' },
];

const app = document.getElementById('app');

async function api(path) {
  const r = await fetch('/api/' + path, { headers: { Accept: 'application/json' } });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || 'Gagal memuat data (HTTP ' + r.status + ')');
  return json;
}

function loadingState(msg = 'Memuat data...') {
  return `<div class="state"><div class="spinner"></div><h3>${msg}</h3></div>`;
}
function errorState(msg) {
  return `<div class="state glass" style="padding:50px 24px;">
    <h3>Gagal memuat</h3>
    <p>${msg}. Coba lagi sebentar lagi — sumber data lain mungkin masih bisa dipakai.</p>
    <button class="btn ghost" onclick="router()">Coba lagi</button>
  </div>`;
}
function emptyState(msg) {
  return `<div class="state"><h3>Tidak ada data</h3><p>${msg}</p></div>`;
}
function cardHTML(item) {
  const safeTitle = (item.title || '?').replace(/'/g, '');
  const img = item.image
    ? `<img class="thumb" src="${item.image}" loading="lazy" onerror="this.outerHTML='<div class=&quot;thumb-fallback&quot;>${safeTitle}</div>'">`
    : `<div class="thumb-fallback">${safeTitle}</div>`;
  return `<a class="card" href="#/detail/${item.source}/${encodeURIComponent(item.slug)}">
    ${item.episode ? `<span class="badge ep">Ep ${item.episode}</span>` : item.status ? `<span class="badge">${item.status}</span>` : ''}
    <span class="src-dot">${item.source === 'otd' ? 'OTD' : 'KRM'}</span>
    ${img}
    <div class="info">
      <h3>${item.title || 'Tanpa judul'}</h3>
      <div class="meta"><span>${item.status || ''}</span><span>${item.score ? '★ ' + item.score : ''}</span></div>
    </div>
  </a>`;
}
function gridOrEmpty(items) {
  return items && items.length ? `<div class="grid">${items.map(cardHTML).join('')}</div>` : emptyState('Tidak ada data untuk ditampilkan.');
}
function debugBlock(json) {
  return `<details class="debug"><summary>Lihat respons mentah (debug)</summary><pre>${JSON.stringify(json, null, 2).replace(/</g, '&lt;')}</pre></details>`;
}

function renderNav() {
  const links = document.getElementById('navLinks');
  links.innerHTML = NAV_ITEMS.map((n) => `<a href="${n.hash}">${n.label}</a>`).join('');
  highlightActive();
}
function highlightActive() {
  const h = location.hash || '#/home';
  document.querySelectorAll('#navLinks a').forEach((a) => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', h === href || (href !== '#/home' && h.startsWith(href)));
  });
}

async function pageHome() {
  app.innerHTML = `
    <section class="hero glass">
      <h1>Streaming anime, tanpa drama.</h1>
      <p>Satu tempat buat mantau anime ongoing, cari judul lama, dan lanjut nonton dari episode terakhir — semua sumber digabung otomatis di belakang layar.</p>
      <form class="search-bar" id="heroSearch">
        <input type="text" placeholder="Cari judul anime..." id="heroSearchInput">
        <button class="btn" type="submit">Cari</button>
      </form>
    </section>
    <section class="block"><div class="block-head"><h2><span class="dot"></span>Ongoing</h2><a class="see-all" href="#/list/ongoing">Lihat semua →</a></div><div id="ongoingGrid">${loadingState()}</div></section>
    <section class="block"><div class="block-head"><h2><span class="dot"></span>Completed</h2><a class="see-all" href="#/list/completed">Lihat semua →</a></div><div id="completedGrid">${loadingState()}</div></section>
  `;
  document.getElementById('heroSearch').onsubmit = (e) => {
    e.preventDefault();
    const q = document.getElementById('heroSearchInput').value.trim();
    if (q) location.hash = '#/search/' + encodeURIComponent(q);
  };
  try {
    const data = await api('home');
    document.getElementById('ongoingGrid').innerHTML = gridOrEmpty(data.ongoing);
    document.getElementById('completedGrid').innerHTML = gridOrEmpty(data.completed);
  } catch (e) {
    document.getElementById('ongoingGrid').innerHTML = errorState(e.message);
    document.getElementById('completedGrid').innerHTML = '';
  }
}

async function pageList(type, page) {
  const titles = { ongoing: 'Ongoing', completed: 'Completed', movie: 'Movie', upcoming: 'Upcoming' };
  app.innerHTML = `
    <div class="block-head"><h2><span class="dot"></span>${titles[type] || type}</h2></div>
    <div id="listGrid">${loadingState()}</div>
    <div class="pager" id="pager"></div>
  `;
  try {
    const data = await api(`list?type=${type}&page=${page}`);
    document.getElementById('listGrid').innerHTML = gridOrEmpty(data.items);
    document.getElementById('pager').innerHTML = `
      ${page > 1 ? `<button class="btn ghost" onclick="location.hash='#/list/${type}/${page - 1}'">← Sebelumnya</button>` : ''}
      <button class="btn ghost" onclick="location.hash='#/list/${type}/${page + 1}'">Selanjutnya →</button>
    `;
  } catch (e) {
    document.getElementById('listGrid').innerHTML = errorState(e.message);
  }
}

async function pageSearch(query) {
  app.innerHTML = `
    <div class="block-head"><h2><span class="dot"></span>Hasil pencarian: "${query}"</h2></div>
    <div id="searchGrid">${loadingState()}</div>
  `;
  try {
    const data = await api(`search?q=${encodeURIComponent(query)}`);
    document.getElementById('searchGrid').innerHTML = data.items && data.items.length
      ? gridOrEmpty(data.items)
      : emptyState('Tidak ada judul yang cocok. Coba kata kunci lain.');
  } catch (e) {
    document.getElementById('searchGrid').innerHTML = errorState(e.message);
  }
}

async function pageDetail(source, slug) {
  app.innerHTML = loadingState('Memuat detail anime...');
  try {
    const d = await api(`detail?source=${source}&slug=${encodeURIComponent(slug)}`);
    const genreChips = (d.genres || []).map((g) => `<span class="chip">${g}</span>`).join('');
    app.innerHTML = `
      <div class="detail-hero glass">
        <div class="poster">${d.image ? `<img src="${d.image}" onerror="this.style.display='none'">` : ''}</div>
        <div class="detail-body">
          <h1>${d.title || 'Tanpa judul'}</h1>
          <div class="info-chips">
            ${d.status ? `<span class="chip">Status <b>${d.status}</b></span>` : ''}
            ${d.rating ? `<span class="chip">★ <b>${d.rating}</b></span>` : ''}
            ${d.totalEp ? `<span class="chip">Total Ep <b>${d.totalEp}</b></span>` : ''}
            ${d.studio ? `<span class="chip">Studio <b>${d.studio}</b></span>` : ''}
            ${d.released ? `<span class="chip">Rilis <b>${d.released}</b></span>` : ''}
            ${d.duration ? `<span class="chip">Durasi <b>${d.duration}</b></span>` : ''}
          </div>
          <p class="synopsis">${d.synopsis}</p>
          <div class="info-chips" style="margin-top:16px;">${genreChips}</div>
        </div>
      </div>
      <div class="block-head"><h2><span class="dot"></span>Episode</h2></div>
      <div id="epGrid">${
        d.episodes && d.episodes.length
          ? `<div class="ep-grid">${d.episodes
              .map((e) => `<a class="ep-item" href="#/episode/${source}/${encodeURIComponent(e.slug || '')}">Ep ${e.episode}</a>`)
              .join('')}</div>`
          : emptyState('Daftar episode tidak ditemukan di respons detail.')
      }</div>
      ${debugBlock(d)}
    `;
  } catch (e) {
    app.innerHTML = errorState(e.message);
  }
}

async function pageEpisode(source, slug) {
  app.innerHTML = loadingState('Memuat episode...');
  try {
    const d = await api(`episode?source=${source}&slug=${encodeURIComponent(slug)}`);
    const servers = d.servers || [];
    const firstUrl = servers[0] ? servers[0].url : '';
    app.innerHTML = `
      <div class="block-head"><h2><span class="dot"></span>${d.title}</h2></div>
      <div class="player-wrap" id="playerWrap">
        ${
          firstUrl
            ? `<iframe src="${firstUrl}" allowfullscreen referrerpolicy="no-referrer"></iframe>`
            : `<div class="placeholder">Link streaming tidak ditemukan di respons episode.<br>Cek panel debug di bawah untuk lihat field aslinya.</div>`
        }
      </div>
      ${
        servers.length > 1
          ? `<div class="servers" id="serverList">${servers
              .map((s, i) => `<button class="server-btn ${i === 0 ? 'active' : ''}" data-url="${s.url}">${s.label}</button>`)
              .join('')}</div>`
          : ''
      }
      <div class="ep-nav">
        ${d.prevSlug ? `<a class="btn ghost" href="#/episode/${source}/${encodeURIComponent(d.prevSlug)}">← Episode sebelumnya</a>` : '<span></span>'}
        ${d.nextSlug ? `<a class="btn ghost" href="#/episode/${source}/${encodeURIComponent(d.nextSlug)}">Episode selanjutnya →</a>` : '<span></span>'}
      </div>
      ${debugBlock(d)}
    `;
    const serverList = document.getElementById('serverList');
    if (serverList) {
      serverList.querySelectorAll('.server-btn').forEach((btn) => {
        btn.onclick = () => {
          serverList.querySelectorAll('.server-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('playerWrap').innerHTML = `<iframe src="${btn.dataset.url}" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
        };
      });
    }
  } catch (e) {
    app.innerHTML = errorState(e.message);
  }
}

async function pageSchedule() {
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const today = days[(new Date().getDay() + 6) % 7];
  app.innerHTML = `
    <div class="block-head"><h2><span class="dot"></span>Jadwal Tayang</h2></div>
    <div class="day-tabs" id="dayTabs">${days.map((d) => `<button data-day="${d}" class="${d === today ? 'active' : ''}">${d}</button>`).join('')}</div>
    <div id="schedGrid">${loadingState()}</div>
  `;
  async function loadDay(day) {
    document.getElementById('schedGrid').innerHTML = loadingState();
    try {
      const data = await api(`schedule?day=${encodeURIComponent(day)}`);
      document.getElementById('schedGrid').innerHTML = gridOrEmpty(data.items);
    } catch (e) {
      document.getElementById('schedGrid').innerHTML = errorState(e.message);
    }
  }
  document.querySelectorAll('#dayTabs button').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('#dayTabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadDay(btn.dataset.day);
    };
  });
  loadDay(today);
}

async function pageGenre(name, page) {
  if (!name) {
    app.innerHTML = `<div class="block-head"><h2><span class="dot"></span>Genre</h2></div><div id="genreCloud">${loadingState()}</div>`;
    try {
      const data = await api('genre');
      document.getElementById('genreCloud').innerHTML = data.genres && data.genres.length
        ? `<div class="genre-cloud">${data.genres.map((g) => `<a href="#/genre/${encodeURIComponent(g)}">${g}</a>`).join('')}</div>`
        : emptyState('Daftar genre tidak ditemukan.');
    } catch (e) {
      document.getElementById('genreCloud').innerHTML = errorState(e.message);
    }
    return;
  }
  app.innerHTML = `
    <div class="block-head"><h2><span class="dot"></span>Genre: ${name}</h2></div>
    <div id="genreGrid">${loadingState()}</div>
    <div class="pager" id="pager"></div>
  `;
  try {
    const data = await api(`genre?name=${encodeURIComponent(name)}&page=${page}`);
    document.getElementById('genreGrid').innerHTML = gridOrEmpty(data.items);
    document.getElementById('pager').innerHTML = `
      ${page > 1 ? `<button class="btn ghost" onclick="location.hash='#/genre/${encodeURIComponent(name)}/${page - 1}'">← Sebelumnya</button>` : ''}
      <button class="btn ghost" onclick="location.hash='#/genre/${encodeURIComponent(name)}/${page + 1}'">Selanjutnya →</button>
    `;
  } catch (e) {
    document.getElementById('genreGrid').innerHTML = errorState(e.message);
  }
}

function router() {
  window.scrollTo(0, 0);
  highlightActive();
  const parts = (location.hash || '#/home').replace(/^#\//, '').split('/').filter(Boolean);
  const [route, ...rest] = parts;

  if (!route || route === 'home') return pageHome();
  if (route === 'list') return pageList(rest[0] || 'ongoing', parseInt(rest[1] || '1', 10));
  if (route === 'search') return pageSearch(decodeURIComponent(rest[0] || ''));
  if (route === 'detail') return pageDetail(rest[0], decodeURIComponent(rest[1] || ''));
  if (route === 'episode') return pageEpisode(rest[0], decodeURIComponent(rest[1] || ''));
  if (route === 'schedule') return pageSchedule();
  if (route === 'genre') return pageGenre(rest[0] ? decodeURIComponent(rest[0]) : null, parseInt(rest[1] || '1', 10));

  app.innerHTML = emptyState('Halaman tidak ditemukan.');
}

window.addEventListener('hashchange', router);
renderNav();
router();
