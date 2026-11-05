---
name: futeba-kmp-build
description: Build Kotlin Multiplatform shared module + iOS Framework + Android compile. Inclui troubleshooting ARM64, opt-ins, Xcode versions, daemon contention. Use quando o usuário pedir "compilar shared", "build iOS", "KMP issue", "Framework build".
---

# Futeba KMP Build

Compilação cross-platform via shared/ module (Kotlin Multiplatform).

## Targets configurados

| Target | Usado por | Build cmd |
|--------|-----------|-----------|
| `androidMain` | Android app | `./gradlew :shared:compileDebugKotlin` |
| `iosSimulatorArm64Main` | iOS Sim Apple Silicon | `./gradlew :shared:compileKotlinIosSimulatorArm64` |
| `iosArm64Main` | iPhone físico | `./gradlew :shared:compileKotlinIosArm64` |
| `iosX64Main` | iOS Sim Intel | `./gradlew :shared:compileKotlinIosX64` |
| `wasmJsMain` | Web (CMP Phase 4 planned) | stub atualmente |
| `nativeAndAndroidMain` | Shared Firebase | usado por Android+iOS |

## Comandos comuns

```bash
# Compile Android only (~30s com daemon warm)
./gradlew :shared:compileDebugKotlin

# Compile iOS Simulator (Apple Silicon)
./gradlew :shared:compileKotlinIosSimulatorArm64

# Build Framework completo (debugFwk)
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
./gradlew :shared:linkDebugFrameworkIosArm64

# Tests common (JVM)
./gradlew :shared:testDebugUnitTest

# Tests iOS Simulator
./gradlew :shared:iosSimulatorArm64Test
```

## Pré-requisitos

| Tool | Setup |
|------|-------|
| JDK 17 (Temurin) | `brew install --cask temurin@17` |
| Android SDK 36 | Android Studio OU `brew install --cask android-commandlinetools` + `sdkmanager "platforms;android-36" "build-tools;36.0.0"` |
| Xcode (full, não só CLT) | Mac App Store ou `mas install 497799835` |
| Rosetta 2 (CodeQL) | `sudo softwareupdate --install-rosetta --agree-to-license` |
| Java env | `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home` |
| Android env | `ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools` |

## Bugs conhecidos + fixes

### `compileKotlinIosSimulatorArm64 FAILED: opt-in` (multiple errors)
```kotlin
// shared/build.gradle.kts
kotlin {
    sourceSets.all {
        languageSettings.optIn("kotlinx.cinterop.ExperimentalForeignApi")
        languageSettings.optIn("kotlinx.cinterop.BetaInteropApi")
    }
}
```

### `linkDebugFrameworkIosSimulatorArm64 FAILED: An error occurred during xcrun execution`
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### `Gradle build daemon disappeared`
OOM. Diagnose:
```bash
vm_stat | head -3 | awk '/free/ {printf "Free: %.1f GB\n", $3 * 16384 / 1024 / 1024 / 1024}'
ps aux | sort -k4 -rn | head -5
```
Se `mds_stores` grande (Spotlight): `osascript -e 'do shell script "killall -KILL mds_stores" with administrator privileges'`

### `Could not load module metadata...descriptor.bin`
Cache Gradle corrompido por concorrência:
```bash
rm -rf ~/.gradle/caches/modules-2/metadata-*
```

### Type mismatch NSString vs String em iosMain
```kotlin
// Antes (erro)
val text: String = nsString
// Depois
val text: String = nsString.toString()
```

### `Unresolved reference 'format'` (String.format em iOS)
iOS Kotlin Native não tem `String.format()`. Use `padStart`:
```kotlin
// Antes
val hex = String.format("%08x", value)
// Depois
val hex = value.toString(16).padStart(8, '0')
```

### `Class 'X' is not abstract and does not implement abstract member`
Repository interface mudou em commonMain. Adicionar `override` faltando em `iosMain`/`androidMain` impl.

## AGENTS.md context

- KMP Phase 2 (CMP migration) em curso
- Phase 4 (iOS via TestFlight) PLANNED — `iosApp/` ainda só template
- Quando Phase 4 vier: setar `vars.IOS_PHASE_4_ENABLED=true` no GitHub Settings → Variables pra ativar Build iOS App workflow
