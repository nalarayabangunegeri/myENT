import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'core/api_client.dart';
import 'core/deeplink.dart';
import 'core/session.dart';
import 'features/auth/login_page.dart';
import 'home_shell.dart';

final navKey = GlobalKey<NavigatorState>();
final _local = FlutterLocalNotificationsPlugin();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // FCM opsional: tanpa google-services tetap jalan (push mati, in-app tetap ada).
  try {
    await Firebase.initializeApp();
    // Channel Android: presensi (penting) vs info biasa.
    final android = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(const AndroidNotificationChannel('presensi', 'Presensi', importance: Importance.high));
    await android?.createNotificationChannel(const AndroidNotificationChannel('info', 'Info'));
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && await Session.access != null) {
      await Api.post('/notifications/devices', {'token': token});
    }
    FirebaseMessaging.onMessage.listen((m) {
      final n = m.notification;
      if (n == null) return;
      final t = m.data['type'] ?? '';
      _local.show(
        id: n.hashCode,
        title: n.title,
        body: n.body,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            (t.startsWith('attendance') || t.startsWith('meeting')) ? 'presensi' : 'info',
            t.startsWith('attendance') || t.startsWith('meeting') ? 'Presensi' : 'Info',
          ),
        ),
        payload: '${m.data['refType'] ?? ''}|${m.data['refId'] ?? ''}',
      );
    });
    _local.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: (r) => _openDeepLink(r.payload),
    );
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _openDeepLink('${m.data['refType'] ?? ''}|${m.data['refId'] ?? ''}'));
    FirebaseMessaging.instance.getInitialMessage().then(
      (m) => m == null ? null : _openDeepLink('${m.data['refType'] ?? ''}|${m.data['refId'] ?? ''}'),
    );
  } catch (_) {}
  runApp(const App());
}

void _openDeepLink(String? payload) {
  final ref = (payload ?? '').split('|').firstOrNull;
  navKey.currentState?.pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => HomeShell(initialTab: tabFor(ref?.isEmpty == true ? null : ref))),
    (_) => false,
  );
}

class App extends StatelessWidget {
  const App({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Jurnalistik APP',
      navigatorKey: navKey,
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
