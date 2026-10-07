import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// Palet brand: biru #134179, putih, kuning #F4CB01.
const brand = Color(0xFF134179);
const brandDeep = Color(0xFF0D3059);
const brandSoft = Color(0xFFE4EBF4);
const gold = Color(0xFFF4CB01);
const goldSoft = Color(0xFFFDF3CF);
const canvas = Color(0xFFF2F3F9);
const line = Color(0xFFE8ECF4);

const okFg = Color(0xFF15803D);
const okBg = Color(0xFFEBF7EF);
const warnFg = Color(0xFFB45309);
const warnBg = Color(0xFFFEF3E2);
const badFg = Color(0xFFBE123C);
const badBg = Color(0xFFFDECEF);

ThemeData appTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: brand, primary: brand);
  final text = GoogleFonts.plusJakartaSansTextTheme();
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: canvas,
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: brandDeep,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.bold,
        color: brandDeep,
      ),
    ),
    cardTheme: const CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(20)),
        side: BorderSide(color: line),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: brand,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: brand),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: brand,
      foregroundColor: Colors.white,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: brand, width: 1.6),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: goldSoft,
      labelTextStyle: WidgetStatePropertyAll(
        GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600),
      ),
    ),
    chipTheme: const ChipThemeData(
      backgroundColor: brandSoft,
      labelStyle: TextStyle(color: brandDeep),
      shape: StadiumBorder(side: BorderSide.none),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: brand),
  );
}
