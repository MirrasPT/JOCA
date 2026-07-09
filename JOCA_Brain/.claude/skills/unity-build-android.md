---
name: unity-build-android
description: "Ship a Unity game to Android — module/SDK/NDK/JDK prerequisites, Player settings (package id, min API, IL2CPP + ARM64, orientation), keystore creation + signing (secrets OUT of git), AAB vs APK, headless batchmode builds via a BuildScript, and the Windows/Unity gotchas (misleading exit code, StreamingAssets, gradle). Focused specialist under the unity-gamedev director. MUST be read before configuring or running an Android build. Triggers: build Android, AAB, APK, IL2CPP, ARM64, keystore, Play Console, gradle Unity, batchmode build, BuildScript, sign Android, Fase 5."
triggers: build Android, AAB, APK, IL2CPP, ARM64, keystore, Play Console, gradle Unity, batchmode build, BuildScript, sign Android, ship to device, Fase 5
chain: unity-build-runner, deploy-executor
metadata:
  type: skill
  category: game-dev
---

# Unity → Android build

Taking a Unity game from editor to a signed `.aab`/`.apk`. Specialist under `unity-gamedev` (read it for project structure + `.gitignore`). For OmniClash this is **Fase 5** — the engine + view are done; this is the shipping path.

> **Read-first** before touching Player settings, the keystore, or running a build. Keystore + passwords are **secrets — never commit them** (soul.md Hard Limits).

---

## 0. Prerequisites (once)
- **Android Build Support** module via Unity Hub → bundles **SDK + NDK + OpenJDK** (don't hand-install unless you must).
- Confirm the editor version (OmniClash = `6000.5.1f1`) and that `BuildTarget.Android` is installed.
- On Windows: long-path support on; build to a short path to avoid gradle path-length failures.

## 1. Player settings (Project Settings → Player → Android)
- **Package name**: `com.<vendor>.<game>` (OmniClash = `com.<vendor>.tcg`). Immutable once on Play.
- **Scripting backend = IL2CPP**, **Target architectures = ARM64** (mandatory for Google Play; ARMv7-only is rejected).
- **Minimum API** 24+ (typical), Target API = latest Play requires.
- **Orientation** (card game = usually landscape or auto), splash off for a clean boot, product name.
- These are set in code by `BuildScript` for headless builds (see §4) so the build is reproducible.

## 2. Keystore + signing (secrets out of git)
- Create a release keystore (`Player → Publishing Settings → Keystore Manager`, or `keytool`). **Store the keystore file + passwords OUTSIDE the repo** (a password manager / CI secret). Losing the key = you can never update the app on Play.
- Reference it via env/CI secrets at build time, not hard-coded. Add `*.keystore`/`*.jks` to `.gitignore`.
- Debug builds can use the auto debug keystore; **release/Play uploads must be signed with your release key** (or Play App Signing with an upload key).

## 3. AAB vs APK
- **AAB** (`EditorUserBuildSettings.buildAppBundle = true`) → required for Google Play. `locationPathName = "Build/Android/<Game>.aab"`.
- **APK** → for sideloading/local device testing (`buildAppBundle = false`).
- Build both as needed: APK for fast on-device QA, AAB for the store.

## 4. Headless build via BuildScript (reproducible)
OmniClash has `Assets/Editor/BuildScript.cs` with `BuildWindows()` and `BuildAndroid()` (sets IL2CPP/ARM64, package id, `buildAppBundle = true`, then `BuildPipeline.BuildPlayer`). It auto-creates an empty scene because the game bootstraps itself (`GameDemo.Bootstrap` via `RuntimeInitializeOnLoadMethod`). Run headless:
```bash
"<UnityHub>/Editor/6000.5.1f1/Editor/Unity.exe" -quit -batchmode -nographics \
  -projectPath "C:/Users/<user>/Projetos/tcg/unity" \
  -executeMethod BuildScript.BuildAndroid \
  -logFile "C:/Users/<user>/Projetos/tcg/unity_build.log"
```

## 5. The Windows/Unity gotchas (these bite every time)
- **The exit code is MISLEADING.** Unity batchmode build often returns a non-zero exit even on success (and licensing warnings spam the log). **Never trust the exit code.** Verify success by the log line `Build Finished, Result: Success` (and the `[BuildScript] Succeeded — N bytes -> <path>` line) **and** the artifact existing on disk with a sane size. This is the canonical OmniClash verification — automated by the `unity-build-runner` agent.
- **StreamingAssets on Android** is inside the APK/AAB → direct `File.IO` fails on device; read via `UnityWebRequest`. (The card art currently loads from `StreamingAssets/cards/` with file IO — fine on Windows/editor, must change for Android.)
- **gradle/path length** on Windows → build to a short path; keep the project off deep nested dirs.
- **Licensing handshake errors** in batchmode logs are usually benign if `Build Finished, Result: Success` appears — don't chase them.
- First IL2CPP build is slow (minutes); subsequent are cached.

## 6. Don't commit build artefacts
`.gitignore` must exclude `Library/`, `Build/`, `Builds/`, `Temp/`, `Logs/`, `*.keystore`, `*.jks`. Versioned: `Assets/`, `Packages/`, `ProjectSettings/`.

## Anti-patterns
| Wrong | Right |
|---|---|
| Trust batchmode exit code | verify log `Result: Success` + artifact on disk |
| Commit keystore / passwords | secrets outside git; `.gitignore` them |
| ARMv7-only / Mono backend for Play | IL2CPP + ARM64 |
| `File.IO` on StreamingAssets on device | `UnityWebRequest` on Android |
| Hand-install SDK/NDK | Android Build Support module |
| Lose the release key | back it up securely; or use Play App Signing |
| Commit `Build/`/`Library/` | gitignore them |

## Próximo passo (chain)
Run + verify the build → `unity-build-runner` (agent: runs batchmode, checks the log + artifact, never trusts the exit code). Post-build distribution → `deploy-executor`. UI not device-ready (safe area/touch) → `unity-ui`.
