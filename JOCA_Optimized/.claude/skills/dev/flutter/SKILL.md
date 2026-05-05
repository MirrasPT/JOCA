---
name: flutter
description: Flutter testing, OWASP Mobile security audits, and release pipeline. Use when writing/fixing/reviewing Flutter tests (unit, widget, integration, Riverpod, Mockito), running OWASP Mobile Top 10 security audits, or cutting a release. Complements flutter-expert agent (architecture/UI/state). Triggers: Flutter test, widget test, integration test, Riverpod test, Mockito, OWASP mobile, mobile security audit, cut a release, bump version, release pipeline, flutter security.
metadata:
  version: 1.0.0
---

Three domains: **Testing** · **Security** · **Release Pipeline**. `flutter-expert` agent handles architecture/UI/state — this skill handles lifecycle.

## Testing

REQUIRE: `flutter_test` in `pubspec.yaml` · FVM: prefix `flutter` commands with `fvm` · `dart run build_runner build` after modifying `@GenerateMocks`

LAYER ISOLATION (mock at layer boundary, never mock providers — override dependencies):
- Repository → mock DAOs/APIs
- DAO → real in-memory DB, mock Logger
- Provider → mock Services/Repositories
- Service → mock Repositories/Network
- Widget → override Provider dependencies

STRUCTURE: Given-When-Then · specific assertions · `testWidgets` for UI · `ProviderContainer` for provider tests

NEVER: test implementation details · use real network in unit tests · mock providers directly

## Security (OWASP Mobile Top 10)

Audit checklist:
- M1 Improper Credential Usage: no hardcoded secrets, secure storage (`flutter_secure_storage`)
- M2 Inadequate Supply Chain: verify pub.dev packages, pin versions
- M3 Insecure Auth: proper token refresh, biometric fallback
- M4 Insufficient I/O Validation: validate all external input
- M5 Insecure Comms: HTTPS only, certificate pinning for sensitive apps
- M6 Inadequate Privacy: minimize PII, encrypt at rest
- M7 Insufficient Binary Protections: obfuscation (`--obfuscate --split-debug-info`)
- M8 Security Misconfiguration: strip debug flags in release, no verbose logging
- M9 Insecure Data Storage: no sensitive data in SharedPreferences unencrypted
- M10 Insufficient Cryptography: AES-256, avoid MD5/SHA1 for security

## Release Pipeline

```bash
# Bump version (pubspec.yaml)
# Run full test suite
flutter test
# Build
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols  # Android
flutter build ipa --release --obfuscate --split-debug-info=build/symbols        # iOS
# Verify
flutter analyze
```

Checklist: version bumped · CHANGELOG updated · tests pass · `flutter analyze` clean · obfuscation flags set · signing configured
