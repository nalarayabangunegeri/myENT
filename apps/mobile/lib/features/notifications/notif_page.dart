import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Notifikasi')),
      body: err != null
          ? Center(child: Text(err!, semanticsLabel: 'Gagal memuat notifikasi'))
          : rows.isEmpty
              ? const AppCard(child: EmptyState(text: 'Belum ada notifikasi', icon: Icons.notifications_outlined))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: rows.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final n = rows[i];
                      final unread = n['readAt'] == null;
                      return Semantics(
                        button: true,
                        label: unread ? 'Belum dibaca: ${n['title']}' : '${n['title']}',
                        child: AppCard(
                          padding: const EdgeInsets.all(12),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () async {
                              if (unread) {
                                try {
                                  await Api.patch("/notifications/${n['id']}/read");
                                  _load();
                                } catch (_) {}
                              }
                            },
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: unread ? goldSoft : brandSoft,
                                    borderRadius: const BorderRadius.all(Radius.circular(14)),
                                  ),
                                  child: Icon(Icons.notifications_outlined, color: unread ? warnFg : brand),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${n['title'] ?? ''}',
                                        style: TextStyle(fontWeight: unread ? FontWeight.bold : FontWeight.w600, color: brandDeep),
                                      ),
                                      const SizedBox(height: 2),
                                      Text('${n['body'] ?? ''}', style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                                    ],
                                  ),
                                ),
                                if (unread) const Padding(padding: EdgeInsets.only(top: 6), child: Icon(Icons.circle, size: 10, color: gold)),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
