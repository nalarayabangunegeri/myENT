import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/helpers.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../attendance/presensi_page.dart';
import '../attendance/qr_scan_page.dart';

String _norm(String s) => s + '=' * ((4 - s.length % 4) % 4);

String _hari(String? iso) {
  if (iso == null) return '';
  try {
    final d = DateTime.parse(iso).toUtc().add(const Duration(hours: 7));
    return d.day.toString().padLeft(2, '0');
  } catch (_) {
    return '';
  }
}

String _bulan(String? iso) {
  if (iso == null) return '';
  try {
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return mo[DateTime.parse(iso).toUtc().add(const Duration(hours: 7)).month - 1];
  } catch (_) {
    return '';
  }
}

class MeetingsPage extends StatefulWidget {
  final void Function(int)? onGo;
  const MeetingsPage({super.key, this.onGo});
  @override
  State<MeetingsPage> createState() => _MeetingsPageState();
}

class _MeetingsPageState extends State<MeetingsPage> {
  List rows = [];
  String? nama;
  String? err;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!loading) setState(() => loading = true);
    try {
      final results = await Future.wait([
        Api.get('/meetings?limit=50'),
        Api.get('/auth/me').catchError((_) => null),
      ]);
      if (!mounted) return;
      final r = results[0];
      final me = results[1];
      setState(() {
        rows = r['data'];
        if (me is Map) nama = (me['name'] ?? me['user']?['name'])?.toString().split(' ').firstOrNull;
        err = null;
      });
    } on MustChange {
      if (mounted) Navigator.pushReplacementNamed(context, '/login');
    } catch (e) {
      if (mounted) setState(() => err = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _scan() async {
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
      final m = await Api.get("/meetings/$mid");
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
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : err != null
                ? Center(child: Text(err!, semanticsLabel: 'Gagal memuat'))
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Row(
                          children: [
                            InitialAvatar(name: nama ?? '?'),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Halo, ${nama ?? 'Anggota'} 👋', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: brandDeep)),
                                  const Text('Siap presensi hari ini?', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                ],
                              ),
                            ),
                            IconButton.filledTonal(
                              onPressed: () => widget.onGo?.call(4),
                              icon: const Icon(Icons.notifications_outlined),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        AppCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SectionHead(title: 'Akses Cepat'),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  QuickAction(icon: Icons.qr_code_scanner, label: 'Scan QR', tint: goldSoft, fg: warnFg, onTap: _scan),
                                  QuickAction(icon: Icons.assignment_outlined, label: 'Tugas', tint: brandSoft, fg: brand, onTap: () => widget.onGo?.call(1)),
                                  QuickAction(icon: Icons.history_outlined, label: 'Riwayat', tint: okBg, fg: okFg, onTap: () => widget.onGo?.call(2)),
                                  QuickAction(icon: Icons.healing_outlined, label: 'Izin', tint: warnBg, fg: warnFg, onTap: () => widget.onGo?.call(3)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        SectionHead(
                          title: 'Kegiatan',
                          sub: rows.isEmpty ? null : '${rows.length} kegiatan',
                          action: IconButton(onPressed: _scan, icon: const Icon(Icons.qr_code_scanner, color: brand), tooltip: 'Scan QR'),
                        ),
                        if (rows.isEmpty)
                          const AppCard(child: EmptyState(text: 'Belum ada kegiatan', icon: Icons.event_outlined))
                        else
                          ...rows.map((m) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: AppCard(
                                  padding: const EdgeInsets.all(12),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(12),
                                    onTap: () async {
                                      final ok = await Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => PresensiPage(meeting: Map.from(m)),
                                        ),
                                      );
                                      if (ok == true) _load();
                                    },
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 52,
                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                          decoration: const BoxDecoration(color: brandSoft, borderRadius: BorderRadius.all(Radius.circular(14))),
                                          child: Column(
                                            children: [
                                              Text(_hari(m['startAt']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: brand)),
                                              Text(_bulan(m['startAt']), style: const TextStyle(fontSize: 11, color: brand)),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text('${m['title'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
                                              const SizedBox(height: 4),
                                              Row(
                                                children: [
                                                  Flexible(child: Text(wib(m['startAt']), style: TextStyle(fontSize: 12, color: Colors.grey.shade500))),
                                                  const SizedBox(width: 8),
                                                  StatusChip(status: '${m['status']}'),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                        const Icon(Icons.chevron_right, color: Colors.grey),
                                      ],
                                    ),
                                  ),
                                ),
                              )),
                      ],
                    ),
                  ),
      ),
    );
  }
}
