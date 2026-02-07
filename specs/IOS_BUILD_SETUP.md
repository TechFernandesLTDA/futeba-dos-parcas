# iOS Build Setup Guide - Futeba dos Parcas

**Status**: DRAFT
**Version**: 1.0
**Last Updated**: 2026-02-06
**Author**: TEAM 10 (Especialistas iOS/KMP)

---

## Indice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Build do Framework iOS (shared module)](#2-build-do-framework-ios-shared-module)
3. [Configuracao do Firebase para iOS](#3-configuracao-do-firebase-para-ios)
4. [Configuracao do Sign in with Apple](#4-configuracao-do-sign-in-with-apple)
5. [Configuracao de Push Notifications (APNs)](#5-configuracao-de-push-notifications-apns)
6. [CI/CD para Builds iOS](#6-cicd-para-builds-ios)
7. [Estrutura do Projeto iOS](#7-estrutura-do-projeto-ios)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Pre-requisitos

### Hardware

- **Mac com macOS 14.0+ (Sonoma)** ou superior (obrigatorio para builds iOS)
- Chip Apple Silicon (M1/M2/M3) recomendado para performance
- Minimo 16GB RAM (recomendado 32GB para builds KMP + Xcode)

### Software

| Ferramenta | Versao Minima | Instalacao |
|------------|---------------|------------|
| **Xcode** | 15.4+ | Mac App Store |
| **Xcode Command Line Tools** | Correspondente ao Xcode | `xcode-select --install` |
| **CocoaPods** | 1.15.0+ | `sudo gem install cocoapods` |
| **JDK** | 17 | `brew install openjdk@17` |
| **Kotlin** | 2.2.10 | Via Gradle (automatico) |
| **Gradle** | 8.x | Via wrapper (automatico) |
| **Ruby** | 3.0+ | `brew install ruby` (necessario para CocoaPods) |

### Contas e Certificados

- **Apple Developer Account** (obrigatoria, $99/ano): [developer.apple.com](https://developer.apple.com)
- **Apple Developer Program** membership ativa
- Certificado de Desenvolvimento iOS gerado no Apple Developer Portal
- Provisioning Profile (Development e Distribution)

### Verificacao dos pre-requisitos

```bash
# Verificar Xcode
xcode-select -p
# Deve retornar: /Applications/Xcode.app/Contents/Developer

# Verificar versao do Xcode
xcodebuild -version
# Xcode 15.4+ esperado

# Verificar CocoaPods
pod --version
# 1.15.0+ esperado

# Verificar JDK
java -version
# openjdk 17+ esperado

# Verificar Kotlin (via Gradle)
./gradlew --version
# Gradle 8.x, Kotlin 2.2.10 esperados
```

---

## 2. Build do Framework iOS (shared module)

O modulo `:shared` gera um framework estatico iOS que pode ser consumido pelo app iOS nativo (SwiftUI) ou pelo Compose Multiplatform.

### 2.1 Targets Disponíveis

| Target | Uso | Comando |
|--------|-----|---------|
| `iosSimulatorArm64` | Simulador em Macs Apple Silicon (M1/M2/M3) | `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64` |
| `iosArm64` | Dispositivo fisico (iPhone/iPad) | `./gradlew :shared:linkDebugFrameworkIosArm64` |
| `iosX64` | Simulador em Macs Intel | `./gradlew :shared:linkDebugFrameworkIosX64` |

### 2.2 Build do Framework (Debug)

```bash
# Para simulador Apple Silicon (mais comum para desenvolvimento)
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64

# O framework sera gerado em:
# shared/build/bin/iosSimulatorArm64/debugFramework/shared.framework

# Para dispositivo fisico
./gradlew :shared:linkDebugFrameworkIosArm64

# Para simulador Intel
./gradlew :shared:linkDebugFrameworkIosX64
```

### 2.3 Build do Framework (Release)

```bash
# Release para dispositivo fisico (App Store)
./gradlew :shared:linkReleaseFrameworkIosArm64

# Release para simulador (testes CI)
./gradlew :shared:linkReleaseFrameworkIosSimulatorArm64
```

### 2.4 Build do ComposeApp (Compose Multiplatform UI)

```bash
# Framework do Compose Multiplatform para simulador
./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64

# Framework gerado em:
# composeApp/build/bin/iosSimulatorArm64/debugFramework/ComposeApp.framework
```

### 2.5 Fat Framework / XCFramework (Universal)

Para distribuir um unico framework compativel com simulador e dispositivo:

```bash
# Gerar XCFramework (recomendado)
./gradlew :shared:assembleXCFramework

# Ou para debug
./gradlew :shared:assembleSharedDebugXCFramework

# O XCFramework sera gerado em:
# shared/build/XCFrameworks/debug/shared.xcframework
```

### 2.6 Verificacao do Build (Metadata)

Para verificar que o codigo Kotlin compila sem gerar frameworks nativos:

```bash
# Compilacao rapida de verificacao (todos os targets)
./gradlew :shared:compileKotlinMetadata

# Compilacao apenas do common (mais rapido)
./gradlew :shared:compileCommonMainKotlinMetadata
```

---

## 3. Configuracao do Firebase para iOS

### 3.1 Criar projeto Firebase (se ainda nao existir)

O projeto Firebase ja esta configurado para Android. Para adicionar iOS:

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto "Futeba dos Parcas"
3. Clique em "Adicionar app" > iOS
4. Preencha:
   - **Bundle ID**: `com.futebadosparcas.ios` (confirmar com o time)
   - **App nickname**: "Futeba dos Parcas iOS"
   - **App Store ID**: (preencher depois, quando publicar)

### 3.2 Download do GoogleService-Info.plist

1. Apos registrar o app iOS, faca download do `GoogleService-Info.plist`
2. Coloque na raiz do projeto Xcode iOS: `iosApp/FutebaDosParcas-ios/GoogleService-Info.plist`
3. **IMPORTANTE**: Adicione ao `.gitignore` se contem dados sensiveis
4. Certifique-se que o arquivo esta incluido no target correto no Xcode

### 3.3 Instalar Firebase iOS SDK

#### Via CocoaPods (recomendado para KMP)

Crie ou edite `iosApp/Podfile`:

```ruby
platform :ios, '16.0'

target 'FutebaDosParcas-ios' do
  use_frameworks!

  # Firebase
  pod 'FirebaseCore', '~> 11.0'
  pod 'FirebaseAuth', '~> 11.0'
  pod 'FirebaseFirestore', '~> 11.0'
  pod 'FirebaseStorage', '~> 11.0'
  pod 'FirebaseMessaging', '~> 11.0'
  pod 'FirebaseAppCheck', '~> 11.0'
  pod 'FirebaseCrashlytics', '~> 11.0'
  pod 'FirebaseAnalytics', '~> 11.0'

  # Shared KMP framework
  # O framework e linkado automaticamente pelo Gradle KMP plugin
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    end
  end
end
```

Executar:

```bash
cd iosApp
pod install
# Apos isso, abrir .xcworkspace (NAO .xcodeproj)
```

#### Via Swift Package Manager (alternativa)

No Xcode:
1. File > Add Package Dependencies
2. URL: `https://github.com/firebase/firebase-ios-sdk`
3. Selecionar: FirebaseAuth, FirebaseFirestore, FirebaseStorage, FirebaseMessaging

### 3.4 Inicializar Firebase no App

Em `AppDelegate.swift` ou `@main` struct:

```swift
import FirebaseCore

@main
struct FutebaDosParcasApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### 3.5 App Check para iOS

```swift
import FirebaseAppCheck

// Em AppDelegate ou init:
let providerFactory: AppCheckProviderFactory

#if DEBUG
providerFactory = AppCheckDebugProviderFactory()
#else
providerFactory = AppAttestProviderFactory()
#endif

AppCheck.setAppCheckProviderFactory(providerFactory)
```

---

## 4. Configuracao do Sign in with Apple

### 4.1 Apple Developer Portal

1. Acesse [Apple Developer Portal](https://developer.apple.com/account/)
2. Certificates, Identifiers & Profiles > Identifiers
3. Selecione ou crie o App ID: `com.futebadosparcas.ios`
4. Em Capabilities, habilite "Sign in with Apple"

### 4.2 Firebase Console

1. Authentication > Sign-in method
2. Adicionar "Apple" como provider
3. Configurar:
   - **Services ID**: Criar em developer.apple.com (usado para web sign-in)
   - **Team ID**: Encontrado em developer.apple.com > Membership
   - **Key ID**: Criar uma Key com "Sign in with Apple" habilitado
   - **Private Key**: Download do .p8 e upload no Firebase

### 4.3 Xcode Configuration

1. No target do app, aba "Signing & Capabilities"
2. Adicionar capability: "Sign in with Apple"

### 4.4 Implementacao em Swift

```swift
import AuthenticationServices
import FirebaseAuth

class SignInWithAppleManager: NSObject, ASAuthorizationControllerDelegate {

    func startSignInWithApple() {
        let nonce = randomNonceString()
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        let request = appleIDProvider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let authorizationController = ASAuthorizationController(
            authorizationRequests: [request]
        )
        authorizationController.delegate = self
        authorizationController.performRequests()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let appleIDCredential = authorization.credential
                as? ASAuthorizationAppleIDCredential,
              let appleIDToken = appleIDCredential.identityToken,
              let idTokenString = String(data: appleIDToken, encoding: .utf8)
        else { return }

        let credential = OAuthProvider.appleCredential(
            withIDToken: idTokenString,
            rawNonce: currentNonce,
            fullName: appleIDCredential.fullName
        )

        Auth.auth().signIn(with: credential) { result, error in
            // Handle result
        }
    }
}
```

---

## 5. Configuracao de Push Notifications (APNs)

### 5.1 Apple Developer Portal

1. Certificates, Identifiers & Profiles > Keys
2. Criar nova Key com "Apple Push Notifications service (APNs)" habilitado
3. Fazer download do arquivo `.p8` (GUARDE COM SEGURANCA, so pode baixar uma vez)
4. Anotar o **Key ID** e **Team ID**

### 5.2 Firebase Console

1. Project Settings > Cloud Messaging
2. Na secao "Apple app configuration":
   - Upload do APNs Authentication Key (.p8)
   - Preencher Key ID e Team ID

### 5.3 Xcode Configuration

1. No target do app, "Signing & Capabilities"
2. Adicionar: "Push Notifications"
3. Adicionar: "Background Modes" > marcar "Remote notifications"

### 5.4 Implementacao em Swift

```swift
import FirebaseMessaging
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate,
    UNUserNotificationCenterDelegate, MessagingDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Solicitar permissao
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(
            options: authOptions
        ) { _, _ in }

        application.registerForRemoteNotifications()

        // Configurar Firebase Messaging
        Messaging.messaging().delegate = self

        return true
    }

    // Receber token FCM
    func messaging(_ messaging: Messaging,
                   didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        // Enviar token para o backend (shared module)
        print("FCM Token: \(token)")
    }

    // Receber APNs token
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }
}
```

### 5.5 Entitlements

Criar arquivo `FutebaDosParcas-ios.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>
```

Para producao, alterar `development` para `production`.

---

## 6. CI/CD para Builds iOS

### 6.1 Consideracoes Gerais

- Builds iOS **OBRIGATORIAMENTE** requerem macOS (GitHub Actions macOS runners ou Bitrise)
- O build KMP (shared framework) pode ser feito em qualquer OS, mas o Xcode build precisa de Mac
- Tempo medio de build: ~15-20 minutos (KMP + Xcode)

### 6.2 GitHub Actions (Recomendado)

Arquivo `.github/workflows/ios-build.yml`:

```yaml
name: iOS Build

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

jobs:
  build-ios:
    runs-on: macos-14  # macOS Sonoma com Xcode 15
    timeout-minutes: 45

    steps:
      - uses: actions/checkout@v4

      - name: Setup JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Gradle Cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
            ~/.konan
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle.kts') }}

      - name: Setup CocoaPods
        run: |
          sudo gem install cocoapods
          cd iosApp && pod install

      - name: Build Shared Framework
        run: ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64

      - name: Build ComposeApp Framework
        run: ./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64

      - name: Build iOS App
        run: |
          xcodebuild build \
            -workspace iosApp/FutebaDosParcas-ios.xcworkspace \
            -scheme FutebaDosParcas-ios \
            -sdk iphonesimulator \
            -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
            -configuration Debug \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO \
            ONLY_ACTIVE_ARCH=YES
```

### 6.3 Fastlane (Automatizacao de Deploy)

Criar `iosApp/Gemfile`:

```ruby
source "https://rubygems.org"
gem "fastlane"
gem "cocoapods"
```

Criar `iosApp/fastlane/Fastfile`:

```ruby
default_platform(:ios)

platform :ios do
  desc "Build para TestFlight"
  lane :beta do
    # Build KMP frameworks
    sh("cd .. && ./gradlew :shared:linkReleaseFrameworkIosArm64")
    sh("cd .. && ./gradlew :composeApp:linkReleaseFrameworkIosArm64")

    # Build e upload
    build_app(
      workspace: "FutebaDosParcas-ios.xcworkspace",
      scheme: "FutebaDosParcas-ios",
      export_method: "app-store"
    )

    upload_to_testflight(
      skip_waiting_for_build_processing: true
    )
  end

  desc "Deploy para App Store"
  lane :release do
    build_app(
      workspace: "FutebaDosParcas-ios.xcworkspace",
      scheme: "FutebaDosParcas-ios",
      export_method: "app-store"
    )

    upload_to_app_store(
      force: true,
      skip_screenshots: true
    )
  end
end
```

### 6.4 Secrets Necessarios no CI

| Secret | Descricao |
|--------|-----------|
| `APPLE_CERTIFICATE_P12` | Certificado de distribuicao (Base64) |
| `APPLE_CERTIFICATE_PASSWORD` | Senha do certificado P12 |
| `APPLE_PROVISIONING_PROFILE` | Provisioning profile (Base64) |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID |
| `APPLE_API_ISSUER_ID` | App Store Connect Issuer ID |
| `APPLE_API_KEY_P8` | App Store Connect API Key (.p8 content) |
| `GOOGLE_SERVICE_INFO_PLIST` | Conteudo do GoogleService-Info.plist (Base64) |

---

## 7. Estrutura do Projeto iOS

### 7.1 Estrutura de Diretorios Planejada

```
FutebaDosParcas/
  iosApp/
    FutebaDosParcas-ios/
      App/
        FutebaDosParcasApp.swift       # Entry point
        AppDelegate.swift              # UIApplicationDelegate
      Config/
        GoogleService-Info.plist       # Firebase config (NAO commitar)
        Info.plist                     # App metadata
        FutebaDosParcas-ios.entitlements
      Bridges/
        IosFirebaseBridge.swift        # Bridge KMP <-> Firebase iOS SDK
      Views/                           # SwiftUI views (se nao usar Compose MP)
      Resources/
        Assets.xcassets
        LaunchScreen.storyboard
    FutebaDosParcas-ios.xcodeproj
    FutebaDosParcas-ios.xcworkspace    # Abrir este (CocoaPods)
    Podfile
    Podfile.lock
    Gemfile                            # Fastlane
    fastlane/
      Fastfile
      Appfile
```

### 7.2 Integracao do Shared Module no Xcode

O framework `shared.framework` gerado pelo Gradle e automaticamente linkado ao projeto Xcode quando usando o plugin Kotlin Multiplatform. Para configuracao manual:

1. No Xcode, abrir Build Settings do target
2. Em "Framework Search Paths", adicionar:
   `$(SRCROOT)/../shared/build/bin/iosSimulatorArm64/debugFramework`
3. Em "Other Linker Flags", adicionar: `-framework shared`
4. Build Phases > Link Binary With Libraries > adicionar `shared.framework`

---

## 8. Troubleshooting

### Problema: "No such module 'shared'" no Xcode

**Causa**: Framework nao foi compilado ou path esta incorreto.

**Solucao**:
```bash
# Recompilar o framework
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64

# Verificar se o framework existe
ls shared/build/bin/iosSimulatorArm64/debugFramework/shared.framework
```

### Problema: "Undefined symbols" ao linkar

**Causa**: Mismatch entre target (arm64 vs x64) ou debug vs release.

**Solucao**: Verificar que o target do build Gradle corresponde ao target do Xcode:
- Simulador Apple Silicon: `iosSimulatorArm64`
- Simulador Intel: `iosX64`
- Dispositivo fisico: `iosArm64`

### Problema: CocoaPods conflito de versoes

**Solucao**:
```bash
cd iosApp
pod deintegrate
pod cache clean --all
pod install --repo-update
```

### Problema: Build lento no CI

**Otimizacoes**:
- Usar cache do Gradle (`~/.gradle/caches`, `~/.gradle/wrapper`)
- Usar cache do Konan (`~/.konan`) - cache do compilador Kotlin/Native
- Usar `ONLY_ACTIVE_ARCH=YES` para builds de debug
- Considerar usar builds incrementais com `--build-cache`

### Problema: Kotlin/Native memory issues

**Solucao**: Adicionar ao `gradle.properties`:
```properties
kotlin.native.cacheKind.iosSimulatorArm64=none
kotlin.native.cacheKind.iosArm64=none
org.gradle.jvmargs=-Xmx4g
```

### Problema: Firebase Auth nao funciona no simulador

**Causa**: App Check com App Attest nao funciona no simulador.

**Solucao**: Usar `AppCheckDebugProviderFactory` em builds de debug (ja configurado na secao 3.5).

---

## Proximos Passos

1. [ ] Criar projeto Xcode inicial (`iosApp/`)
2. [ ] Configurar Firebase no Apple Developer Portal
3. [ ] Implementar IosFirebaseBridge em Swift
4. [ ] Configurar CI/CD (GitHub Actions)
5. [ ] Configurar Fastlane para deploy
6. [ ] Testar build E2E: Gradle -> Xcode -> Simulador
7. [ ] Configurar TestFlight para beta testing
