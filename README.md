# ⚽ Futeba dos Parças

[![Android CI](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/android-ci.yml/badge.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/android-ci.yml)
[![iOS Build](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/ios-build.yml/badge.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/ios-build.yml)
[![Functions CI](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/functions-ci.yml/badge.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/functions-ci.yml)
[![Version](https://img.shields.io/badge/web-1.43.5-green.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-lightgrey.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas)

> Organize suas peladas com gamificação, estatísticas e diversão! 🎮

[📱 Play Store](https://play.google.com/store/apps/details?id=com.futebadosparcas) | [🌐 Web App](https://futebadosparcas.web.app) | [🐛 Reportar Bug](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=bug_report.yml)

---

## 🌟 Features

### ⚽ Gestão de Jogos
- ✅ Criar e gerenciar partidas
- ✅ Sistema de confirmação de presença
- ✅ Check-in com validação GPS
- ✅ Formação automática de times equilibrados
- ✅ Registro de eventos ao vivo (gols, assistências, cartões)

### 🎮 Gamificação
- 🏆 Sistema de XP e níveis
- 🥇 Rankings por temporada (mensal)
- 🎖️ Badges e conquistas desbloqueáveis
- 🔥 Streaks de participação
- 👑 Votação de MVP e Bola Murcha

### 📊 Estatísticas
- 📈 Histórico completo de jogos
- ⚽ Gols, assistências, defesas
- 📉 Win rate e performance
- 🏅 Divisões (Bronze, Prata, Ouro, Diamante)
- 📱 Widgets Android para próximos jogos

### 🌐 Web App
- ✅ 55+ telas com paridade total de funcionalidades com o Android
- ✅ Sincronização em tempo real via React Query + Firestore
- ✅ PWA-ready com suporte offline
- ✅ Design responsivo mobile-first (max-width 480dp)
- ✅ Firebase Hosting com cache CDN

### 🚀 Moderno & Multiplataforma
- 🎨 Material Design 3 (Android) / MUI 5 (Web)
- 🌓 Dark Mode (Android + Web)
- 📱 Jetpack Compose (Android)
- 🔄 Kotlin Multiplatform — lógica de negócio compartilhada (~95%)
- ⚡ Performance otimizada com Baseline Profiles

---

> **📘 Novo no código?** Comece pelo **[CLAUDE.md](CLAUDE.md)** — guia completo de arquitetura, build commands, padrões de código e workflow Spec-Driven Development.

---

## 📌 Status Atual

| Área | Estado |
|------|--------|
| Issues abertas | 0 |
| PRs abertos | 0 |
| Branch padrão | `master` |
| Proteção da `master` | 1 review obrigatório, CODEOWNERS obrigatório, stale reviews ligados |
| Web produção | [`https://futebadosparcas.web.app`](https://futebadosparcas.web.app) |

Versões atuais por plataforma:

| Plataforma | Versão |
|------------|--------|
| Web | `1.43.5` |
| Android | `1.32.1` (`buildNumber` 58) |
| iOS | `1.6.0` (`buildNumber` 17) |
| Functions | `1.2.1` |

Fonte de verdade: [`versions.json`](versions.json). Status de governança: [`docs/GITHUB_STATUS.md`](docs/GITHUB_STATUS.md).

---

## 🛠️ Tech Stack

### Android
- **Linguagem:** Kotlin 2.2.10
- **UI:** Jetpack Compose + Compose BOM 2024.09.00
- **Arquitetura:** MVVM + Clean Architecture
- **Injeção de Dependência:** Koin 4.1.1
- **Async:** Coroutines + Flow
- **Database:** Room + DataStore
- **Image Loading:** Coil
- **Build:** AGP 9.0.1, SDK 36, JDK 17

### Web
- **Framework:** React 18 + TypeScript
- **UI:** Material UI 5
- **Build:** Vite 8
- **Server State:** TanStack React Query 5
- **Routing:** React Router DOM 6
- **Database:** Firestore (com cache/retry via React Query)

### iOS (Em Desenvolvimento)
- **Linguagem:** Kotlin (shared) + Swift
- **UI:** Compose Multiplatform 1.10.0
- **Arquitetura:** KMP (~95% código compartilhado)

### Backend (Firebase)
- **Auth:** Firebase Authentication
- **Database:** Cloud Firestore
- **Storage:** Cloud Storage
- **Serverless:** Cloud Functions v2 (Node 22, TypeScript)
- **Push:** Firebase Cloud Messaging
- **Monitoring:** Crashlytics + App Check

---

## 🚀 Quick Start

### Pré-requisitos

- JDK 17
- Android Studio Ladybug (2024.2.1+) ou Hedgehog (2024.1.1+)
- Android SDK 36 (compileSdk) / minSdk 24 / targetSdk 35
- Firebase CLI (para Functions)
- Node.js 22 (para Functions e Web)

### Clone & Build

```bash
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas

# Android
./gradlew :app:assembleDebug
./gradlew :app:installDebug

# Web
cd web
npm install
npm run dev          # http://localhost:5173

# Testes
./gradlew :app:testDebugUnitTest
cd functions && npx jest --no-coverage
```

### Configuração Firebase

1. Criar projeto no [Firebase Console](https://console.firebase.google.com)
2. Baixar `google-services.json` → `app/`
3. Configurar `local.properties`:

```properties
MAPS_API_KEY=sua_chave_google_maps
```

4. Emuladores locais:

```bash
cd functions
npm install
firebase emulators:start
```

---

## 📂 Estrutura do Projeto

```
futeba-dos-parcas/
├── app/                    # Android app (Jetpack Compose)
├── shared/                 # Kotlin Multiplatform (business logic)
├── composeApp/             # Compose Multiplatform UI (Android + iOS)
├── iosApp/                 # iOS app (Swift + KMP)
├── functions/              # Cloud Functions (TypeScript, Node 22)
├── web/                    # Web app (React + TypeScript + MUI)
│   ├── src/pages/          # 55+ telas
│   ├── src/hooks/          # React hooks (useGames, useGroups, etc.)
│   ├── src/components/     # Componentes UI reutilizáveis
│   └── src/contexts/       # Auth, Theme, Toast
├── firestore.rules         # Firestore security rules
├── specs/                  # Specs técnicas (SDD)
├── scripts/                # Scripts utilitários (~70 scripts)
└── .github/workflows/      # CI/CD pipelines (23 workflows)
```

---

## 📖 Documentação

### 🤖 Para Desenvolvimento Assistido por IA
- **[CLAUDE.md](CLAUDE.md)** — Guia completo com build commands, arquitetura, padrões, gotchas e workflow SDD
- **[LLM Workspace Guide](docs/LLM_WORKSPACE_GUIDE.md)** — Ordem de leitura e fontes da verdade para LMs/agentes sem desperdiçar contexto
- **[.claude/rules/](.claude/rules)** — Padrões detalhados: Compose, Material 3, ViewModels, Firestore, testes, segurança
- **[.claude/PROJECT_CONTEXT.md](.claude/PROJECT_CONTEXT.md)** — Contexto consolidado para LLMs

### 📚 Para Desenvolvedores
- **[Project Map](docs/PROJECT_MAP.md)** — mapa operacional de pastas, fronteiras e comandos
- **[Agent Operating Model](docs/AGENT_OPERATING_MODEL.md)** — papéis e uso dos agentes Rawls, James, Hypatia e Plato
- **[QA Smoke Matrix](docs/QA_SMOKE_MATRIX.md)** — matriz prática de regressão web/mobile/Android/Functions
- **[Tech Stack & Context](docs/TECH_STACK_AND_CONTEXT.md)** — Arquitetura, bibliotecas e navegação
- **[Business Rules](docs/BUSINESS_RULES.md)** — Sistema de XP, ciclo de vida de partidas e ranking
- **[Setup Guide](docs/SETUP_GUIDE.md)** — Configuração completa do ambiente
- **[Specs](specs/)** — Especificações técnicas de todas as features (SDD)

---

## 🤝 Contribuindo

Contribuições são **muito bem-vindas**!

1. Veja o guia em [CONTRIBUTING.md](CONTRIBUTING.md)
2. Leia as [specs](specs/) antes de implementar features
3. Siga [Conventional Commits](https://www.conventionalcommits.org/)
4. Abra um PR com descrição clara

### Spec-Driven Development (SDD)

Este projeto segue **Spec-Driven Development** rigorosamente:

- ✅ Toda feature ou bugfix DEVE ter uma spec aprovada em `/specs/` antes da implementação
- ✅ Fases obrigatórias: `REQUIREMENTS → UX/UI → TECHNICAL DESIGN → TASKS → IMPLEMENTATION → VERIFY`
- ✅ Templates disponíveis: `_TEMPLATE_FEATURE_MOBILE.md` e `_TEMPLATE_BUGFIX_MOBILE.md`
- ✅ Decisões técnicas documentadas em `/specs/DECISIONS.md`

**Consulte [CLAUDE.md](CLAUDE.md) para o workflow completo e regras obrigatórias.**

---

## 🔐 Environment & Access

Este repositório é configurado com variáveis de ambiente e chaves de acesso para desenvolvimento:
- **Firebase Access**: Autentique via `firebase login` ou credenciais locais seguras
- **Scripts**: Scripts Node.js em `/scripts` para tarefas de manutenção
- **Secrets**: Nunca commitar `google-services.json`, `.env` ou arquivos `*.keystore`

---

## 🔗 Links

- 🌐 [Web App](https://futebadosparcas.web.app)
- 📱 [Google Play Store](https://play.google.com/store/apps/details?id=com.futebadosparcas)
- 🛡️ [Política de Segurança](SECURITY.md)
- 🐛 [Reportar Bug](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=bug_report.yml)
- 💡 [Solicitar Feature](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=feature_request.yml)
- 📧 [Contato](mailto:techfernandesltda@gmail.com)

---

## 📊 Status do Projeto

- ✅ **Android:** Produção (`1.32.1`, build 58)
- ✅ **Web:** Produção (`1.43.5` em https://futebadosparcas.web.app)
- ✅ **Backend:** Firebase Cloud Functions v2 (`1.2.1`)
- ✅ **CI/CD:** GitHub Actions (23 workflows)
- 🚧 **iOS:** Em desenvolvimento (`1.6.0`, KMP/CMP em evolução)

Governança e fila atual: [`docs/GITHUB_STATUS.md`](docs/GITHUB_STATUS.md).

---

## 🎮 Sistema de XP

| Ação | XP |
|------|-----|
| Participação | +10 |
| Gol | +10 |
| Assistência | +7 |
| Defesa (Goleiro) | +8 |
| Clean Sheet (Goleiro) | +15 |
| Vitória | +20 |
| Empate | +10 |
| MVP | +30 |
| Bola Murcha (pior jogador) | -10 |
| Streak 3 | +20 |
| Streak 5 | +35 |
| Streak 7 | +50 |
| Streak 10 | +100 |

> Valores padrão — grupos podem customizar via `GamificationSettings`. Fonte da verdade: `shared/xp-constants.json`.

**Reset de Temporada**: Mensal no dia 1. XP global nunca reseta.

---

**Feito com ❤️ pela Tech Fernandes Ltda**

*Built for broken ankles and spectacular goals.*
