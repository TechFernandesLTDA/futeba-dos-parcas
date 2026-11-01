# Setup do Projeto iOS

> **Status (2026-05-11):** app rodando 100% no iOS Simulator com Firebase real (Analytics + Crashlytics + Messaging). HomeScreen Compose Multiplatform renderiza correto.
> **Status (2026-05-07):** smoke test funcional via `xcodebuild`. Spec do projeto Xcode é versionado em `project.yml` (XcodeGen). Pods são instalados via CocoaPods (`Podfile`).

## Quick start (rodar no iOS Simulator)

```bash
# 0. Pré-requisitos (uma vez)
brew install xcodegen      # se ainda não tem
# Xcode + iOS Simulator instalados (ver reference_xcode_ios_simulator memory)

# 1. Build do framework KMP pra Simulator ARM64. Só o ComposeApp é linkado no app:
#    ele já embute o :shared e o runtime do Kotlin/Native (ver "1152 duplicate symbols").
cd /path/to/futeba-dos-parcas
./gradlew --max-workers=3 :composeApp:linkDebugFrameworkIosSimulatorArm64

# 2. Gerar .xcodeproj + Pods (NESTA ORDEM — xcodegen ANTES de pod install)
cd iosApp
xcodegen generate
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install

# 3. GoogleService-Info.plist (uma vez — depois fica local, é gitignored)
#    project.yml resolve path relativo ao próprio yml, então alvo = iosApp/iosApp/GoogleService-Info.plist
firebase apps:sdkconfig IOS 1:490094091078:ios:e51b069afe7aefa3b5a347 \
  --project futebadosparcas \
  --out iosApp/iosApp/GoogleService-Info.plist

# 4a. Build + run via CLI
cd ..
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
open -a Simulator
TMPDIR=/tmp/xcb-tmp xcodebuild -workspace iosApp/iosApp.xcworkspace -scheme iosApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -configuration Debug \
  -derivedDataPath /tmp/ios-derived \
  CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
  build
xcrun simctl install booted /tmp/ios-derived/Build/Products/Debug-iphonesimulator/iosApp.app
xcrun simctl launch booted com.futebadosparcas

# 4b. OU abrir no Xcode (recomendado pra dev iterativo)
open iosApp/iosApp.xcworkspace
# No Xcode: Scheme=iosApp, Destination=iPhone 17 Pro, Cmd+R
```

### Smoke test rápido (sem Firebase real)

Se você não tiver `GoogleService-Info.plist`, o AppDelegate detecta e pula `FirebaseApp.configure()` — app roda em "smoke-test mode" sem Firebase. UI Compose Multiplatform funciona normal.

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
- Dependências de framework (`ComposeApp.framework`, que já embute o `:shared`)
- Build settings (FRAMEWORK_SEARCH_PATHS, OTHER_LDFLAGS)
- preBuildScripts: roda `:composeApp:linkDebugFrameworkIosSimulatorArm64` antes de compilar

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

## Status atual

### 2026-05-11 — Simulator FUNCIONANDO 100% com Firebase

✅ KMP frameworks (`:shared` + `:composeApp`) linkam OK
✅ xcodebuild Simulator iPhone 17 Pro Debug build SUCCESS
✅ Pods integrados (10 deps, 37 total: Firebase Auth/Firestore/Storage/Analytics/Messaging/AppCheck/Crashlytics/Functions + GoogleSignIn)
✅ HomeScreen Compose Multiplatform renderiza (Material 3, bottom nav)
✅ Firebase real ativo:
  - `GoogleService-Info.plist` baixado via `firebase apps:sdkconfig IOS`
  - App ID Firebase: `1:490094091078:ios:e51b069afe7aefa3b5a347`
  - Analytics + Crashlytics + Messaging inicializam OK
  - Dialog de permissão de notificação aparece (APNs swizzle funcional)

⚠️ Keychain error -34018 no Simulator (FirebaseAuth saved-user) — normal em sim sem entitlements, não bloqueia.

## Privacidade e ciclo do token push

- O token FCM não é exibido em logs nem gravado no perfil público `users/{uid}`.
- O backend mantém registros privados em `push_tokens` e `push_token_devices`,
  acessíveis somente pelo Admin SDK; as regras Firestore negam acesso de clientes.
- `registerPushToken` e `unregisterPushToken` exigem usuário autenticado e App
  Check válido em produção. Repetições, rotação do FCM e troca de conta são
  idempotentes por instalação.
- O iOS tenta remover o registro antes do logout. Se estiver offline, o logout
  continua para não prender a sessão; o backend também remove tokens rejeitados
  pelo FCM durante os envios.
- Em Debug usa-se App Check Debug Provider (cadastre no Firebase Console o
  token de debug emitido pelo SDK); Release usa App Attest com fallback para
  DeviceCheck em hardware sem suporte.

### 2026-05-07 — Smoke test inicial

✅ Frame compila e linka contra `shared` KMP framework
✅ xcodebuild simulator build succeeded
✅ Pods integrados (Firebase, GoogleSignIn)

⏳ **Pendente** (próximas fases):
- Device builds: precisa signing (free Apple ID ou Apple Dev Program $99/ano)
- TestFlight: requer Apple Dev Program — ver `specs/IOS_TESTFLIGHT_SETUP.md`
- Push Notifications reais: requer APNs cert (paid program)
- Sign in with Apple: requer entitlement de paid program

## Troubleshooting

**`ld: 1152 duplicate symbols` (`Kotlin_*`, `kotlin::gc::*`) no link do `iosApp`** (Xcode 27.1 + Kotlin 2.4.20, 31/10/2026): o app linkava `shared.framework` e `ComposeApp.framework`, os dois estáticos e cada um com uma cópia do runtime do Kotlin/Native. O `ComposeApp` já embute o `:shared`, e nenhum `.swift` faz `import shared`, então o `project.yml` linka só o `ComposeApp`. Se um dia o Swift precisar de tipos do `:shared`, exporte-os pelo ComposeApp (`export(project(":shared"))` no bloco `framework {}`), nunca linkando um segundo framework Kotlin.

**Aviso `libicu.icudtl_dat.o was built for newer iOS-simulator version (17.2)`**: são dois objetos de dados do ICU que vêm no Compose Multiplatform. Não há código nesses objetos; o aviso é inofensivo e não exige subir o deployment target.

**Erro Ruby/CocoaPods Unicode**: Ruby 4.x tem bug com `unicode_normalize`. Workaround: rodar `pod install` com `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

**`module 'ComposeApp' not found`**: composeApp ainda não tem MainViewController iOS. ContentView placeholder atual usa apenas `shared`. Habilitar quando Phase 3 CMP destrava.

**Framework search path warning**: build pra Simulator gera só `iosSimulatorArm64`. Pra device, rodar `./gradlew :composeApp:linkDebugFrameworkIosArm64` (#4427).

**`Undefined symbol _OBJC_CLASS_$_FIRFunctions`**: shared.framework usa GitLive Firebase Functions, mas Podfile não tinha `FirebaseFunctions`. Adicionar `pod 'FirebaseFunctions'` no Podfile + `pod install`. Fixado 2026-05-11.

**Crash com `PlistSanityCheck.performIfNeeded` no stack**: Compose UI iOS exige keys no Info.plist. Adicionar em `project.yml` (não no Info.plist direto — xcodegen sobrescreve):
```yaml
targets:
  iosApp:
    info:
      path: iosApp/Info.plist
      properties:
        CADisableMinimumFrameDurationOnPhone: true
        UILaunchScreen: {}
```
Fixado 2026-05-11.

**`FirebaseApp.configure() could not find GoogleService-Info.plist`**: baixar via `firebase apps:sdkconfig IOS <APP_ID> --out iosApp/iosApp/GoogleService-Info.plist`. Se app iOS não existe no Firebase, criar primeiro: `firebase apps:create IOS "Nome" --bundle-id com.futebadosparcas`. App ID atual: `1:490094091078:ios:e51b069afe7aefa3b5a347`.

**`xcodegen generate` quebra integração Pods**: rodar `pod install` SEMPRE após `xcodegen generate`. Sequência: `xcodegen generate && pod install`.

**`context-mode TMPDIR` errors em xcodebuild via MCP**: setar `TMPDIR=/tmp/xcb-tmp` explícito antes do xcodebuild. context-mode sandbox cleanup pode invalidar TMPDIR padrão.

**Keychain error -34018 (FirebaseAuth saved-user no Simulator)**: normal — Simulator sem Keychain entitlement válido. Não bloqueia. Resolve em device real.

### `MissingResourceException: ... strings.commonMain.cvr` ao abrir o app

Os recursos do Compose (`composeResources/`) não vão dentro do framework. A fase
"Copiar recursos do Compose" do `project.yml` gera e copia para
`iosApp.app/compose-resources`. Se o erro aparecer, rode `xcodegen generate` e
`pod install` de novo (o projeto antigo não tem a fase) ou gere à mão com
`./gradlew :composeApp:assembleIosSimulatorArm64MainResources`.

### App fecha com `FIRIllegalStateException` sem `GoogleService-Info.plist`

Esperado só em versões antigas: o módulo Koin do iOS (`PlatformComposeAppModule.ios.kt`)
não registra dependências de Firebase quando o plist não está no bundle. Se um código
novo usar `Firebase.*` direto, ele precisa da mesma guarda (`isFirebaseConfigured()`).

## Próximos passos

1. **Bootstrap free no seu iPhone** → ver [BOOTSTRAP_FREE.md](BOOTSTRAP_FREE.md) (sem $99 Apple Dev, validação local de device-real)
2. **Implementar Phase 3 CMP**: composeApp/iosMain com MainViewController
3. **TestFlight** (futuro, requer $99/ano Apple Dev Program) → ver [`specs/IOS_TESTFLIGHT_SETUP.md`](../specs/IOS_TESTFLIGHT_SETUP.md)
