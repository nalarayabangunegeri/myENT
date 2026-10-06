import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/helpers.dart';

const alasan = [
  'SICK',
  'ACADEMIC',
  'BEREAVEMENT',
  'ORGANIZATION',
  'DISPENSATION',
  'OTHER',
];

class AbsencePage extends StatefulWidget {
  const AbsencePage({super.key});
  @override
  State<AbsencePage> createState() => _AbsencePageState();
}

class _AbsencePageState extends State<AbsencePage> {
  List rows = [];
  List klaim = [];
  bool tabKlaim = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.get('/absence-requests/me?limit=50');
      setState(() => rows = r['data']);
    } catch (_) {}
    try {
      final r = await Api.get('/corrections/me?limit=50');
      setState(() => klaim = r['data']);
    } catch (_) {}
  }

  Future<void> ajukan() async {
    final meetings = await Api.get('/meetings?limit=50');
    final list = (meetings['data'] as List?) ?? [];
    if (!mounted) return;
    String? mid = list.isNotEmpty ? list.first['id'] : null;
    String tipe = alasan.first;
    final detail = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Ajukan izin'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: mid,
              items: [
                for (final m in list)
                  DropdownMenuItem(
                    value: m['id'] as String,
                    child: Text(
                      '${m['title']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) => mid = v,
            ),
            DropdownButtonFormField<String>(
              initialValue: tipe,
              items: [
                for (final a in alasan)
                  DropdownMenuItem(value: a, child: Text(a)),
              ],
              onChanged: (v) => tipe = v ?? tipe,
            ),
            TextField(
              controller: detail,
              decoration: const InputDecoration(labelText: 'Keterangan'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Kirim'),
          ),
        ],
      ),
    );
    if (ok != true || mid == null) return;
    try {
      await Api.postMultipart(
        '/meetings/$mid/absence-requests',
        {'reasonType': tipe, 'reasonDetail': detail.text},
        null,
        'attachment',
      );
      _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> ajukanKlaim() async {
    final meetings = await Api.get('/meetings?limit=50');
    final list = (meetings['data'] as List?) ?? [];
    if (!mounted) return;
    String? mid = list.isNotEmpty ? list.first['id'] : null;
    final klaimC = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Klaim kehadiran'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: mid,
              items: [
                for (final m in list)
                  DropdownMenuItem(
                    value: m['id'] as String,
                    child: Text(
                      '${m['title']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) => mid = v,
            ),
            TextField(
              controller: klaimC,
              decoration: const InputDecoration(
                labelText: 'Ceritakan (min 10)',
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Kirim'),
          ),
        ],
      ),
    );
    if (ok != true || mid == null) return;
    try {
      await Api.post('/meetings/$mid/corrections', {'claim': klaimC.text});
      _load();
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
    final data = tabKlaim ? klaim : rows;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Izin / Sakit'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(40),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: () => setState(() => tabKlaim = false),
                child: Text(
                  'Izin',
                  style: TextStyle(
                    color: !tabKlaim ? Colors.white : Colors.white70,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => setState(() => tabKlaim = true),
                child: Text(
                  'Klaim hadir',
                  style: TextStyle(
                    color: tabKlaim ? Colors.white : Colors.white70,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: tabKlaim ? ajukanKlaim : ajukan,
        child: const Icon(Icons.add),
      ),
      body: data.isEmpty
          ? const Center(child: Text('Belum ada pengajuan'))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                itemCount: data.length,
                itemBuilder: (_, i) {
                  final r = data[i];
                  return ListTile(
                    title: Text(
                      tabKlaim ? '${r['claim'] ?? ''}' : '${r['reasonType']}',
                    ),
                    subtitle: Text(
                      '${statusLabel[r['status']] ?? r['status']}',
                    ),
                    trailing: r['status'] == 'PENDING'
                        ? TextButton(
                            onPressed: () async {
                              await Api.patch(
                                tabKlaim
                                    ? '/corrections/${r['id']}/cancel'
                                    : '/absence-requests/${r['id']}/cancel',
                              );
                              _load();
                            },
                            child: const Text('Tarik'),
                          )
                        : null,
                  );
                },
              ),
            ),
    );
  }
}
