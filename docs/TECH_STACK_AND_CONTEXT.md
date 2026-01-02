# 🛠 Tech Stack & Context Dictionary - Futeba dos Parças

## Índice
- [Visão Geral do Projeto](#visão-geral-do-projeto)
- [Stack de Tecnologias](#stack-de-tecnologias)
- [Justificativas Tecnológicas](#justificativas-tecnológicas)
- [Versões e Compatibilidade](#versões-e-compatibilidade)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Arquitetura 3 Camadas](#arquitetura-3-camadas)
- [Guia de Navegação para LLMs](#guia-de-navegação-para-llms)
- [Decision Records](#decision-records)
- [Caminho de Atualização](#caminho-de-atualização)

---

## Visão Geral do Projeto

**Futeba dos Parças** é uma plataforma mobile integrada (Android) para gerenciar jogos de futsal/pelada com foco em:

```
┌─────────────────────────────────────────┐
│  FUTEBA DOS PARÇAS PLATFORM             │
├─────────────────────────────────────────┤
│                                         │
│  Frontend: Android (Kotlin)             │
│  Backend: Node.js/Express/TypeORM       │
│  Database: PostgreSQL + Firestore       │
│  Cloud: Google Firebase + Cloud Run     │
│                                         │
│  Gamification: XP, Badges, Seasons      │
│  Community: Groups, Social Features     │
│  Real-time: Firestore Listeners         │
│  Notifications: FCM (Firebase Cloud     │
│                     Messaging)          │
│                                         │
└─────────────────────────────────────────┘
```

**Usuários Primários:** Jogadores de futsal amador (Brasil, São Paulo area)
**Linguagem Principal:** Português (PT-BR)
**Market:** Google Play Store (futuro)

---

## Stack de Tecnologias

### 1. Frontend (Android)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Linguagem** | Kotlin | 2.0.x | Type-safe, null-safe language |
| **Min SDK** | Android | 24 (7.0) | Support older devices |
| **Target SDK** | Android | 35 (15.0) | Latest OS features + security |
| **Compilação** | Gradle** | 8.7+ | Build system |
| **JDK** | OpenJDK | 17+ | Gradle requirement |

### 2. UI Layer (Android)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Layouts Modernos** | Jetpack Compose | 2024.09.00 | Declarative UI (novos screens) |
| **Layouts Legados** | XML + ConstraintLayout | AndroidX 1.x | Compatibilidade com código antigo |
| **Design System** | Material Design 3 | Included in Compose | UI consistency |
| **Navigation** | Jetpack Navigation | 2.x.x | Fragment-based routing |
| **RecyclerView** | AndroidX RecyclerView | 1.x.x | List performance |

### 3. Architecture & State (Android)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Pattern** | MVVM + Clean | - | Separation of concerns |
| **State Mgmt** | Jetpack Compose State + Flow | 1.x.x | Reactive state management |
| **Coroutines** | Kotlin Coroutines | 1.8+ | Async/await, non-blocking |
| **Reactive** | Flow + StateFlow | Built-in | Stream-based data flow |
| **ViewModel** | Jetpack ViewModel | 2.x.x | Lifecycle-aware state holder |
| **Lifecycle** | Jetpack Lifecycle | 2.x.x | Lifecycle-aware components |

### 4. Dependency Injection (Android)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **DI Framework** | Hilt (Dagger) | 2.51.1 | Compile-time safe injection |
| **Hilt Plugins** | Gradle Plugin | 2.51.1 | Annotation processing |

### 5. Data Layer (Android)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Local DB** | Room | 2.6.1+ | Offline-first SQLite |
| **ORM** | Room DAO | 2.6.1+ | Object-relational mapping |
| **Cloud DB** | Firebase Firestore | Firebase BOM 33.7.0 | Real-time NoSQL sync |
| **Auth** | Firebase Auth | Firebase BOM 33.7.0 | User authentication |
| **Storage** | Firebase Storage | Firebase BOM 33.7.0 | Image/file uploads |
| **Messaging** | Firebase Cloud Messaging | Firebase BOM 33.7.0 | Push notifications |
| **Monitoring** | Firebase Crashlytics | Firebase BOM 33.7.0 | Error tracking |

### 6. Networking (Android)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **HTTP Client** | Retrofit 2 | 2.9.0+ | REST API calls |
| **Serialization** | Gson/Kotlinx | Latest | JSON ↔ Kotlin objects |
| **Image Loading** | Coil | 2.7.0 | Efficient image management |

### 7. Backend (Node.js/Express)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Runtime** | Node.js | 20 LTS | JavaScript runtime |
| **Framework** | Express.js | 4.18.x | HTTP server + routing |
| **Language** | TypeScript | 5.x | Type-safe JavaScript |
| **Package Mgr** | npm | 10.x+ | Dependency management |
| **Transpiler** | TypeScript Compiler | 5.x | TS → JS compilation |

### 8. Backend Architecture

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Pattern** | MVC + Service Layer | - | Clean architecture |
| **ORM** | TypeORM | 0.3.x | Database abstraction |
| **Validation** | Class-validator | 0.14.x | DTO validation |
| **DTOs** | class-transformer | 0.5.x | Serialization |
| **Logging** | Winston | 3.x | Structured logging |
| **Error Handling** | Custom middleware | - | Consistent error responses |

### 9. Database (Backend & Cloud)

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **SQL DB** | PostgreSQL | 15+ | Relational data |
| **Connection Pool** | node-postgres | 8.x | Efficient connections |
| **NoSQL DB** | Firebase Firestore | Firebase BOM | Real-time NoSQL cloud |
| **Admin SDK** | Firebase Admin SDK | 12.x+ | Backend Firestore access |

### 10. Cloud Functions

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Runtime** | Node.js Functions | 20 | Serverless functions |
| **Framework** | Firebase Functions | 7.x+ | Function wrappers |
| **Triggers** | Firestore triggers | - | On document write |
| **Scheduling** | Pub/Sub Schedule | - | Cron-like scheduling |
| **Admin** | Firebase Admin SDK | 12.x+ | Full Firestore access |

### 11. DevOps & Deployment

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Backend Hosting** | Google Cloud Run | - | Container deployment |
| **Cloud Functions** | Google Cloud Functions | - | Serverless deployment |
| **CI/CD** | GitHub Actions | - | Automated testing/deploy |
| **Version Control** | Git | Latest | Source code management |

### 12. Testing & Quality

| Componente | Tecnologia | Versão | Propósito |
|------------|------------|--------|----------|
| **Unit Tests** | JUnit 4/5 | 4.13.x | Android unit testing |
| **Mocking** | Mockito | 5.x | Test doubles |
| **Integration** | Firebase Emulator Suite | - | Local testing |
| **Lint** | Android Lint | Built-in | Code quality checks |
| **Code Coverage** | JaCoCo | 0.8.x | Coverage reporting |

---

## Justificativas Tecnológicas

### Por que Kotlin?

```
✅ ESCOLHIDO: Kotlin
❌ Alternativas: Java, Flutter, React Native

Razões:
  1. Official Android language (Google 2019)
  2. 100% Java interop (gradual migration possible)
  3. Null safety (eliminates NPE)
  4. Extension functions (cleaner code)
  5. Coroutines (superior async vs RxJava)
  6. Data classes (reduce boilerplate)
  7. Android community already migrated

Não Java porque:
  - Verbose (getters/setters)
  - No null safety
  - Deprecated by Google for Android

Não Flutter/React Native porque:
  - Team expertise in Kotlin
  - Direct Android APIs access
  - Better Firestore integration
  - Better Google Play integration
```

### Por que Clean Architecture + MVVM?

```
✅ ESCOLHIDO: Clean Architecture (3 layers) + MVVM
❌ Alternativas: MVC, MVP, Redux, BLoC

Razões:
  1. Clear separation of concerns
  2. Testable business logic (Domain layer independent)
  3. Easy to swap Data layer (Room ↔ Firestore)
  4. Supports Team growth (clear conventions)
  5. Industry standard (Google samples use it)
  6. MVVM pairs well with LiveData/StateFlow

Estrutura (3 camadas):

  Presentation Layer
    ├─ Fragments (UI containers)
    ├─ ViewModels (state + logic)
    ├─ Adapters (list binding)
    └─ Compose screens (new features)
          ↓ (observa via Flow/StateFlow)
  Domain Layer
    ├─ UseCases (business logic)
    ├─ Entities (domain models)
    └─ Repository Interfaces
          ↓ (usa)
  Data Layer
    ├─ Repository Implementations
    ├─ DataSources (Room, Firestore)
    ├─ DAOs (database access)
    └─ Mappers (model conversion)
```

### Por que Firebase?

```
✅ ESCOLHIDO: Firebase (Firestore + Auth + Functions + Messaging)
❌ Alternativas: Custom backend + PostgreSQL

Razões:
  1. Real-time sync (LiveListeners)
  2. Zero infrastructure management
  3. Automatic scaling
  4. Built-in auth (OAuth, Phone, etc)
  5. Push notifications (FCM)
  6. Cloud Functions (serverless processing)
  7. Firebase Console UI
  8. Good pricing for MVP

Trade-offs:
  ✓ Vendor lock-in (Firebase)
  ✗ Complex queries (NoSQL limitations)
  ✗ Cost scaling (pay-per-read/write)

Mitigação: Backend API com PostgreSQL como fonte de verdade
  (Firestore = cache real-time, PostgreSQL = analytics + backup)
```

### Por que Node.js/Express para Backend?

```
✅ ESCOLHIDO: Node.js + Express + TypeScript + TypeORM
❌ Alternativas: Python/FastAPI, Java/Spring, Go

Razões:
  1. Full-stack JS (Kotlin/Android familiar to TS)
  2. Rapid development (npm ecosystem)
  3. TypeScript (type safety)
  4. ORM abstraction (PostgreSQL, MySQL compatible)
  5. Good Firebase integration
  6. Cloud Run deployment (containers)
  7. Cost-effective (lightweight)

TypeORM escolhido porque:
  - Type-safe queries
  - Decorators (@Entity, @Column)
  - Migrations support
  - Query builder API
  - Supports PostgreSQL, MySQL, SQLite
```

### Por que PostgreSQL?

```
✅ ESCOLHIDO: PostgreSQL 15+
❌ Alternativas: MySQL, SQLite, MongoDB

Razões:
  1. Advanced features (JSONB, Arrays, etc)
  2. Strong ACID guarantees
  3. Excellent for structured data
  4. Free and open-source
  5. Cloud providers support it
  6. Good for analytics queries

Firestore vs PostgreSQL:

  Firebase Firestore:
    ✓ Real-time updates
    ✓ Offline-first
    ✓ Automatic scaling
    ✗ Limited queries
    ✗ Eventual consistency

  PostgreSQL:
    ✓ Complex queries
    ✓ Strong consistency
    ✓ Analytics ready
    ✗ Manual scaling
    ✗ No real-time out-of-box

  Estratégia Híbrida:
    - Firestore = Real-time cache (app reads)
    - PostgreSQL = Source of truth (backend writes)
    - Cloud Functions = Sync between both
```

### Por que Cloud Functions?

```
✅ ESCOLHIDO: Firebase Cloud Functions (Node.js 20)
❌ Alternativas: Backend API, Cloud Run

Razões:
  1. Trigger automático em Firestore events
  2. Sem infraestrutura (serverless)
  3. Ideal para processamento síncrono
  4. Built-in Firebase integração
  5. XP cálculos pós-jogo (onGameComplete)
  6. Badges automation (onBadgeUnlock)
  7. Scheduling support (onSeasonEnd)

Quando usar:
  ✓ onGameComplete → Calcular XP
  ✓ onBadgeUnlock → Enviar notificação
  ✓ onSeasonEnd → Reset rankings
  ✓ Real-time triggers em Firestore

Quando NÃO usar:
  ✗ Long-running tasks (max 540s)
  ✗ Heavy CPU (512MB default)
  ✗ Complex business logic (melhor em Backend API)
```

---

## Versões e Compatibilidade

### Android SDK Versioning

```
Compilação: SDK 35 (Android 15)
Target: SDK 35
Mínimo: SDK 24 (Android 7.0)
JDK: 17+

Por quê SDK 24 como mínimo?
  - Cobre 99%+ dos dispositivos em uso
  - Kotlin padrão suporta desde SDK 14
  - Room, Coroutines funcionam bem
  - Material Design 3 + SDK 24 = compatível
```

### Dependency Versioning

**Core AndroidX:**
```
androidx.compose:compose-bom:2024.09.00  (latest stable Compose)
androidx.room:room-runtime:2.6.1+         (Kotlin code generation)
androidx.lifecycle:lifecycle-runtime:2.x  (ViewModel, LiveData)
com.google.dagger:hilt-android:2.51.1    (compile-time DI)
```

**Firebase BOM (Bill of Materials):**
```
firebase-bom:33.7.0  (controls all Firebase libs)
  ├─ firebase-auth
  ├─ firebase-firestore
  ├─ firebase-storage
  ├─ firebase-messaging (FCM)
  ├─ firebase-crashlytics
  └─ firebase-functions (admin SDK)
```

**Networking:**
```
com.squareup.retrofit2:retrofit:2.9.0     (HTTP client)
io.coil-kt:coil:2.7.0                     (image loading)
```

**Backend (Node.js):**
```
typescript: ^5.3.x                         (TypeScript)
express: ^4.18.x                          (web server)
typeorm: ^0.3.x                           (ORM)
firebase-admin: ^12.x                     (Firebase admin)
firebase-functions: ^7.x                  (Cloud Functions)
```

### Compatibility Matrix

| Componente | Min Version | Recomendado | Max Version | Status |
|-----------|---|---|---|---|
| Kotlin | 1.9.x | 2.0.x | Latest | ✅ Active |
| Gradle | 8.0.x | 8.7.x | Latest | ✅ Active |
| JDK | 17 | 21 | Latest | ✅ Active |
| Android SDK | 24 | 35 | Current | ✅ Current |
| Firebase | 33.0.x | 33.7.x | 34+ (beta) | ✅ Stable |
| Node.js | 18 | 20 LTS | 22 | ✅ LTS Active |
| PostgreSQL | 12 | 15+ | Latest | ✅ Active |
| TypeScript | 5.0.x | 5.3.x | Latest | ✅ Active |

---

## Estrutura do Projeto

### Estrutura de Diretórios

```
futeba-dos-parcas/
│
├── app/                            # Android App (Kotlin)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/futebadosparcas/
│   │   │   │   ├── data/           # Data layer
│   │   │   │   ├── domain/         # Domain layer
│   │   │   │   ├── ui/             # Presentation layer
│   │   │   │   ├── di/             # Dependency injection
│   │   │   │   └── util/           # Utilities
│   │   │   ├── res/                # Resources (layouts, strings, etc)
│   │   │   └── AndroidManifest.xml # Permissions, activities
│   │   ├── test/                   # Unit tests (JVM)
│   │   └── androidTest/            # Instrumented tests
│   ├── build.gradle.kts            # App build config
│   ├── README.md                   # App documentation
│   ├── ARCHITECTURE.md             # Architecture deep-dive
│   ├── MODULES.md                  # Feature modules guide
│   └── MODULES.md                  # Feature modules guide
│
├── backend/                        # Node.js/Express API
│   ├── src/
│   │   ├── controllers/            # HTTP request handlers
│   │   ├── services/               # Business logic
│   │   ├── repositories/           # Data access (TypeORM)
│   │   ├── dto/                    # Data transfer objects
│   │   ├── middleware/             # Express middleware
│   │   ├── entity/                 # TypeORM entities
│   │   ├── config/                 # Configuration
│   │   └── index.ts                # App entry point
│   ├── test/                       # Backend tests
│   ├── package.json                # Dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── docker-compose.yml          # Local dev services
│   ├── README.md                   # Backend setup
│   ├── ARCHITECTURE.md             # Backend architecture
│   ├── SERVICES.md                 # Service layer docs
│   └── CONTROLLERS.md              # Controller docs
│
├── functions/                      # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts                # All cloud functions
│   ├── test/                       # Function tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md                   # Setup & deploy
│   └── FUNCTIONS.md                # Detailed function docs
│
├── scripts/                        # Utility scripts
│   ├── seed_database.js            # Load test data
│   ├── migrate_firestore.js        # Migration utilities
│   ├── backup_data.js              # Data backup
│   └── README.md                   # Scripts documentation
│
├── docs/                           # Project documentation
│   ├── README.md                   # Main entry point
│   ├── SETUP_GUIDE.md              # Installation guide
│   ├── ARCHITECTURE.md             # Overall architecture
│   ├── API_REFERENCE.md            # REST API docs
│   ├── DATABASE_SCHEMA.md          # Database structure
│   ├── DEVELOPMENT_GUIDE.md        # Coding standards
│   ├── BUSINESS_RULES.md           # Business logic
│   └── TECH_STACK_AND_CONTEXT.md   # This file
│
├── firebase.json                   # Firebase config
├── firestore.rules                 # Firestore security rules
├── storage.rules                   # Storage security rules
├── .gitignore
├── .github/
│   └── workflows/                  # GitHub Actions CI/CD
└── README.md                       # Project overview
```

---

## Arquitetura 3 Camadas

### Visão Geral Integrada

```
┌─────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (Android)                  │
│                                                                  │
│  Fragments (UI)  →  ViewModels (State)  →  Compose Screens     │
│       ↓                     ↓                     ↓               │
│  Observam         Emitem                  Renderizam            │
│  estado           StateFlow<UiState>      baseado em state      │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ (chama UseCase)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER (Business Logic)                │
│                                                                  │
│  UseCases              Entities           Repository APIs       │
│  ├─ ConfirmPresence    ├─ Game            ├─ GameRepository     │
│  ├─ GenerateTeams      ├─ User            ├─ UserRepository     │
│  ├─ FinalizeGame       ├─ Badge           └─ StatsRepository    │
│  └─ CalculateStats     └─ Season                                │
│                                                                  │
│  (Pure business logic - NO frameworks, NO Android, NO Firebase) │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ (implementa Repository)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER (Access to Data)                 │
│                                                                  │
│  ┌─ GameRepositoryImpl ──────┐                                   │
│  │                           │                                   │
│  ├─→ Room (Local DB)         ├─→ Cache offline                  │
│  │   └─ GameEntity           │   └─ Fallback de dados           │
│  │                           │                                   │
│  ├─→ Firestore (Cloud DB)    ├─→ Real-time sync                │
│  │   └─ games collection      │   └─ Source of data             │
│  │                           │                                   │
│  └─ Mappers (Convert) ───────┘                                   │
│      GameEntity ↔ Game                                           │
│                                                                  │
│  Similar structure for User, Stats, Badge repositories         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Exemplo

```
User clicks "Confirm Presence"
    ↓
Fragment.onConfirmClick()
    ↓
ViewModel.confirmPresence(gameId)
    ↓
viewModelScope.launch { CoroutineContext }
    ↓
UseCase.confirmPresence(gameId)  (domain/usecase/)
    ↓
Repository.confirmPresence(gameId)  (data/repository/)
    ├─→ Room.insert(local cache)
    └─→ Firestore.update(cloud sync)
    ↓
Firestore listener notifica
    ↓
Repository emite novo estado via Flow
    ↓
ViewModel.uiState.collect()
    ↓
Fragment observa mudança
    ↓
UI renderiza "Confirmado! 11/12"
```

---

## Guia de Navegação para LLMs

### Encontrar Código Específico

**XP Calculations:**
- `functions/src/index.ts:calculateXP()` - Implementação do cálculo
- `functions/FUNCTIONS.md:Cálculo de XP` - Documentação
- `docs/BUSINESS_RULES.md:XP e Pontos` - Lógica de negócio

**Badge System:**
- `functions/src/index.ts:checkBadges()` - Lógica de unlock
- `functions/FUNCTIONS.md:Verificação de Badges` - Documentação
- `app/MODULES.md:Badges Module` - UI da app

**Game Lifecycle:**
- `backend/CONTROLLERS.md:GameController` - REST endpoints
- `docs/BUSINESS_RULES.md:Ciclo de Vida do Jogo` - Estados
- `app/MODULES.md:Games Module` - UI do jogo

**Real-time Sync:**
- `app/data/repository/GameRepositoryImpl.kt` - Room + Firestore
- `app/ARCHITECTURE.md:Data Flow` - Arquitetura
- `docs/ARCHITECTURE.md` - Padrões

**Push Notifications:**
- `app/service/FcmService.kt` - FCM receiver
- `functions/src/index.ts:onBadgeUnlock` - Dispara notificação
- `backend/SERVICES.md:NotificationService` - Backend notifications

**Authentication:**
- `app/di/FirebaseModule.kt` - Firebase setup
- `backend/CONTROLLERS.md:AuthController` - Auth endpoints
- `app/data/repository/AuthRepositoryImpl.kt` - Auth logic

### Encontrar Documentação

```
📋 OVERVIEW
├─ docs/README.md                  # Start here
├─ docs/SETUP_GUIDE.md            # Installation
└─ docs/ARCHITECTURE.md           # High-level design

📱 ANDROID
├─ app/README.md                  # Android overview
├─ app/ARCHITECTURE.md            # MVVM + Clean
├─ app/MODULES.md                 # All features
└─ Código em: app/src/main/java/

🔙 BACKEND
├─ backend/README.md              # Backend overview
├─ backend/ARCHITECTURE.md        # MVC + Services
├─ backend/SERVICES.md            # Business logic
├─ backend/CONTROLLERS.md         # REST APIs
└─ Código em: backend/src/

☁️ CLOUD FUNCTIONS
├─ functions/README.md            # Setup + deploy
├─ functions/FUNCTIONS.md         # All functions
└─ Código em: functions/src/

📊 BUSINESS
├─ docs/BUSINESS_RULES.md         # XP, badges, rules
├─ docs/DATABASE_SCHEMA.md        # Tables + relationships
└─ docs/API_REFERENCE.md          # All 40+ endpoints

💻 DEVELOPMENT
├─ docs/DEVELOPMENT_GUIDE.md      # Standards + patterns
├─ docs/TECH_STACK_AND_CONTEXT.md # This file
└─ scripts/README.md              # Utility scripts
```

### Procurar por Funcionalidade

| Funcionalidade | Arquivos | Tipo |
|---|---|---|
| Criar jogo | backend/controllers/GameController, app/ui/games/CreateGameFragment | REST + UI |
| Confirmar presença | domain/usecase/ConfirmPresenceUseCase, app/ViewModel | Business |
| Gerar times (AI) | backend/service/TeamBalancerService, domain/ai/ | Algorithm |
| Calcular XP | functions/src/index.ts:calculateXP | Cloud |
| Desbloquear badges | functions/src/index.ts:checkBadges | Cloud |
| Rankings | backend/service/StatisticsService, domain/ranking/ | Business |
| Notificações | app/service/FcmService, functions/onBadgeUnlock | Cloud + Mobile |
| Autenticação | app/di/FirebaseModule, backend/controller/AuthController | Auth |
| Mapa de locais | app/ui/locations/LocationsFragment, GoogleMap | UI |

---

## Decision Records

### ADR-001: Usar Firestore + PostgreSQL Híbrido

**Status:** ✅ ACCEPTED

**Problema:** Firestore sozinho é limitado para queries analíticas. PostgreSQL sozinho perde real-time.

**Decisão:** Dois bancos de dados complementares:
- **Firestore** = Cache real-time (app reads, Cloud Functions write)
- **PostgreSQL** = Source of truth (backend analytics, historical)

**Consequências:**
- ✓ Real-time na app (Firestore listeners)
- ✓ Complex queries no analytics (PostgreSQL)
- ✗ Sync logic necessário (Cloud Functions)
- ✗ Eventual consistency risk

**Alternativas Consideradas:**
1. Firestore único → Seria limitado para analytics
2. PostgreSQL único → Perderíamos real-time na app
3. Cloud Firestore + Cloud SQL (data sync) → Mais caro

---

### ADR-002: Usar Kotlin + Jetpack Compose (Gradual)

**Status:** ✅ ACCEPTED

**Problema:** Mistura de XML layouts legados e Jetpack Compose modernos.

**Decisão:** Migração gradual:
- Screens novos = Compose
- Screens antigos = XML + ConstraintLayout (refactor quando necessário)
- Shared ViewModels (trabalham com ambos)

**Consequências:**
- ✓ Sem breaking changes
- ✓ Time pode aprender Compose gradualmente
- ✗ Manutenção de ambos frameworks
- ✗ Builds ligeiramente maiores

---

### ADR-003: Cloud Functions para XP Processing

**Status:** ✅ ACCEPTED

**Problema:** Quando calcular XP pós-jogo? Backend API ou Cloud Functions?

**Decisão:** Firebase Cloud Functions
- Trigger automático em `games/{gameId}` status=FINISHED
- Sem infraestrutura
- Integração natural com Firestore

**Consequências:**
- ✓ Zero ops
- ✓ Escalagem automática
- ✗ Vendor lock-in (Firebase)
- ✗ Cold starts (~1-3s)
- ✗ Timeout limit (540s)

---

## Caminho de Atualização

### Upgrade Gradle & Android SDK

```bash
# 1. Update Android Studio (Help → Check for Updates)

# 2. Update build.gradle.kts
android {
    compileSdk = 36  # Novo SDK (quando disponível)
    defaultConfig {
        targetSdk = 36
        minSdk = 24
    }
}

# 3. Update dependencies
dependencies {
    // Compose BOM - verifica latest no Google
    implementation platform('androidx.compose:compose-bom:2024.12.00')

    // Firebase BOM - verifica latest no Firebase console
    implementation platform('com.google.firebase:firebase-bom:34.0.0')
}

# 4. Gradle sync
./gradlew clean && ./gradlew build

# 5. Testar em emulator/device
./gradlew installDebug
```

### Upgrade Node.js & Backend

```bash
# 1. Check Node version
node --version  # Should be 20 LTS

# 2. Update npm
npm install -g npm@latest

# 3. Update package.json dependencies
npm outdated  # Ver quais estão desatualizadas
npm update    # Update tudo (respeitando semver)

# 4. Update firebase-functions if needed
npm install firebase-functions@latest

# 5. Test locally
npm run dev  # Local dev server
npm run test # Tests

# 6. Build & deploy
npm run build
firebase deploy --only functions
```

### Upgrade PostgreSQL

```bash
# Local development:
# docker-compose.yml version → 15

# Production:
# Cloud SQL → gcloud sql upgrade instance [ID] --db-version POSTGRES_16

# Backup antes:
pg_dump -h [host] -U [user] [database] > backup.sql
```

---

## Veja Também

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system design
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Coding standards
- [API_REFERENCE.md](./API_REFERENCE.md) - REST API documentation
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database structure
- [BUSINESS_RULES.md](./BUSINESS_RULES.md) - Business logic rules

---

**Última atualização:** Dezembro 2025
**Versão:** 2.0 (Completa e LLM-otimizada)
**Mantido por:** Desenvolvimento Team
