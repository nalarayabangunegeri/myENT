// Deep-link notifikasi: refType/refId (FCM data + inbox) → tab tujuan.
int tabFor(String? refType) {
  switch (refType) {
    case 'AbsenceRequest':
    case 'CorrectionRequest':
      return 3; // Izin
    case 'Meeting':
    case 'Attendance':
      return 0; // Kegiatan
    case 'Material':
    case 'Assignment':
    case 'Submission':
    case 'Loan':
      return 1; // Tugas (& pinjam)
    default:
      return 4; // Notif
  }
}
