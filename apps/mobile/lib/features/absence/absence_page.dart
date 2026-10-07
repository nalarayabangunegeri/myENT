import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

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
  String? err;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.get('/absence-requests/me?limit=50');
      if (mounted) setState(() => rows = r['data']);
    } catch (e) {
      if (mounted) setState(() => err = e.toString());
    }
    try {
      final r = await Api.get('/corrections/me?limit=50');
      if (mounted) setState(() => klaim = r['data']);
    } catch (e) {
      if (mounted) setState(() => err = e.toString());
    }
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
        "/meetings/$mid/absence-requests",
        {'reasonType': tipe, 'reasonDetail': detail.text},
        null,
        'attachment',
      );
      if (mounted) _load();
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
      await Api.post("/meetings/$mid/corrections", {'claim': klaimC.text});
      if (mounted) _load();
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
      appBar: AppBar(title: const Text('Izin / Sakit')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: tabKlaim ? ajukanKlaim : ajukan,
        icon: const Icon(Icons.add),
        label: Text(tabKlaim ? 'Klaim' : 'Ajukan'),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: SegmentedButton<bool>(
            style: SegmentedButton.styleFrom(selectedBackgroundColor: brand, selectedForegroundColor: Colors.white),
            segments: const [
              ButtonSegment(value: false, label: Text('Izin')),
              ButtonSegment(value: true, label: Text('Klaim hadir')),
            ],
            selected: {tabKlaim},
            onSelectionChanged: (s) => setState(() => tabKlaim = s.first),
          ),
        ),
        if (err != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(err!, style: const TextStyle(color: badFg)),
          ),
        Expanded(
          child: data.isEmpty
              ? const AppCard(child: EmptyState(text: 'Belum ada pengajuan', icon: Icons.healing_outlined))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: data.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final r = data[i];
                      return AppCard(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tabKlaim ? '${r['claim'] ?? ''}' : '${r['reasonType']}',
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  StatusChip(status: '${r['status']}'),
                                ],
                              ),
                            ),
                            if (r['status'] == 'PENDING')
                              TextButton(
                                onPressed: () async {
                                  try {
                                    await Api.patch(
                                      tabKlaim
                                          ? "/corrections/${r['id']}/cancel"
                                          : "/absence-requests/${r['id']}/cancel",
                                    );
                                    if (mounted) _load();
                                  } on ApiException catch (e) {
                                    if (mounted) setState(() => err = e.message);
                                  }
                                },
                                child: const Text('Tarik'),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
        ),
      ]),
    );
  }
}
