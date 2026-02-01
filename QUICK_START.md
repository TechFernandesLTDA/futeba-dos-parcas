# ⚡ Quick Start - Futeba dos Parças

> **Guia rápido para desenvolvedores e LLMs**
> **Última Atualização:** 2026-02-01 | **Versão:** 1.8.0

---

## 🚀 Setup em 5 Minutos

### 1. Clone e Dependências

```bash
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas

# Android Studio Ladybug (2024.2.1+) + JDK 17 + Android SDK 35
```

### 2. Firebase Setup

```bash
# 1. Baixar google-services.json do Firebase Console
cp google-services.json app/

# 2. Configurar local.properties
echo "MAPS_API_KEY=sua_chave_google_maps" >> local.properties
```

### 3. Build & Run

```bash
./gradlew :app:assembleDebug
./gradlew :app:installDebug

# Testes
./gradlew :app:testDebugUnitTest
```

---

## 📂 Estrutura Simplificada

```
├── app/                       # Android app (Jetpack Compose)
│   └── ui/components/modern/  # Componentes UI modernos (NOVO!)
├── shared/                    # Kotlin Multiplatform (business logic)
├── iosApp/                    # iOS app (Swift + KMP)
├── functions/                 # Cloud Functions (TypeScript)
├── specs/                     # Spec-Driven Development (SDD)
├── .claude/                   # Contexto para LLMs
│   ├── PROJECT_CONTEXT.md     # Contexto consolidado
│   └── rules/                 # Padrões de código
├── CLAUDE.md                  # Guia para Claude Code
└── QUICK_START.md             # Este arquivo
```

---

## 🎯 Arquitetura em 30 Segundos

```
UI (Compose) → ViewModel (StateFlow) → UseCase → Repository → Firebase
```

- **UI:** Jetpack Compose Material 3
- **ViewModel:** @HiltViewModel + StateFlow<UiState>
- **Repository:** Interface (shared) + Impl (androidMain)
- **Firebase:** Firestore, Auth, Storage, Functions, FCM

---

## 🧱 Componentes Modernos (NEW!)

Localizados em `app/ui/components/modern/`:

| Componente | Uso |
|------------|-----|
| **ShimmerLoading** | Loading states com skeleton screens |
| **ErrorState** | Telas de erro com retry (5 tipos) |
| **EmptyState** | Estados vazios com CTA (7 variantes) |
| **LoadingButton** | Botões com loading interno (6 tipos) |
| **AdaptiveNavigation** | Bottom bar / Rail / Drawer (responsivo) |
| **PullToRefreshContainer** | Pull-to-refresh Material 3 |

**Exemplo:**
```kotlin
when (uiState) {
    is Loading -> ShimmerGamesList()
    is Error -> ErrorState(ErrorType.NETWORK, onRetry = { vm.retry() })
    is Empty -> EmptyGamesState(onCreateGame = { nav("create") })
    is Success -> PullToRefreshContainer(vm.isRefreshing, { vm.refresh() }) {
        LazyColumn { items(games) { GameCard(it) } }
    }
}
```

---

## 🔥 Firebase Collections

| Collection | Descrição |
|------------|-----------|
| `users` | Perfis (name, email, role, xp, level) |
| `games` | Partidas (status: SCHEDULED → CONFIRMED → LIVE → FINISHED) |
| `groups` | Grupos de pelada (members, admins) |
| `statistics` | Stats por grupo (gols, assistências, win rate) |
| `season_participation` | Rankings mensais (XP, divisão) |
| `xp_logs` | Histórico de XP |
| `user_badges` | Conquistas desbloqueadas |

---

## 🎮 Sistema de XP

| Ação | XP | Ação | XP |
|------|-----|------|-----|
| Participação | +10 | MVP | +50 |
| Gol | +5 | Vitória | +20 |
| Assistência | +3 | Streak 3+ | +10 |
| Defesa (GK) | +2 | Streak 10+ | +30 |

**Divisões:** Bronze (0-499) → Prata (500-1499) → Ouro (1500-2999) → Diamante (3000+)

---

## 🎨 Material 3 Design Tokens

```kotlin
// Cores
MaterialTheme.colorScheme.primary         // Verde Duolingo (#58CC02)
MaterialTheme.colorScheme.secondary       // Laranja (#FF9600)
MaterialTheme.colorScheme.tertiary        // Roxo (#6200EA)

// Surface hierarchy
surfaceContainerLowest → Low → Container → High → Highest

// Tipografia
typography.displayLarge    // 57sp (hero)
typography.headlineLarge   // 32sp (títulos)
typography.bodyLarge       // 16sp (corpo)
typography.labelLarge      // 14sp (botões)
```

**Regra de Ouro:** NUNCA hardcode cores. Sempre usar `MaterialTheme.colorScheme.*`

---

## ⚙️ Comandos Essenciais

```bash
# Build
./gradlew assembleDebug
./gradlew compileDebugKotlin          # Compile check rápido

# Testes
./gradlew :app:testDebugUnitTest
./gradlew :app:testDebugUnitTest --tests "*.GameViewModelTest"

# Quality
./gradlew lint
./gradlew detekt

# Firebase Functions
cd functions
npm install && npm run build
firebase emulators:start
firebase deploy --only functions

# Git (Conventional Commits)
feat(games): add MVP voting screen
fix(auth): resolve login crash
docs(readme): update setup guide
```

---

## 🚫 Proibições Absolutas

❌ `!!` operator (usar `?.let {}`)
❌ Hardcoded colors/strings
❌ `LiveData` (usar `StateFlow`)
❌ `findViewById()` (usar Compose)
❌ Nested `LazyColumn` (usar `FlowRow`)
❌ Lógica de negócio na UI
❌ Commits sem spec (Spec-Driven Development)

---

## ✅ Checklist de PR

- [ ] Código compila sem erros
- [ ] Testes passam
- [ ] Lint/Detekt OK
- [ ] Funciona portrait/landscape/tablet
- [ ] Touch targets >= 48dp
- [ ] `contentDescription` em ícones
- [ ] Estados: Loading, Empty, Error, Success
- [ ] Sem cores/strings hardcoded
- [ ] Comentários em Português (PT-BR)
- [ ] Spec aprovada (para features/bugfixes)

---

## 📚 Documentação Completa

| Arquivo | Propósito |
|---------|-----------|
| **CLAUDE.md** | Guia completo para desenvolvimento |
| **.claude/PROJECT_CONTEXT.md** | Contexto consolidado para LLMs |
| **.claude/rules/** | Padrões de código (Compose, ViewModels, Firestore, etc.) |
| **specs/** | Especificações de features (SDD) |
| **CONTRIBUTING.md** | Guia de contribuição |

---

## 🆘 Problemas Comuns

### Build falha
```bash
./gradlew clean
./gradlew --stop
./gradlew :app:assembleDebug
```

### Firebase não conecta
```bash
# Verificar google-services.json em app/
# Verificar SHA-1 no Firebase Console
```

### Compose error
```kotlin
// NUNCA aninhar LazyColumn
LazyColumn {
    item {
        LazyColumn { } // ❌ ERRADO
        FlowRow { }    // ✅ CORRETO
    }
}
```

---

## 🔗 Links Rápidos

- [GitHub Repo](https://github.com/TechFernandesLTDA/futeba-dos-parcas)
- [Play Store](https://play.google.com/store/apps/details?id=com.futebadosparcas)
- [Firebase Console](https://console.firebase.google.com/project/futebadosparcas)
- [GitHub Actions](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions)
- [Material 3](https://m3.material.io/)
- [Compose Samples](https://github.com/android/compose-samples)

---

**Pronto para codar! ⚽🚀**
