# Kagemusha (影武者)

Web game kartu multiplayer bergaya Coup, dibuat dengan HTML/CSS/JS + Firebase.

## Struktur file

```
index.html        -> splash/intro
login.html         -> registrasi & login (email+password, verifikasi email, reCAPTCHA)
home.html          -> menu utama (create/join room, public/private)
room.html          -> lobby, tunggu pemain, host start game
gameplay.html      -> board game utama
css/style.css      -> tema visual washi paper / shinobi
js/firebase-config.js -> koneksi Firebase (Auth, Firestore, Functions)
js/game-rules.js   -> konstanta role, aksi, deck
js/game.js         -> logic utama gameplay (state machine action/challenge/block)
functions/         -> Cloud Function verifikasi reCAPTCHA
firestore.rules    -> security rules Firestore
```

## Role & Aksi (mekanisme identik Coup, nama diganti)

| Role asli  | Nama di Kagemusha |
|------------|-------------------|
| Duke       | Daimyo            |
| Assassin   | Ronin             |
| Captain    | Kaizoku           |
| Ambassador | Kitsune           |
| Contessa   | Miko              |

Semua aksi (Income, Foreign Aid, Coup, Tax, Assassinate, Steal, Exchange) dan mekanisme challenge/block mengikuti rules Coup asli.

## Cara menjalankan

Karena semuanya file statis (HTML/CSS/JS module), bisa langsung dijalankan pakai local server, contoh:

```bash
cd kagemusha
python3 -m http.server 8080
# buka http://localhost:8080
```

**Penting**: harus lewat server (bukan buka file .html langsung / `file://`), karena pakai ES module (`import`/`export`).

## Setup Firebase yang masih perlu dilakukan

### 1. Deploy Firestore rules
Install Firebase CLI kalau belum ada:
```bash
npm install -g firebase-tools
firebase login
```
Di folder project:
```bash
firebase init firestore
# pilih project kagemusha-d1f45, pakai firestore.rules yang sudah ada
firebase deploy --only firestore:rules
```

### 2. Deploy Cloud Function verifikasi reCAPTCHA
```bash
cd functions
npm install
firebase functions:secrets:set RECAPTCHA_SECRET
# masukkan secret key: 6LdaPZ8tAAAAABMeF-fbo4-kTfvOggWjUIrpu6n4
cd ..
firebase deploy --only functions
```
Kalau langkah ini belum dilakukan, tombol "Daftar" di `login.html` akan gagal karena Cloud Function `verifyCaptcha` belum ada. Sebagai fallback sementara (development only, TIDAK aman untuk publish), bisa hapus pemanggilan `verifyCaptcha` di `login.html` dan langsung lanjut ke `createUserWithEmailAndPassword`.

### 3. Tambah domain ke reCAPTCHA
Saat sudah hosting di domain asli, tambahkan domainnya di [reCAPTCHA admin console](https://www.google.com/recaptcha/admin) (selain `localhost` yang sudah ada).

### 4. Hosting (opsional)
Bisa pakai Firebase Hosting, Netlify, atau Vercel — tinggal upload semua file (kecuali folder `functions`, itu dideploy terpisah via Firebase CLI).

## Deploy ke GitHub Pages

Karena semua file statis (HTML/CSS/JS module), GitHub Pages cukup buat hosting `index.html` s/d `gameplay.html` + `css/` + `js/` + `assets/` (folder `functions/` tetap dideploy terpisah lewat Firebase CLI, bukan lewat GitHub Pages).

1. Push repo ke GitHub, aktifkan **Settings → Pages → Deploy from branch** (pilih branch `main`, folder root)
2. URL live kamu bakal berbentuk: `https://<username>.github.io/<repo>/`
3. **WAJIB** tambahkan domain itu di 2 tempat, atau login/captcha gagal di versi live:
   - **Firebase Console → Authentication → Settings → Authorized domains** → tambah `<username>.github.io`
   - **reCAPTCHA Admin Console** (https://www.google.com/recaptcha/admin) → buka site key kamu → tambah domain `<username>.github.io`
4. Sebelum push, pastikan di `login.html`: `const DEV_MODE = false;` (sudah di-set default di versi ini) — supaya captcha & verifikasi Cloud Function aktif penuh.
5. Deploy Cloud Function `verifyCaptcha` dan Firestore rules dulu (lihat langkah di atas) SEBELUM push ke GitHub, karena begitu `DEV_MODE = false`, registrasi butuh Cloud Function itu untuk jalan.

## Mode testing lokal (sebelum deploy)

- **Captcha DEV_MODE**: di `login.html`, ada konstanta `const DEV_MODE = false;` (default versi ini). Kalau mau testing lokal cepat tanpa deploy Cloud Function dulu, boleh sementara ganti ke `true` (widget captcha akan disembunyikan & verifikasi server di-skip). **Pastikan balikin ke `false` sebelum push ke GitHub / publish**, supaya captcha benar-benar diverifikasi lewat `verifyCaptcha`.
- **Video intro**: `index.html` sudah siap load video dari `assets/intro.mp4`. Taruh file video kamu di situ dengan nama persis `intro.mp4`. Kalau file belum ada / gagal dimuat, otomatis fallback tampilan logo statis (tidak error/blank). Durasi splash sebelum auto-lanjut ke `login.html` diatur di `DURATION_MS` (default 3000ms / 3 detik), tombol "Lewati" selalu muncul dari awal.

## Batasan yang perlu diketahui (MVP, bukan production-grade)

- **Anti-cheat challenge/block bersifat client-trust**: pengecekan "punya kartu X atau tidak" dilakukan di device pemain yang diklaim (bukan di server), karena keterbatasan arsitektur tanpa backend kustom. Untuk main santai sama teman ini aman, tapi pemain yang niat curang secara teknis bisa modif kode di device sendiri. Kalau nanti mau dibikin server-authoritative penuh, semua logic aksi perlu dipindah ke Cloud Functions.
- **Belum ada reconnect handling** kalau koneksi putus di tengah giliran (pemain lain harus menunggu).
- **Belum ada limit waktu** per giliran/respons — pemain bisa menunggu tanpa batas kalau ada yang idle.
- Deck & state disimpan penuh di dokumen room (bukan dienkripsi), kecuali kartu privat tiap pemain yang disimpan di subcollection terpisah dengan rules baca terbatas ke pemiliknya.

## Ide pengembangan lanjutan
- Timer otomatis per fase respons (auto-pass kalau tidak merespons dalam N detik)
- Reconnect / kick pemain yang AFK
- Riwayat pertandingan & statistik menang-kalah di `users/{uid}`
- Ilustrasi kartu custom (SVG saat ini masih simpel, bisa di-upgrade ke ilustrasi penuh)
