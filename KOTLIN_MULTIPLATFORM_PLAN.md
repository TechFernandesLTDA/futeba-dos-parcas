# Kotlin Multiplatform (KMP) - Plano de Migracao

## Indice

1. [Visao Geral](#visao-geral)
2. [Arquitetura Proposta](#arquitetura-proposta)
3. [Estrutura de Modulos](#estrutura-de-modulos)
4. [Analise de Classes Compartilhaveis](#analise-de-classes-compartilhaveis)
5. [Dependencias Necessarias](#dependencias-necessarias)
6. [Roadmap de Migracao](#roadmap-de-migracao)
7. [Riscos e Mitigacoes](#riscos-e-mitigacoes)
8. [Proximos Passos](#proximos-passos)

---

## Visao Geral

Este documento descreve o plano de migracao do projeto **Futeba dos Parcas** para Kotlin Multiplatform (KMP), permitindo compartilhar codigo entre Android e iOS.

### Objetivos
- Reutilizar logica de negocios entre plataformas
- Manter consistencia de regras e calculos (XP, Rankings, Team Balancing)
- Reduzir tempo de desenvolvimento para iOS
- Preservar a arquitetura MVVM + Clean Architecture existente

### Estado Atual
- **Plataforma**: Android (Kotlin)
- **Arquitetura**: MVVM + Clean Architecture + Hilt
- **Backend**: Firebase (Firestore, Auth, Storage, Functions)
- **Local DB**: Room
- **UI**: ViewBinding (XML) + Compose (parcial)

---

## Arquitetura Proposta

```
futeba-dos-parcas/
+-- shared/                          # Modulo KMP compartilhado
|   +-- src/
|   |   +-- commonMain/              # Codigo compartilhado (Kotlin puro)
|   |   |   +-- kotlin/
|   |   |       +-- com/futebadosparcas/
|   |   |           +-- domain/       # Use Cases, Business Logic
|   |   |           +-- data/
|   |   |           |   +-- model/    # Data Classes (Platform-agnostic)
|   |   |           |   +-- repository/ # Interfaces de Repository
|   |   |           +-- util/         # Utilitarios compartilhados
|   |   |
|   |   +-- androidMain/             # Implementacoes Android-especificas
|   |   |   +-- kotlin/
|   |   |       +-- com/futebadosparcas/
|   |   |           +-- data/
|   |   |               +-- repository/ # Impl com Firebase/Room
|   |   |
|   |   +-- iosMain/                 # Implementacoes iOS-especificas
|   |       +-- kotlin/
|   |           +-- com/futebadosparcas/
|   |               +-- data/
|   |                   +-- repository/ # Impl com Firebase iOS SDK
|   |
|   +-- build.gradle.kts
|
+-- androidApp/                       # App Android (UI Layer)
|   +-- src/main/
|       +-- java/com/futebadosparcas/
|           +-- ui/                   # Fragments, Activities, Compose
|           +-- di/                   # Hilt Modules
|
+-- iosApp/                           # App iOS (SwiftUI)
|   +-- Sources/
|       +-- Views/
|       +-- ViewModels/
|
+-- build.gradle.kts                  # Root build file
+-- settings.gradle.kts
```

### Camadas e Responsabilidades

| Camada | Localizacao | Responsabilidade |
|--------|-------------|------------------|
| **UI** | `androidApp/`, `iosApp/` | Fragments, SwiftUI Views, platform UI |
| **ViewModel** | `androidApp/`, `iosApp/` | UI State, platform-specific lifecycle |
| **Domain** | `shared/commonMain/` | Use Cases, Business Rules, XP Calculator |
| **Data (Interface)** | `shared/commonMain/` | Repository Interfaces, Models |
| **Data (Impl)** | `shared/androidMain/`, `shared/iosMain/` | Firebase, SQLDelight |

---

## Estrutura de Modulos

### 1. `shared` Module (KMP)

```kotlin
// build.gradle.kts (shared)
plugins {
    kotlin("multiplatform")
    kotlin("native.cocoapods")
    id("com.android.library")
    id("app.cash.sqldelight")
    kotlin("plugin.serialization")
}

kotlin {
    androidTarget()

    iosX64()
    iosArm64()
    iosSimulatorArm64()

    cocoapods {
        summary = "Futeba dos Parcas Shared Module"
        homepage = "https://github.com/seu-usuario/futeba-dos-parcas"
        ios.deploymentTarget = "14.0"
        framework {
            baseName = "shared"
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                // Coroutines
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")

                // Serialization
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")

                // Ktor (Networking)
                implementation("io.ktor:ktor-client-core:2.3.5")
                implementation("io.ktor:ktor-client-content-negotiation:2.3.5")
                implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.5")

                // SQLDelight (Local DB)
                implementation("app.cash.sqldelight:runtime:2.0.0")
                implementation("app.cash.sqldelight:coroutines-extensions:2.0.0")

                // DateTime
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.4.1")
            }
        }

        val androidMain by getting {
            dependencies {
                implementation("io.ktor:ktor-client-android:2.3.5")
                implementation("app.cash.sqldelight:android-driver:2.0.0")
            }
        }

        val iosMain by creating {
            dependencies {
                implementation("io.ktor:ktor-client-darwin:2.3.5")
                implementation("app.cash.sqldelight:native-driver:2.0.0")
            }
        }
    }
}
```

### 2. `androidApp` Module

```kotlin
// build.gradle.kts (androidApp)
plugins {
    id("com.android.application")
    kotlin("android")
    id("com.google.dagger.hilt.android")
    // ... outros plugins existentes
}

dependencies {
    implementation(project(":shared"))

    // Firebase (permanece no Android)
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    // ...

    // UI (Android-specific)
    implementation("androidx.compose.material3:material3")
    // ...
}
```

### 3. `iosApp` Module

- Framework SwiftUI
- Consome o modulo `shared` via CocoaPods ou SPM
- Firebase iOS SDK para implementacoes nativas

---

## Analise de Classes Compartilhaveis

### Models (`data/model/`) - ALTA PRIORIDADE

| Arquivo | Migravel? | Observacoes |
|---------|-----------|-------------|
| `User.kt` | **PARCIAL** | Remover anotacoes Firebase (`@DocumentId`, `@PropertyName`). Criar versao KMP com `@Serializable` |
| `Game.kt` | **PARCIAL** | Remover anotacoes Firebase. Classes `Game`, `GameConfirmation`, `Team`, `PlayerStats` podem ser compartilhadas |
| `Group.kt` | **PARCIAL** | `Group`, `GroupMember`, `UserGroup` - remover anotacoes Firebase |
| `Gamification.kt` | **SIM** | `Season`, `SeasonParticipation`, `Badge`, `UserBadge`, `WeeklyChallenge` - enums sao totalmente compartilhaveis |
| `Statistics.kt` | **SIM** | Provavelmente data classes puras |
| `Ranking.kt` | **SIM** | Data classes para ranking |
| `Enums.kt` | **SIM** | Enums sao 100% compartilhaveis |
| `Payment.kt` | **PARCIAL** | Verificar dependencias |
| `Location.kt` | **PARCIAL** | Verificar dependencias de mapas |
| `LiveGame.kt` | **SIM** | Dados de jogo ao vivo |
| `Cashbox.kt` | **SIM** | Dados de caixa |
| `Schedule.kt` | **SIM** | Agendamentos |
| `Activity.kt` | **SIM** | Log de atividades |
| `LevelTable.kt` | **SIM** | Tabela de niveis XP |
| `GamificationSettings.kt` | **SIM** | Configuracoes de XP |
| `ThemeConfig.kt` | **NAO** | Especifico de plataforma |

### Repository Interfaces (`data/repository/`) - MEDIA PRIORIDADE

| Arquivo | Interface Migravel? | Observacoes |
|---------|---------------------|-------------|
| `GameRepository.kt` | **SIM** | Interface pode ser compartilhada. Impl permanece platform-specific |
| `UserRepository.kt` | **PARCIAL** | Depende de `android.net.Uri`. Criar interface sem Uri |
| `GroupRepository.kt` | **SIM** | Interface compartilhavel |
| `StatisticsRepository.kt` | **SIM** | Interface + `IStatisticsRepository.kt` |
| `RankingRepository.kt` | **SIM** | Interface compartilhavel |
| `GamificationRepository.kt` | **SIM** | Interface compartilhavel |
| `CashboxRepository.kt` | **SIM** | Interface compartilhavel |
| `ScheduleRepository.kt` | **SIM** | Interface compartilhavel |
| `LocationRepository.kt` | **PARCIAL** | Depende de Google Maps/Places |
| `AuthRepository.kt` | **PARCIAL** | Depende de Firebase Auth |
| `LiveGameRepository.kt` | **SIM** | Interface compartilhavel |
| `PaymentRepository.kt` | **SIM** | Interface compartilhavel |
| `ActivityRepository.kt` | **SIM** | Interface compartilhavel |
| `NotificationRepository.kt` | **NAO** | Depende de FCM (platform-specific) |
| `ThemeRepository.kt` | **NAO** | Especifico de plataforma |
| `SettingsRepository.kt` | **PARCIAL** | DataStore e platform-specific |

### Domain Layer (`domain/`) - ALTA PRIORIDADE

| Arquivo | Migravel? | Observacoes |
|---------|-----------|-------------|
| `XPCalculator.kt` | **SIM** | Logica pura, 100% compartilhavel |
| `TeamBalancer.kt` | **SIM** | Interface pura, compartilhavel |
| `MilestoneChecker.kt` | **SIM** | Logica pura |
| `BadgeAwarder.kt` | **PARCIAL** | Verificar dependencias de repository |
| `LeagueService.kt` | **PARCIAL** | Verificar dependencias |
| `SeasonClosureService.kt` | **PARCIAL** | Verificar dependencias |
| `MatchFinalizationService.kt` | **PARCIAL** | Depende de repositorios |
| `PostGameEventEmitter.kt` | **SIM** | Logica pura |
| `SeasonGuardian.kt` | **PARCIAL** | Verificar dependencias |

### Use Cases (`domain/usecase/`) - ALTA PRIORIDADE

| Diretorio | Migravel? | Observacoes |
|-----------|-----------|-------------|
| `usecase/group/*.kt` | **SIM** | Use cases sao ideais para compartilhar. Dependem apenas de interfaces |

---

## Dependencias Necessarias

### Substituicoes de Bibliotecas

| Android Atual | KMP Equivalente | Notas |
|---------------|-----------------|-------|
| Room | **SQLDelight** | Sintaxe SQL pura, code generation |
| Retrofit/OkHttp | **Ktor Client** | HTTP client multiplatform |
| Gson | **Kotlinx Serialization** | JSON nativo Kotlin |
| java.util.Date | **kotlinx-datetime** | API de data/hora multiplataforma |
| Hilt (DI) | **Koin** ou **Kodein** | DI multiplatform (Android pode manter Hilt na UI) |
| Firebase SDK | **Firebase KMP** (experimental) ou wrappers | Implementacoes separadas por plataforma |
| Coroutines | **kotlinx-coroutines** | Ja e multiplatform |

### Versoes Recomendadas (2024/2025)

```kotlin
// versions.gradle.kts ou libs.versions.toml
kotlin = "2.0.0"
kotlinxCoroutines = "1.7.3"
kotlinxSerialization = "1.6.0"
kotlinxDatetime = "0.4.1"
ktor = "2.3.5"
sqldelight = "2.0.0"
koin = "3.5.0"
```

---

## Roadmap de Migracao

### Fase 0: Preparacao (1-2 semanas)
- [ ] Auditar todas as dependencias Android-especificas
- [ ] Identificar codigo com anotacoes Firebase (`@DocumentId`, `@PropertyName`)
- [ ] Criar issue tracking para migracao
- [ ] Configurar ambiente de desenvolvimento iOS (Xcode, CocoaPods)

### Fase 1: Configuracao do Projeto KMP (1 semana)
- [ ] Criar estrutura de modulos (`shared`, `androidApp`, `iosApp`)
- [ ] Configurar `build.gradle.kts` com Kotlin Multiplatform
- [ ] Configurar CocoaPods para iOS
- [ ] Verificar build inicial em ambas plataformas

### Fase 2: Migracao de Models (2-3 semanas)
- [ ] Criar versoes KMP dos models (sem anotacoes Firebase)
- [ ] Adicionar `@Serializable` (kotlinx.serialization)
- [ ] Substituir `java.util.Date` por `kotlinx-datetime`
- [ ] Criar mapeadores `FirebaseModel <-> KmpModel` no `androidMain`
- [ ] Migrar enums (100% compartilhaveis)

**Ordem de migracao:**
1. `Enums.kt` - Base para outros models
2. `LevelTable.kt`, `GamificationSettings.kt` - Configuracoes
3. `User.kt`, `Game.kt`, `Group.kt` - Core models
4. `Gamification.kt` - Sistema de XP/Badges
5. Demais models

### Fase 3: Migracao de Domain Layer (2-3 semanas)
- [ ] Migrar `XPCalculator` (logica pura)
- [ ] Migrar `TeamBalancer` interface
- [ ] Migrar `MilestoneChecker`
- [ ] Migrar Use Cases de Group
- [ ] Migrar demais services

### Fase 4: Interfaces de Repository (1-2 semanas)
- [ ] Criar interfaces compartilhadas em `commonMain`
- [ ] Manter implementacoes Firebase em `androidMain`
- [ ] Preparar estrutura para `iosMain`

### Fase 5: SQLDelight (Local Cache) (2 semanas)
- [ ] Definir schema SQLDelight (`.sq` files)
- [ ] Migrar entidades Room para SQLDelight
- [ ] Implementar drivers para Android e iOS
- [ ] Testar sincronizacao com Firebase

### Fase 6: App iOS Inicial (4-6 semanas)
- [ ] Criar projeto SwiftUI basico
- [ ] Integrar modulo `shared` via CocoaPods
- [ ] Implementar autenticacao Firebase iOS
- [ ] Implementar repositorios iOS (`iosMain`)
- [ ] Criar telas principais (Login, Home, Games)

### Fase 7: Paridade de Features (Ongoing)
- [ ] Sincronizar features Android com iOS
- [ ] Testes de integracao cross-platform
- [ ] CI/CD para ambas plataformas

---

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Firebase KMP imaturo | Alta | Alto | Usar SDKs nativos com wrappers em `expect/actual` |
| Curva de aprendizado Swift/iOS | Media | Medio | Treinamento, pair programming com dev iOS |
| Performance iOS | Baixa | Medio | Profiling, otimizacao de interop |
| Breaking changes KMP | Media | Medio | Fixar versoes, updates controlados |
| Complexidade de build | Alta | Baixo | Documentacao, scripts de automacao |

---

## Proximos Passos

1. **Revisar este documento** com a equipe
2. **Priorizar features** que mais se beneficiam de compartilhamento
3. **Criar branch** `feature/kmp-migration`
4. **Iniciar Fase 0** (preparacao e auditoria)
5. **POC inicial** com `XPCalculator` (logica pura, facil de testar)

---

## Referencias

- [Kotlin Multiplatform Documentation](https://kotlinlang.org/docs/multiplatform.html)
- [SQLDelight Documentation](https://cashapp.github.io/sqldelight/)
- [Ktor Client Documentation](https://ktor.io/docs/client.html)
- [Firebase KMP (Experimental)](https://github.com/nickalvarezdev/firebase-kotlin-sdk)
- [Compose Multiplatform](https://www.jetbrains.com/lp/compose-multiplatform/) (futuro para UI compartilhada)

---

*Documento criado em: Janeiro 2026*
*Versao: 1.0*
*Autor: Claude AI Assistant*
