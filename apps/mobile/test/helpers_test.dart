import 'package:flutter_test/flutter_test.dart';
import 'package:jurnalistik_app/core/helpers.dart';

void main() {
  test('wib: UTC → WIB +7', () {
    expect(wib('2026-10-10T01:00:00.000Z'), '10 Okt 08:00');
  });

  test('kontrak retry presensi (docs/API.md)', () {
    expect(presensiSukses(200), true);
    expect(presensiSukses(409), true); // duplikat milik sendiri = sukses
    expect(presensiBerhenti(400), true);
    expect(presensiBerhenti(410), true);
    expect(bolehRetry(2), true);
    expect(bolehRetry(3), false);
  });

  test('label status + persentase kosong', () {
    expect(statusLabel['ABSENT'], 'Alpha');
    expect(pct(null), '–');
    expect(pct(91.7), '91.7%');
  });
}
