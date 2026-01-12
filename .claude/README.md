# Futeba dos Parças - README

> App Android para organização de peladas com gamificação, estatísticas e ranking.
>
> **Stack:** Kotlin 2.0 + Jetpack Compose (híbrido com XML) + Firebase + Hilt + KMP

---

## 1. SETUP RÁPIDO

### Pré-requisitos

- **JDK:** 17+
- **Android Studio:** Hedgehog (2023.1.1) ou superior
- **Gradle:** 8.13.2
- **Kotlin:** 2.0.21

### 1.1 Clonar e Configurar

```bash
# Clonar repositório
git clone <repo-url>
cd Futeba\ dos\ Parças

# Copiar local.properties.example
cp local.properties.example local.properties

# Adicionar ao local.properties:
MAPS_API_KEY=sua_chave_google_maps
STORE_FILE=caminho/keystore.jks
STORE_PASSWORD=sua_senha
KEY_ALIAS=seu_alias
KEY_PASSWORD=sua_senha
```

### 1.2 Configurar Firebase

1. Criar projeto em [Firebase Console](https://console.firebase.google.com/)
2. Adicionar app Android com package `com.futebadosparcas`
3. Baixar `google-services.json` e colocar em `app/`
4. Ativar serviços:
   - Authentication (Google + Email)
   - Firestore
   - Storage
   - Cloud Messaging (FCM)
   - Crashlytics
   - Performance Monitoring
   - Remote Config

### 1.3 Build e Run

```bash
# Build debug
./gradlew assembleDebug

# Instalar em dispositivo conectado
./gradlew installDebug

# Run no Android Studio: Botão Play ▶️
```

---

## 2. ESTRUTURA DO PROJETO

```
Futeba dos Parças/
├── app/                          # Módulo Android principal
│   ├── src/main/
│   │   ├── java/...futebadosparcas/
│   │   │   ├── ui/               # UI Layer (Fragments + Screens)
│   │   │   ├── data/             # Data Layer (Repositories, Room)
│   │   │   ├── di/               # Hilt Modules
│   │   │   └── util/             # Utilities
│   │   ├── res/                  # Resources (XML, strings, etc.)
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts          # Config Android
│
├── shared/                       # Kotlin Multiplatform
│   └── src/
│       ├── commonMain/           # Domain compartilhado
│       ├── androidMain/          # Implementações Android
│       └── iosMain/              # Implementações iOS (preparado)
│
├── functions/                    # Firebase Cloud Functions
│   └── src/index.ts
│
├── gradle/                       # Gradle wrapper
├── .claude/                      # Documentação e regras
├── build.gradle.kts              # Root build
└── gradle.properties             # Configurações globais
```

---

## 3. COMANDOS ÚTEIS

### Desenvolvimento

```bash
# Compilação rápida (verifica erros Kotlin)
./gradlew compileDebugKotlin

# Build debug
./gradlew assembleDebug

# Build release (minificado)
./gradlew assembleRelease

# Instalar debug
./gradlew installDebug

# Desinstalar
./gradlew uninstallDebug
```

### Testes

```bash
# Unit tests
./gradlew test

# Unit tests específicos
./gradlew testDebugUnitTest --tests com.futebadosparcas.ui.games.GamesViewModelTest

# Instrumented tests (precisa de emulador/dispositivo)
./gradlew connectedAndroidTest
```

### Qualidade

```bash
# Lint
./gradlew lint

# Lint específico
./gradlew :app:lintDebug

# Clean build
./gradlew clean

# Build com relatório
./gradlew assembleDebug --scan
```

### Firebase (opcional)

```bash
# Deploy Functions (Node.js necessário)
cd functions
npm install
firebase deploy --only functions
```

---

## 4. FLUXO DE DESENVOLVIMENTO

### 4.1 Criar Nova Feature

1. **Domain:**
   ```
   shared/src/commonMain/kotlin/com/futebadosparcas/domain/
   ├── model/FeatureModel.kt
   └── usecase/GetFeatureUseCase.kt
   ```

2. **Data:**
   ```
   app/src/main/java/com/futebadosparcas/data/
   └── repository/FeatureRepositoryImpl.kt
   ```

3. **DI:**
   ```kotlin
   // AppModule.kt
   @Provides
   @Singleton
   fun provideFeatureRepository(...): FeatureRepository {
       return FeatureRepositoryImpl(...)
   }
   ```

4. **UI:**
   ```
   app/src/main/java/com/futebadosparcas/ui/feature/
   ├── FeatureScreen.kt       # Composable
   ├── FeatureViewModel.kt    # ViewModel
   └── FeatureUiState.kt      # Sealed class
   ```

5. **Strings:**
   ```xml
   <!-- strings.xml -->
   <string name="feature_title">Título</string>
   ```

### 4.2 Navegação

Adicionar ao `nav_graph.xml`:
```xml
<fragment
    android:id="@+id/featureFragment"
    android:name="com.futebadosparcas.ui.feature.FeatureFragment"
    android:label="@string/feature_title">
    <argument
        android:name="featureId"
        app:argType="string" />
</fragment>
```

---

## 5. AMBIENTE

### Variáveis (local.properties)

```properties
# Maps (obrigatório)
MAPS_API_KEY=sua_chave

# Signing Release (opcional - só para gerar APK release)
STORE_FILE=caminho/keystore.jks
STORE_PASSWORD=sua_senha
KEY_ALIAS=seu_alias
KEY_PASSWORD=sua_senha
```

### Build Variants

| Variant | Descrição | Minificação |
|---------|-----------|-------------|
| `debug` | Desenvolvimento | Não |
| `release` | Produção | Sim (ProGuard) |

---

## 6. FIREBASE STRUCTURE

### Collections Firestore

| Collection | Descrição |
|------------|-----------|
| `users` | Perfis de usuários |
| `games` | Jogos agendados/realizados |
| `groups` | Grupos de pelada |
| `statistics` | Estatísticas de jogadores |
| `season_participation` | Ranking por temporada |
| `seasons` | Temporadas ativas/passadas |
| `xp_logs` | Histórico de XP |
| `user_badges` | Badges desbloqueadas |
| `locations` | Locais/quadras |
| `cashbox` | Caixa de grupos |

### Cloud Functions

- `onUserCreate` - Inicializa novo usuário
- `onGameFinished` - Processa XP, stats, rankings
- `recalculateLeagueRating` - Atualiza posições na liga
- `checkSeasonClosure` - Gerencia temporadas mensais

---

## 7. SOLUÇÃO DE PROBLEMAS

### Build falha com KSP

```bash
./gradlew clean
./gradlew compileDebugKotlin
```

### Erro de Firebase

Verificar se `google-services.json` existe em `app/`:
```bash
ls app/google-services.json
```

### Maps não funciona

Verificar `MAPS_API_KEY` em `local.properties`:
```bash
grep MAPS_API_KEY local.properties
```

### Testes falhando

```bash
# Limpar e rodar novamente
./gradlew clean test --info
```

---

## 8. VERSIONAMENTO

| Versão | Version Code | Data | Principais Mudanças |
|--------|--------------|------|---------------------|
| 1.4.2 | 15 | 2025-01 | KMP preparation, Compose migration |
| 1.4.0 | 13 | 2024-12 | Gamificação overhaul |
| 1.3.0 | 11 | 2024-11 | Badges system |
| 1.2.0 | 9 | 2024-10 | Live game tracking |
| 1.0.0 | 1 | 2024-09 | Release inicial |

---

## 9. RECURSOS

### Documentação Interna

- `.claude/PROJECT_MAP.md` - Mapa completo do projeto
- `.claude/RULES.md` - Regras de desenvolvimento
- `.claude/RULES_SHORT.md` - Regras resumidas
- `.claude/ARCHITECTURE.md` - Arquitetura detalhada
- `.claude/DEVELOPMENT_PLAYBOOK.md` - Como trabalhar

### Links Úteis

- [Jetpack Compose Docs](https://developer.android.com/jetpack/compose)
- [Firebase Docs](https://firebase.google.com/docs)
- [Kotlin Multiplatform](https://kotlinlang.org/docs/multiplatform.html)
- [Hilt Docs](https://dagger.dev/hilt/)

---

## 10. LICENÇA

Desenvolvido por Renan Locatiz Fernandes © 2024
