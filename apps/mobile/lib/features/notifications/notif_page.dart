import 'package:flutter/material.dart';
import '../../core/api_client.dart';

class NotifPage extends StatefulWidget {
  const NotifPage({super.key});
  @override
  State<NotifPage> createState() => _NotifPageState();
}

class _NotifPageState extends State<NotifPage> {
  List rows = [];
  String? err;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.get('/notifications/me?limit=50');
      if (mounted) {
        setState(() {
          rows = r['data'];
          err = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => err = e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (err != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifikasi')),
        body: Center(child: Text(err!, semanticsLabel: 'Gagal memuat notifikasi')),
      );
    }
    if (rows.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifikasi')),
        body: const Center(child: Text('Belum ada notifikasi')),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Notifikasi')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          itemCount: rows.length,
          itemBuilder: (_, i) {
            final n = rows[i];
            final unread = n['readAt'] == null;
            return Semantics(
              button: true,
              label: unread ? 'Belum dibaca: ${n['title']}' : '${n['title']}',
              child: ListTile(
                title: Text(n['title'] ?? '', style: TextStyle(fontWeight: unread ? FontWeight.bold : null)),
                subtitle: Text(n['body'] ?? ''),
                trailing: unread ? const Icon(Icons.circle, size: 10, semanticLabel: 'Baru') : null,
                onTap: () async {
                  if (unread) {
                    try {
                      await Api.patch("/notifications/${n['id']}/read");
                      _load();
                    } catch (_) {}
                  }
                },
              ),
            );
          },
        ),
      ),
    );
  }
}
