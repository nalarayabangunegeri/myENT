import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/session.dart';

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
            Text(me?['name'] ?? 'Memuat…', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text('${me?['nim'] ?? ''} · ${me?['division'] ?? ''}'),
            const SizedBox(height: 8),
            if (poin != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${poin!['points'] ?? 0} poin · peringkat ${poin!['rank'] ?? '–'} · 🔥${poin!['streak'] ?? 0}x',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      children: [for (final b in (poin!['badges'] as List? ?? [])) Chip(label: Text('${b['label']}'))],
                    ),
                  ]),
                ),
              ),
            const SizedBox(height: 16),
            if (msg != null) Text(msg!),
            TextField(controller: lama, decoration: const InputDecoration(labelText: 'Password lama'), obscureText: true),
            TextField(controller: baru, decoration: const InputDecoration(labelText: 'Password baru (min 10)'), obscureText: true),
            ElevatedButton(onPressed: busy ? null : ganti, child: const Text('Ganti password')),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: busy ? null : keluar,
              child: const Text('Keluar'),
            ),
          ],
        ),
      ),
    );
  }
}
