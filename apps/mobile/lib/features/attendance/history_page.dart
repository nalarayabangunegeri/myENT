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
  String? err;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      Api.get('/attendance/recap/me').catchError((e) => e),
      Api.get('/duty/summary/me').catchError((e) => e),
      Api.get('/duty/assignments/me').catchError((e) => e),
    ]);
    if (!mounted) return;
    if (results[0] is ApiException) {
      setState(() => err = (results[0] as ApiException).message);
      return;
    }
    setState(() {
      rekap = results[0];
      if (results[1] is Map) piket = results[1];
      if (results[2] is List) {
        tugasPiket = (results[2] as List).where((a) => a['meeting']?['status'] == 'PUBLISHED' || a['meeting']?['status'] == 'ONGOING').toList();
      }
    });
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
    if (err != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Riwayat')),
        body: Center(child: Text(err!, semanticsLabel: 'Gagal memuat riwayat')),
      );
    }
    final r = rekap;
    if (r == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final hist = (r['history'] as List?) ?? [];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Riwayat'),
        actions: [
          IconButton(icon: const Icon(Icons.share), onPressed: bagikan),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: hist.isEmpty && tugasPiket.isEmpty
            ? ListView(children: const [Center(child: Text('Belum ada riwayat'))])
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
      ),
    );
  }
}
