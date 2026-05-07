# Setup do Projeto iOS

> **Status (2026-05-07):** smoke test funcional via `xcodebuild`. Spec do projeto Xcode é versionado em `project.yml` (XcodeGen). Pods são instalados via CocoaPods (`Podfile`).

## Quick start (smoke test)

```bash
# 1. Instalar XcodeGen (uma vez)
brew install xcodegen

# 2. Build shared framework KMP
cd /path/to/futeba-dos-parcas
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64

# 3. Gerar .xcodeproj a partir do project.yml
cd iosApp
xcodegen generate

# 4. Instalar Pods (locale fix necessário com Ruby 4.x)
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install

# 5. Build via CLI (smoke test)
xcodebuild -workspace iosApp.xcworkspace -scheme iosApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -configuration Debug build \
  CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO

# 6. Ou abrir no Xcode
open iosApp.xcworkspace
```

## Estrutura

```
iosApp/
├── project.yml                # XcodeGen spec (versionado)
├── Podfile                    # CocoaPods deps (versionado)
├── build_shared.sh            # Helper para build do KMP framework
├── iosApp/                    # Sources Swift
│   ├── FutebaApp.swift        # @main entry
│   ├── ContentView.swift      # Smoke screen (placeholder)
│   ├── AppDelegate.swift
│   ├── Info.plist
│   ├── Firebase/
│   ├── Services/
│   └── Assets.xcassets
├── iosApp.xcodeproj/          # gerado por xcodegen (gitignored)
├── iosApp.xcworkspace/        # gerado por pod install (gitignored)
└── Pods/                      # gerado por pod install (gitignored)
```

## XcodeGen + CocoaPods

`project.yml` define configurações Xcode em YAML:
- Bundle ID, deployment target, Swift version
- Dependências de framework (`shared.framework` do KMP)
- Build settings (FRAMEWORK_SEARCH_PATHS, OTHER_LDFLAGS)
- preBuildScripts: roda `:shared:linkDebugFrameworkIosSimulatorArm64` antes de compilar

Atualize `project.yml` em vez do `.xcodeproj` (que é gerado).

## Capabilities (configurar no Xcode)

Ativar em Signing & Capabilities:
- Push Notifications
- Sign in with Apple
- Background Modes → Remote notifications
- Location → When In Use

## Info.plist (já configurado)

Chaves principais:
- `NSLocationWhenInUseUsageDescription` — check-in nos jogos
- `NSCameraUsageDescription` — fotos
- `NSPhotoLibraryUsageDescription` — perfil

## Status atual (2026-05-07)

✅ **Frame compila e linka contra `shared` KMP framework**
✅ **xcodebuild simulator build succeeded**
✅ **Pods integrados** (Firebase, GoogleSignIn)

⏳ **Pendente** (Phase 3 CMP):
- `composeApp/MainViewController` (UI compartilhada via Compose Multiplatform)
- ContentView atual é apenas placeholder smoke test (usa `Platform()` do shared)
- Configurar signing team para device builds e TestFlight

## Troubleshooting

**Erro Ruby/CocoaPods Unicode**: Ruby 4.x tem bug com `unicode_normalize`. Workaround: rodar `pod install` com `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

**`module 'ComposeApp' not found`**: composeApp ainda não tem MainViewController iOS. ContentView placeholder atual usa apenas `shared`. Habilitar quando Phase 3 CMP destrava.

**Framework search path warning**: build pra Simulator gera só `iosSimulatorArm64`. Pra device, rodar `./gradlew :shared:linkDebugFrameworkIosArm64`.

## Próximos passos

1. **Configurar signing team** no Xcode (Signing & Capabilities)
2. **Implementar Phase 3 CMP**: composeApp/iosMain com MainViewController
3. **TestFlight**: archive + upload via Xcode Organizer ou fastlane
