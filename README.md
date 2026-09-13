# nimeplay

Web nonton anime. Frontend statis (`public/`) + backend serverless
(`api/`) jadi satu project Vercel, jadi tidak butuh server terpisah
dan tidak kena masalah CORS — semua request ke API pihak ketiga
dilakukan di sisi server (`/api/*`), lalu digabung jadi satu feed.

Tidak ada pilihan "sumber" yang ditampilkan ke pengguna: setiap
endpoint di `/api` sudah menggabungkan data dari Kuramanime dan
Otakudesu secara otomatis (via ShivraAPI). Setiap anime tetap
menyimpan sumber aslinya di belakang layar (dipakai untuk memuat
detail & episode yang benar), tapi pengguna cuma lihat satu daftar.

## Struktur

```
api/
  _lib/shared.js   -> konfigurasi endpoint + helper normalisasi data (diimpor, bukan endpoint)
  home.js          -> GET /api/home            -> { ongoing, completed }
  list.js          -> GET /api/list?type=&page=-> { items }   (type: ongoing|completed|movie|upcoming)
  search.js        -> GET /api/search?q=       -> { items }
  detail.js        -> GET /api/detail?source=&slug= -> detail anime + daftar episode
  episode.js       -> GET /api/episode?source=&slug= -> judul, server streaming, prev/next
  schedule.js      -> GET /api/schedule?day=   -> { items }
  genre.js         -> GET /api/genre (list) atau /api/genre?name=&page= (detail)
public/
  index.html       -> shell halaman
  style.css        -> tema glassmorphism
  app.js           -> SPA (routing pakai hash, semua data dari /api/*)
```

## Deploy ke Vercel

1. Push folder ini ke repo GitHub baru.
2. Buka vercel.com -> **Add New Project** -> import repo tadi.
3. Framework preset: **Other**. Tidak perlu build command atau output
   directory khusus — Vercel otomatis mendeteksi `api/` sebagai
   serverless functions dan `public/` sebagai static output.
4. Klik **Deploy**.

## Coba lokal

```
npm i -g vercel   # kalau belum ada
vercel dev
```

Ini menjalankan frontend dan API sekaligus di `http://localhost:3000`,
persis seperti di production.

## Catatan penting

- **Field API pihak ketiga ditebak secara defensif.** Fungsi
  `normalizeItem`, `pick`, dan `deepFindArray` di `api/_lib/shared.js`
  mencoba beberapa nama field umum (`title`/`judul`/`name`,
  `poster`/`image`/`thumbnail`, dst). Kalau kartu atau detail muncul
  kosong/aneh setelah dites live, buka panel **"Lihat respons mentah
  (debug)"** di halaman detail/episode untuk lihat nama field asli,
  lalu sesuaikan `pick(...)` di file API yang relevan
  (`detail.js`, `episode.js`, dll).
- **Genre gabungan** dicocokkan lewat slug hasil dari nama genre yang
  sama di kedua sumber (mis. "Action" -> `action`). Kalau slug di
  salah satu sumber ternyata beda formatnya, genre itu cuma akan
  menampilkan hasil dari sumber yang cocok saja.
- **Kuramanime belum punya endpoint search** di dokumentasi yang ada,
  jadi pencarian untuk sumber itu memfilter dari `/list` halaman 1 di
  sisi server — kalau judulnya ada di halaman berikutnya, dia tidak
  akan ketemu. Bisa ditingkatkan nanti dengan mengambil beberapa
  halaman sekaligus.
- Untuk penggunaan pribadi/edukasi.
