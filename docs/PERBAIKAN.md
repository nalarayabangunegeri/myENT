# PERBAIKAN.md

# JURNALISTIK APP — Daftar Perbaikan & Hardening

Dokumen ini berisi hasil review teknis terhadap repository `myENT`
setelah fase implementasi MVP + P1 + sebagian P2/backlog.

Tujuan utama dokumen ini bukan menambah fitur baru, tetapi memastikan
sistem sudah **konsisten, aman, tahan terhadap race condition, dan siap
dipakai untuk pilot internal UKM Jurnalistik**.

> Prinsip: **Fix existing system before adding new features.**

---

## 1. Status Review

**Status saat review:** Perlu Hardening sebelum Pilot  
**Target berikutnya:** Hardening → Security Test → Backup/Restore Drill → Pilot  
**Fokus:** Data Integrity, Security, Consistency, Reliability, UX

### Penilaian umum

| Area | Penilaian |
|---|---|
| Arsitektur | Baik |
| Authentication | Baik |
| Authorization | Baik, perlu pengujian abuse lebih dalam |
| Attendance core | Baik |
| Storage security | Baik, perlu konsistensi antar module |
| Data integrity | Perlu perbaikan |
| Scheduler | Perlu perbaikan |
| Privacy enforcement | Perlu perbaikan |
| Analytics consistency | Perlu perbaikan |
| Backup & recovery | Dokumentasi baik, belum dibuktikan dengan restore drill |
| UX Mobile | Layak MVP, masih perlu polish |
| Production readiness | Belum 100% |

---

# 2. PRIORITAS P0 — WAJIB SEBELUM PILOT

## P0-01 — Cegah Penghapusan Meeting yang Sudah Memiliki Attendance

### Masalah

`MeetingsService.remove()` saat ini dapat melakukan soft delete terhadap
meeting tanpa memeriksa apakah meeting sudah memiliki attendance.

Akibatnya:

- attendance tetap ada di database,
- tetapi meeting menjadi `deletedAt != null`,
- banyak query rekap mengecualikan meeting tersebut,
- histori kehadiran bisa hilang dari perhitungan bisnis.

Ini bertentangan dengan aturan PRD bahwa histori attendance harus tetap
konsisten.

### Perbaikan

Sebelum menghapus:

```text
Meeting
   ↓
Apakah sudah memiliki attendance?
   ├── YA  → Tolak delete
   └── TIDAK → Soft delete boleh
```

Alternatif yang lebih aman:

```text
Meeting yang sudah memiliki attendance
→ tidak boleh dihapus
→ gunakan status CANCELLED
```

### Acceptance Criteria

- [ ] Meeting tanpa attendance dapat di-soft-delete sesuai aturan.
- [ ] Meeting dengan attendance ditolak untuk delete.
- [ ] Error response jelas.
- [ ] Test untuk delete meeting dengan attendance ditambahkan.
- [ ] Tidak ada histori attendance yang hilang dari rekap karena delete.

### File terkait

```text
apps/api/src/meetings/meetings.service.ts
docs/PRD.md
```

---

## P0-02 — Perbaiki Advisory Lock Scheduler

### Masalah

Scheduler menggunakan PostgreSQL advisory lock:

```sql
pg_try_advisory_lock(...)
```

dan kemudian:

```sql
pg_advisory_unlock(...)
```

Tetapi Prisma menggunakan connection pool. Session-level advisory
lock perlu dijamin berada pada koneksi PostgreSQL yang sama.

Jika lock dan unlock berjalan pada koneksi berbeda, perilaku lock dapat
menjadi tidak dapat diandalkan.

### Dampak

Scheduler menangani:

- transisi meeting,
- Auto Alpha,
- reminder,
- retention,
- overdue loan.

Jika mekanisme lock salah, job dapat berjalan ganda atau lock tidak
terlepas dengan benar.

### Perbaikan yang direkomendasikan

Gunakan transaction-level advisory lock:

```sql
pg_try_advisory_xact_lock(...)
```

dalam transaction yang sama.

Alternatif lain:

- DB lease/lock berbasis row,
- dedicated worker,
- external scheduler.

Untuk skala UKM saat ini, **PostgreSQL transaction lock** sudah cukup.

### Acceptance Criteria

- [ ] Tidak ada dua scheduler menjalankan tick bersamaan.
- [ ] Lock otomatis dilepas saat transaction selesai.
- [ ] Test concurrent scheduler.
- [ ] Tidak membutuhkan Redis untuk deployment single-instance.

### File terkait

```text
apps/api/src/meetings/meetings.service.ts
```

---

## P0-03 — Perbaiki Race Condition Approval Absence Request

### Masalah

Workflow approval saat ini secara konsep:

```text
SELECT request
↓
cek PENDING
↓
UPDATE menjadi APPROVED/REJECTED
```

Dua officer dapat membaca request yang sama sebagai `PENDING` sebelum salah
satunya selesai.

### Perbaikan

Gunakan conditional update atau mekanisme transaction yang menjamin hanya
satu keputusan berhasil:

```sql
UPDATE absence_requests
SET status = 'APPROVED'
WHERE id = ?
AND status = 'PENDING';
```

Kemudian periksa jumlah row yang berubah:

```text
1 row → berhasil
0 row → request sudah diproses / tidak valid
```

### Acceptance Criteria

- [ ] Dua approval bersamaan hanya menghasilkan satu keputusan.
- [ ] Dua rejection bersamaan hanya menghasilkan satu keputusan.
- [ ] Attendance tidak dibuat dua kali.
- [ ] Audit hanya mencatat keputusan yang benar-benar berhasil.

### File terkait

```text
apps/api/src/absence/absence.service.ts
```

---

# 3. PRIORITAS P1 — HARUS DIBERESKAN SEBELUM PRODUCTION

## P1-01 — Atomic Consume untuk Password Reset Token

### Masalah

Flow reset password masih menggunakan pola:

```text
find token
↓
check usedAt
↓
change password
↓
set usedAt
```

Dua request bersamaan dapat berpotensi mencoba memakai token yang sama.

### Perbaikan

Gunakan atomic update:

```sql
UPDATE password_resets
SET used_at = NOW()
WHERE id = ?
AND used_at IS NULL
AND expires_at > NOW();
```

Hanya request yang memperoleh row update yang boleh melanjutkan proses.

### Tambahan

- [ ] Batasi satu reset token aktif per user.
- [ ] Invalid/expired/used token menghasilkan error yang konsisten.
- [ ] Tambahkan concurrent test.

### File terkait

```text
apps/api/src/auth/auth.service.ts
```

---

## P1-02 — Enforce Privacy Consent untuk Selfie

### Kondisi saat ini

Schema sudah memiliki:

```text
privacyConsentedAt
```

dan PRD sudah menetapkan consent sebelum selfie pertama.

Namun flow mobile perlu memastikan consent benar-benar menjadi requirement
sebelum presensi selfie.

### Flow yang disarankan

```text
Login
  ↓
Presensi pertama
  ↓
Privacy Notice
  ↓
Setuju
  ↓
privacyConsentedAt = now()
  ↓
Kamera
  ↓
Presensi
```

Jika belum consent:

```text
POST /attendance
→ 403 PRIVACY_CONSENT_REQUIRED
```

### Acceptance Criteria

- [ ] User baru melihat privacy notice sebelum selfie pertama.
- [ ] Consent disimpan di backend.
- [ ] Consent tidak dapat dipalsukan dari client.
- [ ] Setelah consent, user tidak perlu menyetujui ulang setiap presensi.
- [ ] Test API untuk user tanpa consent.

### File terkait

```text
apps/api/prisma/schema.prisma
apps/api/src/attendance/attendance.service.ts
apps/mobile/lib/features/attendance/presensi_page.dart
docs/PRD.md
```

---

## P1-03 — Satukan Semua Perhitungan Attendance

### Masalah

Rekap utama sudah menggunakan konfigurasi:

```text
effective_statuses
```

Namun beberapa analytics masih hardcoded:

```text
PRESENT
PERMITTED
SICK
DISPENSATION
```

Akibatnya konfigurasi dapat menghasilkan angka berbeda antara:

- recap,
- dashboard,
- trend,
- by division,
- analytics,
- leaderboard.

### Perbaikan

Buat satu source of truth:

```text
AttendanceStatsService
├── getEffectiveStatuses()
├── calculateStats()
├── calculatePercentage()
└── calculateBreakdown()
```

Semua module memanggil service ini.

### Acceptance Criteria

- [ ] Recap member menggunakan service.
- [ ] Recap officer menggunakan service.
- [ ] Dashboard menggunakan service.
- [ ] Trend menggunakan service.
- [ ] By-division menggunakan service.
- [ ] Export menggunakan service.
- [ ] Tidak ada status efektif hardcoded di analytics.

### File terkait

```text
apps/api/src/attendance/attendance.service.ts
apps/api/src/absence/absence.rules.ts
apps/api/src/insight/insight.service.ts
```

---

## P1-04 — Konsistenkan Cleanup Orphaned Upload

### Masalah

Pattern upload pada beberapa module adalah:

```text
storage.save()
↓
database.create()
```

Jika storage berhasil tetapi database gagal:

```text
object ada
record DB tidak ada
```

Muncul orphan object.

### Module yang perlu direview

```text
Attendance
Absence
Materials
Assignments
Corrections
Loans
```

### Perbaikan

Gunakan pola:

```text
validate
↓
save object
↓
write database
↓
success → keep object
failure → delete object
```

Atau gunakan abstraction khusus:

```text
StorageWriteCoordinator
```

agar pattern cleanup konsisten.

### Acceptance Criteria

- [ ] DB failure menghapus object yang baru dibuat.
- [ ] Tidak ada orphan object pada test.
- [ ] Cleanup failure dicatat untuk retry.
- [ ] Retention job dapat membersihkan sisa object.

---

## P1-05 — Seragamkan Sanitasi File Upload

### Kondisi saat ini

Selfie sudah sangat baik:

```text
magic bytes
→ decode
→ resize
→ re-encode
→ EXIF hilang
```

Namun file lain seperti material, submission, correction, dan loan
perlu direview agar aturan sanitasi konsisten.

### Perbaikan minimum

Untuk image:

```text
detect
→ decode
→ re-encode
→ store
```

Untuk PDF:

```text
magic bytes
→ size validation
→ extension/content consistency
→ private storage
```

### Acceptance Criteria

- [ ] Tidak percaya filename client.
- [ ] Tidak percaya MIME header client.
- [ ] Image re-encode.
- [ ] Object key dibuat server.
- [ ] Storage private.
- [ ] Signed URL memiliki expiry.
- [ ] File yang sudah dihapus menghasilkan 410/Gone.

---

## P1-06 — Backup Tidak Cukup, Lakukan Restore Drill

### Kondisi saat ini

Dokumentasi deployment sudah memiliki backup strategy.

Namun restore drill masih belum dibuktikan.

### Checklist

```text
Create backup
↓
Create empty PostgreSQL
↓
Restore dump
↓
Run application
↓
Login
↓
Read meeting
↓
Read attendance
↓
Generate recap
↓
Verify uploaded files
```

### Acceptance Criteria

- [ ] Restore DB berhasil.
- [ ] Application dapat login setelah restore.
- [ ] Rekap tetap konsisten.
- [ ] File storage tetap dapat diakses.
- [ ] Tanggal restore drill dicatat di DEPLOY.md.
- [ ] Restore drill diulang berkala.

### File terkait

```text
docs/DEPLOY.md
scripts/backup.sh
docker-compose.prod.yml
```

---

## P1-07 — Tambahkan Security/Abuse Test Suite

Unit test saja tidak cukup setelah feature surface membesar.

### Test wajib

#### Authorization

```text
Member → akses attendance member lain
Member → akses absence member lain
Member → adjust attendance
Member → audit log
Officer → ubah ADMIN
Officer divisi A → akses member divisi B
```

#### Attendance

```text
duplicate attendance
presensi di luar window
client timestamp palsu
client userId palsu
client role palsu
retry setelah timeout
race duplicate submit
```

#### Absence

```text
double approval
double rejection
approve atas PRESENT
approve setelah Auto Alpha
resubmit setelah rejected
cancel setelah approved
```

#### Authentication

```text
refresh token reuse
password reset token reuse
expired reset token
2FA code brute force
pending 2FA token reuse
lockout
```

#### Upload

```text
oversized image
malformed image
fake MIME
fake extension
path traversal
deleted-file access
unauthorized file access
```

#### QR / Location

```text
expired QR
QR untuk meeting berbeda
signature tampering
location outside radius
missing coordinates
```

---

# 4. PRIORITAS P2 — POLISH SETELAH CORE HARDENING

## P2-01 — Batasi Correction Request

Feature koreksi kehadiran berpotensi disalahgunakan:

```text
"Saya sebenarnya hadir, lupa presensi."
```

### Rekomendasi

Batasi:

- maksimal periode pengajuan,
- bukti opsional/wajib sesuai kebijakan,
- satu request aktif,
- audit wajib,
- reviewer selain pembuat.

Contoh:

```text
Meeting selesai
↓
Correction dibuka maksimal 3 hari
↓
setelah itu ditutup
```

Jangan biarkan klaim muncul berbulan-bulan setelah kegiatan.

---

## P2-02 — Harden Konfigurasi Organisasi

Halaman konfigurasi saat ini sangat fleksibel karena menerima:

```text
key + JSON value
```

Ini berisiko karena admin dapat memasukkan kebijakan yang secara bisnis
tidak masuk akal.

### Perbaikan

Gunakan typed configuration UI:

```text
Retensi selfie
[ 12 ] bulan

Status efektif
[x] PRESENT
[x] PERMITTED
[x] SICK
[x] DISPENSATION
[ ] ABSENT
```

Backend tetap harus memvalidasi setiap configuration key.

### Acceptance Criteria

- [ ] Tidak ada config key arbitrary.
- [ ] Range tiap nilai divalidasi.
- [ ] `ABSENT` tidak boleh menjadi effective status.
- [ ] Mapping approval hanya menerima status valid.
- [ ] Perubahan konfigurasi tercatat di audit log.

---

## P2-03 — Polish UX Mobile

Current flow sudah layak MVP:

```text
Meeting
→ Camera
→ Preview
→ Submit
→ Retry
```

Fokus UX berikutnya:

### Home

```text
Presensi berikutnya
Status kehadiran
Kegiatan aktif
Deadline tugas
Notifikasi
```

### Status attendance

Gunakan label + ikon:

```text
🟢 Sudah Presensi
🟠 Belum Presensi
🔴 Window Ditutup
🔵 Izin Disetujui
```

Status tidak boleh hanya dibedakan berdasarkan warna.

### Presensi

- progress upload,
- state sukses yang jelas,
- state retry,
- state window ditutup,
- tombol satu tangan,
- error message manusiawi.

---

# 5. SCOPE CONTROL — JANGAN TAMBAH FITUR DULU

Project sudah memiliki cukup banyak modul:

```text
Authentication
Attendance
Absence
Correction
QR
Location
Points
Leaderboard
Recurring Meeting
Duty
Inventory
Loan
Notification
Announcement
Analytics
2FA
Turnstile
Password Reset
```

Pada tahap ini **feature freeze** lebih sehat daripada menambah fitur baru.

### Tunda sementara

```text
AI attendance
Face recognition
Chat internal
Social feed
Video conference
Microservices
Redis hanya untuk "biar scalable"
Kubernetes
Service mesh
Event-driven architecture kompleks
```

Untuk skala UKM saat ini:

```text
NestJS modular monolith
+
PostgreSQL
+
Next.js BFF
+
Flutter
+
R2
+
Docker
+
Caddy
```

sudah cukup.

---

# 6. FASE PENGERJAAN YANG DIREKOMENDASIKAN

## Phase A — Data Integrity

- [ ] P0-01 Meeting delete guard
- [ ] P0-02 Scheduler lock
- [ ] P0-03 Absence approval race condition
- [ ] P1-01 Password reset atomic consume

---

## Phase B — Privacy & Storage

- [ ] P1-02 Privacy consent
- [ ] P1-04 Orphan upload cleanup
- [ ] P1-05 Upload sanitization
- [ ] Audit semua signed URL dan private storage

---

## Phase C — Consistency

- [ ] P1-03 AttendanceStatsService
- [ ] Review semua analytics
- [ ] Review semua export
- [ ] Review semua percentage calculation

---

## Phase D — Security Testing

- [ ] Authorization abuse test
- [ ] Authentication abuse test
- [ ] Race-condition test
- [ ] File-upload test
- [ ] QR test
- [ ] Location test
- [ ] Regression test

---

## Phase E — Recovery

- [ ] Backup production
- [ ] Restore database
- [ ] Restore/verify storage
- [ ] Login test
- [ ] Attendance test
- [ ] Recap test
- [ ] Document restore drill

---

## Phase F — Pilot

### Tahap 1 — Pengurus

Target:

```text
5–10 user
1–2 meeting
```

Validasi:

- [ ] Login
- [ ] Reset password
- [ ] Create meeting
- [ ] Publish meeting
- [ ] Attendance
- [ ] Absence
- [ ] Approval
- [ ] Auto Alpha
- [ ] Recap
- [ ] Export
- [ ] Notification

---

### Tahap 2 — Satu Divisi

Target:

```text
30–50 anggota
```

Uji:

- [ ] Presensi serentak
- [ ] WiFi kampus
- [ ] koneksi buruk
- [ ] upload selfie
- [ ] retry
- [ ] Auto Alpha
- [ ] rekap

Target minimum:

```text
>95% attendance request sukses
0 critical data-integrity issue
0 unauthorized access
0 unexplained 500
```

---

### Tahap 3 — Full Organization

Setelah tahap sebelumnya stabil:

```text
Import semua anggota
↓
Pilot seluruh organisasi
↓
Monitoring
↓
Maintenance
```

---

# 7. DEFINITION OF DONE — HARDENING

Sistem dianggap selesai untuk pilot jika:

```text
[ ] Tidak ada P0 yang tersisa
[ ] Semua P1 kritis selesai
[ ] Meeting tidak dapat menghilangkan histori attendance
[ ] Scheduler tidak berjalan ganda
[ ] Approval race aman
[ ] Password reset token atomic
[ ] Privacy consent enforced
[ ] Attendance percentage single source of truth
[ ] Upload failure tidak meninggalkan orphan object
[ ] Security abuse test lulus
[ ] Backup berhasil
[ ] Restore drill berhasil
[ ] Mobile attendance UX stabil
[ ] CI lint lulus
[ ] CI unit test lulus
[ ] CI E2E lulus
[ ] CI admin build lulus
[ ] CI mobile analyze/test lulus
[ ] Docker image build lulus
[ ] Production healthcheck lulus
```

---

# 8. SECURITY GATE

Sebelum pilot, lakukan review terakhir terhadap:

```text
Authentication
Authorization
Session management
CSRF
Rate limiting
Input validation
File upload
Object storage
Signed URL
Audit log
Privacy consent
SQL/data integrity
Race condition
Backup
Restore
Secrets
Production headers
CORS
```

Prioritas:

```text
1. Security
2. Data Integrity
3. Product Requirement
4. Maintainability
5. Developer Convenience
```

---

# 9. Kesimpulan

JURNALISTIK APP sudah memiliki fondasi teknis yang kuat dan feature set
yang lebih dari cukup untuk kebutuhan UKM.

Tahap berikutnya bukan menambah banyak fitur, tetapi memastikan:

```text
Feature Complete
      ↓
Hardening
      ↓
Security Verification
      ↓
Recovery Verification
      ↓
Pilot
```

Target utama:

> **Simple · Reliable · Secure · Maintainable**

Setelah hardening selesai, fokus pengembangan harus bergeser dari
**"fitur apa lagi?"** menjadi **"apakah fitur yang sudah ada benar-benar
aman, konsisten, dan dapat dipercaya?"**

---

# 10. Referensi Repository

Dokumen dan file utama yang menjadi basis review:

```text
docs/PRD.md
docs/AGENTS.md
docs/API.md
docs/DEPLOY.md

apps/api/src/meetings/meetings.service.ts
apps/api/src/absence/absence.service.ts
apps/api/src/auth/auth.service.ts
apps/api/src/attendance/attendance.service.ts
apps/api/src/insight/insight.service.ts
apps/api/src/retention/retention.service.ts
apps/api/src/storage/storage.service.ts
apps/api/src/materials/materials.service.ts
apps/api/src/assignments/assignments.service.ts
apps/api/src/corrections/correction.service.ts

apps/mobile/lib/features/attendance/presensi_page.dart
```
