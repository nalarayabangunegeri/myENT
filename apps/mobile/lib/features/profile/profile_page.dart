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
  @override
  void initState() {
    super.initState();
    Api.get('/auth/me').then((r) => setState(() => me = r)).catchError((_) {});
    Api.get('/points/me').then((r) => setState(() => poin = r)).catchError((_) {});
  }

  Future<void> ganti() async {
    try {
      await Api.post('/auth/change-password', {'oldPassword': lama.text, 'newPassword': baru.text});
      setState(() => msg = 'Password diganti.');
    } on ApiException catch (e) {
      setState(() => msg = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(me?['name'] ?? '…', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
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
          ElevatedButton(onPressed: ganti, child: const Text('Ganti password')),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () async {
              final ref = await Session.refresh;
              if (ref != null) {
                await Api.post('/auth/logout', {'refreshToken': ref});
              }
              await Session.clear();
              if (!context.mounted) return;
              Navigator.pushReplacementNamed(context, '/login');
            },
            child: const Text('Keluar'),
          ),
        ]),
      ),
    );
  }
}
