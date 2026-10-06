import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../main.dart' show registerFcmToken;

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final nim = TextEditingController();
  final pass = TextEditingController();
  final kode = TextEditingController();
  final baru = TextEditingController();
  bool mustChange = false;
  String? pending;
  String? err;
  bool busy = false;

  @override
  void dispose() {
    nim.dispose();
    pass.dispose();
    kode.dispose();
    baru.dispose();
    super.dispose();
  }

  Future<void> login() async {
    if (busy) return;
    setState(() {
      busy = true;
      err = null;
    });
    try {
      final r = await Api.post('/auth/login', {'nim': nim.text.trim(), 'password': pass.text}) as Map;
      if (r['twoFactorRequired'] == true) {
        setState(() => pending = r['pendingToken']);
        return;
      }
      await Session.save(r['accessToken'], r['refreshToken']);
      await registerFcmToken();
      if (r['mustChangePassword'] == true) {
        setState(() => mustChange = true);
      } else {
        _masuk();
      }
    } on ApiException catch (e) {
      setState(() => err = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> ganti() async {
    if (busy) return;
    if (baru.text.length < 10) {
      setState(() => err = 'Password baru minimal 10 karakter');
      return;
    }
    setState(() {
      busy = true;
      err = null;
    });
    try {
      await Api.post('/auth/change-password', {'oldPassword': pass.text, 'newPassword': baru.text});
      _masuk();
    } on ApiException catch (e) {
      setState(() => err = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _masuk() {
    if (mounted) Navigator.pushReplacementNamed(context, '/home');
  }

  Future<void> verifikasi() async {
    if (busy) return;
    setState(() {
      busy = true;
      err = null;
    });
    try {
      final r = await Api.post('/auth/2fa/verify', {'pendingToken': pending, 'code': kode.text.trim()}) as Map;
      await Session.save(r['accessToken'], r['refreshToken']);
      await registerFcmToken();
      if (r['mustChangePassword'] == true) {
        setState(() {
          pending = null;
          mustChange = true;
        });
      } else {
        _masuk();
      }
    } on ApiException catch (e) {
      setState(() => err = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> lupa() async {
    if (busy) return;
    if (nim.text.trim().isEmpty) {
      setState(() => err = 'Isi NIM dulu');
      return;
    }
    setState(() {
      busy = true;
      err = null;
    });
    try {
      await Api.post('/auth/forgot-password', {'nim': nim.text.trim()});
      setState(() => err = 'Bila NIM terdaftar + ada email, tautan reset terkirim.');
    } on ApiException catch (e) {
      setState(() => err = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
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
          TextField(controller: nim, decoration: const InputDecoration(labelText: 'NIM'), enabled: !mustChange && pending == null),
          TextField(controller: pass, decoration: const InputDecoration(labelText: 'Password'), obscureText: true, enabled: !mustChange && pending == null),
          const SizedBox(height: 8),
          if (pending != null) ...[
            const Text('Kode 2FA dari aplikasi authenticator:'),
            TextField(controller: kode, decoration: const InputDecoration(labelText: '123456'), keyboardType: TextInputType.number),
            ElevatedButton(onPressed: busy ? null : verifikasi, child: const Text('Verifikasi')),
          ] else if (!mustChange) ...[
            ElevatedButton(onPressed: busy ? null : login, child: const Text('Masuk')),
            TextButton(onPressed: busy ? null : lupa, child: const Text('Lupa password')),
          ] else ...[
            const Text('Password sementara harus diganti (min 10 karakter).'),
            TextField(controller: baru, decoration: const InputDecoration(labelText: 'Password baru'), obscureText: true),
            ElevatedButton(onPressed: busy ? null : ganti, child: const Text('Ganti & Masuk')),
          ],
        ]),
      ),
    );
  }
}
