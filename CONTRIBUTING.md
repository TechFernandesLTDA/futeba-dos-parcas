# Guia de Contribuição - Futeba dos Parças

Obrigado por considerar contribuir!

> **Nota:** Este é um repositório privado. Contribuidores externos devem solicitar acesso antes de enviar contribuições. Entre em contato pelo email [techfernandesltda@gmail.com](mailto:techfernandesltda@gmail.com).

## 📋 Índice

- [Code of Conduct](#code-of-conduct)
- [Como Contribuir](#como-contribuir)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Web App](#web-app)
- [Cloud Functions](#cloud-functions)
- [Padrões de Código](#padrões-de-código)
- [Conventional Commits](#conventional-commits)
- [Processo de Pull Request](#processo-de-pull-request)
- [Issues, labels e board](#issues-labels-e-board)
- [Reportando Bugs](#reportando-bugs)

---

## Code of Conduct

Este projeto segue um código de conduta. Ao participar, você concorda em respeitar estas diretrizes.

---

## Como Contribuir

### 1. Solicite Acesso

Este é um repositório privado. Caso não faça parte da organização, solicite acesso via email: [techfernandesltda@gmail.com](mailto:techfernandesltda@gmail.com)

### 2. Clone o Repositório

```bash
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas
```

### 3. Crie uma Branch

```bash
# Sempre trabalhe em uma branch separada
git checkout -b feature/minha-feature
# ou
git checkout -b fix/meu-bugfix
```

Convenção de nomes:
- `feature/nome-da-feature` - Novas funcionalidades
- `fix/nome-do-bug` - Correções de bugs
- `docs/descricao` - Documentação
- `refactor/descricao` - Refatorações
- `test/descricao` - Testes

### 4. Faça Suas Mudanças

Siga os [Padrões de Código](#padrões-de-código) abaixo.

### 5. Commit

Siga a convenção de [Conventional Commits](#conventional-commits).

### 6. Push e Pull Request

```bash
git push origin feature/minha-feature
```

Abra um PR no GitHub seguindo o [template](.github/pull_request_template.md) e referencie a issue com `refs #N`.

---

## Desenvolvimento Local

### Pré-requisitos

- JDK 21 (Gradle e emuladores Firebase)
- Android Studio atual + Android SDK 36 (`minSdk 24`, `targetSdk 35`)
- Git
- Firebase CLI (Functions e emuladores)
- Node.js 22 (versão em `.nvmrc`; `nvm use`)
- Xcode (somente para iOS)

### Setup Android

```bash
# 1. Clone
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas

# 2. Configure Firebase
# Baixe google-services.json do Firebase Console
cp google-services.json app/

# 3. Configure local.properties
echo "MAPS_API_KEY=sua_chave" >> local.properties

# 4. Build
./gradlew assembleDebug

# 5. Rodar testes
./gradlew :app:testDebugUnitTest

# 6. Instalar no device
./gradlew installDebug

# Compile check rápido
./gradlew compileDebugKotlin
```

---

## Web App

O app web está em `web/` e usa React 18 + TypeScript + Vite 8 + MUI 5.

```bash
cd web
npm install                    # Instalar dependências
npm run dev                    # Servidor de desenvolvimento (porta 5173)
npm run build                  # Build de produção
npm run preview                # Preview do build de produção
npm run test                   # Testes unitários (Vitest)
npx playwright test            # Testes E2E (Playwright)
npm run lint                   # ESLint
```

**Estrutura do app web:**

```
web/src/
├── components/               # Componentes reutilizáveis
├── contexts/                 # Contextos React (Auth, Theme, Toast)
├── hooks/                    # Hooks customizados (useGames, useGroups)
├── pages/                    # Páginas por feature
│   ├── auth/                 # Login, Register, ForgotPassword
│   ├── home/                 # Home com tabs (Home, Games, Groups, Profile)
│   ├── game/                 # Game detail, create, live
│   └── group/                # Group detail, edit, settings
├── services/                 # Firebase service, cloud functions
├── theme/                    # Configuração do tema MUI
├── types/                    # Definições de tipos TypeScript
└── utils/                    # Funções utilitárias
```

---

## Cloud Functions

As Cloud Functions estão em `functions/` e usam TypeScript com Firebase Functions v2.

```bash
cd functions
npm install                    # Instalar dependências
npm run build                  # Compilar TypeScript
npm run lint                   # ESLint
npx jest --no-coverage         # Todos os testes
npx jest path/to/file.test.ts  # Arquivo de teste específico
npx jest --testNamePattern="test name"  # Teste específico por nome
firebase emulators:start       # Teste local com emuladores
firebase deploy --only functions  # Deploy para produção
```

**Estrutura das functions:**

```
functions/src/
├── index.ts                   # Entry point principal
├── auth/                      # Gestão de roles (Custom Claims)
├── badges/                    # Lógica de badges
├── cache/                     # Cache server-side (leaderboard)
├── maintenance/               # Tarefas de manutenção (cleanup, keep-warm)
├── middleware/                 # Rate limiter, secure callable wrapper
├── monitoring/                # Alerting, métricas
├── notifications/             # Push notifications (batch sender)
├── season/                    # Gestão de temporadas
├── storage/                   # Thumbnails de imagens
├── validation/                # Validação de inputs
├── voting/                    # Votação MVP / Bola Murcha
├── xp/                        # Cálculo e processamento de XP
└── examples/                  # Exemplos de padrões de segurança
```

---

## Padrões de Código

### Kotlin

- **Style Guide:** [Kotlin Coding Conventions](https://kotlinlang.org/docs/coding-conventions.html)
- **Formato:** 4 espaços (não tabs)
- **Max line length:** 120 caracteres
- **Imports:** Sempre use imports específicos (não wildcards para classes principais)
- **Nomes:** `camelCase` para variáveis, `PascalCase` para classes
- **Comentários:** Em Português (PT-BR)

### Compose

- Stateless composables sempre que possível
- Use `remember {}` para cálculos caros
- Evite recomposições desnecessárias
- Sempre use `MaterialTheme.colorScheme.*` (nunca hardcode cores)

### Arquitetura

```
UI (Compose) → ViewModel (StateFlow) → UseCase → Repository → DataSource
```

- **MVVM** com Clean Architecture
- **Koin** para DI
- **StateFlow** para estados (não LiveData em código novo)
- **Repository pattern** para dados

### Testes

- Cobertura mínima: 70% para ViewModels e UseCases
- Naming: `methodName_condition_expectedResult`
- Use MockK para mocking
- Testes em `src/test/` (unit) e `src/androidTest/` (instrumented)

---

## Conventional Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/) para padronizar mensagens de commit. As descrições devem ser escritas em português (PT-BR).

### Formato

```
<tipo>(<escopo>): <descrição em português>
```

### Tipos

| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `style` | Formatação (espaços, ponto-e-vírgula, etc.) |
| `refactor` | Refatoração de código |
| `test` | Adição/modificação de testes |
| `chore` | Tarefas de build, config, dependências |
| `perf` | Melhorias de performance |
| `ci` | CI/CD pipelines |

### Escopos comuns

Escopos validados pelo commitlint: `web`, `android`, `ios`, `shared`, `functions`, `firebase`, `ci`, `deps`. Outros escopos de domínio (`auth`, `games`, `groups`, `xp`...) geram apenas aviso.

### Exemplos

```bash
feat(games): adicionar tela de votação MVP
fix(auth): corrigir crash no login em Android 14
docs(readme): atualizar instruções de instalação
refactor(profile): simplificar cálculo de estatísticas
test(games): adicionar testes unitários para GameViewModel
chore(deps): atualizar Compose BOM para 2024.09.00
perf(firestore): otimizar consultas do leaderboard
ci(deploy): adicionar step de validação de segurança
fix(functions): adicionar rate limiting nas callables
```

---

## Processo de Pull Request

1. **Spec First** - Para features grandes, crie uma spec em `/specs/` antes
2. **Pequenos PRs** - PRs menores são mais fáceis de revisar
3. **Descrição clara** - Use o template e preencha todas as seções
4. **Screenshots** - Se houver mudanças visuais
5. **Testes** - Adicione testes para sua mudança
6. **CI deve passar** - Todos os checks do GitHub Actions devem estar ✅

### Revisão

- Revisão por CODEOWNERS é consultiva hoje (org com um único membro elegível; ver `.github/BRANCH_STRATEGY.md`)
- Responda aos comentários
- Faça as mudanças solicitadas
- Mantenha a branch atualizada com `master`

---

## Issues, labels e board

Toda issue/PR deve ter **pelo menos uma label `type:*` e uma `area:*`** (a automação aplica o básico a partir dos
templates de `.github/ISSUE_TEMPLATE/`). Fonte de verdade: [`.github/labels.yml`](.github/labels.yml).

| Prefixo | Valores | Observação |
|---------|---------|------------|
| `type:*` | `bug`, `feature`, `enhancement`, `refactor`, `test`, `docs`, `chore`, `security`, `audit`, `question` | O que é o trabalho |
| `area:*` | `web`, `android`, `ios`, `functions`, `firebase`, `rules`, `shared`, `ci`, `docs`, `release`, `seo`, `a11y`, `i18n`, `performance`, `design-system`, `gamification`, `admin`, `analytics`, `billing`, `locations` | Onde mexe (várias permitidas) |
| `priority:*` | `critical` (P0), `high` (P1), `medium` (P2), `low` (P3) | Espelha o campo Priority do board |
| `status:*` | `needs-triage`, `needs-discussion`, `ready`, `in-progress`, `review`, `blocked` | Estado de fluxo; Status nativo do board continua manual |
| Outras | `epic` (+ `epic:*` temáticas históricas), `dependencies`, `lgpd`, `good-first-issue`, `help-wanted`, `duplicate`, `wontfix` | |

- **Épicos** (`epic`) agrupam sub-issues nativas e têm um *milestone* próprio (Campanha 5×5, Quadras, Site, Releases).
- **Board:** [Futeba — Campanhas](https://github.com/orgs/TechFernandesLTDA/projects/3) (campos Priority P0-P3, Area, Rodada).
- **Renomear/consolidar labels:** use a API/UI (preserva as issues antigas) e atualize `.github/labels.yml`; o sync não apaga labels.
- **CI e runners:** [`docs/CI_RUNNERS.md`](docs/CI_RUNNERS.md).

---

## Reportando Bugs

Use o [Bug Report Template](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=bug_report.yml).

**Informações importantes:**
- Versão do app
- Plataforma (Android/iOS/Web/Backend)
- Passos para reproduzir
- Logs/screenshots
- Severidade

---

## Dúvidas?

- 💬 [Discussions](https://github.com/TechFernandesLTDA/futeba-dos-parcas/discussions)
- 📧 [Email](mailto:techfernandesltda@gmail.com)
- 📖 [Documentação](https://futebadosparcas.com.br)

---

**Obrigado por contribuir!**
