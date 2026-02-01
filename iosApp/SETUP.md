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
