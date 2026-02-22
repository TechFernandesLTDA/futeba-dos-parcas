# 📘 Guia de Migração Android → Web (wasmJs)

**Futeba dos Parças - Versão Web**

Este documento fornece orientação completa para LLMs (Claude Code, GLM 5, etc.) trabalharem na migração do app Android para a versão Web usando Kotlin/Wasm + Compose Multiplatform.

---

## 🎯 **OBJETIVO**

Portar **TODAS** as funcionalidades do app Android para a versão Web (wasmJs), mantendo:
- ✅ Mesma UX/UI
- ✅ Mesma lógica de negócio
- ✅ Mesma integração com Firebase
- ✅ Material Design 3

---

## 📊 **STATUS ATUAL (2026-02-22)**

### ✅ O QUE JÁ ESTÁ FUNCIONANDO (Web)

#### Infraestrutura Base
- [x] Kotlin/Wasm compilando com sucesso
- [x] Compose Multiplatform 1.10.0 configurado
- [x] Webpack dev server rodando (localhost:8081)
- [x] Hot reload funcionando
- [x] Material Design 3 UI components
- [x] Firebase SDK scripts carregados no HTML

#### UI Básica
- [x] SplashScreen com detecção de plataforma (mostra "Web Edition")
- [x] Navegação básica com 4 tabs (Início, Jogos, Grupos, Perfil)
- [x] TopAppBar e NavigationBar funcionais
- [x] Emojis substituindo Material Icons (wasmJs não suporta Icons ainda)

#### Autenticação Mock
- [x] `LoginScreen` com campos email/senha
- [x] `FirebaseManager` (versão MOCK - autenticação hardcoded)
- [x] Navegação Login → Home após autenticação
- [x] Credenciais de teste:
  - `test@futeba.com` / `123456`
  - `admin@futeba.com` / `admin123`

#### Dados Mock
- [x] `GamesTab` - Lista 2 jogos mockados
- [x] `GroupsTab` - Lista 2 grupos mockados
- [x] Cards com Material 3 (surfaceContainerHigh)
- [x] Loading states (CircularProgressIndicator)

---

### ⏳ O QUE FALTA FAZER (21 Issues Criadas)

**Todas as issues foram criadas no GitHub com label `web`:**
🔗 https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues?q=is%3Aissue+is%3Aopen+label%3Aweb

#### Prioridade ALTA (MVP Web)
1. **#162 - Autenticação Real** (Firebase Auth com external declarations)
2. **#163 - Perfil** (ProfileScreen + EditProfileScreen)
3. **#164 - Grupos Completo** (CRUD + detalhes + convites + cashbox)
4. **#165 - Jogos Completo** (CRUD + detalhes + confirmação)
5. **#170 - Navegação** (Router web + deep links)

#### Prioridade MÉDIA
6. **#166 - Live Game** (eventos ao vivo)
7. **#167 - MVP Voting** (votação pós-jogo)
8. **#168 - Gamificação** (XP, levels, badges)
9. **#169 - Rankings** (ligas e classificação)
10. **#171 - Locations** (campos + mapas)

#### Prioridade BAIXA (features avançadas)
11. **#172 - Notificações** (push notifications via Service Worker)
12. **#173 - PWA** (Progressive Web App completo)
13. **#174 - Jogadores** (busca e perfis)
14. **#175 - Settings** (configurações)
15. **#176 - Schedules** (calendário)
16. **#177 - Tactical Board** (quadro tático)
17. **#178 - Admin** (painel admin)
18. **#179 - Developer Tools** (debug tools)

#### Infraestrutura e Qualidade
19. **#180 - Performance** (otimizações + bundle size)
20. **#181 - Testing** (testes automatizados)
21. **#182 - Documentação** (guias + deploy)

---

## 🏗️ **ARQUITETURA DO PROJETO**

### Estrutura de Diretórios

```
futeba-dos-parcas/
├── app/                          # Android app (REFERÊNCIA)
│   └── src/main/java/com/futebadosparcas/
│       ├── ui/                   # 53 telas Android
│       │   ├── auth/             # LoginScreen, RegisterScreen
│       │   ├── games/            # GamesScreen, GameDetailScreen, CreateGameScreen
│       │   ├── groups/           # GroupsScreen, GroupDetailScreen, etc.
│       │   ├── profile/          # ProfileScreen, EditProfileScreen
│       │   └── ...               # + 30 outros módulos
│       ├── domain/               # UseCases, Models
│       └── data/                 # Repositories, DataSources
│
├── composeApp/                   # Compose Multiplatform (WEB)
│   └── src/
│       ├── commonMain/           # Código compartilhado (Android + iOS + Web)
│       │   └── kotlin/com/futebadosparcas/
│       │       ├── compose/      # App.kt (entry point)
│       │       └── ui/           # HomeScreen.kt (compartilhado)
│       │
│       ├── wasmJsMain/           # ESPECÍFICO DA WEB ⭐
│       │   ├── kotlin/com/futebadosparcas/
│       │   │   ├── compose/      # Main.kt, AppNavigation.wasmJs.kt
│       │   │   ├── firebase/     # FirebaseManager.kt (mock por enquanto)
│       │   │   └── ui/           # LoginScreen.kt, GamesTab.kt, GroupsTab.kt, HomeScreenWeb.kt
│       │   └── resources/
│       │       └── index.html    # HTML principal + Firebase SDK
│       │
│       ├── androidMain/          # Android-specific
│       └── iosMain/              # iOS-specific
│
├── shared/                       # KMP Shared Module
│   └── src/
│       ├── commonMain/           # Domain models, Repository interfaces
│       ├── androidMain/          # Android implementations
│       ├── iosMain/              # iOS implementations
│       └── (nativeAndAndroidMain)  # Firebase GitLive SDK (Android + iOS)
│
└── functions/                    # Cloud Functions (Node.js)
    └── src/                      # 30+ functions (XP, badges, notificações, etc.)
```

### Fluxo de Código para Web

```
1. Usuário acessa localhost:8081
   ↓
2. index.html carrega:
   - Firebase JS SDK (v8 compat)
   - skiko.js (Skia engine)
   - composeApp.js (Kotlin/Wasm compilado)
   ↓
3. Main.kt (entry point):
   - FirebaseManager.initialize()
   - ComposeViewport(document.body) { App() }
   ↓
4. App.kt:
   - FutebaTheme { AppNavigation(...) }
   ↓
5. AppNavigation.wasmJs.kt:
   - Se logado → HomeScreenWeb()
   - Se não logado → LoginScreen()
   ↓
6. HomeScreenWeb.kt:
   - Scaffold + NavigationBar
   - Tab 0 → HomeScreen (commonMain)
   - Tab 1 → GamesTab (wasmJs - busca dados do FirebaseManager)
   - Tab 2 → GroupsTab (wasmJs - busca dados do FirebaseManager)
   - Tab 3 → ProfilePlaceholder
```

---

## 🔥 **FIREBASE INTEGRATION (CRÍTICO)**

### Problema Atual: FirebaseManager Mock

**Arquivo:** `composeApp/src/wasmJsMain/kotlin/com/futebadosparcas/firebase/FirebaseManager.kt`

```kotlin
// ❌ VERSÃO ATUAL (MOCK)
object FirebaseManager {
    private val mockUsers = mapOf("test@futeba.com" to "123456")

    suspend fun signInWithEmailAndPassword(email: String, password: String): String? {
        delay(500) // Simula network
        return if (mockUsers[email] == password) "mock-user-id" else null
    }
}
```

### Solução: External Declarations

**Problema:** Kotlin/Wasm **NÃO SUPORTA** `js()`inline code.

**Solução:** Usar `external interface` + `@JsModule`:

```kotlin
// ✅ VERSÃO REAL (EXTERNAL DECLARATIONS)

// 1. Definir tipos JS externos
external interface Auth : JsAny
external interface User : JsAny {
    val uid: String
    val email: String?
}
external interface UserCredential : JsAny {
    val user: User
}

// 2. Importar funções do Firebase JS SDK
@JsModule("firebase/auth")
external object FirebaseAuthModule {
    fun getAuth(app: FirebaseApp): Auth
    fun signInWithEmailAndPassword(
        auth: Auth,
        email: String,
        password: String
    ): Promise<UserCredential>
}

// 3. Wrapper Kotlin
object FirebaseManager {
    private lateinit var auth: Auth

    fun initialize() {
        val app = FirebaseAppModule.getApp()
        auth = FirebaseAuthModule.getAuth(app)
    }

    suspend fun signInWithEmailAndPassword(email: String, password: String): String? {
        return try {
            val credential = FirebaseAuthModule.signInWithEmailAndPassword(
                auth, email, password
            ).await()
            credential.user.uid
        } catch (e: Exception) {
            null
        }
    }
}
```

### Referências para Firebase Web Integration

**Estudar estes arquivos:**
- `composeApp/src/wasmJsMain/resources/index.html` (Firebase SDK já carregado)
- `app/src/main/java/com/futebadosparcas/data/firebase/` (lógica Android como referência)
- Firebase JS SDK docs: https://firebase.google.com/docs/web/setup

**Coleções Firestore usadas no app:**
- `users` - Perfis de usuários
- `games` - Jogos (peladas)
- `groups` - Grupos de pelada
- `statistics` - Estatísticas de jogadores por grupo
- `season_participation` - Rankings por temporada
- `xp_logs` - Histórico de XP
- `user_badges` - Badges desbloqueadas
- `locations` - Campos de futebol
- `cashbox` - Controle financeiro de grupos
- `activities` - Feed de atividades

---

## 🎨 **UI PATTERNS (Material 3)**

### Componentes Já Implementados (Web)

```kotlin
// ✅ Navegação
@Composable
fun HomeScreenWeb() {
    Scaffold(
        topBar = { TopAppBar(...) },
        bottomBar = { NavigationBar { ... } }
    ) { paddingValues ->
        // Tab content
    }
}

// ✅ Cards
Card(
    colors = CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
    )
) { /* content */ }

// ✅ Loading
CircularProgressIndicator()

// ✅ Emojis (substituindo Icons)
Text("⚽") // ao invés de Icon(Icons.Default.Sports)
```

### ⚠️ Limitações Conhecidas (wasmJs)

1. **Material Icons NÃO funcionam** → Usar emojis ou SVGs
2. **Compose Resources limitados** → Preferir assets no HTML
3. **Sem Camera API nativa** → Usar `<input type="file" accept="image/*">`
4. **Geolocalização limitada** → Web Geolocation API (menos preciso)
5. **Sem background processing** → Service Workers apenas

---

## 🚀 **WORKFLOW DE DESENVOLVIMENTO**

### 1. Escolher uma Issue

```bash
# Ver issues abertas com label 'web'
gh issue list --label web

# Escolher uma issue (ex: #162 - Autenticação)
gh issue view 162
```

### 2. Criar Branch

```bash
git checkout -b web/feature-auth
```

### 3. Implementar (Pasta wasmJsMain)

```kotlin
// SEMPRE criar arquivos em:
composeApp/src/wasmJsMain/kotlin/com/futebadosparcas/

// Exemplos:
ui/auth/LoginScreenReal.kt       # Tela de login com Firebase real
firebase/FirebaseAuth.kt          # External declarations para Auth
firebase/FirebaseFirestore.kt     # External declarations para Firestore
```

### 4. Testar Localmente

```bash
# Iniciar dev server (hot reload automático)
./gradlew :composeApp:wasmJsBrowserDevelopmentRun

# Acessar: http://localhost:8081
```

### 5. Build de Produção

```bash
# Gerar bundle otimizado
./gradlew :composeApp:wasmJsBrowserProductionWebpack

# Output: composeApp/build/dist/wasmJs/productionExecutable/
```

### 6. Commit e PR

```bash
git add .
git commit -m "feat(web): implement Firebase Auth real (#162)"
gh pr create --title "feat(web): Firebase Auth real" --body "Closes #162"
```

---

## 🔧 **FERRAMENTAS E BIBLIOTECAS**

### Já Configuradas ✅
- Kotlin 2.2.10
- Compose Multiplatform 1.10.0
- Material 3
- Webpack 5.100.2
- Firebase JS SDK v8 (CDN)

### A Avaliar 🔍
- **Navegação:** Voyager ou Decompose (routers para KMP)
- **Mapas:** Google Maps JS API ou Leaflet
- **Charts:** KoalaPlot ou Chart.js (via external)
- **Image Loading:** Coil3 (tem suporte wasmJs experimental)
- **LocalStorage:** localStorage API (via external)

---

## 📚 **REFERÊNCIAS TÉCNICAS**

### Documentação Oficial
- [Kotlin/Wasm](https://kotlinlang.org/docs/wasm-overview.html)
- [Compose Multiplatform](https://www.jetbrains.com/lp/compose-multiplatform/)
- [Firebase Web SDK](https://firebase.google.com/docs/web/setup)
- [Material 3 for Compose](https://m3.material.io/)

### Arquivos Importantes do Projeto
- `CLAUDE.md` - Instruções gerais do projeto
- `.claude/rules/compose-patterns.md` - Padrões de UI
- `.claude/rules/firestore.md` - Padrões de Firestore
- `specs/CMP_MULTIPLATFORM_MIGRATION.md` - Plano geral de migração KMP
- `MEMORY.md` - Memória de patterns e decisões

### Código Android de Referência (53 telas)
- `app/src/main/java/com/futebadosparcas/ui/` - TODAS as telas Android
- Use como referência para UX/UI e lógica de negócio

---

## ⚡ **DICAS DE PERFORMANCE**

### Code Splitting
```kotlin
// Lazy load heavy screens
val LazyGameDetail = lazy {
    @Composable { GameDetailScreen(...) }
}
```

### Image Optimization
```html
<!-- No HTML, usar WebP -->
<img src="logo.webp" alt="Logo">
```

### Bundle Size
```bash
# Medir bundle size
ls -lh composeApp/build/dist/wasmJs/productionExecutable/*.wasm

# Alvo: < 10MB (não comprimido), < 3MB (gzipped)
```

---

## 🐛 **TROUBLESHOOTING COMUM**

### Build Falha com "js() not allowed"
```
Erro: Calls to 'js(code)' must be a single expression...
```
**Solução:** Usar external declarations ao invés de js() inline.

### Material Icons não compilam
```
Erro: Unresolved reference 'icons'
```
**Solução:** Usar emojis ou criar SVG Icons customizados.

### Firebase undefined
```
Erro: firebase is not defined
```
**Solução:** Verificar se scripts do Firebase foram carregados no index.html ANTES do composeApp.js.

### Webpack dev server não atualiza
```bash
# Forçar rebuild completo
./gradlew clean
./gradlew :composeApp:wasmJsBrowserDevelopmentRun
```

---

## 🎯 **CHECKLIST PARA CADA FEATURE**

Ao implementar uma nova feature (ex: GameDetailScreen), seguir:

- [ ] 1. Ler código Android de referência (`app/.../ui/games/GameDetailScreen.kt`)
- [ ] 2. Identificar dependências (ViewModel, Repository, UseCases)
- [ ] 3. Criar external declarations para Firebase (se necessário)
- [ ] 4. Criar Screen em `wasmJsMain/kotlin/.../ui/`
- [ ] 5. Integrar com navegação (AppNavigation.wasmJs.kt)
- [ ] 6. Testar em localhost:8081
- [ ] 7. Verificar responsividade (desktop + mobile)
- [ ] 8. Verificar tema claro/escuro
- [ ] 9. Adicionar loading states
- [ ] 10. Adicionar error handling
- [ ] 11. Commit e PR

---

## 📝 **NOTAS IMPORTANTES**

### Para GLM 5 / Outros LLMs

1. **Sempre leia este documento ANTES de começar a trabalhar**
2. **Sempre verifique as Issues no GitHub** (não implementar features sem issue)
3. **Sempre consulte o código Android** (app/src/main/java/...) como referência
4. **NUNCA use js() inline** - sempre external declarations
5. **SEMPRE teste localmente** antes de commitar
6. **Sempre pergunte se tiver dúvidas** - não assuma comportamentos

### Priorização

**MVP Web (Prioridade 1):**
- Auth real (#162)
- Perfil (#163)
- Grupos completo (#164)
- Jogos completo (#165)
- Navegação (#170)

**Features Core (Prioridade 2):**
- Live Game (#166)
- MVP Voting (#167)
- Gamificação (#168)
- Rankings (#169)

**Nice-to-Have (Prioridade 3):**
- Tudo resto

---

## 🤝 **COLABORAÇÃO ENTRE LLMs**

### Claude Code (você está aqui 👋)
- Arquiteto principal
- Revisor de código
- Especialista em Kotlin/Compose

### GLM 5 (OpenCode)
- Implementação paralela de features
- Foco em issues de Prioridade 1 e 2
- Sempre consultar este documento

### Workflow Paralelo
1. Claude Code: Trabalha em issues críticas (#162, #163)
2. GLM 5: Trabalha em issues paralelas (#164, #165)
3. Revisão cruzada via GitHub PRs
4. Merges coordenados

---

## 🏁 **CONCLUSÃO**

Este é um projeto AMBICIOSO mas VIÁVEL:
- ✅ Infraestrutura base funcionando
- ✅ 21 issues bem definidas
- ✅ Código Android completo como referência
- ✅ Firebase configurado

**Próximos Passos:**
1. Começar por #162 (Auth real)
2. Testar Auth funcionando
3. Partir para #163 (Perfil)
4. Continuar sequencialmente

**Vamos transformar Futeba dos Parças em um PWA completo! ⚽🚀**

---

_Última atualização: 2026-02-22_
_Por: Claude Code (Sonnet 4.5)_
