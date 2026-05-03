---
name: flutter
description: "Flutter development skill covering testing, security auditing, and release pipeline. Use when: writing/fixing/reviewing Flutter tests (unit, widget, integration, Riverpod, Mockito); running OWASP Mobile Top 10 security audits; or cutting a release ('cut a release', 'bump version and release', 'run release pipeline'). Complements the flutter-expert agent which handles architecture and implementation."
metadata:
  version: 1.0.0
---

# Flutter

Three-domain skill: **Testing** · **Security** · **Release Pipeline**.

The `flutter-expert` agent handles architecture, state management, UI, and implementation. This skill handles the operational lifecycle: writing tests, auditing security, and shipping releases.

---

## 1. Testing

### Requirements

- `flutter_test` dependency in `pubspec.yaml`
- Works with Riverpod, Mockito, GetIt
- Run `dart run build_runner build` after modifying `@GenerateMocks` annotations
- FVM: prefix all `flutter` commands with `fvm`

### Core Principle: Layer Isolation

Test each layer against its own mocked dependencies. Never mock providers — override their dependencies instead.

| Layer | What to test | What to mock |
|---|---|---|
| **Repository** | Data coordination | DAOs, APIs, Logger |
| **DAO** | Database CRUD | Real in-memory DB, mock Logger |
| **Provider** | State and transitions | Services, Repositories |
| **Service** | Business logic | Repositories, Network clients |
| **Widget** | UI behaviour | Provider dependencies (via overrides) |

### Given-When-Then Structure

```dart
test('Given valid data, When fetchUsers called, Then returns user list', () async {
  // Arrange
  when(mockDAO.fetchAll()).thenAnswer((_) async => expectedUsers);

  // Act
  final result = await repository.fetchUsers();

  // Assert
  expect(result, equals(expectedUsers));
  verify(mockDAO.fetchAll()).called(1);
});
```

### Test Organisation

```dart
group('UserRepository', () {
  group('fetchUsers', () {
    setUp(() { /* init mocks, register with GetIt */ });
    tearDown(() => GetIt.I.reset()); // Always reset GetIt

    test('Given success ... When ... Then ...', () { });
    test('Given error  ... When ... Then ...', () { });
  });
});
```

### Standard Setup

**Generate mocks:**
```dart
@GenerateMocks([IUserDAO, IUserAPI, ILogger])
void main() { ... }
```

**Register with GetIt:**
```dart
setUp(() {
  mockDAO = MockIUserDAO();
  GetIt.I
    ..registerSingleton<IUserDAO>(mockDAO)
    ..registerSingleton<ILogger>(mockLogger);
});
tearDown(() => GetIt.I.reset()); // Critical — always reset
```

**Fakes vs Mocks:**
- **Fakes** (`class FakeLogger extends ILogger`) — silent stubs, no verification
- **Mocks** (`MockILogger`) — use when you need `when()`, `verify()`, `thenThrow()`

### Quick Reference

| Scenario | Pattern |
|---|---|
| Test a repository | Mock DAO + API → inject into constructor |
| Test a DAO | `openInMemoryDatabase()` in setUp, delete table in tearDown |
| Test a Riverpod provider | `createContainer(overrides: [serviceProvider.overrideWith(...)])` |
| Test a widget | Set screen size, use `find.byKey()`, `pumpAndSettle()` |
| Test loading state | `Completer` → `pump()` to assert loading → complete → `pump()` again |
| Test platform-specific UI | `debugDefaultTargetPlatformOverride = TargetPlatform.iOS` — reset after |
| Test GoRouter navigation | `FakeGoRouter` + `MockGoRouterProvider` |

### Running Tests

```bash
flutter test --coverage                        # All tests + coverage
flutter test test/path/to/test.dart            # Specific file
flutter test --plain-name "Given valid data"   # Filter by name
genhtml coverage/lcov.info -o coverage/html    # HTML coverage report
```

### Common Mistakes

| Mistake | Fix |
|---|---|
| Mocking a provider directly | Override its dependencies with `provider.overrideWith(...)` |
| Missing `GetIt.I.reset()` in tearDown | Tests pollute each other — always reset |
| `await Future.delayed()` in tests | Use `await tester.pumpAndSettle()` or `Completer` |
| Finding widgets by text string | Use `find.byKey(const Key('name'))` — stable across text changes |
| No screen size in widget tests | Add `tester.view.physicalSize = const Size(1000, 1000)` |
| Not resetting `debugDefaultTargetPlatformOverride` | Set to `null` at end of test |

### Test Checklist

**Setup & Mocking:**
- [ ] Dependencies mocked (not providers)
- [ ] SharedPreferences mocked if used
- [ ] `GetIt.I.reset()` in `tearDown`
- [ ] Streams closed, controllers disposed in `tearDown`

**Widget Tests:**
- [ ] Keys added to source widgets, used in `find.byKey()`
- [ ] Screen size set (`physicalSize` + `devicePixelRatio`)
- [ ] Platform overrides reset (`debugDefaultTargetPlatformOverride = null`)

**Coverage:**
- [ ] Success and failure paths covered
- [ ] Edge cases (null, empty, max)
- [ ] Loading and error states
- [ ] No `Future.delayed` — async handled correctly

---

## 2. Security (OWASP Mobile Top 10)

Based on OWASP Mobile Top 10 (2024). Four categories have automated scanners; six require manual review.

**Scripts source:** `github.com/Harishwarrior/flutter-claude-skills/tree/main/owasp-mobile-security-checker/scripts/`

### Automated Scanners

```bash
SKILL=~/.claude/skills/owasp-mobile-security-checker  # adjust to install path

python3 $SKILL/scripts/scan_hardcoded_secrets.py .      # M1 — API keys, tokens, credentials
python3 $SKILL/scripts/check_dependencies.py .          # M2 — outdated/unconstrained packages
python3 $SKILL/scripts/check_network_security.py .      # M5 — HTTP usage, cert pinning, ATS
python3 $SKILL/scripts/analyze_storage_security.py .    # M9 — unencrypted SharedPreferences/DB
```

Outputs: `owasp_m1_secrets_scan.json`, `owasp_m2_dependencies_scan.json`, `owasp_m5_network_scan.json`, `owasp_m9_storage_scan.json`

### OWASP Mobile Top 10 Quick Reference

| Risk | Issue | Automated? | Key Check |
|---|---|:---:|---|
| **M1** | Hardcoded credentials | Yes | API keys, tokens in source/config |
| **M2** | Vulnerable dependencies | Yes | Outdated or `any` version constraints |
| **M3** | Weak authentication | Manual | Token storage, MFA, session expiry |
| **M4** | Input validation | Manual | SQL injection, XSS in WebViews, IDOR |
| **M5** | Insecure communication | Yes | HTTP usage, missing cert pinning |
| **M6** | Privacy violations | Manual | PII in logs/analytics, excess permissions |
| **M7** | No binary protections | Manual | Missing `--obfuscate`, no root detection |
| **M8** | Misconfiguration | Manual | Debug flags in production, verbose logging |
| **M9** | Insecure storage | Yes | Sensitive data in SharedPreferences |
| **M10** | Weak cryptography | Manual | MD5/SHA1/ECB, hardcoded keys |

### Severity Action

| Severity | Action |
|---|---|
| **CRITICAL** | Fix now — do not release |
| **HIGH** | Fix before release |
| **MEDIUM** | Plan for next sprint |
| **LOW** | Address as time permits |

### Workflow Decision Tree

```
Comprehensive audit?
  YES → Run all 4 scanners → Manual review M3/M4/M6/M7/M8/M10 → Generate report
  NO  → Specific category → run targeted scanner or manual review
  
Pre-release quick check?
  YES → Run all 4 scanners → Fix CRITICAL + HIGH only
```

### Common False Positives

- **M1**: Test/example keys, placeholders like `YOUR_API_KEY`
- **M2**: Dev-only dependencies (linters, test tools)
- **M5**: HTTP for `localhost`/`127.0.0.1` in dev
- **M9**: Non-sensitive data (theme pref, language setting)

### Integration Points

| Stage | Action |
|---|---|
| Pre-commit | `scan_hardcoded_secrets.py` as secrets gate |
| Pull requests | All 4 scanners, post findings as PR comment |
| Release builds | Full audit including manual analysis |
| Incident response | Targeted scanner for the reported category |

---

## 3. Release Pipeline

Automates the full Flutter release process. Trigger on: "cut a release", "run release pipeline", "bump version and release".

**Execute steps strictly in order. Stop and report if any critical step fails.**

### Safety Rules (Critical)

- **NO DELETIONS** — never `rm -rf`. Ask user if cleanup needed.
- **DATA PERSISTENCE** — always APPEND to CSV files, never overwrite.
- **PATH RETENTION** — write confirmed paths to `flutter_release_config.json`. Never ask for same path twice.
- **GITIGNORE** — always ensure `flutter_release_config.json` is in `.gitignore`.
- **CROSS-PLATFORM** — detect OS first (Step 0), use correct commands throughout.
- **NO EARLY GIT WRITES** — no commit/tag/push before Step 8. `git status` only used in Step 8.1.

### Pipeline Overview

```
Step 0  Environment Setup (OS + Flutter check + config + gitignore + releases dir)
Step 1  Run Tests                          [GATE]
Step 2  Bump Version
Step 3  Log Test Results to CSV
Step 4  Extract Changes + Generate Release Notes
Step 5  Log Release to CSV
Step 6  Review and Confirm Release Notes   [GATE]
Step 7  Build
        7.1  iOS Archive Prep              [GATE — macOS only]
        7.2  Android Build (AAB / APK / Skip)
Step 8  Git Operations (status → stage → commit → tag → push)
Done    Completion Summary
```

### Cross-Platform Commands

| Operation | macOS/Linux | Windows PowerShell |
|---|---|---|
| Create directory | `mkdir -p <path>` | `New-Item -ItemType Directory -Force -Path "<path>"` |
| Append to file | `echo "text" >> file` | `Add-Content -Path "file" -Value "text"` |
| Create new file | `echo "text" > file` | `Set-Content -Path "file" -Value "text"` |
| List directory | `ls <path>` | `dir "<path>"` |
| Get project name | `basename $PWD` | `Split-Path -Leaf (Get-Location)` |
| Temp file | `/tmp/flutter_test_output.json` | `$env:TEMP\flutter_test_output.json` |

### Step 0 — Environment Setup

**0.0 OS Detection** — set macOS/Linux vs Windows context for all subsequent steps.

**0.1 Flutter Project Check** — confirm `pubspec.yaml` exists. If missing: STOP.

**0.2 Load/Create Config** — read or create `flutter_release_config.json`:
```json
{
  "project_name": "<name>",
  "os": "<macos|linux|windows>",
  "docs_root": "<path>",
  "releases_dir": "<path>/releases",
  "test_results_csv": "<path>/test_results.csv",
  "releases_csv": "<path>/releases.csv"
}
```
Default docs folder: `DOCs/` in project root. Ask user if missing: create or provide custom path.

**0.3 .gitignore Protection** — ensure `flutter_release_config.json` is listed.

**0.4 Releases Directory** — create `releases_dir` if it doesn't exist.

### Step 1 — Run Tests [GATE]

```bash
# macOS/Linux
flutter test --reporter json 2>&1 | tee /tmp/flutter_test_output.json
# Windows
flutter test --reporter json 2>&1 | Tee-Object -FilePath "$env:TEMP\flutter_test_output.json"
```

Parse JSON output: test names, total, passed, failed. Show clean summary.

**If FAILED:**
- Do NOT proceed to Step 2.
- Log to `test_results.csv` (headers: `Date,Version,Test_cases,Total Tests,Passed,Failed,Status`).
- Present: 1. Retry  2. Analyze errors and suggest fixes  3. Analyze and fix  4. Cancel

**If PASSED:** Confirm and proceed. Do NOT log CSV yet (need bumped version from Step 2).

### Step 2 — Bump Version

Read `version:` from `pubspec.yaml` (e.g. `1.0.4+5`). Increment patch + build number → `1.0.5+6`. Write back. Store `OLD_VERSION` for potential revert.

### Step 3 — Log Test Results to CSV

Now that new version exists: append to `test_results.csv`:
```
[Date],[New Version],[test names ;-separated],[Total],[Passed],[Failed],Passed
```

### Step 4 — Extract Changes + Release Notes

```bash
# macOS/Linux
git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --pretty=format:"- %s"
# Windows
git log --pretty=format:"- %s" $(git describe --tags --abbrev=0)
```

Create `<releases_dir>/release_notes_<version_underscored>.md`:
```markdown
# Release Notes - v[VERSION]
**Date:** [Date]
**Build:** [Build Number]
**Platform:** [OS]

## Changes
[formatted commit list]
```

### Step 5 — Log Release to CSV

Append to `releases.csv` (headers: `Date,Version,Release Notes File Path,Changes`).

### Step 6 — Review and Confirm [GATE]

Display full release notes. Present options:
1. Proceed to build
2. Edit release notes (user provides new content)
3. Regenerate from git log
4. Cancel (revert `pubspec.yaml` to `OLD_VERSION`, retain CSV logs)

Loop until user confirms or cancels.

### Step 7 — Build

**7.1 iOS Archive Prep** (macOS + `ios/` directory exists only):

Ask: Run iOS prep / Run iOS prep + open Xcode / Skip

If running prep:
```bash
flutter clean
flutter pub get
cd ios && pod deintegrate
pod install
cd ..
```

If user chose Xcode: `open ios/Runner.xcworkspace`. Wait for user to confirm 'done' before continuing.

On failure: Retry / Skip iOS / Cancel + revert version.

**Note:** Run iOS prep BEFORE Android — `flutter clean` wipes `build/`.

**7.2 Android Build:**

Ask: 1. AAB (Play Store recommended) / 2. APK (direct distribution) / 3. Skip

```bash
flutter build appbundle --release  # AAB → build/app/outputs/bundle/release/app-release.aab
flutter build apk --release        # APK → build/app/outputs/flutter-apk/app-release.apk
```

On failure: Retry / Cancel + revert version.

### Step 8 — Git Operations

Only git write operations in the entire pipeline happen here.

**8.1** `git status --short` — display changed files (informational only).

**8.2** Stage files:
```bash
git add pubspec.yaml <docs_root>/ .gitignore flutter_release_config.json
```

**8.3** Ask:
1. Commit + Tag only (local)
2. Commit + Tag + Push (remote)
3. Skip

```bash
git commit -m "chore(release): bump version to [NEW_VERSION]"
git tag v[NEW_VERSION]
git push
git push --tags
```

### Completion Summary

```
Project       : <project_name>
OS            : <macOS / Linux / Windows>
New Version   : <new_version>
iOS Prep      : <Completed / Xcode Opened / Skipped>
Android Build : <AAB path / APK path / Skipped>
Release Notes : <path>
Git Tag       : v<new_version> (pushed / local / skipped)
```

---

## Related

- `flutter-expert` agent — architecture, state management, UI implementation, platform features
- `owasp-mobile-security-checker` — full skill with Python scanner scripts (Harishwarrior/flutter-claude-skills)
