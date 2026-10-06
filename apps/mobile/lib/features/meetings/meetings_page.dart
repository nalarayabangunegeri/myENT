import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/helpers.dart';
import '../attendance/presensi_page.dart';
import '../attendance/qr_scan_page.dart';

String _norm(String s) => s + '=' * ((4 - s.length % 4) % 4);

class MeetingsPage extends StatefulWidget {
  const MeetingsPage({super.key});
  @override
  State<MeetingsPage> createState() => _MeetingsPageState();
}

class _MeetingsPageState extends State<MeetingsPage> {
  List rows = [];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.get('/meetings?limit=50');
      setState(() => rows = r['data']);
    } on MustChange {
      if (mounted) Navigator.pushReplacementNamed(context, '/login');
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kegiatan'),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () async {
              final nav = Navigator.of(context);
              final msg = ScaffoldMessenger.of(context);
              final token = await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const QrScanPage()),
              );
              if (token == null || !mounted) return;
              try {
                final payload = (token as String).split('.').first;
                final mid = jsonDecode(
                  utf8.decode(base64Url.decode(_norm(payload))),
                )['mid'];
                final m = await Api.get('/meetings/$mid');
                if (!mounted) return;
                await nav.push(
                  MaterialPageRoute(
                    builder: (_) => PresensiPage(meeting: m, qrToken: token),
                  ),
                );
                _load();
              } on ApiException catch (e) {
                msg.showSnackBar(SnackBar(content: Text(e.message)));
              }
            },
          ),
        ],
      ),
      body: rows.isEmpty
          ? const Center(child: Text('Belum ada kegiatan'))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                itemCount: rows.length,
                itemBuilder: (_, i) {
                  final m = rows[i];
                  return ListTile(
                    title: Text(m['title'] ?? ''),
                    subtitle: Text(
                      '${wib(m['startAt'])} · ${statusLabel[m['status']] ?? m['status']}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      final ok = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => PresensiPage(meeting: Map.from(m)),
                        ),
                      );
                      if (ok == true) _load();
                    },
                  );
                },
              ),
            ),
    );
  }
}
