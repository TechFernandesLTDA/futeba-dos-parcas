# Setup iOS - Futeba dos Parças

## Pré-requisitos

- **Mac** com macOS 13+ (Ventura ou superior)
- **Xcode** 15+ instalado
- **CocoaPods** instalado
- **Homebrew** (opcional, para ferramentas)

## Instalação de Ferramentas

### 1. Instalar CocoaPods

```bash
sudo gem install cocoapods
pod setup
```

### 2. Verificar Instalação

```bash
pod --version  # Deve mostrar 1.12+ ou superior
xcodebuild -version  # Deve mostrar Xcode 15+
```

## Criação do Projeto iOS

### 1. Criar Projeto no Xcode

1. Abrir Xcode
2. File → New → Project
3. Selecionar **iOS** → **App**
4. Configurar:
   - **Product Name**: FutebaDosParças
   - **Team**: Sua conta Apple Developer
   - **Organization Identifier**: com.futebadosparcas
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Desmarcar**: Core Data, Tests
5. Salvar em: `C:\Projetos\Futeba dos Parças\iosApp`

### 2. Configurar shared Module via CocoaPods

Criar arquivo `Podfile` na raiz de `iosApp/`:

```ruby
platform :ios, '14.0'
use_frameworks!

target 'FutebaDosParças' do
    # Shared KMP module
    pod 'shared', :path => '../shared'

    # Firebase iOS SDK
    pod 'FirebaseAuth'
    pod 'FirebaseFirestore'
    pod 'FirebaseStorage'
    pod 'FirebaseMessaging'
    pod 'FirebaseAnalytics'
    pod 'FirebaseCrashlytics'
end
```

### 3. Instalar Dependências

```bash
cd iosApp
pod install
```

### 4. Abrir Workspace (NÃO o .xcodeproj)

```bash
open FutebaDosParças.xcworkspace
```

## Configuração do Firebase iOS

### 1. Criar App iOS no Firebase Console

1. Acessar [Firebase Console](https://console.firebase.google.com)
2. Selecionar projeto "Futeba dos Parças"
3. Adicionar App iOS
4. Bundle ID: `com.futebadosparcas.FutebaDosParças`
5. Download `GoogleService-Info.plist`

### 2. Adicionar GoogleService-Info.plist ao Projeto

1. Arrastar `GoogleService-Info.plist` para Xcode
2. **Importante**: Marcar "Copy items if needed"
3. Adicionar ao target `FutebaDosParças`

### 3. Inicializar Firebase no App

Editar `FutebaDosParçasApp.swift`:

```swift
import SwiftUI
import FirebaseCore
import shared  // KMP shared module

@main
struct FutebaDosParçasApp: App {

    init() {
        // Inicializar Firebase
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## Usando o Shared Module

### Exemplo: Buscar Usuário Atual

```swift
import shared

class UserViewModel: ObservableObject {
    @Published var user: User?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let userRepository: UserRepository

    init() {
        // Criar instâncias dos serviços de plataforma
        let firebaseDataSource = FirebaseDataSource()  // iOS implementation
        let databaseFactory = DatabaseDriverFactory()
        let database = DatabaseFactory(driverFactory: databaseFactory).createDatabase()
        let preferencesService = PreferencesService()

        // Criar repositório compartilhado
        self.userRepository = UserRepositoryImpl(
            firebaseDataSource: firebaseDataSource,
            database: database,
            preferencesService: preferencesService
        )
    }

    func loadCurrentUser() {
        isLoading = true

        Task {
            do {
                let result = try await userRepository.getCurrentUser()

                DispatchQueue.main.async {
                    switch result {
                    case let success as ResultSuccess<User>:
                        self.user = success.value
                        self.errorMessage = nil
                    case let failure as ResultFailure<User>:
                        self.errorMessage = failure.throwable.message
                    default:
                        break
                    }
                    self.isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}
```

## Primeiro Build

### 1. Compilar Shared Framework

```bash
cd shared
./gradlew linkDebugFrameworkIosSimulatorArm64  # Para M1/M2 Mac
# OU
./gradlew linkDebugFrameworkIosX64  # Para Intel Mac
```

### 2. Build no Xcode

1. Selecionar simulador (iPhone 14 Pro ou superior)
2. Product → Build (⌘B)
3. Product → Run (⌘R)

## Troubleshooting

### Erro: "Module 'shared' not found"

**Solução**:
```bash
cd iosApp
pod deintegrate
pod install
# Limpar build do Xcode: Product → Clean Build Folder (⌘⇧K)
```

### Erro: "Firebase/Auth module not found"

**Solução**:
```bash
cd iosApp
pod update
```

### Erro: "No such module 'FirebaseCore'"

**Solução**:
1. Verificar que está abrindo `.xcworkspace` e NÃO `.xcodeproj`
2. Limpar Derived Data: Xcode → Preferences → Locations → Derived Data → Delete

### Gradle build falha

**Solução**:
```bash
cd shared
./gradlew clean
./gradlew build
```

## Próximos Passos

1. **Implementar TODOs no iosMain**:
   - FirebaseDataSource: Substituir TODOs com Firebase iOS SDK
   - PreferencesService: Implementar com NSUserDefaults
   - PlatformLogger: Melhorar com NSLog

2. **Criar UI SwiftUI**:
   - Tela de Login
   - Tela de Home
   - Lista de Jogos
   - Perfil de Usuário

3. **Testar Funcionalidades**:
   - Autenticação
   - CRUD de Jogos
   - Cache SQLDelight
   - Sincronização Firebase

## Recursos Úteis

- [Kotlin Multiplatform Docs](https://kotlinlang.org/docs/multiplatform.html)
- [Firebase iOS SDK](https://firebase.google.com/docs/ios/setup)
- [SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui)
- [CocoaPods Guides](https://guides.cocoapods.org/)

---

**Desenvolvido com ❤️ por Futeba dos Parças Team**
