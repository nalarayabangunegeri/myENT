import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/api_client.dart';
import '../../core/helpers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

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
    final numPct = r['percentage'] is num ? (r['percentage'] as num).toDouble() : null;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Riwayat'),
        actions: [
          IconButton(icon: const Icon(Icons.share_outlined), onPressed: bagikan, tooltip: 'Bagikan rekap'),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppCard(
              child: Row(
                children: [
                  SizedBox(
                    width: 84,
                    height: 84,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 84,
                          height: 84,
                          child: CircularProgressIndicator(
                            value: numPct == null ? 0 : numPct / 100,
                            strokeWidth: 9,
                            backgroundColor: const Color(0xFFE8ECF4),
                            valueColor: const AlwaysStoppedAnimation(brand),
                            strokeCap: StrokeCap.round,
                          ),
                        ),
                        Text(pct(r['percentage']), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: brandDeep)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Kehadiran Efektif', style: TextStyle(fontWeight: FontWeight.bold, color: brandDeep)),
                        const SizedBox(height: 4),
                        Text(
                          'Hadir ${r['present']} · Izin ${r['permitted']} · Sakit ${r['sick']} · Alpha ${r['absent']}',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                        if (piket != null) ...[
                          const SizedBox(height: 4),
                          Text('Piket ${piket!['attended']}/${piket!['scheduled']}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (tugasPiket.isNotEmpty) ...[
              const SectionHead(title: 'Piket Berikutnya'),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final a in tugasPiket)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            const Icon(Icons.cleaning_services_outlined, size: 18, color: brand),
                            const SizedBox(width: 8),
                            Expanded(child: Text('${a['meeting']?['title']} (${wib(a['meeting']?['startAt'])})', style: const TextStyle(fontSize: 13))),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            const SectionHead(title: 'Riwayat Kehadiran'),
            if (hist.isEmpty)
              const AppCard(child: EmptyState(text: 'Belum ada riwayat', icon: Icons.history_outlined))
            else
              ...hist.map(
                (h) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${h['meeting']?['title'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              const SizedBox(height: 2),
                              Text(
                                [
                                  statusLabel[h['status']] ?? h['status'],
                                  if (h['corrected'] == true) 'Dikoreksi pengurus: ${h['adjustmentReason'] ?? ''}',
                                ].join(' · '),
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                              ),
                            ],
                          ),
                        ),
                        StatusChip(status: '${h['status']}'),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
