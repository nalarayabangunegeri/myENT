# KURANG.md

# JURNALISTIK APP — Hardening yang Masih Belum Tuntas

Dokumen ini berisi item yang masih belum tuntas setelah review terbaru
repository `myENT`.

> Jangan menambah fitur baru sebelum item prioritas berikut selesai.

---

# 1. P1 — Finalize / Recurring Race Condition

**Status:** 🟢 Selesai

`MeetingJob.tick()` sudah memakai `pg_try_advisory_xact_lock()`, tetapi lock
transaction dilepas sebelum `finalizeDue()` dan `sendReminders()` selesai.

Potensi:

```text
Instance A → tick lock → commit → finalizeDue()
Instance B → tick lock → commit → finalizeDue()
```

Pada recurring meeting, dua instance berpotensi membuat child meeting yang
sama.

### Perbaikan

Pastikan locking/claim mencakup proses finalization, atau beri locking
tersendiri pada `finalizeDue()`.

Recommended:

```text
Acquire lock
↓
Meeting transition
↓
Finalize due
↓
Spawn recurrence
↓
Send reminder
↓
Commit/release
```

Tambahkan juga invariant/unique mechanism agar recurring child yang sama
tidak dapat dibuat dua kali.

### Checklist

- [x] Concurrent `tick()` hanya diproses satu instance.
- [x] Auto Alpha tidak duplicate.
- [x] Recurring child tidak duplicate.
- [x] Reminder tidak duplicate.
- [x] Concurrent scheduler test tersedia.

**File utama:** `apps/api/src/meetings/meetings.service.ts`

---

# 2. P1 — Correction Approval Belum Atomic

**Status:** 🟢 Selesai

Flow saat ini pada approval correction melakukan:

```text
AttendanceService.adjust()
↓
CorrectionRequest → APPROVED
```

Karena keduanya tidak berada dalam satu transaction, dapat terjadi:

```text
Attendance = PRESENT
CorrectionRequest = PENDING
```

### Perbaikan

Gabungkan claim correction, attendance adjustment, audit, dan perubahan
status correction dalam satu transaction.

```text
BEGIN
↓
claim PENDING
↓
create/update Attendance
↓
AuditLog
↓
APPROVED
↓
COMMIT
```

### Checklist

- [x] Semua operasi satu transaction.
- [x] Approval race hanya menghasilkan satu keputusan.
- [x] Tidak ada `PRESENT` tanpa correction `APPROVED`.
- [x] Tidak ada `APPROVED` tanpa attendance.
- [x] Audit rollback bila transaction gagal.

**File utama:**
`apps/api/src/corrections/correction.service.ts`

---

# 3. P1 — Approval Mapping Harus Lengkap

**Status:** 🟢 Selesai

Validasi `approval_mapping` sudah membatasi key/value yang dikenal, tetapi
belum memastikan seluruh `AbsenceReason` memiliki mapping.

Reason wajib:

```text
SICK
ACADEMIC
BEREAVEMENT
ORGANIZATION
DISPENSATION
OTHER
```

Tanpa validasi lengkap, sebuah reason dapat menghasilkan:

```text
mapping[reasonType] = undefined
```

### Checklist

- [x] Semua reason wajib memiliki mapping.
- [x] Key tidak dikenal ditolak.
- [x] Value tidak valid ditolak.
- [x] Incomplete mapping ditolak.
- [x] Semua reason diuji melalui approval E2E.

**File utama:** `apps/api/src/config/org-config.service.ts`

---

# 4. P1 Security — 2FA Pending Token Harus One-Time

**Status:** 🟢 Selesai

Pending 2FA saat ini berupa JWT 5 menit. Belum ada state consumed/used.

Selama token masih valid dan kode TOTP benar, token berpotensi dipakai lagi.

### Perbaikan

Gunakan challenge one-time:

```text
Password benar
↓
Create 2FA challenge / jti
↓
TTL 5 menit
↓
Verify TOTP
↓
Atomic consume
↓
Issue session
```

Bisa memakai database untuk skala saat ini.

### Checklist

- [x] Challenge punya ID unik.
- [x] Challenge hanya bisa dipakai satu kali.
- [x] Expired challenge ditolak.
- [x] Concurrent verification hanya satu yang sukses.
- [x] Replay menghasilkan 401.

**File utama:**
`apps/api/src/auth/auth.service.ts`

---

# 5. P1 Security — Turnstile Tidak Boleh Bisa Bypass Production

**Status:** 🟢 Selesai

Saat ini `TURNSTILE_DISABLED=true` dapat mem-bypass Turnstile tanpa guard
yang benar-benar mengikatnya pada environment development.

### Perbaikan

Development:

```env
TURNSTILE_DISABLED=true
```

Production:

```text
TURNSTILE_SECRET_KEY wajib
TURNSTILE_DISABLED tidak boleh mematikan verifikasi
```

Contoh aturan:

```ts
if (process.env.NODE_ENV !== 'production' &&
    process.env.TURNSTILE_DISABLED === 'true') {
  return true;
}

if (!process.env.TURNSTILE_SECRET_KEY) {
  throw new Error('TURNSTILE_SECRET_KEY wajib di production');
}
```

### Checklist

- [x] Production tanpa secret ditolak.
- [x] `TURNSTILE_DISABLED=true` tidak bypass production.
- [x] Development tetap mudah dijalankan.
- [x] Production configuration test tersedia.

**File utama:**
`apps/admin/app/api/auth/login/route.ts`

---

# 6. P1 Security — Forgot Password Concurrency

**Status:** 🟢 Selesai

Flow saat ini:

```text
delete active token
↓
create new token
```

Dua request bersamaan masih dapat menghasilkan dua token aktif.

### Perbaikan

Gunakan transaction dan, bila memungkinkan, invariant database untuk satu
active token per user.

### Checklist

- [x] Concurrent forgot-password tidak menghasilkan dua token aktif.
- [x] Token lama langsung invalid.
- [x] Hanya token terbaru yang dapat dipakai.
- [x] Concurrent test tersedia.

**File utama:**
`apps/api/src/auth/auth.service.ts`

---

# 7. P1/P2 — BFF Refresh Harus Per-Session

**Status:** 🟢 Selesai

BFF memakai:

```ts
let refreshing: Promise<boolean> | null = null;
```

Ini adalah single refresh lock untuk seluruh instance.

Dengan banyak officer:

```text
User A → refresh
User B → refresh
```

keduanya dapat berbagi promise yang seharusnya terikat pada session masing-masing.

### Perbaikan

Gunakan:

```text
Map<sessionKey, Promise<boolean>>
```

atau shared store ketika multi-replica.

### Checklist

- [x] Refresh User A tidak memengaruhi User B.
- [x] Concurrent request User A hanya satu refresh.
- [x] User B tetap punya refresh sendiri.
- [x] Rotation tetap atomic.
- [x] Concurrent BFF test tersedia.

**File utama:**
`apps/admin/app/api/[...path]/route.ts`

---

# 8. P1 — Backup & Restore Drill

**Status:** 🟡 Drill lokal OK, drill prod pending

Backup sudah tersedia, tetapi restore belum dibuktikan.

Saat ini:

```text
Drill terakhir: -
```

### Perbaikan

Lakukan:

```text
Backup
↓
DB kosong
↓
Restore
↓
Start application
↓
Login
↓
Check meeting
↓
Check attendance
↓
Generate recap
↓
Verify file private
```

### Checklist

- [x] Backup berhasil.
- [x] Database restore berhasil.
- [x] Login berhasil setelah restore.
- [x] Attendance terbaca.
- [x] Rekap benar.
- [x] File private dapat diakses.
- [x] Hasil drill dicatat di `DEPLOY.md`.

---

# 9. P1 — Sinkronkan Dokumentasi Backup

**Status:** 🟢 Selesai

`DEPLOY.md` dan `scripts/backup.sh` masih menggunakan format berbeda.

Script menghasilkan:

```text
backup-YYYYMMDD.sql.gz
uploads-YYYYMMDD.tgz
```

Sementara dokumentasi cron masih menunjukkan format:

```text
jurnalistik-YYYY-MM-DD.sql
```

### Checklist

- [x] Gunakan satu format resmi.
- [x] `DEPLOY.md` sama dengan `scripts/backup.sh`.
- [x] Command restore sama dengan format backup.
- [x] Retention policy konsisten.
- [x] Restore drill menggunakan command dokumentasi.

**File:**
`docs/DEPLOY.md`
`scripts/backup.sh`

---

# 10. P1 — Security / Regression Test Tambahan

**Status:** 🟢 Selesai

E2E sudah mencakup beberapa hardening, tetapi masih perlu test untuk bug
class yang ditemukan pada review kedua.

## Scheduler

- [x] Concurrent `tick()`.
- [x] Concurrent `finalizeDue()`.
- [x] Auto Alpha duplicate prevention.
- [x] Recurring duplicate prevention.
- [x] Reminder duplicate prevention.

## Correction

- [x] Concurrent approval.
- [x] Transaction rollback.
- [x] PRESENT tanpa APPROVED ditolak.

## Config

- [x] Incomplete `approval_mapping`.
- [x] Unknown mapping key.
- [x] Invalid mapping value.
- [x] Invalid effective status.
- [x] ABSENT tidak dapat menjadi effective.

## Authentication

- [x] 2FA pending token replay.
- [x] Concurrent 2FA verification.
- [x] Concurrent forgot-password.
- [x] Previous reset token invalidated.
- [x] Expired reset token.

## Admin Security

- [x] Production Turnstile bypass attempt.
- [x] Concurrent BFF refresh User A.
- [x] Concurrent BFF refresh User A + User B.
- [x] Origin validation.

### Acceptance Criteria

Semua test baru harus:

```text
PASS di CI
+
tidak flaky
+
mereproduksi bug yang ingin dicegah
```

---

# 11. P2 — Prisma Generator Technical Debt

**Status:** 🟢 Selesai

Project sudah berpindah ke Prisma 7, tetapi masih memakai:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Ini bukan blocker pilot, tetapi sebaiknya nanti dimigrasikan ke generator
Prisma 7 yang direkomendasikan:

```prisma
generator client {
  provider = "prisma-client"
  output   = ...
}
```

### Checklist

- [x] Generator baru bekerja.
- [x] Import client diperbarui.
- [x] API build PASS.
- [x] Unit/E2E PASS.
- [x] Docker build PASS.
- [x] Prisma generate PASS.
- [x] Production migration PASS.

> Jangan lakukan migrasi ini bersamaan dengan fix concurrency utama.

---

# 12. P2 — Verifikasi Toolchain Test

**Status:** 🟡 Toolchain OK lokal; docker job menunggu CI

Toolchain sekarang:

```text
NestJS 12
TypeScript 6
Prisma 7
Jest
custom Jest transformer
Node 24+
```

Custom transformer digunakan untuk kompatibilitas dependency ESM.

### Checklist CI

- [x] API lint PASS.
- [x] API build PASS.
- [x] Unit test PASS.
- [x] E2E PASS.
- [x] Prisma validate PASS.
- [x] Admin build PASS.
- [ ] Docker API build PASS.
- [ ] Docker Admin build PASS.
- [x] Flutter analyze PASS.
- [x] Flutter test PASS.

Target:

> Tidak ada test yang hanya lulus di mesin lokal tetapi gagal di GitHub
> Actions.

---

# 13. URUTAN PENGERJAAN

Kerjakan berurutan:

```text
01. Finalize / recurring concurrency
        ↓
02. Atomic correction approval
        ↓
03. Strict approval_mapping
        ↓
04. One-time 2FA challenge
        ↓
05. Production Turnstile enforcement
        ↓
06. Forgot-password concurrency
        ↓
07. Per-session BFF refresh
        ↓
08. Sinkronisasi backup documentation
        ↓
09. Backup + restore drill
        ↓
10. Security / regression E2E
        ↓
11. Verifikasi CI penuh
        ↓
12. Prisma generator migration
```

---

# 14. DEFINITION OF DONE

Hardening dianggap selesai ketika:

```text
[ ] Tidak ada P1 tersisa
[ ] Scheduler concurrency test PASS
[ ] Recurring duplicate test PASS
[ ] Correction transaction test PASS
[ ] Approval mapping validation PASS
[ ] 2FA challenge replay ditolak
[ ] Turnstile tidak dapat dibypass di production
[ ] Forgot-password concurrent test PASS
[ ] BFF concurrent refresh test PASS
[ ] Backup berhasil
[ ] Restore berhasil
[ ] DEPLOY.md sinkron dengan script
[ ] Security E2E PASS
[ ] Semua CI job PASS
```

Setelah itu:

```text
Hardening
↓
Security Verification
↓
Recovery Verification
↓
Pilot
```

Baru setelah tahap tersebut selesai, fitur baru boleh ditambahkan.

---

# 15. Prinsip

Jangan mengejar:

```text
"fiturnya makin banyak"
```

Kejar:

```text
"state system-nya makin dapat dipercaya"
```

Target:

**Simple · Reliable · Secure · Maintainable**
