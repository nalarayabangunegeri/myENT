// Helper murni (unit-testable): format WIB, retry presensi, status efektif.
// Waktu API = UTC ISO-8601; tampil Asia/Jakarta (+7, tanpa lib).
String wib(String? iso) {
  String p(int n) => n.toString().padLeft(2, '0');
  if (iso == null) return '–';
  final d = DateTime.parse(iso).toUtc().add(const Duration(hours: 7));
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return '${d.day} ${mo[d.month - 1]} ${p(d.hour)}:${p(d.minute)}';
}
String pct(dynamic v) => v == null ? '–' : '$v%';

// Kontrak retry (docs/API.md): 2xx/409-milik-sendiri = sukses; 400/404/410 = berhenti.
bool presensiSukses(int status) => (status >= 200 && status < 300) || status == 409;
bool presensiBerhenti(int status) => status == 400 || status == 404 || status == 410;
bool bolehRetry(int percobaan) => percobaan < 3;

const statusLabel = {
  'PRESENT': 'Hadir',
  'PERMITTED': 'Izin',
  'SICK': 'Sakit',
  'DISPENSATION': 'Dispensasi',
  'ABSENT': 'Alpha',
  'PENDING': 'Menunggu',
  'APPROVED': 'Disetujui',
  'REJECTED': 'Ditolak',
  'CANCELLED': 'Dibatalkan',
};
