import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

// Scan QR presensi (P2). Token kedaluwarsa 5 mnt; window + selfie tetap berlaku.
class QrScanPage extends StatefulWidget {
  const QrScanPage({super.key});
  @override
  State<QrScanPage> createState() => _QrScanPageState();
}

class _QrScanPageState extends State<QrScanPage> {
  bool done = false;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan QR')),
      body: MobileScanner(
        onDetect: (cap) {
          if (done) return;
          final v = cap.barcodes.firstOrNull?.rawValue;
          if (v == null || !v.contains('.')) return;
          done = true;
          Navigator.pop(context, v);
        },
      ),
    );
  }
}
