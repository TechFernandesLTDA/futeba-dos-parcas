# SPEC: iOS Development com Kotlin Multiplatform

> **Status:** `DRAFT`
> **Autor:** Claude AI
> **Data:** 2026-02-01
> **Versão Alvo:** 2.0.0

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O Futeba dos Parças atualmente está disponível apenas para Android. A expansão para iOS permitirá:
- Alcançar ~50% do mercado de smartphones no Brasil (especialmente classes A/B)
- Aumentar base de usuários e grupos
- Reter grupos mistos (onde alguns membros têm iPhone)

**Por que KMP?**
- 85 arquivos em `commonMain` já prontos (modelos, use cases, repositories interfaces)
- Reuso de ~70% do código de negócio
- Consistência de comportamento entre plataformas
- Manutenção centralizada de regras de negócio

### 1.2 Estratégia de UI: Compose Multiplatform vs SwiftUI

| Critério | Compose Multiplatform | SwiftUI Nativo |
|----------|----------------------|----------------|
| **Reuso de código** | ~95% (UI + lógica) | ~70% (só lógica) |
| **Curva de aprendizado** | Menor (já sabemos Compose) | Maior (nova linguagem) |
| **Performance** | Excelente (Skia/Metal) | Nativa |
| **Widgets iOS** | Limitado | Completo |
| **LLM-friendly** | ✅ Kotlin único | ⚠️ Swift + Kotlin |
| **Maturidade** | Estável desde 2024 | Madura |
| **App Store Review** | Aprovado | Nativo |

**Decisão: Compose Multiplatform**

Razões:
1. **LLM Optimization**: Um único idioma (Kotlin) para toda a codebase facilita:
   - Geração de código consistente
   - Refatorações cross-platform
   - Debugging unificado

2. **Reuso máximo**: Telas Compose existentes podem ser adaptadas com mínimo esforço

3. **Futuro**: Compose Multiplatform é o investimento estratégico do Google/JetBrains

### 1.3 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador iOS | Fazer login com Apple ID | Autenticação via Firebase Auth |
| UC2 | Jogador iOS | Ver próximos jogos | Lista de jogos do grupo |
| UC3 | Jogador iOS | Confirmar presença | Check-in com validação GPS |
| UC4 | Jogador iOS | Registrar gol/assistência | Estatísticas atualizadas |
| UC5 | Jogador iOS | Votar MVP | Sistema de gamificação |
| UC6 | Jogador iOS | Receber notificações | Push via APNs/FCM |

### 1.4 Critérios de Aceite

- [ ] CA1: App iOS funcional no simulador e dispositivo real
- [ ] CA2: Paridade de features com Android (exceto widgets)
- [ ] CA3: Login com Apple ID funcionando
- [ ] CA4: Notificações push funcionando
- [ ] CA5: Localização GPS funcionando
- [ ] CA6: Aprovado na App Store

### 1.5 Fora de Escopo (v2.0)

- Widgets iOS (WidgetKit) - futuro v2.1
- Apple Watch app - futuro v3.0
- Siri Shortcuts - futuro
- CarPlay - futuro

---

## 2. Arquitetura iOS com KMP

### 2.1 Estrutura de Diretórios

```
FutebaDosParcas/
├── shared/                      # Módulo KMP existente
│   ├── src/
│   │   ├── commonMain/          # 85 arquivos ✅
│   │   ├── androidMain/         # 30 arquivos ✅
│   │   └── iosMain/             # 9 arquivos (expandir)
│   └── build.gradle.kts         # iOS targets configurados ✅
│
├── iosApp/                      # NOVO - App iOS
│   ├── iosApp/
│   │   ├── FutebaApp.swift      # Entry point
│   │   ├── ContentView.swift    # Host para ComposeView
│   │   ├── Firebase/
│   │   │   └── IosFirebaseBridge.swift  # Bridge Firebase
│   │   ├── Info.plist
│   │   └── Assets.xcassets
│   ├── iosApp.xcodeproj
│   └── Podfile                  # Firebase iOS SDK
│
└── composeApp/                  # NOVO - Compose Multiplatform UI
    ├── src/
    │   ├── commonMain/          # Telas compartilhadas
    │   ├── androidMain/         # Específico Android
    │   └── iosMain/             # Específico iOS
    └── build.gradle.kts
```

### 2.2 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                        iOS App                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SwiftUI Host (ContentView)              │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │         ComposeUIViewController              │    │    │
│  │  │  ┌─────────────────────────────────────┐    │    │    │
│  │  │  │      Compose Multiplatform UI       │    │    │    │
│  │  │  │  (HomeScreen, GameScreen, etc.)     │    │    │    │
│  │  │  └─────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              shared (Kotlin/Native)                  │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │    │
│  │  │ ViewModels │  │ UseCases  │  │ Repositories  │   │    │
│  │  └───────────┘  └───────────┘  └───────────────┘   │    │
│  │                       │                             │    │
│  │              ┌────────┴────────┐                   │    │
│  │              ▼                 ▼                   │    │
│  │  ┌─────────────────┐  ┌─────────────────┐         │    │
│  │  │ FirebaseDataSource│  │  SQLDelight DB  │         │    │
│  │  │   (iosMain)      │  │  (native-driver)│         │    │
│  │  └─────────────────┘  └─────────────────┘         │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           IosFirebaseBridge.swift                    │    │
│  │  (Ponte entre Kotlin/Native e Firebase iOS SDK)     │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Firebase iOS SDK                        │    │
│  │  (Firestore, Auth, Storage, Analytics, FCM)         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Pattern: Swift-Kotlin Bridge

O arquivo `FirebaseDataSource.kt` em iosMain (1946 linhas) já define a interface.
Precisamos implementar `IosFirebaseBridge.swift`:

```swift
// IosFirebaseBridge.swift
import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore

@objc public class IosFirebaseBridge: NSObject {

    private let db = Firestore.firestore()
    private let auth = Auth.auth()

    // MARK: - Authentication

    @objc public func getCurrentUserId() -> String? {
        return auth.currentUser?.uid
    }

    @objc public func signInWithApple(
        idToken: String,
        nonce: String,
        completion: @escaping (String?, Error?) -> Void
    ) {
        let credential = OAuthProvider.credential(
            withProviderID: "apple.com",
            idToken: idToken,
            rawNonce: nonce
        )
        auth.signIn(with: credential) { result, error in
            completion(result?.user.uid, error)
        }
    }

    // MARK: - Firestore

    @objc public func getDocument(
        collection: String,
        documentId: String,
        completion: @escaping ([String: Any]?, Error?) -> Void
    ) {
        db.collection(collection).document(documentId).getDocument { snapshot, error in
            completion(snapshot?.data(), error)
        }
    }

    @objc public func setDocument(
        collection: String,
        documentId: String,
        data: [String: Any],
        merge: Bool,
        completion: @escaping (Error?) -> Void
    ) {
        db.collection(collection).document(documentId).setData(data, merge: merge) { error in
            completion(error)
        }
    }

    // ... (demais métodos seguindo mesmo padrão)
}
```

---

## 3. Technical Design

### 3.1 Dependências iOS

**Podfile:**
```ruby
platform :ios, '15.0'

target 'iosApp' do
  use_frameworks!

  # Firebase
  pod 'FirebaseCore'
  pod 'FirebaseAuth'
  pod 'FirebaseFirestore'
  pod 'FirebaseStorage'
  pod 'FirebaseAnalytics'
  pod 'FirebaseMessaging'
  pod 'FirebaseCrashlytics'

  # Sign in with Apple
  # (nativo, não precisa de pod)

  # Google Sign-In (opcional)
  pod 'GoogleSignIn'
end
```

**build.gradle.kts (composeApp):**
```kotlin
kotlin {
    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.material3)
                implementation(compose.ui)
                implementation(project(":shared"))
            }
        }

        val iosMain by creating {
            dependsOn(commonMain)
        }
    }
}
```

### 3.2 Configuração Firebase iOS

1. Baixar `GoogleService-Info.plist` do Firebase Console
2. Adicionar ao target iOS no Xcode
3. Inicializar no `FutebaApp.swift`:

```swift
import SwiftUI
import FirebaseCore

@main
struct FutebaApp: App {
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

### 3.3 Compose Multiplatform Entry Point

```swift
// ContentView.swift
import SwiftUI
import ComposeApp

struct ContentView: View {
    var body: some View {
        ComposeView()
            .ignoresSafeArea(.all)
    }
}

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
```

```kotlin
// composeApp/src/iosMain/kotlin/MainViewController.kt
import androidx.compose.ui.window.ComposeUIViewController
import com.futebadosparcas.ui.App

fun MainViewController() = ComposeUIViewController { App() }
```

### 3.4 Push Notifications (APNs + FCM)

```swift
// AppDelegate.swift
import UIKit
import FirebaseMessaging

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self

        application.registerForRemoteNotifications()

        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        // Enviar token para o backend
        if let token = fcmToken {
            IosFirebaseBridge().updateFcmToken(token: token)
        }
    }
}
```

### 3.5 Localização GPS

```swift
// LocationService.swift
import CoreLocation

class LocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    var onLocationUpdate: ((CLLocation) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func getCurrentLocation() {
        manager.requestLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let location = locations.last {
            onLocationUpdate?(location)
        }
    }
}
```

### 3.6 Sign in with Apple

```swift
// AppleSignInService.swift
import AuthenticationServices
import CryptoKit

class AppleSignInService: NSObject, ASAuthorizationControllerDelegate {

    private var currentNonce: String?
    var onComplete: ((String, String) -> Void)?
    var onError: ((Error) -> Void)?

    func signIn() {
        let nonce = randomNonceString()
        currentNonce = nonce

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.performRequests()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
           let idToken = appleIDCredential.identityToken,
           let tokenString = String(data: idToken, encoding: .utf8) {
            onComplete?(tokenString, currentNonce ?? "")
        }
    }

    private func randomNonceString(length: Int = 32) -> String {
        // Implementação de nonce seguro
    }

    private func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}
```

---

## 4. Tasks (Breakdown)

### Fase 1: Setup Inicial

| # | Task | Descrição | Status |
|---|------|-----------|--------|
| 1.1 | Criar projeto Xcode | Estrutura iosApp com targets | ⬜ |
| 1.2 | Configurar CocoaPods | Podfile com Firebase dependencies | ⬜ |
| 1.3 | Integrar shared framework | Linkar shared.framework no Xcode | ⬜ |
| 1.4 | Firebase setup | GoogleService-Info.plist + init | ⬜ |
| 1.5 | Compose Multiplatform setup | Módulo composeApp | ⬜ |

### Fase 2: Firebase Bridge

| # | Task | Descrição | Status |
|---|------|-----------|--------|
| 2.1 | IosFirebaseBridge - Auth | Login, logout, currentUser | ⬜ |
| 2.2 | IosFirebaseBridge - Firestore | CRUD operations | ⬜ |
| 2.3 | IosFirebaseBridge - Storage | Upload/download files | ⬜ |
| 2.4 | IosFirebaseBridge - FCM | Push notifications | ⬜ |
| 2.5 | Sign in with Apple | ASAuthorizationController | ⬜ |

### Fase 3: Core Features

| # | Task | Descrição | Status |
|---|------|-----------|--------|
| 3.1 | Splash Screen | Launch + auth check | ⬜ |
| 3.2 | Login Screen | Apple ID + Email/Password | ⬜ |
| 3.3 | Home Screen | Grupos + próximos jogos | ⬜ |
| 3.4 | Game Detail | Confirmações + check-in GPS | ⬜ |
| 3.5 | Live Game | Registro de eventos | ⬜ |
| 3.6 | MVP Voting | Votação pós-jogo | ⬜ |
| 3.7 | Profile | Stats + badges | ⬜ |
| 3.8 | Settings | Notificações + preferences | ⬜ |

### Fase 4: Polish

| # | Task | Descrição | Status |
|---|------|-----------|--------|
| 4.1 | App Icons | Todos os tamanhos | ⬜ |
| 4.2 | Launch Screen | Storyboard ou SwiftUI | ⬜ |
| 4.3 | Dark Mode | Validar cores/contraste | ⬜ |
| 4.4 | Accessibility | VoiceOver, Dynamic Type | ⬜ |
| 4.5 | Performance | Profiling, otimizações | ⬜ |

### Fase 5: Release

| # | Task | Descrição | Status |
|---|------|-----------|--------|
| 5.1 | App Store Connect | Create app, metadata | ⬜ |
| 5.2 | Screenshots | iPhone + iPad | ⬜ |
| 5.3 | Privacy Labels | App privacy details | ⬜ |
| 5.4 | TestFlight | Beta testing | ⬜ |
| 5.5 | Submit for Review | App Store submission | ⬜ |

---

## 5. Guia LLM-Friendly

### 5.1 Estrutura de Prompts para Desenvolvimento

Ao solicitar implementação, usar formato:

```
Contexto: [descrever o que já existe]
Tarefa: [implementar X]
Arquivos relevantes:
- shared/src/commonMain/.../X.kt
- shared/src/iosMain/.../XImpl.kt

Padrões a seguir:
- Usar expect/actual para código específico de plataforma
- StateFlow para estados
- suspend functions para async

Output esperado:
- Código Kotlin completo
- Imports necessários
- Testes unitários (se aplicável)
```

### 5.2 Convenções para Consistência

**Nomenclatura:**
- `*Screen.kt` - Composables de tela completa
- `*ViewModel.kt` - ViewModels com @HiltViewModel (Android) ou manual (iOS)
- `*Repository.kt` - Interface em commonMain, impl em platform
- `*UseCase.kt` - Lógica de negócio em commonMain
- `*Bridge.swift` - Pontes Swift-Kotlin

**Estados:**
```kotlin
sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    object Empty : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}
```

**Padrão expect/actual:**
```kotlin
// commonMain
expect class PlatformContext

expect fun getPlatformName(): String

// androidMain
actual typealias PlatformContext = Context

actual fun getPlatformName(): String = "Android"

// iosMain
actual class PlatformContext

actual fun getPlatformName(): String = "iOS"
```

### 5.3 Comandos Úteis

```bash
# Build iOS framework
./gradlew :shared:linkDebugFrameworkIosArm64
./gradlew :shared:linkReleaseFrameworkIosArm64

# Verificar targets disponíveis
./gradlew :shared:tasks --group=build

# Abrir no Xcode (após setup)
open iosApp/iosApp.xcworkspace

# Rodar no simulador
xcodebuild -workspace iosApp/iosApp.xcworkspace \
  -scheme iosApp \
  -destination 'platform=iOS Simulator,name=iPhone 15 Pro' \
  build
```

---

## 6. Verificação

### 6.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit (shared) | Já existente | ✅ |
| Unit (iosMain) | Bridge methods | ⬜ |
| UI (Compose) | Fluxos críticos | ⬜ |
| Integration | Firebase ops | ⬜ |

### 6.2 Checklist de Release

- [ ] App funciona no simulador
- [ ] App funciona em dispositivo real
- [ ] Login com Apple funciona
- [ ] Login com Email funciona
- [ ] Push notifications funcionam
- [ ] Localização GPS funciona
- [ ] Offline mode funciona (cache)
- [ ] Dark mode funciona
- [ ] VoiceOver funciona
- [ ] Performance aceitável (< 16ms/frame)
- [ ] Crash-free rate > 99%
- [ ] Aprovado no App Store Review

### 6.3 Requisitos App Store

- [ ] App Icons (todas as resoluções)
- [ ] Launch Screen
- [ ] Privacy Policy URL
- [ ] Terms of Service URL (já temos: futebadosparcas.web.app)
- [ ] Screenshots (6.7", 6.5", 5.5" iPhone + iPad)
- [ ] App description (PT-BR)
- [ ] Keywords
- [ ] Privacy Labels (nutrition labels)
- [ ] Age Rating (4+)

---

## 7. Referências

- [Compose Multiplatform iOS](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-multiplatform-getting-started.html)
- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)
- [Sign in with Apple](https://developer.apple.com/documentation/authenticationservices/implementing_user_authentication_with_sign_in_with_apple)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-02-01 | Claude AI | Criação inicial |
