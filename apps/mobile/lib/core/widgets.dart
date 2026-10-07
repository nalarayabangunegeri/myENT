import 'package:flutter/material.dart';
import 'helpers.dart';
import 'theme.dart';

// Kartu putih rounded — wadah konten utama.
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(14)});

  @override
  Widget build(BuildContext context) {
    return Card(child: Padding(padding: padding, child: child));
  }
}

// Judul seksi + aksi opsional di kanan.
class SectionHead extends StatelessWidget {
  final String title;
  final String? sub;
  final Widget action;
  const SectionHead({super.key, required this.title, this.sub, this.action = const SizedBox.shrink()});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: brandDeep)),
                if (sub != null) Text(sub!, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ],
            ),
          ),
          action,
        ],
      ),
    );
  }
}

// Pil status dari label API.
class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color fg;
    Color bg;
    switch (status) {
      case 'PRESENT':
      case 'APPROVED':
      case 'RETURNED':
      case 'PUBLISHED':
        fg = okFg;
        bg = okBg;
      case 'PENDING':
      case 'DRAFT':
      case 'OVERDUE':
        fg = warnFg;
        bg = warnBg;
      case 'ABSENT':
      case 'REJECTED':
      case 'CANCELLED':
        fg = badFg;
        bg = badBg;
      default:
        fg = brand;
        bg = brandSoft;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(
        statusLabel[status] ?? status,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }
}

// Avatar inisial — tanpa aset gambar.
class InitialAvatar extends StatelessWidget {
  final String name;
  final double size;
  const InitialAvatar({super.key, required this.name, this.size = 44});

  @override
  Widget build(BuildContext context) {
    final init = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0]).join().toUpperCase();
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: brand, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        init.isEmpty ? '?' : init,
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: size * 0.36),
      ),
    );
  }
}

// Tombol akses cepat ala referensi: ikon dalam kotak tint + label.
class QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color tint;
  final Color fg;
  final VoidCallback onTap;
  const QuickAction({super.key, required this.icon, required this.label, required this.tint, required this.fg, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(18)),
            child: Icon(icon, color: fg, size: 26),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: brandDeep), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

// Bar progres tipis.
class Bar extends StatelessWidget {
  final double value;
  final Color color;
  const Bar({super.key, required this.value, this.color = brand});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1),
        minHeight: 8,
        backgroundColor: const Color(0xFFE8ECF4),
        valueColor: AlwaysStoppedAnimation(color),
      ),
    );
  }
}

// State kosong yang ramah.
class EmptyState extends StatelessWidget {
  final String text;
  final IconData icon;
  const EmptyState({super.key, required this.text, this.icon = Icons.inbox_outlined});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(color: brandSoft, shape: BoxShape.circle),
              child: Icon(icon, color: brand, size: 30),
            ),
            const SizedBox(height: 12),
            Text(text, style: TextStyle(color: Colors.grey.shade500)),
          ],
        ),
      ),
    );
  }
}
