import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/session.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final nim = TextEditingController();
  final pass = TextEditingController();
  final baru = TextEditingController();
  bool mustChange = false;
  String? err;
  bool busy = false;

  Future<void> login() async {
    setState(() {
      busy = true;
      err = null;
    });
    try {
      final r = await Api.post('/auth/login', {'nim': nim.text.trim(), 'password': pass.text}) as Map;
      await Session.save(r['accessToken'], r['refreshToken']);
      if (r['mustChangePassword'] == true) {
        setState(() => mustChange = true);
      } else {
        _masuk();
      }
    } on ApiException catch (e) {
      setState(() => err = e.message);
    } finally {
      setState(() => busy = false);
    }
  }

  Future<void> ganti() async {
    try {
      await Api.post('/auth/change-password', {'oldPassword': pass.text, 'newPassword': baru.text});
      _masuk();
    } on ApiException catch (e) {
      setState(() => err = e.message);
    }
  }

  void _masuk() {
    if (mounted) Navigator.pushReplacementNamed(context, '/home');
  }

  Future<void> lupa() async {
    try {
      await Api.post('/auth/forgot-password', {'nim': nim.text.trim()});
      setState(() => err = 'Bila NIM terdaftar + ada email, tautan reset terkirim.');
    } on ApiException catch (e) {
      setState(() => err = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Jurnalistik APP')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          if (err != null) Text(err!, style: const TextStyle(color: Colors.red)),
          TextField(controller: nim, decoration: const InputDecoration(labelText: 'NIM'), enabled: !mustChange),
          TextField(controller: pass, decoration: const InputDecoration(labelText: 'Password'), obscureText: true, enabled: !mustChange),
          const SizedBox(height: 8),
          if (!mustChange) ...[
            ElevatedButton(onPressed: busy ? null : login, child: const Text('Masuk')),
            TextButton(onPressed: lupa, child: const Text('Lupa password')),
          ] else ...[            const Text('Password sementara harus diganti (min 10 karakter).'),
            TextField(controller: baru, decoration: const InputDecoration(labelText: 'Password baru'), obscureText: true),
            ElevatedButton(onPressed: ganti, child: const Text('Ganti & Masuk')),
          ],
        ]),
      ),
    );
  }
}
