# AGENTS.md

## JURNALISTIK APP — Panduan Engineering untuk Agent/Developer

Tujuan:

> Build a simple, secure, maintainable attendance platform for UKM Jurnalistik.

Dokumen ini mengatur **cara bekerja dan konvensi engineering**. Dokumen ini
**tidak** mendefinisikan aturan domain.

---

# 1. Sumber Kebenaran

| Pertanyaan | Rujukan |
|---|---|
| Apa yang harus dibangun? Status, alur, rumus, business rules | `PRD.md` |
| Bagaimana cara membangunnya? Konvensi, keamanan, testing, workflow | `AGENTS.md` (ini) |

Aturan:

1. **Jangan menulis ulang aturan domain di dokumen ini atau di kode
   tanpa merujuk PRD.** Rujuk dengan ID, mis. `BR-09`, `PRD §14.1`.
2. Jika PRD dan AGENTS.md berbeda, PRD menang untuk aturan produk dan
   AGENTS.md menang untuk aturan engineering. Laporkan perbedaannya.
3. Jika requirement ambigu dan memengaruhi data, authorization, atau
   security: jangan menebak secara berbahaya. Pilih default paling aman dan
   catat asumsi di deskripsi PR (atau `docs/DECISIONS.md`).
4. Baca `PRD.md` bagian terkait **sebelum** mengubah kode.

---

# 2. Struktur Repo dan Perintah

> Bagian ini berisi **contoh asumsi**. Sesuaikan dengan repo sebenarnya
> dan perbarui jika berubah. Agent wajib memakai perintah yang tercantum
> di sini, bukan menebak.

```text
apps/
├── api/        NestJS + Prisma
├── admin/      Next.js (Web Admin)
└── mobile/     Flutter
docs/           DECISIONS.md, API notes
PRD.md
AGENTS.md
```

```text
# Package manager: Bun (bukan pnpm/npm). Prisma via bin workspace:
# apps/api/node_modules/.bin/prisma <cmd> --schema apps/api/prisma/schema.prisma

# API
bun install
bun --filter api lint
bun --filter api test            # unit
bun --filter api test:e2e        # integration (butuh DATABASE_URL postgres)
bun --filter api build
bun --filter api prisma:migrate  # migrate dev (dari apps/api)
bun --filter api prisma:deploy
bun --filter api seed            # bun prisma/seed.ts

# Admin
bun --filter admin lint
bun --filter admin build
bun --filter admin dev           # :3102, butuh API_URL ke API :3000

# Mobile
flutter analyze
flutter test

# Database lokal
docker compose up -d db          # atau: initdb + pg_ctl manual (lihat DECISIONS)
```

Sebelum menyatakan pekerjaan selesai: lint, test, dan build untuk bagian
yang disentuh harus lulus.

---

# 3. Tech Stack

```text
Mobile      Flutter, Dart
Backend     NestJS, TypeScript, REST API
Database    PostgreSQL + Prisma
Storage     Cloudflare R2 (private bucket)
Admin       Next.js, React, TypeScript, Tailwind CSS
Notif       Firebase Cloud Messaging (P1)
Deploy      Docker, VPS, Caddy/Nginx, HTTPS
```

Arsitektur: backend monolith modular sebagai pusat business logic;
Flutter dan Next.js hanyalah client. Diagram ada di `PRD §20`.

---

# 4. Prinsip Utama: Client Tidak Dipercaya

Anggap seluruh client dapat dimodifikasi oleh attacker. Jangan percaya
`role`, `userId`, `status`, atau `timestamp` yang berasal dari client.

Backend yang menentukan: **siapa, apa, kapan, dan boleh atau tidak**.
Client hanya UI dan pengirim request. Jika aturan bisnis hanya ada di
frontend, user dapat melewatinya lewat pemanggilan API langsung.

---

# 5. Invariant Domain: Di Mana Dijaga

Aturan lengkap ada di PRD. Tabel ini hanya memastikan setiap invariant
**dijaga di level yang tepat** dan **punya test**.

| Invariant (PRD) | Dijaga di | Wajib ada test |
|---|---|---|
| BR-01 satu attendance per user per meeting | Unique constraint DB (`@@unique([userId, meetingId])`) + penanganan error 409 | duplicate attendance ditolak |
| BR-02/03 timestamp server, window | Service layer; waktu dari server | presensi di luar window ditolak; client timestamp diabaikan |
| BR-05 ownership | Guard + service (user id dari token, bukan body) | member tidak bisa bertindak atas nama orang lain |
| BR-07 approval atomik | `prisma.$transaction` (request + attendance + audit) | rollback jika salah satu gagal |
| BR-09 Auto Alpha idempotent | `INSERT ... ON CONFLICT DO NOTHING`; set `finalized_at` | dijalankan dua kali → tanpa duplikat |
| BR-11 persentase | **Satu fungsi** (mis. `AttendanceStatsService`) dipakai API, dashboard, dan export; status efektif dari konfigurasi | contoh PRD §14.1 menghasilkan 91,7% |
| BR-15 PRESENT menang | Service | approve atas PRESENT → 409; presensi membatalkan request PENDING |
| BR-17/13 manual + audit | Service + `AuditService` | penyesuaian tanpa alasan ditolak; audit tercatat |
| BR-19 histori terjaga | Soft delete / status `INACTIVE` | anggota nonaktif tidak dihapus dan tidak kena Alpha baru |
| BR-01 + ketahanan upload (`PRD §10`) | Client cek status sebelum retry; server tetap 409 pada duplikat | retry setelah timeout tidak membuat record ganda; 409 atas attendance sendiri diperlakukan sukses |
| BR-20 retensi file | Scheduled job; isi `*_deleted_at` setelah objek terhapus | job idempotent; objek terhapus, record tetap |
| BR-21 koreksi transparan | Field `adjusted_at`/`adjustment_reason` hanya pada respons riwayat milik sendiri | member melihat alasan koreksi miliknya, tidak milik orang lain |
| BR-22 bulk per item | Service memproses per item | satu item gagal tidak menggagalkan item lain; hasil dan audit per item |

Jangan menyalin logika perhitungan persentase ke tempat lain (UI, query
ad-hoc, export). Selalu panggil fungsi yang sama.

---

# 6. Authorization

-   Default endpoint adalah *deny*; setiap endpoint punya guard role
    eksplisit.
-   Cek kepemilikan di service: filter data berdasarkan `userId` dari
    token, bukan dari body/query.
-   Role: `MEMBER`, `OFFICER`, `ADMIN`. Matriks permission rinci mengikuti
    `PRD §4` dan `§6.4`.
-   Jangan menaruh pengecekan role hanya di UI.
-   Pusatkan keputusan akses di satu policy layer (mis.
    `can(user, action, resource)`) alih-alih `if role === ...` tersebar di
    controller, agar scope per divisi dapat ditambahkan nanti tanpa mengubah
    semua endpoint (`PRD §22.3`).

---

# 7. Authentication dan Secret

Detail kebijakan: `PRD §6`.

-   Gunakan library hashing modern (Argon2id/bcrypt); jangan membuat hashing
    sendiri.
-   Access token pendek, refresh token dirotasi, disimpan sebagai hash,
    dapat direvoke.
-   Secret hanya dari environment/secret manager.
-   Commit `.env.example` (placeholder saja); jangan commit `.env`.

```text
DATABASE_URL=
JWT_SECRET=
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
FCM_PROJECT_ID=
```

Jangan: `const jwtSecret = "super-secret";`

---

# 8. File Upload dan Storage

Semua file upload **untrusted**. Jangan percaya filename, extension, atau
Content-Type dari client. Aturan produk selfie: `PRD §10`.

Wajib:

-   Validasi MIME dari isi file (magic bytes), ukuran, dan extension.
-   Selfie: re-encode di server untuk membuang EXIF.
-   Generate object key sendiri; jangan pakai nama file asli.
-   Bucket private; akses sementara lewat signed URL berumur pendek.
-   Database menyimpan object key + metadata, bukan binary (`BYTEA`).
-   Selfie dan lampiran absence request memiliki retensi (`PRD §17`): hapus
    **objek di storage terlebih dahulu**, baru isi `selfie_deleted_at` /
    `attachment_deleted_at`. Jangan menghapus record-nya. Kode yang membuat
    signed URL harus menangani file yang sudah dihapus (kembalikan status
    "file sudah dihapus", bukan error 500).

```text
attendance/{year}/{month}/{uuid}.jpg
materials/{uuid}.pdf
submissions/{assignmentId}/{userId}/{uuid}.pdf
```

Jangan: `uploads/{username}.jpg`

---

# 9. Privacy dan Logging

Data anggota, selfie, alasan ketidakhadiran, dokumen, dan submission
adalah **private** (`PRD §17`).

-   Jangan expose selfie sebagai public URL atau sertakan di respons API
    jika tidak diperlukan.
-   Jangan kirim data pribadi lebih dari kebutuhan endpoint.
-   Jangan log: password, access/refresh token, isi file privat, detail
    alasan sensitif.
-   Boleh log: request penting, kegagalan autentikasi/otorisasi, event
    bisnis kritis, kegagalan background job dan storage.
-   Jangan commit data asli (selfie, dokumen, data user) ke git.

---

# 10. API

-   REST yang konsisten; nama endpoint menggambarkan resource.
-   Contoh:

```text
POST   /auth/login
POST   /auth/logout
GET    /meetings
POST   /meetings
POST   /meetings/:id/attendance
GET    /attendance/me
GET    /meetings/:id/attendance
POST   /meetings/:id/absence-requests
PATCH  /absence-requests/:id/approve
PATCH  /absence-requests/:id/reject
PATCH  /absence-requests/:id/cancel
PATCH  /attendance/:id/adjust        # penyesuaian manual (butuh alasan)
GET    /meetings/:id/attendance/me   # status presensi sendiri (dipakai sebelum retry)
POST   /meetings/:id/duplicate       # duplikasi kegiatan -> DRAFT baru
GET    /audit-logs?actor=&from=&to=&action=&page=&limit=
POST   /absence-requests/bulk-approve   # P1; hasil per item
```

-   Hindari `/doEverything`, `/processData`, `/updateStuff`.
-   **Validasi runtime** untuk semua input (UUID, enum, panjang string,
    tanggal, ukuran/tipe file, pagination, filter) memakai mekanisme
    validasi NestJS secara konsisten. Type TypeScript saja bukan validasi.
-   **Pagination wajib** untuk endpoint yang bisa mengembalikan banyak
    data (`?page=1&limit=20`, batas maksimum `limit`).
-   **Error:** format konsisten. Produksi tidak membocorkan stack trace,
    SQL, path internal, secret, atau detail infrastruktur.
-   **Rate limiting** pada login, upload, dan endpoint sensitif. **CORS**
    memakai allowlist eksplisit.
-   **Search dan sort** dilakukan di server. Kolom sort hanya dari
    allowlist; jangan meneruskan string sort dari client langsung ke
    `orderBy` atau query mentah. Pencarian memakai query berparameter.
-   **Bulk endpoint** mengembalikan hasil per item
    (`[{ id, status: "ok" | "failed", reason? }]`), memakai batas jumlah item
    (default 100), dan memproses tiap item dengan otorisasi + transaksi +
    audit sendiri (`PRD §15.7`).

---

# 11. Database dan Waktu

-   Semua perubahan skema lewat migration; jangan mengubah DB produksi
    manual.
-   Foreign key jelas; unique constraint untuk invariant penting; index
    untuk kolom lookup/filter; `CHECK` untuk invariant waktu (`PRD §19`).
-   Gunakan transaction untuk operasi multi-langkah yang harus atomik
    (contoh: approve request = update request + upsert attendance + audit).
-   Timestamp disimpan **UTC**; frontend mengonversi ke `Asia/Jakarta`.
    Jangan memakai waktu device sebagai sumber kebenaran presensi.
-   Review file migration sebelum merge. Indeks partial-unique
    (`*_one_active*`, hanya ada di SQL migration) JANGAN di-DROP:
    `migrate dev` mengusulkannya karena tak ada di schema — tolak usulan itu.

---

# 12. Background Job dan Scheduler

Gunakan job untuk pekerjaan yang tidak harus memblokir request: Auto
Alpha, transisi status meeting, reminder, push notification, generate
laporan, pembersihan file sementara, serta penghapusan selfie dan lampiran
yang melewati retensi (`PRD §17`).

-   **Setiap job harus idempotent.** Menjalankan dua kali tidak boleh
    merusak atau menggandakan data. Jaga di level DB (unique constraint,
    `ON CONFLICT`), bukan hanya di kode.
-   Jika backend dijalankan lebih dari satu instance, cegah job berjalan
    ganda (mis. advisory lock PostgreSQL).
-   Kegagalan job dilog dan dapat dijalankan ulang dengan aman.

---

# 13. Audit Log

Minimal mencatat: `actor`, `action`, `entity`, `entity_id`, nilai lama,
nilai baru, `reason` (jika ada), `timestamp`. Daftar aktivitas yang wajib
diaudit: `PRD §16`.

-   Append-only; tidak memuat password/token/isi dokumen.
-   Penulisan audit berada dalam transaksi yang sama dengan perubahan
    yang diaudit.
-   Endpoint baca audit log mendukung filter aktor, rentang tanggal, jenis
    aksi, dan entity; selalu dipaginasi, diurutkan terbaru, dan hanya untuk
    role berwenang. Index sesuai `PRD §19`.

---

# 14. Mobile (Flutter)

-   Pisahkan `presentation`, `domain`, `data`; organisasi berbasis fitur
    (`features/auth|meetings|attendance|materials|assignments|profile`).
-   Hindari widget raksasa; jangan menaruh seluruh logic di widget.
-   Tidak ada business rule di mobile (window, status akhir, persentase
    berasal dari API).
-   Presensi: kamera langsung (bukan galeri), kompres sebelum upload,
    alur singkat: Home → Presensi → Kamera → Preview → Submit → Sukses.
    Jangan menambah form panjang pada alur presensi.
-   Token di secure storage.
-   **Ketahanan upload presensi** (`PRD §10`): simpan foto lokal sampai
    sukses; tampilkan progress, pesan error yang jelas, dan tombol coba
    lagi; set timeout eksplisit dan batasi retry otomatis; **sebelum mengulang
    request yang timeout, cek `GET /meetings/:id/attendance/me`**; 409 atas
    attendance milik sendiri = sukses. Jangan membuat antrean offline untuk
    presensi.
-   Riwayat menampilkan penanda "Dikoreksi pengurus" beserta alasan sesuai
    data API (`PRD §14.3`); jangan menampilkan nama pengurus.

---

# 15. Web Admin (Next.js)

-   Utamakan data table, filter, search, pagination, konfirmasi untuk
    aksi destruktif, dan indikator status yang jelas.
-   Cookie sesi `HttpOnly` + `Secure` + `SameSite` dengan perlindungan
    CSRF.
-   Export XLSX: escape sel yang diawali `=`, `+`, `-`, `@`.
-   Bangun halaman sesuai tahap di `PRD §24`; jangan membangun halaman yang
    belum dibutuhkan tahap berjalan.
-   Rekap: pencarian (nama/NIM) dan sorting lewat server dengan allowlist
    kolom; pagination.
-   Audit log: filter aktor, tanggal, dan jenis aksi (`PRD §16`).
-   Bulk action: konfirmasi dengan jumlah item dan tampilkan hasil per item
    (`PRD §15.7`).
-   Halaman konfigurasi (P1): tampilkan peringatan bahwa perubahan status
    efektif berlaku pada seluruh histori rekap (`PRD §15.8`).

---

# 16. UI/UX dan Accessibility

-   Sederhana, bersih, profesional, mobile-first, mudah dipahami
    mahasiswa; minimalkan langkah presensi.
-   Status visual konsisten dan tidak hanya mengandalkan warna (sertakan
    label/ikon):

```text
PRESENT → success      ABSENT (Alpha) → error
PENDING → warning      REJECTED → error
PERMITTED / SICK / DISPENSATION → netral/info
```

-   Teks mudah dibaca, touch target cukup, kontras baik, label untuk
    ikon, pesan error jelas.
-   Notifikasi harus actionable dan tidak spam. Bagus: "Tugas Fotografi
    deadline besok pukul 23:59." Kurang bagus: "Ada sesuatu yang perlu
    kamu lihat."

---

# 17. Testing

Minimal:

-   **Unit:** aturan attendance, Auto Alpha, permission, persentase,
    deadline.
-   **Integration:** login, buat meeting, presensi, absence request,
    approval, penyesuaian manual, Auto Alpha, metadata upload materi,
    submission tugas.
-   **Security:** member mengakses endpoint officer; member melihat
    attendance user lain; duplicate attendance; presensi di luar window;
    upload file invalid; akses file tanpa izin; client mengirim
    `role`/`userId`/`status` palsu.
-   Edge case approval (`PRD §11`): approve atas PRESENT (409), approve
    setelah Auto Alpha, request ulang setelah REJECTED, tarik request.
-   **Ketahanan presensi:** retry setelah timeout tidak menghasilkan record
    ganda, dan `GET /meetings/:id/attendance/me` mencerminkan record yang
    sudah masuk.
-   **Duplikasi kegiatan:** hasil berstatus `DRAFT`, tanpa attendance/request
    tersalin, validasi waktu tetap berlaku.
-   **Job retensi:** idempotent; objek dihapus sebelum `*_deleted_at` diisi;
    record tetap; signed URL untuk file terhapus ditangani dengan benar.
-   **Rekap dan audit:** search/sort berfungsi, nilai sort di luar allowlist
    ditolak; filter audit log sesuai aktor/tanggal/aksi dan terpaginasi.
-   **Riwayat member:** alasan koreksi hanya terlihat oleh pemiliknya.
-   **Bulk action (P1):** satu item gagal tidak menggagalkan yang lain, hasil
    per item benar, dan batas jumlah item ditegakkan.

Bug fix wajib menyertakan test yang mereproduksi bug.

---

# 18. Git, Branch, Dependency

**Commit** jelas, mis. `feat: add attendance submission`,
`fix: prevent duplicate attendance`, `test: add auto alpha tests`,
`docs: update PRD`. Hindari `update`, `fix`, `aaa`, `final2`.

**Jangan commit:** secret, password, private key, `.env` produksi, data
user, selfie asli, dokumen asli.

**Branch:** `main`, `develop`, `feature/*`, `fix/*`. Produksi hanya dari
branch yang sudah diverifikasi.

**Dependency baru:** cek apakah bisa dengan dependency yang ada, cek
maintenance, riwayat keamanan, dan lisensi; hindari library besar untuk
fungsi kecil.

---

# 19. Aksi Destruktif dan Integritas Data

-   Delete user/meeting/material/assignment memerlukan authorization,
    konfirmasi, audit log bila relevan, dan soft delete jika data masih
    dibutuhkan untuk histori.
-   Jangan hard-delete attendance history tanpa alasan kuat.
-   Anggota keluar → `status = INACTIVE`, bukan hapus record.
-   Jangan menghapus data historis yang dibutuhkan laporan.

---

# 20. Jangan Overengineering

Prioritaskan **Simple · Reliable · Secure · Maintainable**.

Jangan memperkenalkan microservices, event-driven kompleks, Kubernetes,
service mesh, CQRS, event sourcing, atau AI pipeline kecuali ada
kebutuhan nyata yang sudah disepakati. Jangan menambahkan Redis/cache
hanya demi "scalable". Monolith modular adalah default.

Struktur backend yang direkomendasikan (satu tanggung jawab per module;
jangan jadikan satu service tempat semua logic):

```text
src/
├── auth/  users/  meetings/  attendance/  absence-requests/
├── materials/  assignments/  submissions/  notifications/
├── audit/  storage/  common/  prisma/
```

Sebelum membuat entity baru, cek apakah kebutuhan dapat dipenuhi entity
yang ada.

Item di `PRD §22.3` (Backlog) **tidak dikerjakan** kecuali diminta secara
eksplisit.

---

# 21. Definition of Done

Sebuah fitur selesai jika:

```text
[ ] Requirement (bagian PRD terkait) dipahami
[ ] Migration/schema siap dan sudah direview
[ ] Backend selesai dengan authentication + authorization
[ ] Input validation + error handling
[ ] Duplicate/idempotency terlindungi (jika relevan)
[ ] Pagination (jika endpoint list)
[ ] Rate limiting & validasi file (jika relevan)
[ ] Tidak ada secret / kebocoran data sensitif di respons dan log
[ ] UI selesai, termasuk loading, empty, dan error state (jika ada UI)
[ ] Test relevan dibuat dan lulus; lint/build lulus
[ ] Audit log (jika aksi administratif)
[ ] Dokumentasi/PRD/DECISIONS diperbarui bila perlu
```

---

# 22. Workflow Agent

1.  Baca bagian `PRD.md` yang relevan dan pahami fitur.
2.  Inspect struktur repo dan implementasi existing; hindari logic ganda.
3.  Tentukan perubahan database/API/UI.
4.  Implementasikan perubahan **terkecil** yang memenuhi requirement.
5.  Jalankan formatter/linter dan test (§2).
6.  Review dampak keamanan dan migration.
7.  Perbarui dokumentasi; catat asumsi jika ada.

---

# 23. Prioritas Saat Terjadi Konflik

```text
1. Security
2. Data integrity
3. Product requirement
4. Maintainability
5. Developer convenience
```

Jangan mengorbankan security atau integrity demi implementasi yang lebih
cepat.

---

# 24. Filosofi Proyek

> **A simple operational platform for UKM Jurnalistik.**

Anggota mendapat pengalaman yang cepat dan mudah. Pengurus mendapat data
yang terstruktur. Sistem tetap sederhana, aman, dan mudah dikembangkan.
