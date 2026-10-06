import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/api_client.dart';
import 'core/session.dart';
import 'features/auth/login_page.dart';
import 'home_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // FCM opsional: tanpa google-services tetap jalan (push mati, in-app tetap ada).
  try {
    await Firebase.initializeApp();
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && await Session.access != null) {
      await Api.post('/notifications/devices', {'token': token});
    }
    FirebaseMessaging.onMessage.listen((_) {});
  } catch (_) {}
  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Jurnalistik APP',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.blue),
      home: const Gate(),
      routes: {'/login': (_) => const LoginPage(), '/home': (_) => const HomeShell()},
    );
  }
}

class Gate extends StatelessWidget {
  const Gate({super.key});
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: Session.access,
      builder: (_, s) {
        if (!s.hasData) return const Scaffold(body: Center(child: CircularProgressIndicator()));
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Navigator.pushReplacementNamed(context, s.data == null ? '/login' : '/home');
        });
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      },
    );
  }
}
