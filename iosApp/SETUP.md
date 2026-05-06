# Setup do Projeto iOS

## Passo 1: Criar Projeto no Xcode

1. Abrir Xcode
2. File → New → Project
3. Selecionar "App" (iOS)
4. Product Name: `iosApp`
5. Organization Identifier: `com.futebadosparcas`
6. Interface: SwiftUI
7. Language: Swift
8. Salvar em: `FutebaDosParcas/iosApp/`

## Passo 2: Configurar Targets

### Build Settings:
- iOS Deployment Target: 15.0
- Swift Language Version: 5.9
- Enable Bitcode: No

### Framework Search Paths:
Adicionar em Build Settings → Framework Search Paths:
```
$(SRCROOT)/../shared/build/bin/iosArm64/debugFramework
$(SRCROOT)/../shared/build/bin/iosSimulatorArm64/debugFramework
```

### Other Linker Flags:
```
-framework shared
```

## Passo 3: Capabilities

Ativar em Signing & Capabilities:
- Push Notifications
- Sign in with Apple
- Background Modes → Remote notifications
- Location → When In Use

## Passo 4: Info.plist

Adicionar chaves:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Precisamos da sua localização para validar check-in nos jogos</string>

<key>NSCameraUsageDescription</key>
<string>Tire fotos para compartilhar momentos das peladas</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Escolha fotos para seu perfil e jogos</string>

<key>UIApplicationSceneManifest</key>
<dict>
    <key>UIApplicationSupportsMultipleScenes</key>
    <true/>
</dict>
```

## Passo 5: Instalar CocoaPods

```bash
cd iosApp
pod install
```

## Passo 6: Build Shared Framework

```bash
cd ..
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
```

## Passo 7: Abrir Workspace

```bash
open iosApp.xcworkspace
```

## Troubleshooting

### Framework not found
Se o Xcode não encontrar o framework `shared`:
1. Verifique se o framework foi compilado: `./iosApp/build_shared.sh`
2. Limpe o build: Product → Clean Build Folder
3. Rebuild: ⌘B

### Simulator issues
Se houver problemas com o simulador:
- Certifique-se de que o framework correto está sendo usado (Arm64 para M1/M2, x86_64 para Intel)
- Execute: `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64` (M1/M2) ou `./gradlew :shared:linkDebugFrameworkIosX64` (Intel)

### CocoaPods issues
Se o `pod install` falhar:
```bash
pod repo update
pod install --repo-update
```

---

## Phone+CPF Verification Setup (Fase 4 — #447)

Os arquivos abaixo implementam o fluxo de verificação anti-bot iOS:

- `Utils/CpfValidator.swift` — algoritmo CPF mod-11 (espelha shared KMP)
- `Services/VerificationService.swift` — wrapper das callables `verifyCpf` + `setUserVerified`
- `ViewModels/PhoneVerificationViewModel.swift` — Firebase PhoneAuthProvider link
- `ViewModels/CpfVerificationViewModel.swift` — submit CPF + complete flow
- `Views/PhoneVerificationView.swift` — UI etapa 1/2 (SMS OTP)
- `Views/CpfVerificationView.swift` — UI etapa 2/2 (CPF input + LGPD panel)
- `Views/VerificationFlowView.swift` — coordinator (auto-skip phone se já linked)

### APNs Setup (necessário pra Phone Auth)

O Firebase Phone Auth no iOS requer APNs configurado pra receber silent push tokens (substituem o reCAPTCHA usado em Android/Web).

#### Passo APNs 1: Apple Developer Account

1. Acesse https://developer.apple.com/account
2. **Certificates, IDs & Profiles → Keys → "+" novo key**
3. Habilite **Apple Push Notifications service (APNs)**
4. Download o `.p8` file (guarde — só pode baixar 1x)
5. Anote o **Key ID** e o **Team ID** (mostrados no portal)

#### Passo APNs 2: Firebase Console

1. https://console.firebase.google.com → projeto `futebadosparcas`
2. **Project Settings → Cloud Messaging tab**
3. Em iOS app config, **Upload APNs auth key**:
   - Key file: `.p8` baixado
   - Key ID: copiado do Apple
   - Team ID: copiado do Apple

#### Passo APNs 3: AppDelegate

Adicionar em `AppDelegate.swift`:

```swift
import FirebaseAuth
import UIKit
import UserNotifications

// MARK: APNs
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Auth.auth().setAPNSToken(deviceToken, type: .unknown)
}

func application(_ application: UIApplication,
                 didReceiveRemoteNotification notification: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler:
                    @escaping (UIBackgroundFetchResult) -> Void) {
    if Auth.auth().canHandleNotification(notification) {
        completionHandler(.noData)
        return
    }
    completionHandler(.newData)
}

// Em didFinishLaunchingWithOptions:
UIApplication.shared.registerForRemoteNotifications()
```

#### Passo APNs 4: Capabilities

Em **Signing & Capabilities** do target iosApp:
- Push Notifications ✅ (já documentado em Passo 3)
- Background Modes → **Remote notifications** ✅

#### Verificação

Após setup, fazer login + tentar `Auth.auth().settings.isAppVerificationDisabledForTesting = false` (default). Se SMS chega → APNs OK. Se erro `auth/missing-app-credentials` → APNs não configurado.

#### Modo Test

Pra desenvolvimento sem APNs:
```swift
#if DEBUG
Auth.auth().settings?.isAppVerificationDisabledForTesting = true
#endif
```

E adicionar números de teste em **Firebase Console → Authentication → Sign-in method → Phone → Phone numbers for testing**.

### Integração no app

Em `MainTabView` ou `ContentView`, adicionar gate de onboarding:

```swift
struct RootView: View {
    @State private var verified: Bool = false
    @State private var checking: Bool = true

    var body: some View {
        if checking {
            ProgressView().task { await checkVerified() }
        } else if !verified {
            VerificationFlowView(onCompleted: { verified = true })
        } else {
            MainTabView()
        }
    }

    private func checkVerified() async {
        guard let user = Auth.auth().currentUser else {
            verified = true  // sem auth = AuthView mostra; não bloqueia onboarding
            checking = false
            return
        }
        let token = try? await user.getIDTokenResult(forcingRefresh: false)
        verified = token?.claims["verified"] as? Bool == true
        checking = false
    }
}
```
