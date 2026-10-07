import 'package:flutter/material.dart';
import 'features/meetings/meetings_page.dart';
import 'features/attendance/history_page.dart';
import 'features/absence/absence_page.dart';
import 'features/tugas/tugas_page.dart';
import 'features/notifications/notif_page.dart';
import 'features/profile/profile_page.dart';

class HomeShell extends StatefulWidget {
  final int initialTab;
  const HomeShell({super.key, this.initialTab = 0});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int i = widget.initialTab;

  void _go(int v) => setState(() => i = v);

  @override
  Widget build(BuildContext context) {
    final pages = [
      MeetingsPage(onGo: _go),
      const TugasPage(),
      const HistoryPage(),
      const AbsencePage(),
      const NotifPage(),
      const ProfilePage(),
    ];
    return Scaffold(
      body: pages[i],
      bottomNavigationBar: NavigationBar(
        selectedIndex: i,
        onDestinationSelected: _go,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.event_outlined), selectedIcon: Icon(Icons.event), label: 'Kegiatan'),
          NavigationDestination(icon: Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment), label: 'Tugas'),
          NavigationDestination(icon: Icon(Icons.history_outlined), selectedIcon: Icon(Icons.history), label: 'Riwayat'),
          NavigationDestination(icon: Icon(Icons.healing_outlined), selectedIcon: Icon(Icons.healing), label: 'Izin'),
          NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Notif'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profil'),
        ],
      ),
    );
  }
}
