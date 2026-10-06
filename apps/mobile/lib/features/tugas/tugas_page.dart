import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_client.dart';
import '../../core/helpers.dart';

class TugasPage extends StatefulWidget {
  const TugasPage({super.key});
  @override
  State<TugasPage> createState() => _TugasPageState();
}

class _TugasPageState extends State<TugasPage>
    with SingleTickerProviderStateMixin {
  late TabController tab;
  List tugas = [];
  List materi = [];
  List kumpul = [];
  List barang = [];
  List pinjamku = [];
  @override
  void initState() {
    super.initState();
    tab = TabController(length: 4, vsync: this);
    _load();
  }

  Future<void> _load() async {
    // Paralel: dulu sekuensial (waterfall 5x).
    final results = await Future.wait([
      Api.get('/assignments?limit=50').then((v) => v['data']).catchError((_) => null),
      Api.get('/materials?limit=50').then((v) => v['data']).catchError((_) => null),
      Api.get('/submissions/me?limit=50').then((v) => v['data']).catchError((_) => null),
      Api.get('/items').then((v) => v is List ? v : (v['data'] ?? [])).catchError((_) => null),
      Api.get('/loans/me').then((v) => v is List ? v : (v['data'] ?? [])).catchError((_) => null),
    ]);
    if (!mounted) return;
    setState(() {
      if (results[0] != null) tugas = results[0];
      if (results[1] != null) materi = results[1];
      if (results[2] != null) kumpul = results[2];
      if (results[3] != null) barang = results[3];
      if (results[4] != null) pinjamku = results[4];
    });
  }

  Future<void> buka(String path) async {
    try {
      final r = await Api.get(path);
      final uri = Uri.parse(r['url']);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> kumpulkan(String assignmentId) async {
    final files = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    final f = files.firstOrNull?.path;
    if (f == null) return;
    if (File(f).lengthSync() > 5 * 1024 * 1024) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('File maksimal 5 MB')));
      return;
    }
    try {
      await Api.postMultipart(
        "/assignments/$assignmentId/submissions",
        {},
        File(f),
        'file',
      );
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Terkumpul')));
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> pinjam(Map item) async {
    final dueC = TextEditingController(text: DateTime.now().add(const Duration(days: 3)).toString().substring(0, 10));
    try {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text('Pinjam ${item['code']}'),
          content: TextField(controller: dueC, decoration: const InputDecoration(labelText: 'Tenggat (YYYY-MM-DD)')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Batal')),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Lanjut foto')),
          ],
        ),
      );
      if (ok != true) return;
      final x = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1280);
      if (x == null) return;
      if (File(x.path).lengthSync() > 5 * 1024 * 1024) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Foto maksimal 5 MB')));
        return;
      }
      final due = DateTime.tryParse(dueC.text);
      if (due == null || !due.isAfter(DateTime.now())) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tenggat harus tanggal valid di masa depan')));
        return;
      }
      await Api.postMultipart('/loans', {
        'itemId': '${item['id']}',
        'dueAt': due.toUtc().toIso8601String(),
      }, File(x.path), 'photo');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pinjaman aktif')));
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      dueC.dispose();
    }
  }

  @override
  void dispose() {
    tab.dispose();
    super.dispose();
  }

  Widget kosong(String s) => Center(child: Text(s));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tugas & Materi'),
        bottom: TabBar(
          controller: tab,
          tabs: const [
            Tab(text: 'Tugas'),
            Tab(text: 'Materi'),
            Tab(text: 'Kumpulanku'),
            Tab(text: 'Pinjam'),
          ],
        ),
      ),
      body: TabBarView(
        controller: tab,
        children: [
          tugas.isEmpty
              ? kosong('Belum ada tugas')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: tugas.length,
                    itemBuilder: (_, i) {
                      final t = tugas[i];
                      return ListTile(
                        title: Text(t['title'] ?? ''),
                        subtitle: Text('Deadline ${wib(t['deadline'])}'),
                        trailing: TextButton(
                          onPressed: () => kumpulkan(t['id']),
                          child: const Text('Kumpul'),
                        ),
                      );
                    },
                  ),
                ),
          materi.isEmpty
              ? kosong('Belum ada materi')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: materi.length,
                    itemBuilder: (_, i) {
                      final m = materi[i];
                      return ListTile(
                        title: Text(m['title'] ?? ''),
                        subtitle: Text(
                          '${((m['size'] ?? 0) / 1024).toStringAsFixed(0)} KB',
                        ),
                        trailing: TextButton(
                          onPressed: () => buka("/materials/${m['id']}/file"),
                          child: const Text('Buka'),
                        ),
                      );
                    },
                  ),
                ),
          kumpul.isEmpty
              ? kosong('Belum ada submission')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: kumpul.length,
                    itemBuilder: (_, i) {
                      final s = kumpul[i];
                      return ListTile(
                      title: Text(s['assignment']?['title'] ?? ''),
                      subtitle: Text(
                        '${s['status'] ?? ''} · ${wib(s['submittedAt'])}',
                      ),
                    );
                  },
                ),
              ),
          barang.isEmpty && pinjamku.isEmpty
              ? kosong('Belum ada barang')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    children: [
                      const ListTile(title: Text('Katalog', style: TextStyle(fontWeight: FontWeight.bold))),
                      ...barang.map(
                        (b) => ListTile(
                          title: Text('${b['code']} · ${b['name']}'),
                          subtitle: Text('${b['condition'] ?? ''} · ${b['status']}'),
                          trailing: b['status'] == 'AVAILABLE'
                              ? TextButton(onPressed: () => pinjam(b), child: const Text('Pinjam'))
                              : null,
                        ),
                      ),
                      const ListTile(title: Text('Pinjamanku', style: TextStyle(fontWeight: FontWeight.bold))),
                      ...pinjamku.map(
                        (l) => ListTile(
                          title: Text('${l['item']?['code']}'),
                          subtitle: Text('${l['status']} · kembali ${wib(l['dueAt'])}'),
                        ),
                      ),
                    ],
                  ),
                ),
        ],
      ),
    );
  }
}
