# Delta — Flutter

Stable version verified August 2026: **3.47.0**.

Flutter is always **mobile frontend**; the backend is a Laravel API (or none, if it is a local app).
It applies to steps 2.1–2.4 and 2.8–2.9. The rest is the same.

## 2.1 — Scaffold

```bash
flutter create --org <com.reverse.domain> --platforms=android,ios app
cd app && flutter pub get
```

`--org` sets the package id (`com.domain.app`) and **is hard to change later** — ask first,
do not assume.

## 2.3 — Tests

`flutter_test` already ships with the scaffold. Prefer **widget tests** (`testWidgets`) over unit
tests of internal classes: they check what the user sees.

## 2.4 — Initial test

```dart
testWidgets('starts without crashing', (tester) async {
  await tester.pumpWidget(const MyApp());
  expect(find.byType(MaterialApp), findsOneWidget);
});
```

## 2.8 — Tokens

There is no Tailwind. The tokens in `docs/DESIGN.md` are converted to `ThemeData`, in `lib/theme.dart`:

```dart
final theme = ThemeData(
  colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
  fontFamily: 'Inter',
  cardTheme: const CardThemeData(shape: RoundedRectangleBorder(
    borderRadius: BorderRadius.all(Radius.circular(12)),   // 0.75rem
  )),
);
```

`rem` → px at 16px/rem. **The brand color is the same hex as in `DESIGN.md`** — not "the closest one
in Material".

## 2.9 — CI

`ci-flutter.yml`. `flutter analyze --fatal-infos` is Dart's only static gate — do not lower it to
errors-only.

## Pitfalls

- **`ColorScheme.fromSeed` derives the whole palette from the seed** and may ignore colors that
  `DESIGN.md` pinned. If the brand has a secondary/tertiary defined, pass them explicitly instead of
  letting them be derived.
- **Touch targets >= 48dp** (Material) — stricter than the web's 44px.
- **The keystore never goes into git.** A signed release requires repository secrets.
- The HTML mockup is a **visual reference**, not structure: there is no 1-to-1 translation from HTML to widgets.
