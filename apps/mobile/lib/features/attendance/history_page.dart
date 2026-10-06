import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/api_client.dart';
import '../../core/helpers.dart';

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});
  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  Map? rekap;
  Map? piket;
  List tugasPiket = [];
  @override
  void initState() {
    super.initState();
    Api.get(
      '/attendance/recap/me',
    ).then((r) => setState(() => rekap = r)).catchError((_) {});
    Api.get('/duty/summary/me').then((r) => setState(() => piket = r)).catchError((_) {});
    Api.get('/duty/assignments/me').then((list) {
      setState(() => tugasPiket = (list as List).where((a) => a['meeting']?['status'] == 'PUBLISHED' || a['meeting']?['status'] == 'ONGOING').toList());
    }).catchError((_) {});
  }

  Future<void> bagikan() async {
    try {
      final bytes = await Api.getBytes('/attendance/recap/me.pdf');
      final f = File('${(await getTemporaryDirectory()).path}/rekap.pdf');
      await f.writeAsBytes(bytes);
      await SharePlus.instance.share(
        ShareParams(files: [XFile(f.path)], text: 'Rekap kehadiran'),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = rekap;
    if (r == null) return const Scaffold(body: Center(child: Text('Memuat…')));
    final hist = (r['history'] as List?) ?? [];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Riwayat'),
        actions: [
          IconButton(icon: const Icon(Icons.share), onPressed: bagikan),
        ],
      ),
      body: hist.isEmpty
          ? const Center(child: Text('Belum ada riwayat'))
          : ListView(
              children: [
                ListTile(
                  title: Text(
                    'Kehadiran: ${pct(r['percentage'])}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    'Hadir ${r['present']} · Izin ${r['permitted']} · Sakit ${r['sick']} · Alpha ${r['absent']}',
                  ),
                ),
                if (tugasPiket.isNotEmpty)
                  ListTile(
                    title: const Text('Piket berikut', style: TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(tugasPiket.map((a) => '${a['meeting']?['title']} (${wib(a['meeting']?['startAt'])})').join('\n')),
                  ),
                if (piket != null)
                  ListTile(
                    title: const Text('Piket selesai'),
                    subtitle: Text('Hadir ${piket!['attended']}/${piket!['scheduled']}'),
                  ),
                ...hist.map(
                  (h) => ListTile(
                    title: Text(h['meeting']?['title'] ?? ''),
                    subtitle: Text(
                      [
                        statusLabel[h['status']] ?? h['status'],
                        if (h['corrected'] == true)
                          'Dikoreksi pengurus: ${h['adjustmentReason'] ?? ''}',
                      ].join(' · '),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
