import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jurnalistik_app/core/widgets.dart';

Widget wrap(Widget w) => MaterialApp(home: Scaffold(body: w));

void main() {
  testWidgets('StatusChip tampilkan label Indonesia', (t) async {
    await t.pumpWidget(wrap(const StatusChip(status: 'PRESENT')));
    expect(find.text('Hadir'), findsOneWidget);
    await t.pumpWidget(wrap(const StatusChip(status: 'PENDING')));
    expect(find.text('Menunggu'), findsOneWidget);
  });

  testWidgets('EmptyState tampilkan teks', (t) async {
    await t.pumpWidget(wrap(const EmptyState(text: 'Belum ada tugas')));
    expect(find.text('Belum ada tugas'), findsOneWidget);
  });

  testWidgets('InitialAvatar inisial dua kata', (t) async {
    await t.pumpWidget(wrap(const InitialAvatar(name: 'Budi Santoso')));
    expect(find.text('BS'), findsOneWidget);
  });
}
