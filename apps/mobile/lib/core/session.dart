import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// Token di secure storage (AGENTS §14). Refresh dirotasi server.
// ponytail: default v11 = EncryptedSharedPreferences (AES-GCM). Tanpa opsi tambahan.
class Session {
  static const _s = FlutterSecureStorage();
  static Future<String?> get access => _s.read(key: 'access');
  static Future<String?> get refresh => _s.read(key: 'refresh');
  static Future<void> save(String a, String r) async {
    await _s.write(key: 'access', value: a);
    await _s.write(key: 'refresh', value: r);
  }

  static Future<void> clear() => _s.deleteAll();
}
