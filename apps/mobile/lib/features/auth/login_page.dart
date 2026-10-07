import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
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
  bool sembunyi = true;
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
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: const BoxDecoration(color: gold, borderRadius: BorderRadius.all(Radius.circular(22))),
                  alignment: Alignment.center,
                  child: const Text('J', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: brandDeep)),
                ),
                const SizedBox(height: 20),
                const Text('Selamat datang kembali!', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: brandDeep)),
                Text(
                  pending != null
                      ? 'Verifikasi dua langkah untuk melanjutkan.'
                      : mustChange
                          ? 'Amankan akunmu dengan password baru.'
                          : 'Masuk untuk presensi dan tugasmu.',
                  style: TextStyle(color: Colors.grey.shade500),
                ),
                const SizedBox(height: 20),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (err != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(10),
                          decoration: const BoxDecoration(color: badBg, borderRadius: BorderRadius.all(Radius.circular(12))),
                          child: Text(err!, style: const TextStyle(color: badFg, fontSize: 13)),
                        ),
                      if (pending != null) ...[
                        const Text('Kode 6 digit dari aplikasi authenticator:'),
                        const SizedBox(height: 8),
                        TextField(controller: kode, decoration: const InputDecoration(labelText: '123456'), keyboardType: TextInputType.number),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: busy ? null : verifikasi, child: const Text('Verifikasi')),
                      ] else if (!mustChange) ...[
                        TextField(controller: nim, decoration: const InputDecoration(labelText: 'NIM', prefixIcon: Icon(Icons.badge_outlined)), enabled: !mustChange && pending == null),
                        const SizedBox(height: 12),
                        TextField(
                          controller: pass,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(sembunyi ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                              onPressed: () => setState(() => sembunyi = !sembunyi),
                            ),
                          ),
                          obscureText: sembunyi,
                          enabled: !mustChange && pending == null,
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: busy ? null : login, child: const Text('Masuk')),
                        TextButton(onPressed: busy ? null : lupa, child: const Text('Lupa password')),
                      ] else ...[
                        const Text('Password sementara harus diganti (min 10 karakter).'),
                        const SizedBox(height: 8),
                        TextField(controller: baru, decoration: const InputDecoration(labelText: 'Password baru'), obscureText: true),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: busy ? null : ganti, child: const Text('Ganti & Masuk')),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const Text('UKM Jurnalistik', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
