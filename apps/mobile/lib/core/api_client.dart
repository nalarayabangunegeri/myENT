import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'session.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class MustChange implements Exception {}

// Satu pintu ke API (docs/API.md): timeout 30 dtk, refresh diam-diam sekali saat 401.
// ponytail: single-flight refresh in-memory. Ceiling: очередь ulang saat multi-isolate.
class Api {
  // Emulator Android: 10.0.2.2. HP fisik: ganti via --dart-define=API_URL=http://<lan-ip>:3100
  static const base = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3100');
  static Future<bool>? _refreshing;

  static Future<bool> _doRefresh() {
    _refreshing ??= () async {
      try {
        final ref = await Session.refresh;
        if (ref == null) return false;
        final rr = await http
            .post(Uri.parse('$base/auth/refresh'),
                headers: {'content-type': 'application/json'},
                body: jsonEncode({'refreshToken': ref}))
            .timeout(const Duration(seconds: 30));
        if (rr.statusCode != 200) return false;
        final t = jsonDecode(utf8.decode(rr.bodyBytes));
        await Session.save(t['accessToken'], t['refreshToken']);
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
    return _refreshing!;
  }

  static Future<Map<String, String>> _headers({bool json = true}) async {
    final h = <String, String>{};
    if (json) h['content-type'] = 'application/json';
    final a = await Session.access;
    if (a != null) h['authorization'] = 'Bearer $a';
    return h;
  }

  static dynamic _decode(http.Response r) {
    dynamic body;
    try {
      body = jsonDecode(utf8.decode(r.bodyBytes));
    } catch (_) {
      try {
        body = jsonDecode(r.body);
      } catch (_) {
        body = {'message': r.body};
      }
    }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final raw = body is Map ? body['message'] : null;
    final msg = raw is List ? raw.join(', ') : (raw?.toString() ?? 'Gagal');
    if (r.statusCode == 401 && msg.contains('MUST_CHANGE_PASSWORD')) throw MustChange();
    throw ApiException(r.statusCode, msg);
  }

  static Future<dynamic> _withRefresh(Future<http.Response> Function() call) async {
    var r = await call().timeout(const Duration(seconds: 30));
    if (r.statusCode == 401) {
      if (await _doRefresh()) {
        r = await call().timeout(const Duration(seconds: 30));
      }
    }
    return _decode(r);
  }

  static Future<dynamic> get(String path) =>
      _withRefresh(() async => http.get(Uri.parse('$base$path'), headers: await _headers(json: false)));

  static Future<dynamic> post(String path, [Map<String, dynamic>? body]) => _withRefresh(() async => http.post(
      Uri.parse('$base$path'), headers: await _headers(), body: body == null ? null : jsonEncode(body)));

  static Future<dynamic> patch(String path, [Map<String, dynamic>? body]) => _withRefresh(() async => http.patch(
      Uri.parse('$base$path'), headers: await _headers(), body: body == null ? null : jsonEncode(body)));

  // Unduhan biner terautentikasi (PDF rekap) — url_launcher tak bisa kirim header.
  static Future<List<int>> getBytes(String path) async {
    Future<http.Response> call() async {
      final h = await _headers(json: false);
      return http.get(Uri.parse('$base$path'), headers: h).timeout(const Duration(seconds: 60));
    }

    var r = await call();
    if (r.statusCode == 401 && await _doRefresh()) r = await call();
    if (r.statusCode == 200) return r.bodyBytes;
    dynamic msg = 'Unduhan gagal';
    try {
      final b = jsonDecode(utf8.decode(r.bodyBytes));
      if (b is Map && b['message'] != null) msg = b['message'].toString();
    } catch (_) {}
    throw ApiException(r.statusCode, msg);
  }

  static Future<http.Response> _multipart(
      String method, String path, Map<String, String> fields, File? file, String field) async {
    final req = http.MultipartRequest(method, Uri.parse('$base$path'));
    final a = await Session.access;
    if (a != null) req.headers['authorization'] = 'Bearer $a';
    req.fields.addAll(fields);
    if (file != null) req.files.add(await http.MultipartFile.fromPath(field, file.path));
    final streamed = await req.send().timeout(const Duration(seconds: 30));
    return http.Response.fromStream(streamed);
  }

  static Future<dynamic> postMultipart(String path, Map<String, String> fields, File? file, String field,
      {bool retried = false}) async {
    var r = await _multipart('POST', path, fields, file, field);
    if (r.statusCode == 401 && !retried && await _doRefresh()) {
      r = await _multipart('POST', path, fields, file, field);
    }
    return _decode(r);
  }
}
