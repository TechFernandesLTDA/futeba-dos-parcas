# PROJECT MAP - Futeba dos Parças

> Última atualização: 2025-01-10
> Documento de referência para entendimento macro do projeto

---

## 1. IDENTIFICAÇÃO DO APP

| Propriedade | Valor | Fonte |
|------------|-------|-------|
| **Nome do App** | Futeba dos Parças | `strings.xml:app_name` |
| **Package ID** | `com.futebadosparcas` | `build.gradle.kts:namespace` |
| **Versão Atual** | 1.4.2 (versionCode: 15) | `app/build.gradle.kts` |
| **Min SDK** | 24 (Android 7.0) | `app/build.gradle.kts` |
| **Target SDK** | 35 (Android 14) | `app/build.gradle.kts` |
| **Linguagem** | Kotlin 2.0.21 | `app/build.gradle.kts` |
| **Multiplatform** | Kotlin Multiplatform (KMP) - shared module | `shared/build.gradle.kts` |

---

## 2. STACK ANDROID

### 2.1 UI: HÍBRIDA (XML + Compose)

| Tecnologia | Quantidade | Status | Padrão |
|------------|-----------|--------|--------|
| **XML Fragments** | ~38 arquivos | Legado | ViewBinding |
| **Compose Screens** | ~33 arquivos | Moderno | Material3 |
| **Coexistência** | Fragment wrap Compose | Migração em andamento | `androidx.compose.ui.platform.ComposeView` |

**Padrão de Híbrida:**
```kotlin
// Fragment hospeda Screen Compose
class ExampleFragment : Fragment() {
    private val viewModel: ExampleViewModel by viewModels()
    private var _binding: FragmentExampleBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(...): View {
        _binding = FragmentExampleBinding.inflate(...)
        binding.composeView.setContent {
            ExampleScreen(viewModel = viewModel)
        }
        return binding.root
    }
}
```

### 2.2 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         UI LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  Fragments (XML)  │  Screens (Compose)  │  ViewModels       │
│  - HomeFragment   │  - HomeScreen       │  - @HiltViewModel │
│  - GamesFragment  │  - GamesScreen      │  - StateFlow<Ui>  │
│  - etc. (38)      │  - etc. (33)        │  - Job tracking   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       DOMAIN LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  Use Cases              │  Services          │  Models      │
│  - GetUpcomingGames     │  - XPCalculator     │  - Game      │
│  - ConfirmPresence      │  - TeamBalancer     │  - User      │
│  - CalculateRanking     │  - MatchFinalization│  - Group     │
│  (shared/src/commonMain)│  - LeagueService    │  - Location  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  Repositories           │  Local             │  Remote      │
│  - GameRepository       │  - Room (GameDao)  │  - Firebase  │
│  - UserRepository       │  - Cache (LRU)     │  - Firestore │
│  - GroupRepository      │  - DataStore       │  - Auth      │
│  - StatisticsRepository │  - SQLDelight(KMP) │  - Storage   │
│  - LocationRepository   │                     │  - FCM       │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Dependency Injection

**Framework:** Hilt (Dagger)
- `@HiltAndroidApp` em `FutebaApplication`
- Módulos em `app/src/main/java/com/futebadosparcas/di/`
  - `AppModule.kt` - Providers principais
  - `DatabaseModule.kt` - Room/Local
  - `FirebaseModule.kt` - Firebase singletons
  - `RepositoryModule.kt` - Repositories

### 2.4 Navegação

**Sistema:** Android Navigation Component (XML)
- **Graph:** `app/src/main/res/navigation/nav_graph.xml`
- **Destinations:** 45+ fragments/screens
- **Global Actions:** notifications, groups, map, preferences
- **Animações:** slide_in/out, fade customizadas

---

## 3. STACK iOS (KMP PREPARADO)

| Status | Descrição |
|--------|-----------|
| **Preparação** | KMP configurado com targets iOS |
| **Source Sets** | `shared/src/iosMain/kotlin/` |
| **Binários** | Framework estático `shared.framework` |
| **Implementações** | `FirebaseDataSource.kt`, `LocationRepositoryImpl.kt` (iOS) |
| **NOTA** | **Sem código Swift/iOS nativo ainda** - apenas preparação KMP |

**iOS Targets:**
```kotlin
// shared/build.gradle.kts
listOf(iosX64(), iosArm64(), iosSimulatorArm64())
```

---

## 4. FLUXOS PRINCIPAIS DO PRODUTO

### 4.1 Autenticação
```
SplashActivity → LoginActivity → MainActivity
                      ↓ (Google Sign-In)
                FirebaseAuth + Credentials API
```
**Arquivos:** `LoginActivity.kt`, `RegisterActivity.kt`, `LoginViewModel.kt`

### 4.2 Jogos (Core)
```
HomeFragment → GameDetailFragment → LiveGameFragment → MVPVoteFragment
     ↓              ↓                      ↓                  ↓
  GamesList    Confirmar Presence    Acompanhar Jogo    Votação
     ↓              ↓                      ↓
CreateGameFragment → (CreateGameScreen) → Agendar/Editar
```
**Arquivos:** `GamesFragment/Screen.kt`, `GameDetailFragment/Screen.kt`, `LiveGameFragment/Screen.kt`

### 4.3 Liga/Ranking
```
LeagueFragment → Divisões (Ouro/Prata/Bronze/Diamante)
       ↓
RankingFragment → Classificação por temporada
       ↓
XPCalculator → Processamento de XP + Badges
```
**Arquivos:** `LeagueFragment/Screen.kt`, `RankingFragment/Screen.kt`, `XPCalculator.kt`

### 4.4 Grupos
```
GroupsFragment → GroupDetailFragment
       ↓               ↓
CreateGroup → CashboxFragment (Caixinha)
       ↓               ↓
InvitePlayersFragment → Gerenciar membros e finanças
```
**Arquivos:** `GroupsFragment/Screen.kt`, `GroupDetailFragment/Screen.kt`, `CashboxFragment/Screen.kt`

### 4.5 Locais/Mapa
```
LocationsMapFragment (Google Maps)
       ↓
ManageLocationsFragment → Gerenciar quadras
       ↓
LocationDetailFragment → Editar local, quadras, comodidades
```
**Arquivos:** `LocationsMapFragment/Screen.kt`, `ManageLocationsFragment/Screen.kt`

### 4.6 Pagamentos/Caixa
```
GroupDetail → CashboxFragment
       ↓
Add Entry (Income/Expense)
       ↓
Pix Payment BottomSheet
```
**Arquivos:** `CashboxFragment/Screen.kt`, `PaymentBottomSheet.kt`

---

## 5. INTEGRAÇÕES

| Serviço | Uso | Detalhes |
|---------|-----|----------|
| **Firebase Firestore** | Banco de dados principal | Collections: users, games, groups, statistics, etc. |
| **Firebase Auth** | Autenticação | Google Sign-In + Email/Password |
| **Firebase Storage** | Armazenamento de imagens | Avatares, fotos de local |
| **FCM** | Push notifications | `FcmService.kt` |
| **Cloud Functions v2** | Backend serverless | `onGameFinished`, `recalculateLeagueRating`, etc. |
| **Firebase Crashlytics** | Crash reporting | Configurado |
| **Firebase Analytics** | Event tracking | Configurado |
| **Firebase Performance** | Monitoramento | Configurado |
| **Firebase Remote Config** | Configuração remota | Configurado |
| **Firebase App Check** | Segurança | Play Integrity (prod) / Debug (dev) |
| **Google Maps** | Mapa de locais | `maps-compose:4.4.1` |
| **Google Places** | Autocomplete de endereços | `places:4.1.0` |
| **Coil** | Image loading | Cache otimizado (25% mem, 50MB disk) |

---

## 6. BOUNDARIES (QUEM PODE IMPORTAR QUEM)

```
app/src/main/java/com/futebadosparcas/
├── ui/           → Pode importar domain e data
├── domain/       → NÃO pode importar ui
├── data/         → Pode importar domain
└── di/           → Pode importar tudo (injeção)

shared/src/commonMain/kotlin/com/futebadosparcas/
├── domain/       → Código compartilhado Android+iOS
└── (sem ui, sem data específico de plataforma)

shared/src/androidMain/kotlin/com/futebadosparcas/
└── platform/     → Implementações Android do Firebase

shared/src/iosMain/kotlin/com/futebadosparcas/
└── platform/     → Implementações iOS (futuras)
```

**Regra de Ouro:**
- `ui/` depende de `domain/`
- `domain/` **NUNCA** depende de `ui/` ou `data/`
- `data/` expõe interfaces para `domain/`

---

## 7. HOTSPOTS (ONDE A IA TENDE A ERRAR)

### 7.1 Ponto Crítico: Coexistência XML + Compose
**Risco:** IA pode tentar migrar tudo para Compose de uma vez
**Arquivos:** Todos os `*Fragment.kt` que ainda usam XML
**Mitigação:** Sempre preservar wrapper Fragment

### 7.2 Ponto Crítico: Navegação Híbrida
**Risco:** Confusão entre nav_graph.xml e navegação Compose
**Arquivos:** `nav_graph.xml`, `MainActivity.kt`
**Mitigação:** Usar Navigation Component XML para tudo por enquanto

### 7.3 Ponto Crítico: Job Tracking em ViewModels
**Risco:** Memory leak por jobs não cancelados
**Arquivos:** Todos os `*ViewModel.kt`
**Mitigação:** Sempre armazenar referência Job e cancelar em `onCleared()`

### 7.4 Ponto Crítico: Batching de Queries Firestore
**Risco:** Exceder limite de 10 em `whereIn()`
**Arquivos:** Repositórios que usam `whereIn()`
**Mitigação:** Sempre usar `chunked(10)`

### 7.5 Ponto Crítico: Strings Hardcoded
**Risco:** Texto direto no código (violates project rule)
**Arquivos:** Todos os Screen.kt
**Mitigação:** Sempre usar `stringResource()`

### 7.6 Ponto Crítico: Coexistência Repository Android vs KMP
**Risco:** IA pode tentar migrar tudo para KMP sem preparação
**Arquivos:** `AppModule.kt` (linhas 151-191 comentadas)
**Mitigação:** Respeitar comentário "ETAPA INTERMEDIÁRIA NA MIGRAÇÃO KMP"

---

## 8. MODULARIZAÇÃO

```
project/
├── app/                    → Android app module
│   └── src/main/
│       ├── java/.../ui/    → UI completa
│       ├── java/.../data/  → Repositories Android
│       ├── java/.../di/    → Hilt modules
│       ├── res/            → Resources (XML layouts, strings, etc.)
│       └── AndroidManifest.xml
│
├── shared/                 → Kotlin Multiplatform module
│   └── src/
│       ├── commonMain/     → Domain compartilhado
│       ├── androidMain/    → Implementações Android
│       └── iosMain/        → Implementações iOS (preparado)
│
└── functions/              → Firebase Cloud Functions (Node.js)
    └── src/index.ts
```

---

## 9. ESTADO DE MIGRAÇÃO

| Camada | Status | Próximo Passo |
|--------|--------|---------------|
| **Domain** | 90% KMP | Finalizar migração de use cases |
| **Data** | 60% Android, 40% KMP | Migrar repositories para KMP |
| **UI** | 100% Android (híbrido) | Continuar migração para Compose |
| **iOS** | 0% implementado | Aguardar KMP domain estar 100% |

---

## 10. DECISÕES ARQUITETURAIS RELEVANTES

1. **Compor sem reescrever:** Fragment wrapper permite migração gradual
2. **KMP para domain only:** UI permanece platform-specific
3. **Firebase no Android:** KMP usa expect/actual para Firebase
4. **Room + SQLDelight:** Room para Android-only, SQLDelight para KMP
5. **Job tracking obrigatório:** Previne memory leaks em ViewModels
6. **LRU cache com TTL:** Otimização para queries frequentes
7. **Batching chunked(10):** Workaround para limite Firestore
