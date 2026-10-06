import 'package:flutter_test/flutter_test.dart';
import 'package:jurnalistik_app/core/deeplink.dart';
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

  test('deep-link: tipe → tab', () {
    expect(tabFor('AbsenceRequest'), 3);
    expect(tabFor('Meeting'), 0);
    expect(tabFor('Assignment'), 1);
    expect(tabFor('Loan'), 1);
    expect(tabFor(null), 4);
    expect(tabFor('alien'), 4);
  });
}
