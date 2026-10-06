# PRD — JURNALISTIK APP

## 1. Informasi Dokumen

-   **Nama Produk:** JURNALISTIK APP
-   **Jenis:** Aplikasi Manajemen Absensi dan Kegiatan UKM Jurnalistik
-   **Platform:** Mobile App (anggota) + Web Admin (pengurus/admin)
-   **Versi:** 1.2 (revisi dari v1.1)
-   **Status:** Product Requirement Document
-   **Prioritas:** Attendance-first
-   **Diperbarui:** 5 Oktober 2026
-   **Dokumen pendamping:** `AGENTS.md` (panduan engineering)

**Sumber kebenaran.** PRD ini adalah satu-satunya sumber untuk aturan produk
dan domain (status, rumus, alur, business rules). `AGENTS.md` hanya mengatur
*cara* mengimplementasikan dan tidak boleh menulis ulang aturan domain. Jika
keduanya berbeda, PRD yang berlaku untuk aturan produk.

### Ringkasan revisi v1.2

-   Ketahanan upload selfie pada koneksi buruk (§10).
-   Duplikasi kegiatan (§8) dan pencarian/sorting rekap pengurus (§14.4).
-   Koreksi attendance terlihat oleh anggota yang bersangkutan beserta
    alasannya (§13, §14.3).
-   Retensi selfie **dan** lampiran izin, serta penanganan alumni dan
    permintaan hapus data (§17).
-   Filter audit log (§16).
-   P1 diperluas: notifikasi in-app + riwayat, pengumuman, export rekap
    pribadi, bulk action, halaman konfigurasi organisasi, reset password via
    email (§6.2, §15).
-   Backlog ide P2/nanti dicatat (§22.3); business rules BR-20 s.d. BR-22;
    urutan implementasi diperbarui (§24).

### Ringkasan revisi v1.1

-   Rumus persentase kehadiran disatukan di satu tempat (§14, BR-11).
-   Siklus `AbsenceRequest` ↔ `Attendance` dilengkapi (§11, §12): approval
    membuat/memperbarui attendance dalam satu transaksi, ditambah status
    `CANCELLED` pada request dan aturan "PRESENT menang".
-   Ditambahkan: onboarding akun dan reset password (§6), status anggota
    dan `joined_at` (§7), transisi status kegiatan (§8), `source` attendance
    (§9), penyesuaian manual oleh pengurus (§13), retensi selfie dan consent
    (§10, §17), model data dan constraint (§19), urutan implementasi (§24),
    asumsi dan pertanyaan terbuka (§25).
-   Penamaan distandarkan menjadi `AbsenceRequest` di seluruh dokumen.

------------------------------------------------------------------------

# 2. Latar Belakang

Kegiatan UKM Jurnalistik membutuhkan sistem absensi yang mudah digunakan,
terstruktur, dan membantu pengurus memantau kehadiran anggota.

Proses absensi manual dapat menyebabkan:

-   Rekap membutuhkan waktu.
-   Data mudah tidak konsisten.
-   Anggota sulit mengetahui riwayat kehadiran.
-   Pengurus kesulitan memantau anggota yang sering tidak hadir.
-   Pengajuan izin/sakit sulit dilacak.
-   Risiko kesalahan saat membuat laporan.

JURNALISTIK APP dibuat untuk menangani proses tersebut secara terpusat.

------------------------------------------------------------------------

# 3. Tujuan Produk

1.  Mempermudah anggota melakukan presensi.
2.  Memastikan data presensi tercatat secara konsisten.
3.  Menyediakan pengajuan ketidakhadiran yang terstruktur.
4.  Menentukan Alpha secara otomatis.
5.  Menyediakan rekap kehadiran anggota.
6.  Membantu pengurus mengelola kegiatan dan absensi.
7.  Menyediakan data yang dapat digunakan untuk laporan organisasi.

------------------------------------------------------------------------

# 4. Target Pengguna dan Scope

## 4.1 Peran

**Member** — anggota UKM. Melihat kegiatan, presensi, mengajukan
izin/sakit/dispensasi, melihat riwayat dan persentase kehadiran sendiri,
serta (P1) melihat materi dan tugas.

**Officer** — pengurus operasional. Mengelola anggota (terbatas) dan kegiatan,
melihat absensi, memproses absence request, melakukan penyesuaian manual,
melihat rekap, serta (P1) mengelola materi dan tugas.

**Admin** — hak administratif. Mengelola user, role, konfigurasi sistem,
melihat audit log, dan tindakan administratif tingkat tinggi.

## 4.2 Prioritas Fitur

### P0 — Core MVP

-   Authentication, onboarding akun, dan reset password.
-   Profile anggota dan manajemen anggota dasar.
-   Role dan authorization.
-   Meeting/kegiatan, termasuk duplikasi kegiatan.
-   Attendance dan selfie presensi, termasuk ketahanan upload pada koneksi
    buruk.
-   Absence request dan approval.
-   Auto Alpha.
-   Penyesuaian attendance manual oleh pengurus.
-   Rekap absensi pribadi dan rekap pengurus (dengan pencarian dan sorting).
-   Audit log untuk aktivitas administratif penting (dapat difilter).

### P1 — Supporting Features

Dikerjakan setelah core attendance stabil:

-   Materi, tugas, dan submission tugas.
-   Reminder, notifikasi in-app + riwayat, dan pengumuman/broadcast.
-   Kalender kegiatan.
-   Export laporan (pengurus) dan export rekap pribadi (PDF).
-   Dashboard pengurus yang lebih lengkap.
-   Bulk action (approve request, nonaktifkan anggota).
-   Halaman konfigurasi organisasi.
-   Reset password mandiri via email.
-   Export audit log.

### P2 — Enhancement

-   QR Attendance.
-   Verifikasi lokasi.
-   Poin keaktifan.
-   Integrasi eksternal tambahan.
-   Ide lain yang tercatat di Backlog (§22.3).

### P3 — Future / Experimental

-   Face recognition, AI attendance, gamifikasi kompleks.
-   Fitur sosial/feed, chat internal, video conference.

------------------------------------------------------------------------

# 5. Glosarium dan Konvensi

| Istilah | Arti |
|---|---|
| `ABSENT` | Status teknis. Ditampilkan di UI sebagai **Alpha**. `ALPHA` dan `ABSENT` bukan dua status berbeda. |
| `AbsenceRequest` | Pengajuan ketidakhadiran (izin/sakit/dispensasi). Satu-satunya nama entity untuk konsep ini. |
| Meeting | Padanan teknis dari "kegiatan". |
| Finalized | Meeting yang Auto Alpha-nya sudah diproses (`finalized_at` terisi). |
| Counted meeting | Meeting yang dihitung dalam rekap (lihat §14). |

**Waktu.** Semua timestamp disimpan dalam UTC. Tampilan menggunakan
`Asia/Jakarta` (WIB). Input waktu kegiatan oleh pengurus diinterpretasikan
sebagai WIB dan dikonversi di backend.

------------------------------------------------------------------------

# 6. Akun, Authentication, dan Authorization

## 6.1 Onboarding akun

-   Tidak ada registrasi publik. Akun dibuat oleh Admin/Officer, satu per
    satu atau melalui import CSV (`nim`, `nama`, `divisi`, `angkatan`,
    email opsional).
-   Identitas login: **NIM/NRP + password**.
-   Akun baru mendapat password sementara dan wajib menggantinya saat login
    pertama (`must_change_password`).
-   Admin pertama dibuat melalui seed script saat deployment dengan
    credential dari environment, bukan melalui endpoint publik.

## 6.2 Reset password

-   Tidak bergantung pada layanan email pada MVP.
-   Officer dapat mereset password Member. Admin dapat mereset password
    siapa pun.
-   Reset menghasilkan password sementara yang ditampilkan satu kali, memaksa
    ganti password, mencabut seluruh sesi aktif akun tersebut, dan dicatat
    di audit log.
-   **P1 awal:** reset mandiri via email (butuh layanan pengiriman email dan
    email valid pada profil anggota). Reset oleh pengurus tetap tersedia
    sebagai cadangan.

## 6.3 Authentication

-   Password tidak disimpan plaintext; gunakan hashing modern (Argon2id
    direkomendasikan). Panjang minimal 10 karakter.
-   Access token berumur pendek (default 15 menit) dan refresh token
    dengan rotasi (default 14 hari). Refresh token disimpan sebagai hash
    di database sehingga dapat direvoke.
-   Logout, ganti password, reset password, dan penonaktifan akun mencabut
    sesi terkait.
-   Mobile menyimpan token di secure storage. Web Admin menggunakan
    cookie `HttpOnly`, `Secure`, `SameSite` dengan perlindungan CSRF.
-   Login dibatasi rate limit dan lockout sementara setelah percobaan gagal
    berulang.

## 6.4 Authorization

-   User harus login untuk mengakses fitur yang membutuhkan authentication.
-   Authorization selalu diputuskan di backend; role dari client tidak
    dipercaya. Default endpoint adalah *deny* kecuali diberi permission.
-   Member hanya dapat mengakses data miliknya sendiri.
-   Member tidak dapat mengubah attendance secara langsung.
-   Officer/admin melakukan tindakan administratif sesuai permission dan
    setiap perubahan penting masuk audit log.

------------------------------------------------------------------------

# 7. Manajemen Anggota

Data anggota: NIM/NRP, nama, divisi, angkatan, email (opsional), role,
status, `joined_at`, `left_at`.

Status anggota:

``` text
ACTIVE
INACTIVE
```

### Aturan

-   Anggota yang keluar diubah menjadi `INACTIVE`, tidak dihapus. Histori
    attendance tetap utuh dan konsisten.
-   Hanya anggota `ACTIVE` yang diproses Auto Alpha.
-   Anggota hanya dikenai Alpha untuk meeting dengan
    `start_at >= joined_at`. Meeting sebelum bergabung tidak pernah masuk
    rekap anggota tersebut.
-   Anggota `INACTIVE` tidak dapat login dan semua sesinya dicabut.
-   Perubahan data anggota, role, dan status dicatat di audit log.

------------------------------------------------------------------------

# 8. Manajemen Kegiatan

### Data Kegiatan

Judul, deskripsi, tanggal, `start_at`, `end_at`, `attendance_open_at`,
`attendance_close_at`, status, pembuat, `finalized_at`, Created At,
Updated At.

### Status Kegiatan

``` text
DRAFT → PUBLISHED → ONGOING → COMPLETED
                 ↘ CANCELLED (dari DRAFT/PUBLISHED/ONGOING)
```

-   `DRAFT` belum terlihat oleh member.
-   `PUBLISHED` sudah dipublikasikan.
-   `ONGOING` otomatis saat `start_at` tercapai.
-   `COMPLETED` otomatis saat `end_at` tercapai.
-   `CANCELLED` dilakukan manual oleh Officer/Admin. Membatalkan kegiatan
    yang sudah `COMPLETED` hanya boleh oleh Admin. Selalu masuk audit log.
-   Transisi otomatis dijalankan oleh scheduled job (idempotent).

### Validasi

-   `start_at < end_at` dan `attendance_open_at < attendance_close_at`.
-   Window presensi tidak harus berada di dalam rentang kegiatan, tetapi
    harus terdefinisi sebelum kegiatan dipublikasikan.
-   Setelah kegiatan *finalized*, field window (`attendance_open_at`,
    `attendance_close_at`) dikunci. Koreksi dilakukan lewat penyesuaian
    manual (§13), bukan dengan membuka ulang window.

### Duplikasi Kegiatan

Officer/Admin dapat menduplikasi kegiatan untuk agenda rutin.

-   Disalin: judul, deskripsi, durasi kegiatan, dan offset window presensi
    relatif terhadap `start_at`.
-   Tanggal/waktu baru wajib diisi. Hasil selalu berstatus `DRAFT` dan
    tunduk pada validasi di atas.
-   Tidak disalin: attendance, absence request, materi, dan tugas.
-   Meeting recurring otomatis ada di backlog (§22.3).

### Aturan

-   Kegiatan `CANCELLED` tidak dihitung dalam persentase kehadiran.
-   Data attendance yang sudah tercatat tidak boleh dihapus karena
    kegiatan dibatalkan; perubahan harus dapat diaudit.
-   Penghapusan kegiatan menggunakan soft delete, dan hanya untuk kegiatan
    yang belum memiliki attendance.

------------------------------------------------------------------------

# 9. Attendance

Attendance adalah domain utama aplikasi.

## 9.1 Status Attendance

Status final hanya:

``` text
PRESENT
PERMITTED
SICK
DISPENSATION
ABSENT
```

Tidak ada `PENDING` pada `Attendance.status`. `PENDING` hanya milik workflow
`AbsenceRequest`.

## 9.2 Source Attendance

Setiap attendance mencatat asal pembuatannya:

``` text
SELF              presensi oleh member (selfie wajib)
ABSENCE_APPROVAL  hasil approval AbsenceRequest
AUTO_ALPHA        dibuat Auto Alpha (selalu ABSENT)
MANUAL            penyesuaian oleh Officer/Admin (alasan wajib)
```

## 9.3 Attendance Window

Member hanya dapat presensi jika:

``` text
meeting.status IN (PUBLISHED, ONGOING)
AND attendance_open_at <= server_time <= attendance_close_at
AND member ACTIVE
```

-   Waktu berasal dari server; client tidak boleh menentukan timestamp.
-   Presensi di luar window ditolak.
-   `attendance_close_at` menjadi acuan Auto Alpha.

## 9.4 Alur Presensi

``` text
Member → Login → Pilih kegiatan → Cek window → Kamera/Selfie
→ Preview → Submit → Server validation → Create attendance → PRESENT
```

### Aturan

1.  Satu user hanya boleh memiliki satu attendance untuk satu kegiatan
    (`UNIQUE(user_id, meeting_id)`).
2.  Member hanya dapat membuat attendance untuk dirinya sendiri.
3.  Timestamp dibuat oleh server.
4.  Selfie wajib untuk presensi `SELF`.
5.  Duplicate attendance ditolak (HTTP 409).
6.  Member tidak dapat mengubah status attendance secara langsung.
7.  Attendance yang sudah dibuat tidak dapat dimanipulasi dari client.
8.  **PRESENT menang.** Jika member berhasil presensi, `AbsenceRequest`
    `PENDING` miliknya untuk kegiatan itu otomatis menjadi `CANCELLED`.
    Member yang sudah `PRESENT` tidak dapat mengajukan request baru.

------------------------------------------------------------------------

# 10. Selfie Presensi

Selfie adalah bukti presensi.

### Aturan

-   Wajib untuk presensi `SELF`.
-   Mobile hanya menggunakan kamera langsung (tidak mengambil dari galeri)
    dan mengompres gambar sebelum upload.
-   Upload melalui API (bukan langsung ke bucket) agar validasi dilakukan
    server.
-   File adalah untrusted input: validasi MIME berdasarkan isi file (magic
    bytes), ukuran (default maks 5 MB), dan dimensi.
-   Server meng-*re-encode* gambar sehingga metadata EXIF, termasuk lokasi,
    terbuang.
-   Disimpan di private storage dengan object key yang dibuat server;
    nama file asli tidak dipakai. Database hanya menyimpan object key dan
    metadata.
-   Akses file melalui signed URL berumur pendek, dan hanya untuk role
    yang berwenang.
-   **Retensi:** selfie dihapus dari storage setelah periode retensi
    (default 12 bulan, configurable). Record attendance tetap ada;
    `selfie_object_key` dikosongkan dan `selfie_deleted_at` diisi.

### Ketahanan koneksi

Presensi sering dilakukan di lokasi dengan sinyal buruk, sedangkan
timestamp ditentukan server saat request diterima.

-   Mobile menyimpan foto hasil jepretan secara lokal sampai server
    mengonfirmasi sukses, lalu menghapusnya.
-   Mobile menampilkan progress upload, pesan error yang jelas, dan
    tombol coba lagi. Retry otomatis dibatasi (default 3 kali dengan jeda
    bertambah) dan timeout request ditetapkan eksplisit (default 30 detik).
-   **Sebelum mengulang request yang timeout/terputus**, mobile memeriksa
    `GET /meetings/:id/attendance/me`. Jika attendance sudah ada, itu
    dianggap sukses (request sebelumnya sempat diterima server).
-   Respons 409 duplicate atas attendance milik sendiri diperlakukan
    sebagai sukses, bukan error. BR-01 tetap menjamin tidak ada record
    ganda.
-   **Tidak ada mode offline.** Presensi tidak dapat diantre untuk dikirim
    belakangan karena waktu harus ditentukan server dalam window. Jika
    window ditutup saat retry, server menolak dan mobile menjelaskan bahwa
    presensi sudah ditutup serta menyarankan menghubungi pengurus
    (penyesuaian manual, §13).

### Batasan yang disadari

Selfie tanpa verifikasi tambahan tidak sepenuhnya mencegah titip absen
atau penggunaan foto lama. Untuk MVP ini diterima. Mitigasi lanjutan
(QR, lokasi) ada di P2, dan pengurus dapat meninjau selfie saat ada
kecurigaan.

------------------------------------------------------------------------

# 11. Absence Request

Member dapat mengajukan ketidakhadiran untuk satu kegiatan.

## Jenis Alasan

``` text
SICK
ACADEMIC
BEREAVEMENT
ORGANIZATION
DISPENSATION
OTHER
```

## Status Request

``` text
PENDING     menunggu review
APPROVED    disetujui
REJECTED    ditolak
CANCELLED   ditarik member / digantikan presensi (PRESENT menang)
```

### Data Request

User, Meeting, reason type, reason detail, attachment/bukti, status,
reviewer, review note, Submitted At, Reviewed At.

Kewajiban lampiran ditentukan per jenis alasan melalui konfigurasi
(default: opsional untuk semua jenis). Lampiran mengikuti kebijakan
retensi di §17.

## Aturan

-   Member hanya dapat membuat request untuk dirinya sendiri.
-   Request terkait tepat satu kegiatan, dan hanya untuk kegiatan yang
    belum CANCELLED.
-   Request dapat diajukan **sampai `attendance_close_at`**. Setelah itu,
    koreksi dilakukan Officer/Admin lewat penyesuaian manual (§13).
-   Hanya boleh ada satu request aktif (`PENDING` atau `APPROVED`) per
    user per kegiatan. Setelah `REJECTED` atau `CANCELLED`, member boleh
    mengajukan ulang selama masih sebelum `attendance_close_at`.
-   Member dapat menarik request yang masih `PENDING` (menjadi `CANCELLED`).
-   Officer/admin approve/reject sesuai authorization. Keputusan
    `APPROVED`/`REJECTED` bersifat final; perubahan setelahnya melalui
    penyesuaian manual.
-   Reject dan cancel tidak menghapus history request.
-   Approval dan rejection dapat dilacak (reviewer, waktu, catatan).

## Approval → Attendance

Approve dijalankan dalam **satu transaksi**: update request + upsert
attendance (`source = ABSENCE_APPROVAL`) + audit log.

-   Belum ada attendance → dibuat dengan status hasil mapping.
-   Sudah ada attendance `ABSENT` (mis. dari Auto Alpha) → diubah ke status
    hasil mapping dan diaudit.
-   Sudah ada attendance `PRESENT` → approve ditolak (HTTP 409).

Reject: request menjadi `REJECTED`. Jika attendance sudah `ABSENT`, tetap
`ABSENT`. Jika belum ada, member tetap dapat presensi selama window masih
terbuka, dan jika tidak maka Auto Alpha menghasilkan `ABSENT`.

### Mapping Approval

``` text
SICK          → SICK
ACADEMIC      → PERMITTED
BEREAVEMENT   → PERMITTED
ORGANIZATION  → PERMITTED
DISPENSATION  → DISPENSATION
OTHER         → PERMITTED
```

Mapping dapat disesuaikan dengan kebijakan organisasi melalui konfigurasi
tanpa mengubah workflow.

------------------------------------------------------------------------

# 12. Auto Alpha

Alpha tidak dapat dipilih manual oleh member. Auto Alpha berjalan setelah
attendance window ditutup.

## Trigger

Scheduled job berkala (default tiap menit) mencari kegiatan dengan:

``` text
status IN (PUBLISHED, ONGOING, COMPLETED)
AND attendance_close_at <= now
AND finalized_at IS NULL
```

## Proses (satu transaksi per kegiatan)

``` text
Ambil anggota eligible
  (ACTIVE, start_at >= joined_at, belum punya attendance untuk kegiatan ini)
        ↓
Punya APPROVED request tanpa attendance? (jaring pengaman)
   ├── Ya  → buat attendance sesuai mapping (ABSENCE_APPROVAL)
   └── Tidak → buat ABSENT (AUTO_ALPHA)
        ↓
Isi finalized_at
```

### Aturan

-   Anggota yang sudah memiliki attendance (apa pun statusnya) tidak
    disentuh.
-   Request `PENDING` tidak dianggap approval. Pada saat window ditutup
    member menjadi `ABSENT`, dan jika request kemudian di-approve, status
    berubah lewat mekanisme §11 dan diaudit.
-   Request `REJECTED`/`CANCELLED` tidak mencegah `ABSENT`.
-   Proses harus idempotent: pembuatan record memakai
    `INSERT ... ON CONFLICT DO NOTHING` pada `UNIQUE(user_id, meeting_id)`,
    sehingga menjalankan dua kali tidak menghasilkan duplikat.
-   Kegiatan `CANCELLED` dan `DRAFT` tidak diproses.

------------------------------------------------------------------------

# 13. Penyesuaian Manual oleh Pengurus

Untuk kasus yang tidak tertangani alur normal (HP rusak, salah catat,
koreksi setelah window ditutup).

-   Officer/Admin dapat membuat atau mengubah attendance dengan
    `source = MANUAL` untuk status apa pun, kapan pun.
-   **Alasan wajib diisi.** Selfie tidak wajib untuk `MANUAL`.
-   Setiap penyesuaian masuk audit log (status lama → baru, aktor, alasan,
    waktu).
-   Member tidak memiliki akses ke fitur ini.
-   Alasan koreksi **terlihat oleh anggota yang bersangkutan** pada
    riwayatnya (§14.3); anggota lain tidak melihatnya. Pada P1, anggota juga
    menerima notifikasi bahwa statusnya dikoreksi (§15.4). Karena itu
    alasan ditulis netral dan tanpa data pribadi pihak lain.
-   Penyesuaian manual pada kegiatan *finalized* memengaruhi rekap secara
    langsung; tidak membuka ulang window.

------------------------------------------------------------------------

# 14. Rekap Absensi

## 14.1 Definisi dan Formula (satu-satunya sumber)

**Counted meeting** untuk seorang member adalah kegiatan yang:

-   statusnya bukan `CANCELLED`,
-   sudah *finalized* (Auto Alpha selesai), dan
-   memiliki record attendance untuk member tersebut.

Kehadiran efektif:

``` text
PRESENT, PERMITTED, SICK, DISPENSATION
```

`ABSENT` tidak dihitung sebagai kehadiran efektif.

``` text
Kehadiran = (PRESENT + PERMITTED + SICK + DISPENSATION)
            / counted meetings × 100
```

-   Daftar status efektif berada di **konfigurasi backend** (default di
    atas), bukan hardcoded di UI. Jika kebijakan organisasi berubah,
    cukup ubah konfigurasi.
-   Hasil dibulatkan 1 desimal (half up). Jika counted meetings = 0,
    tampilkan "–", bukan 0%.
-   API, dashboard, dan export wajib memakai satu fungsi perhitungan yang
    sama.

Contoh:

``` text
Total Pertemuan : 12      Hadir 8 · Izin 2 · Sakit 1 · Dispensasi 0 · Alpha 1
Kehadiran       : (8 + 2 + 1 + 0) / 12 × 100 = 91.7%
```

## 14.2 Rekap Member

Total kegiatan yang dihitung, hadir, izin, sakit, dispensasi, alpha, dan
persentase. Member hanya dapat melihat data miliknya sendiri.

## 14.3 Detail Histori

Per kegiatan: nama, tanggal, status, alasan jika tidak hadir, waktu
presensi jika hadir, dan informasi request jika relevan.

Jika status berasal dari penyesuaian manual (`source = MANUAL`), riwayat
menampilkan penanda "Dikoreksi pengurus", alasan koreksi, dan waktu
koreksi. Nama pengurus tidak ditampilkan kepada member (tetap tercatat di
audit log).

## 14.4 Rekap Pengurus

Kolom: Anggota, Hadir, Izin, Sakit, Dispensasi, Alpha, Persentase.

Filter: periode, kegiatan, angkatan, divisi, status anggota.

Pencarian: nama atau NIM/NRP (parsial, tidak sensitif huruf besar-kecil).
Sorting: nama, hadir, izin, sakit, dispensasi, alpha, dan persentase
(naik/turun). Pencarian dan sorting dilakukan di server dengan
pagination; kolom sort dibatasi pada allowlist.

Pengurus tidak boleh mendapatkan data pribadi yang tidak diperlukan untuk
rekap. Alasan ketidakhadiran detail hanya ditampilkan pada tampilan
review request.

------------------------------------------------------------------------

# 15. Fitur Pendukung (P1)

Dikerjakan setelah core attendance stabil.

## 15.1 Kalender Kegiatan

Menampilkan kegiatan, jadwal pelatihan, deadline tugas, dan agenda
organisasi. Member dapat membuka detail kegiatan dari kalender.

## 15.2 Materi

-   Officer mengunggah materi (format utama PDF) dengan judul, deskripsi,
    file, ukuran, kegiatan terkait, pengunggah, waktu upload.
-   Member melihat daftar, detail, dan membuka/download PDF melalui signed
    URL.
-   File di object storage; database hanya menyimpan object key dan
    metadata. Validasi file sama ketatnya dengan §10.

## 15.3 Tugas dan Submission

-   Officer membuat tugas (judul, deskripsi, kegiatan terkait, deadline,
    lampiran opsional).
-   Member melihat tugas dan deadline, mengunggah submission, melihat
    status pengumpulan.
-   Status submission: `NOT_SUBMITTED` (dapat diturunkan dari tidak adanya
    record), `SUBMITTED`, `LATE` (dikumpulkan setelah deadline; tetap
    diterima), `REVIEWED`.

## 15.4 Reminder, Notification, dan Pengumuman

Jenis notifikasi: presensi dibuka, presensi hampir ditutup, materi baru,
tugas baru, deadline tugas, request diterima/ditolak, attendance dikoreksi
pengurus, kegiatan dibatalkan, perubahan jadwal.

-   **Notifikasi in-app:** setiap notifikasi disimpan di database dan
    tampil pada daftar notifikasi di aplikasi (status sudah/belum dibaca)
    agar dapat dibaca ulang. Push via Firebase Cloud Messaging hanya
    pengantar; kegagalan push tidak boleh menghilangkan notifikasi in-app.
-   Isi push tidak memuat alasan sensitif.
-   Riwayat notifikasi dipaginasi dan memiliki retensi (default 90 hari).
-   **Pengumuman/broadcast:** Officer membuat pengumuman (judul, isi, target
    semua anggota aktif atau divisi tertentu). Pengumuman adalah jenis
    notifikasi pada modul yang sama, bukan fitur terpisah, dan pembuatannya
    diaudit.
-   Notifikasi harus actionable dan tidak spam.

## 15.5 Dashboard Pengurus

Statistik: total anggota, anggota aktif, kehadiran bulan berjalan, total
kegiatan, tugas aktif, request pending. Quick actions: buat kegiatan,
buka/atur presensi, upload materi, buat tugas, lihat rekap. Dashboard
bukan pengganti halaman attendance management yang detail.

## 15.6 Export Laporan

**Export pengurus.** Format XLSX (PDF opsional). Kolom: nama, NRP/NIM,
divisi, hadir, izin, sakit, dispensasi, alpha, persentase. Perhitungan
wajib memakai fungsi yang sama dengan API/dashboard (§14.1). Nilai sel
yang diawali `=`, `+`, `-`, atau `@` harus di-escape untuk mencegah
formula injection.

**Export pribadi (anggota).** Member dapat mengunduh rekap kehadiran
pribadinya sebagai **PDF** (mis. untuk beasiswa atau surat keterangan
aktif). PDF dibuat di server dengan fungsi §14.1 dan memuat nama,
NIM/NRP, periode, daftar kegiatan beserta status, persentase, dan waktu
pembuatan. Hanya data milik sendiri. PDF dipilih karena lebih sulit
diubah dibanding XLSX, dan dokumen ini bukan pengganti surat resmi
organisasi.

------------------------------------------------------------------------

## 15.7 Bulk Action

Untuk mempercepat pekerjaan pengurus: approve/reject banyak request
sekaligus dan nonaktifkan banyak anggota (mis. akhir periode).

-   Diproses **per item**: tiap item diotorisasi, memakai transaksi
    sendiri, dan diaudit sendiri. Kegagalan satu item (mis. 409 karena
    sudah `PRESENT`) tidak menggagalkan item lain.
-   Respons memuat hasil per item (berhasil/gagal beserta alasan).
-   Ada batas jumlah item per permintaan (default 100), dan UI meminta
    konfirmasi dengan menyebut jumlah item.
-   Penyesuaian manual attendance (§13) tidak tersedia sebagai bulk.

## 15.8 Konfigurasi Organisasi

Halaman admin sederhana (Admin saja) agar nilai berikut dapat diubah tanpa
deploy ulang: status kehadiran efektif (§14.1), mapping alasan → status
(§11), kewajiban lampiran per jenis alasan, periode retensi (§17), dan
batas ukuran upload.

-   Sebelum halaman ini ada, nilai-nilai tersebut berada di konfigurasi
    backend, bukan hardcoded di kode atau UI.
-   Perubahan konfigurasi masuk audit log (nilai lama → baru).
-   Karena rekap dihitung saat dibaca, perubahan **status efektif berlaku
    pada seluruh histori rekap**; UI menampilkan konfirmasi yang
    menyatakan hal ini. Perubahan **mapping** hanya memengaruhi approval
    berikutnya (attendance yang sudah tercatat tidak berubah).

------------------------------------------------------------------------

# 16. Audit Log

Mencatat aktivitas administratif penting:

-   Perubahan/penyesuaian status attendance.
-   Approval/rejection absence request.
-   Perubahan data anggota, status, dan role.
-   Reset password.
-   Pembatalan/penghapusan kegiatan.
-   Upload/hapus materi.
-   Perubahan konfigurasi penting.

Field minimal: aktor, aksi, entity, entity_id, nilai lama, nilai baru,
alasan (jika ada), timestamp.

Contoh:

``` text
Pengurus Budi mengubah status Luthfi: ABSENT → PERMITTED
Alasan: HP rusak, bukti diterima · 10 Oktober 2026 21:43 WIB
```

Audit log hanya dapat dilihat oleh role yang berwenang, bersifat
append-only, dan tidak memuat password, token, atau isi dokumen.

Pencarian dan filter: aktor, rentang tanggal, jenis aksi, dan
entity/`entity_id`. Hasil dipaginasi dan diurutkan terbaru. Export audit
log (Admin saja, XLSX dengan escape formula) tersedia pada P1.

------------------------------------------------------------------------

# 17. Privacy

Aplikasi memproses data anggota, foto selfie, alasan ketidakhadiran,
dokumen pendukung, dan submission tugas. Semua dianggap **private**.

### Aturan

-   Selfie tidak boleh menjadi public URL.
-   Alasan ketidakhadiran tidak ditampilkan ke member lain tanpa
    kebutuhan.
-   Jangan mengirim data pribadi yang tidak diperlukan pada API.
-   Jangan log password, token, atau isi dokumen.
-   File sensitif memakai private storage.
-   **Consent:** sebelum selfie pertama, aplikasi menampilkan
    pemberitahuan penggunaan data (tujuan, siapa yang dapat melihat,
    lama retensi). Persetujuan dicatat (`privacy_consented_at`).
-   **Retensi** (semua configurable; nilai di bawah adalah default):

    | Data | Default | Setelah retensi |
    |---|---|---|
    | Selfie presensi | 12 bulan sejak presensi | objek dihapus; `selfie_deleted_at` diisi |
    | Lampiran absence request | 6 bulan sejak keputusan request | objek dihapus; `attachment_deleted_at` diisi |
    | Submission tugas (P1) | 12 bulan sejak dikumpulkan | objek dihapus; metadata tetap |
    | Riwayat notifikasi in-app (P1) | 90 hari | record dihapus |

    Record attendance, status, dan audit log tetap ada. Penghapusan
    dilakukan scheduled job yang idempotent.
-   **Alumni/anggota keluar:** akun `INACTIVE`, record attendance tetap untuk
    histori organisasi, file tetap mengikuti jadwal retensi di atas (tidak
    diperpanjang karena status alumni).
-   **Permintaan penghapusan data pribadi** ditangani Admin: selfie dan
    lampiran milik anggota dihapus segera; identitas pada rekap
    dipertahankan seperlunya sebagai arsip organisasi atau dianonimkan
    sesuai keputusan Admin; tindakan dicatat di audit log.
-   Jika verifikasi lokasi diaktifkan di masa depan: hanya saat presensi,
    tanpa background tracking, dengan penjelasan tujuan.

------------------------------------------------------------------------

# 18. Security Requirements

-   **Authentication/authorization:** lihat §6. Authorization di backend
    untuk setiap endpoint yang membutuhkan permission.
-   **Secret:** dari environment/secret manager, tidak di source code.
-   **Validation:** semua input client divalidasi di runtime (UUID, enum,
    panjang string, tanggal/waktu, ukuran dan tipe file, pagination, query
    filter). TypeScript type saja bukan validasi.
-   **Rate limiting:** login, upload, endpoint sensitif, dan endpoint yang
    rawan disalahgunakan.
-   **CORS:** allowlist origin eksplisit.
-   **Transport:** HTTPS wajib; Web Admin memakai security header standar.
-   **Error handling:** respons produksi tidak membocorkan stack trace,
    query SQL, path internal, secret, credential, atau detail
    infrastruktur.
-   **Backup:** backup PostgreSQL otomatis (minimal harian) dengan uji
    restore berkala. Bucket R2 tidak public.

------------------------------------------------------------------------

# 19. Model Data dan Constraint (ringkas)

``` text
User            id, nim (unique), name, email?, password_hash, role,
                status, division, cohort_year, joined_at, left_at,
                must_change_password, privacy_consented_at, timestamps
Session         id, user_id, refresh_token_hash, expires_at, revoked_at
Meeting         id, title, description, start_at, end_at,
                attendance_open_at, attendance_close_at, status,
                created_by, finalized_at, deleted_at, timestamps
Attendance      id, user_id, meeting_id, status, source,
                selfie_object_key?, selfie_deleted_at?, submitted_at,
                absence_request_id?, note?, adjusted_at?,
                adjustment_reason?, timestamps
AbsenceRequest  id, user_id, meeting_id, reason_type, reason_detail,
                attachment_object_key?, attachment_deleted_at?, status,
                reviewer_id?, review_note?, submitted_at, reviewed_at?
AuditLog        id, actor_id, action, entity, entity_id,
                old_value, new_value, reason?, created_at
Material, Assignment, AssignmentSubmission, Notification   (P1)
```

Constraint wajib:

-   `UNIQUE(user_id, meeting_id)` pada `Attendance`.
-   Unique parsial pada `AbsenceRequest(user_id, meeting_id)` untuk status
    `PENDING` atau `APPROVED`.
-   `CHECK(start_at < end_at)` dan
    `CHECK(attendance_open_at < attendance_close_at)`.
-   Foreign key eksplisit; histori tidak di-hard-delete.
-   Index pada `user_id`, `meeting_id`, `status`, dan kolom filter rekap,
    serta pada `AuditLog(actor_id, created_at, action)` untuk filter audit.

------------------------------------------------------------------------

# 20. Teknologi dan Arsitektur

| Bagian | Teknologi |
|---|---|
| Mobile | Flutter, Dart (Android utama, iOS opsional) |
| Backend | NestJS, TypeScript, REST API |
| Database / ORM | PostgreSQL, Prisma |
| Storage | Cloudflare R2 (selfie, PDF materi, submission, lampiran) |
| Notification | Firebase Cloud Messaging (P1) |
| Web Admin | Next.js, React, TypeScript, Tailwind CSS |
| Deployment | Docker, VPS, Caddy/Nginx, HTTPS |

``` text
  Flutter Mobile ──┐
                   │ HTTPS
                   ▼
            ┌──────────────────┐        ┌────────────────┐
            │    NestJS API    │───────▶│   PostgreSQL   │
            │ (monolith modular)│        └────────────────┘
            │                  │        ┌────────────────┐
            │                  │───────▶│ Cloudflare R2  │
            └──────────────────┘        └────────────────┘
                   ▲
                   │ HTTPS
  Next.js Admin ───┘
```

------------------------------------------------------------------------

# 21. Business Rules Utama

| ID | Aturan |
|---|---|
| BR-01 | **Unique Attendance.** Satu member hanya satu attendance per meeting: `UNIQUE(user_id, meeting_id)`. |
| BR-02 | **Server Timestamp.** Timestamp attendance selalu dari server. |
| BR-03 | **Attendance Window.** Valid jika `attendance_open_at <= server_time <= attendance_close_at` dan meeting `PUBLISHED`/`ONGOING`. |
| BR-04 | **Selfie.** Selfie wajib untuk presensi `SELF`. Attendance `MANUAL`, `ABSENCE_APPROVAL`, `AUTO_ALPHA` tidak memerlukan selfie. |
| BR-05 | **Member Ownership.** Member hanya membuat attendance dan absence request untuk dirinya sendiri. |
| BR-06 | **Pending Request.** `PENDING` hanya untuk `AbsenceRequest`, bukan `Attendance`. |
| BR-07 | **Approval.** Approve = update request + upsert attendance + audit log dalam satu transaksi. |
| BR-08 | **Rejection.** Request yang ditolak tidak mencegah `ABSENT`. |
| BR-09 | **Auto Alpha.** Anggota eligible tanpa attendance setelah window ditutup mendapat `ABSENT`; proses idempotent. |
| BR-10 | **Cancelled Meeting.** Meeting `CANCELLED` tidak dihitung dalam persentase. |
| BR-11 | **Percentage.** Rumus dan definisi counted meeting di §14.1; satu fungsi untuk API, dashboard, export; status efektif dari konfigurasi. |
| BR-12 | **Backend Authority.** Business logic dan authorization diputuskan di backend. |
| BR-13 | **Audit.** Perubahan administratif penting tercatat di audit log. |
| BR-14 | **Private Files.** Selfie dan dokumen sensitif memakai private storage. |
| BR-15 | **PRESENT Menang.** Presensi berhasil membatalkan request `PENDING`; approve atas attendance `PRESENT` ditolak. |
| BR-16 | **Finalized Only.** Hanya meeting finalized dan non-cancelled yang dihitung di rekap. |
| BR-17 | **Manual Adjustment.** Penyesuaian manual wajib beralasan dan diaudit. |
| BR-18 | **Satu Request Aktif.** Maksimal satu request `PENDING`/`APPROVED` per user per meeting. |
| BR-19 | **Histori Terjaga.** Anggota keluar menjadi `INACTIVE`; histori tidak dihapus. |
| BR-20 | **Retensi File.** Selfie dan lampiran dihapus dari storage setelah masa retensi; record attendance/request tetap ada. |
| BR-21 | **Koreksi Transparan.** Alasan koreksi manual terlihat oleh anggota yang bersangkutan. |
| BR-22 | **Bulk Per Item.** Bulk action diproses per item (otorisasi, transaksi, dan audit sendiri-sendiri); satu kegagalan tidak membatalkan yang lain. |

------------------------------------------------------------------------

# 22. Non-Goals MVP dan Future Features

## 22.1 Non-Goals MVP

Face recognition, live location tracking, chat internal, social media/feed,
video conference, microservices, AI attendance, gamifikasi kompleks,
integrasi terlalu banyak platform eksternal, status keterlambatan
(`LATE`) pada attendance.

Fokus MVP: **Simple · Reliable · Secure · Maintainable**.

## 22.2 Future Features

-   **Poin keaktifan:** poin berdasarkan aktivitas (contoh: hadir +10,
    tugas +10, panitia +20, pemateri +30, alpha −5) untuk leaderboard.
-   **Verifikasi lokasi:** selfie + GPS + authentication + meeting window;
    lokasi hanya diambil saat presensi.
-   **QR Attendance:** scan QR → authentication → selfie → presensi. QR
    memiliki masa berlaku dan bukan satu-satunya mekanisme validasi.

------------------------------------------------------------------------

## 22.3 Backlog Ide (belum dijadwalkan)

Ide yang bermanfaat tetapi tidak kritis untuk MVP/P1. Tidak dikerjakan
tanpa persetujuan.

| Ide | Catatan |
|---|---|
| Kuota izin per semester | Keputusan kebijakan organisasi; tunda sampai ada aturan resmi |
| Pengajuan koreksi attendance dari anggota ("sebenarnya hadir tapi lupa presensi") | Evaluasi setelah pilot. Penyesuaian manual (§13) sudah menutup kebutuhan, dan membukanya rawan klaim palsu |
| Meeting recurring otomatis | Mulai dari Duplikasi Kegiatan (§8); recurring penuh rumit (zona waktu, pembatalan satu sesi) |
| Multi-divisi / hierarchical role | Mulai dari role global; authorization dipusatkan di satu policy layer agar scope divisi dapat ditambah tanpa mengubah semua endpoint |
| Dashboard analitik lanjutan | Tren bulanan, anggota yang sering alpha, perbandingan divisi |
| Threshold kehadiran minimum | Penanda anggota di bawah ambang kehadiran |
| Integrasi Google Calendar | Nice to have |
| Foto profil | Tidak dipilih: menambah file privat dan alur moderasi dengan manfaat kecil |

------------------------------------------------------------------------

# 23. Acceptance Criteria MVP

MVP memenuhi requirement jika:

**Akun dan akses**

-   Admin/Officer dapat membuat anggota (termasuk import CSV) dan mereset
    password; member wajib ganti password sementara.
-   Member dapat login dan melihat kegiatan.
-   Authorization diterapkan di backend; member tidak dapat mengakses
    endpoint officer atau data member lain.

**Presensi**

-   Member hanya dapat presensi dalam attendance window, dengan selfie.
-   Server menentukan timestamp; duplicate attendance ditolak.
-   File sensitif tidak dapat diakses secara public; EXIF selfie terbuang.
-   Retry presensi setelah timeout tidak menghasilkan record ganda;
    mobile memperlakukan attendance yang sudah ada sebagai sukses dan
    menjelaskan dengan jelas jika window sudah ditutup.
-   Job retensi menghapus selfie dan lampiran yang melewati batas tanpa
    menghapus record.

**Absence request**

-   Member dapat mengajukan dan menarik request; maksimal satu request
    aktif per kegiatan.
-   Officer/admin dapat approve/reject; approval menghasilkan status
    attendance yang benar dalam satu transaksi.
-   Rejected request tidak mencegah `ABSENT`.
-   Presensi berhasil membatalkan request `PENDING`.

**Auto Alpha dan rekap**

-   Auto Alpha berjalan setelah window ditutup, idempotent, dan hanya
    untuk anggota eligible.
-   Approval setelah Auto Alpha mengubah `ABSENT` ke status yang benar
    dan diaudit.
-   Member dapat melihat rekap pribadi; pengurus dapat melihat rekap
    anggota.
-   Persentase konsisten di API, dashboard, dan export.
-   Meeting cancelled dan meeting belum finalized tidak memengaruhi
    persentase.
-   Rekap pengurus dapat dicari (nama/NIM) dan diurutkan, dengan
    pagination.
-   Riwayat member menampilkan penanda dan alasan koreksi manual miliknya.

**Pengurus dan audit**

-   Officer/admin dapat melakukan penyesuaian manual dengan alasan.
-   Perubahan administratif penting tercatat di audit log, yang dapat
    difilter berdasarkan aktor, tanggal, dan jenis aksi.
-   Officer dapat menduplikasi kegiatan menjadi `DRAFT` baru.

------------------------------------------------------------------------

# 24. Urutan Implementasi MVP

Dikerjakan sebagai irisan vertikal tipis; Web Admin dibangun bertahap,
hanya halaman yang dibutuhkan tiap tahap.

| Tahap | Isi | Selesai jika |
|---|---|---|
| M0 Fondasi | Repo, CI, skema Prisma, auth, seed admin, audit log dasar | Login dan guard role berjalan; migration jalan di CI |
| M1 Anggota & Meeting | CRUD anggota (+ CSV), CRUD meeting, duplikasi kegiatan, transisi status | Officer dapat membuat dan mempublikasikan kegiatan |
| M2 Presensi | Window, selfie, R2, unique constraint, ketahanan upload (cek status sebelum retry) | Member dapat presensi; semua penolakan tervalidasi tes; retry setelah timeout tidak menggandakan data |
| M3 Request & Penyesuaian | AbsenceRequest, approval transaksional, penyesuaian manual (terlihat di riwayat), filter audit log | Alur §11 dan §13 lolos tes, termasuk edge case |
| M4 Auto Alpha & Rekap | Scheduler, finalisasi, rekap member/pengurus dengan search + sort | Angka konsisten dengan contoh §14 |
| M5 Hardening & Pilot | Checklist keamanan, backup + uji restore, job retensi (selfie + lampiran), pilot satu kegiatan nyata | Acceptance Criteria §23 terpenuhi |

Setelah M5 stabil, P1 disarankan berurutan (dapat disesuaikan dengan hasil
pilot):

1.  Notifikasi in-app + push (termasuk "attendance dikoreksi").
2.  Materi dan tugas.
3.  Export pengurus dan export rekap pribadi (PDF).
4.  Bulk action dan halaman konfigurasi organisasi.
5.  Pengumuman, kalender, dashboard lanjutan, reset password via email,
    export audit log.

------------------------------------------------------------------------

# 25. Asumsi dan Pertanyaan Terbuka

Default di bawah dipilih karena paling aman dan sederhana. Konfirmasi atau
ubah sebelum implementasi.

| # | Keputusan | Default pada v1.1 |
|---|---|---|
| 1 | Izin/sakit/dispensasi dihitung sebagai kehadiran efektif? | **Ya** (sesuai PRD v1.0), dapat diubah lewat konfigurasi |
| 2 | Perlu status keterlambatan? | Tidak (non-goal MVP) |
| 3 | Identitas login | NIM/NRP + password |
| 4 | Batas pengajuan request | Sampai `attendance_close_at` |
| 5 | Retensi selfie | 12 bulan (configurable) |
| 6 | Lampiran wajib untuk jenis alasan tertentu? | Tidak wajib; configurable per jenis |
| 7 | Divisi dan angkatan | Field biasa pada `User` (bukan tabel terpisah) |
| 8 | Reset password | Dilakukan Officer/Admin, tanpa email |
| 9 | Siapa boleh membatalkan kegiatan `COMPLETED` | Admin saja |
| 10 | Retensi lampiran absence request | 6 bulan sejak keputusan (configurable) |
| 11 | Nama pengurus terlihat oleh anggota pada koreksi? | Tidak (hanya penanda dan alasan) |
| 12 | Batas item per bulk action | 100 |
| 13 | Reset password via email | Ditunda ke P1 awal |
| 14 | Retensi riwayat notifikasi in-app | 90 hari |
| 15 | Export audit log | P1, Admin saja |

------------------------------------------------------------------------

# 26. Prinsip Produk

JURNALISTIK APP tidak ditujukan menjadi platform organisasi yang terlalu
kompleks.

``` text
1. Attendance harus benar.
2. Data harus konsisten.
3. Security harus masuk sejak awal.
4. UX harus sederhana.
5. Fitur tambahan dibuat setelah core attendance stabil.
```

Core MVP harus dapat digunakan tanpa bergantung pada fitur future.
