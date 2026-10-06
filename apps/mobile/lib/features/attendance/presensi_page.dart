import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/api_client.dart';
import '../../core/helpers.dart';

// Alur singkat (AGENTS §14): Kegiatan → Kamera → Preview → Submit → Sukses.
// Kamera langsung (bukan galeri), kompres sebelum upload, foto lokal disimpan sampai sukses.
class PresensiPage extends StatefulWidget {
  final Map meeting;
  final String? qrToken;
  const PresensiPage({super.key, required this.meeting, this.qrToken});
  @override
  State<PresensiPage> createState() => _PresensiPageState();
}

class _PresensiPageState extends State<PresensiPage> {
  File? foto;
  String? status;
  int percobaan = 0;
  bool kirim = false;

  Future<void> jepret() async {
    final x = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1280);
    if (x == null) return;
    final out = '${x.path}.jpg';
    final r = await FlutterImageCompress.compressAndGetFile(x.path, out, quality: 80);
    setState(() {
      foto = r == null ? File(x.path) : File(r.path);
      status = null;
      percobaan = 0;
    });
  }

  Future<Position?> _lokasi() async {
    if (widget.meeting['latitude'] == null) return null;
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
      throw ApiException(400, 'Izin lokasi dibutuhkan kegiatan ini');
    }
    return Geolocator.getCurrentPosition();
  }

  Future<int> _kirimSekali() async {
    try {
      final pos = await _lokasi();      final fields = {
        if (pos != null) 'latitude': '${pos.latitude}',
        if (pos != null) 'longitude': '${pos.longitude}',
        if (widget.qrToken != null) 'token': widget.qrToken!,
      };
      await Api.postMultipart(
        widget.qrToken == null
            ? '/meetings/${widget.meeting['id']}/attendance'
            : '/meetings/${widget.meeting['id']}/attendance/qr',
        fields,
        foto,
        'selfie',
      );
      return 200;
    } on ApiException catch (e) {
      return e.status;
    } on TimeoutException {
      return 0; // timeout/terputus → cek dulu sebelum ulang
    }
  }

  Future<void> submit() async {
    if (foto == null || kirim) {
      return;
    }
    setState(() {
      kirim = true;
      status = 'Mengunggah…';
    });
    try {
      await _submitLoop();
    } on MustChange {
      setState(() => status = 'Perlu ganti password, masuk ulang');
    } finally {
      setState(() => kirim = false);
    }
  }

  Future<void> _submitLoop() async {
    final mid = widget.meeting['id'];
    while (true) {
      final s = await _kirimSekali();
      if (presensiSukses(s)) {
        setState(() => status = 'Berhasil tercatat');
        break;
      }
      if (presensiBerhenti(s) || s == 401) {
        setState(() => status = s == 401 ? 'Sesi habis, masuk ulang' : 'Gagal — hubungi pengurus bila window tutup');
        break;
      }
      // Timeout: cek status dulu (request mungkin sempat masuk).
      try {
        await Api.get('/meetings/$mid/attendance/me');
        setState(() => status = 'Berhasil tercatat');
        break;
      } catch (_) {}
      percobaan++;
      if (!bolehRetry(percobaan)) {
        setState(() => status = 'Gagal terkirim, coba lagi');
        break;
      }
      setState(() => status = 'Mengulang… ($percobaan)');
    }
  }

  @override
  Widget build(BuildContext context) {
    final ok = status == 'Berhasil tercatat';
    return Scaffold(
      appBar: AppBar(title: Text(widget.meeting['title'] ?? 'Presensi')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          if (foto != null) Image.file(foto!, height: 280) else const Text('Belum ada foto'),
          const SizedBox(height: 8),
          if (!ok) ElevatedButton(onPressed: jepret, child: const Text('Kamera')),
          const SizedBox(height: 8),
          if (foto != null && !ok) ElevatedButton(onPressed: kirim ? null : submit, child: const Text('Submit')),
          if (status != null) ...[
            const SizedBox(height: 8),
            Text(status!, style: TextStyle(color: ok ? Colors.green : null)),
            if (ok) ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Selesai')),
          ],
        ]),
      ),
    );
  }
}
