# Delta — Flutter

Versao estavel verificada Agosto 2026: **3.47.0**.

Flutter e sempre **frontend movel**; o backend e Laravel API (ou nenhum, se for app local).
Aplica-se aos passos 2.1–2.4 e 2.8–2.9. O resto e igual.

## 2.1 — Scaffold

```bash
flutter create --org <com.dominio.inverso> --platforms=android,ios app
cd app && flutter pub get
```

O `--org` define o package id (`com.dominio.app`) e **e dificil de mudar depois** — perguntar antes,
nao assumir.

## 2.3 — Testes

`flutter_test` ja vem no scaffold. Preferir **widget tests** (`testWidgets`) a unit tests de
classes internas: verificam o que o utilizador ve.

## 2.4 — Teste inicial

```dart
testWidgets('arranca sem rebentar', (tester) async {
  await tester.pumpWidget(const MinhaApp());
  expect(find.byType(MaterialApp), findsOneWidget);
});
```

## 2.8 — Tokens

Nao ha Tailwind. Os tokens do `docs/DESIGN.md` convertem-se para `ThemeData`, em `lib/theme.dart`:

```dart
final tema = ThemeData(
  colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
  fontFamily: 'Inter',
  cardTheme: const CardThemeData(shape: RoundedRectangleBorder(
    borderRadius: BorderRadius.all(Radius.circular(12)),   // 0.75rem
  )),
);
```

`rem` → px a 16px/rem. **A cor de marca e o mesmo hex do `DESIGN.md`** — nao "a mais parecida do
Material".

## 2.9 — CI

`ci-flutter.yml`. `flutter analyze --fatal-infos` e o unico gate estatico do Dart — nao o baixar para
so-erros.

## Armadilhas

- **`ColorScheme.fromSeed` deriva a paleta toda da semente** e pode ignorar cores que o `DESIGN.md`
  fixou. Se a marca tiver secundaria/terciaria definidas, passa-as explicitamente em vez de deixar
  derivar.
- **Alvos de toque >= 48dp** (Material) — mais exigente que os 44px da web.
- **Keystore nunca vai para o git.** Release assinada exige segredos do repositorio.
- O mockup HTML e **referencia visual**, nao estrutura: nao ha traducao 1-para-1 de HTML para widgets.
