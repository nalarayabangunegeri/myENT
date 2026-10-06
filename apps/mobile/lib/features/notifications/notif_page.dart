import 'package:flutter/material.dart';
import '../../core/api_client.dart';

class NotifPage extends StatefulWidget {
  const NotifPage({super.key});
  @override
  State<NotifPage> createState() => _NotifPageState();
}

class _NotifPageState extends State<NotifPage> {
  List rows = [];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.get('/notifications/me?limit=50');
      setState(() => rows = r['data']);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifikasi')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          itemCount: rows.length,
          itemBuilder: (_, i) {
            final n = rows[i];
            final unread = n['readAt'] == null;
            return ListTile(
              title: Text(n['title'] ?? '', style: TextStyle(fontWeight: unread ? FontWeight.bold : null)),
              subtitle: Text(n['body'] ?? ''),
              onTap: () async {
                if (unread) {
                  await Api.patch('/notifications/${n['id']}/read');
                  _load();
                }
              },
            );
          },
        ),
      ),
    );
  }
}
