import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map? me;
  Map? poin;
  final lama = TextEditingController();
  final baru = TextEditingController();
  String? msg;
  String? err;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    lama.dispose();
    baru.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await Api.get('/auth/me');
      if (mounted) setState(() => me = r);
    } catch (e) {
      if (mounted) setState(() => err = e.toString());
    }
    try {
      final r = await Api.get('/points/me');
      if (mounted) setState(() => poin = r);
    } catch (_) {}
  }

  Future<void> ganti() async {
    if (busy) return;
    if (baru.text.length < 10) {
      setState(() => msg = 'Password baru minimal 10 karakter');
      return;
    }
    setState(() {
      busy = true;
      msg = null;
    });
    try {
      await Api.post('/auth/change-password', {'oldPassword': lama.text, 'newPassword': baru.text});
      if (mounted) {
        setState(() {
          msg = 'Password diganti.';
          lama.clear();
          baru.clear();
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => msg = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> keluar() async {
    final nav = Navigator.of(context);
    if (mounted) setState(() => busy = true);
    try {
      final ref = await Session.refresh;
      if (ref != null) {
        await Api.post('/auth/logout', {'refreshToken': ref}).catchError((_) => null);
      }
    } catch (_) {
      /* tetap keluar lokal */
    }
    await Session.clear();
    nav.pushReplacementNamed('/login');
  }

  @override
  Widget build(BuildContext context) {
    if (err != null && me == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Profil')),
        body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(children: [Center(child: Text(err!, semanticsLabel: 'Gagal memuat profil'))]),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AppCard(
              child: Row(
                children: [
                  InitialAvatar(name: '${me?['name'] ?? '?'}', size: 56),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${me?['name'] ?? 'Memuat…'}', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: brandDeep)),
                        Text('${me?['nim'] ?? ''} · ${me?['division'] ?? ''}', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                        if (poin != null) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: const BoxDecoration(color: goldSoft, borderRadius: BorderRadius.all(Radius.circular(99))),
                            child: Text(
                              '${poin!['points'] ?? 0} poin · peringkat ${poin!['rank'] ?? '–'} · 🔥${poin!['streak'] ?? 0}x',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: warnFg),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (poin != null && ((poin!['badges'] as List?) ?? []).isNotEmpty) ...[
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHead(title: 'Lencana'),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final b in (poin!['badges'] as List? ?? []))
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                            decoration: const BoxDecoration(color: brandSoft, borderRadius: BorderRadius.all(Radius.circular(99))),
                            child: Text('${b['label']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: brand)),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionHead(title: 'Ganti Password'),
                  if (msg != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(color: brandSoft, borderRadius: BorderRadius.all(Radius.circular(12))),
                      child: Text(msg!, style: const TextStyle(color: brandDeep, fontSize: 13)),
                    ),
                  TextField(controller: lama, decoration: const InputDecoration(labelText: 'Password lama'), obscureText: true),
                  const SizedBox(height: 10),
                  TextField(controller: baru, decoration: const InputDecoration(labelText: 'Password baru (min 10)'), obscureText: true),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: busy ? null : ganti, child: const Text('Ganti password')),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: busy ? null : keluar,
                icon: const Icon(Icons.logout, color: badFg),
                label: const Text('Keluar', style: TextStyle(color: badFg)),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                  side: const BorderSide(color: badFg),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
