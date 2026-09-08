# Futeba dos Parças

<!-- markdownlint-disable MD013 -->

[![Web CI](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/web-ci.yml/badge.svg?branch=master)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/web-ci.yml)
[![Android CI](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/android-ci.yml/badge.svg?branch=master)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/android-ci.yml)
[![iOS Build](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/ios-build.yml/badge.svg?branch=master)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/ios-build.yml)
[![Functions CI](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/functions-ci.yml/badge.svg?branch=master)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/functions-ci.yml)
[![Firestore Rules](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/firestore-rules-ci.yml/badge.svg?branch=master)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/firestore-rules-ci.yml)
[![CodeQL](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/codeql.yml/badge.svg?branch=master)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Plataforma para organizar peladas, grupos e temporadas com confirmação de presença, formação de times, estatísticas, ranking e gamificação.

[Web em produção](https://futebadosparcas.com.br) · [Releases](https://github.com/TechFernandesLTDA/futeba-dos-parcas/releases) · [Reportar bug](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=bug_report.yml)

> Este é um repositório privado. Clonar, executar ambientes conectados e acessar projetos Firebase exige autorização explícita da Tech Fernandes Ltda.

## Produto

- Gestão de jogos, confirmações, check-in, escalações e eventos ao vivo.
- Grupos com mural, convites, caixa, mensalistas com rateio exato, enquetes,
  desafios e comunicação direta.
- XP, níveis, badges, divisões, rankings sazonais, MVP, bônus por performance,
  aderência e histórico estatístico.
- Aplicações Web/PWA, Android e iOS/CMP apoiadas por Firebase e Cloud Functions.
- No iOS, Aparência permite escolher claro, escuro ou sistema e preserva a
  preferência entre sessões; a tipografia usa a fonte nativa da plataforma.

A revisão comercial sinaliza contratos vencidos, trials sem data e trials com
mais de 30 dias. O limite de trial é apenas um critério de revisão, sem cobrança
ou suspensão automática. A auditoria por localização fica em
`billing_automation_runs/{run}/locations/{locationId}`.

As versões vigentes são independentes por plataforma. Consulte [`versions.json`](versions.json) e as fontes em [`release-notes/`](release-notes/) em vez de copiar números de versão para documentação secundária.

## Arquitetura

| Camada | Tecnologia | Código principal |
| --- | --- | --- |
| Web | React 18, TypeScript, Vite 8, MUI 5, TanStack Query | [`web/`](web/) |
| Android | Kotlin, Jetpack Compose, Koin, Coroutines/Flow | [`app/`](app/) |
| Compartilhado | Kotlin Multiplatform para domínio, modelos e validadores | [`shared/`](shared/) |
| iOS/CMP | Host iOS + Compose Multiplatform | [`iosApp/`](iosApp/), [`composeApp/`](composeApp/) |
| Backend | Firebase Auth, Firestore, Storage, FCM, App Check e Cloud Functions v2 | [`functions/`](functions/) |
| Segurança de dados | Firestore/Storage Rules e testes de regras | [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules), [`firestore-rules-tests/`](firestore-rules-tests/) |

Fronteiras importantes:

- A Web não consome o módulo KMP `shared`; usa hooks, contexts e serviços Firebase próprios.
- `functions/` é o backend serverless em produção.
- `archive/backend/` é um backend Express/TypeORM arquivado e sem consumidores. Não desenvolva nele sem nova spec e decisão arquitetural explícita.
- Alterações de CPF precisam manter Functions, Web e KMP sincronizados.
- Alterações de XP precisam manter `shared/xp-constants.json`, Functions, Web,
  KMP e Android sincronizados; o backend é a única autoridade de persistência e
  `xp_logs` permanece agregado por jogo+jogador.
- O Live Game usa Cloud Functions transacionais para registrar/reverter eventos e
  listeners Firestore para distribuir placar, timeline, estatísticas e votação;
  clientes não escrevem diretamente nas coleções derivadas.
- Mudanças no Live Game devem preservar idempotência por `requestId`, bloquear
  eventos durante a finalização e passar o teste multi-cliente em
  `firestore-rules-tests/src/live-realtime.test.ts`.

O mapa completo está em [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md).

## Pré-requisitos

| Ferramenta | Uso |
| --- | --- |
| Git + acesso ao repositório | Clone, branches e PRs |
| Node.js 22 | Web, Functions e scripts; versão definida em [`.nvmrc`](.nvmrc) |
| JDK 21 | Build Android/Gradle e emuladores Firebase atuais |
| Android Studio + SDK 36 | Desenvolvimento Android (`minSdk 24`, `targetSdk 35`) |
| Firebase CLI | Emuladores e deploy autorizado |
| FFmpeg 8.1.2+ | Smoke local dos processadores de vídeo; produção usa artefato pinado |
| Xcode | Desenvolvimento e validação do host iOS |

Use instalações LTS e os lockfiles do repositório. Para JavaScript, prefira `npm ci`; não atualize dependências implicitamente durante o setup.

## Início rápido

```bash
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas
nvm use
```

### Web

```bash
cd web
cp .env.example .env.local
# Substitua a configuração pelo ambiente autorizado; não reutilize produção por padrão.
npm ci
npm run dev
```

A aplicação abre em `http://localhost:5173`. O build valida variáveis obrigatórias antes de compilar:

```bash
npm run lint
npm test
npm run build
```

### Android

```bash
cp app/google-services.json.example app/google-services.json
# Configure MAPS_API_KEY em local.properties sem commitar o arquivo.
./gradlew :app:compileDebugKotlin
./gradlew :app:assembleDebug
```

Use um `google-services.json` autorizado para fluxos Firebase reais. O arquivo de exemplo serve apenas como modelo local.

### Cloud Functions

```bash
cd functions
npm ci
# macOS: `brew install ffmpeg`; Linux/Cloud Build: artefato pinado pelo script abaixo.
npm run install:ffmpeg
npm run build
npm run lint
npx jest --no-coverage
npm run serve
```

O comando `serve` inicia o emulador de Functions. Consulte [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) para configurar o conjunto completo de emuladores e credenciais.

## Validação por escopo

Execute primeiro o menor gate que cobre a mudança; antes de um PR, rode o gate completo das plataformas afetadas.

| Escopo | Comandos mínimos |
| --- | --- |
| Web | `cd web && npm run lint && npm test && npm run build` |
| Functions | `cd functions && npm run build && npm run lint && npx jest --no-coverage` |
| Android | `./gradlew :app:compileDebugKotlin && ./gradlew :app:testDebugUnitTest` |
| Android completo | `./gradlew :app:assembleDebug && ./gradlew lint && ./gradlew detekt` |
| Firestore Rules | `cd firestore-rules-tests && npm ci && npm test` |
| Scripts do repositório | `npm run test:scripts` |
| Realtime multiusuário | `npm run test:load:realtime -- --profile 10` com Firestore Emulator |

Testes E2E e de performance possuem requisitos adicionais. Use [`docs/QA_SMOKE_MATRIX.md`](docs/QA_SMOKE_MATRIX.md) como fonte do gate de release.

O harness realtime simula 10, 100 ou 1.000 sessões concorrentes, mede p50/p95/p99,
erros e invariantes de fan-out, contenção e escritas distribuídas. Ele bloqueia
explicitamente qualquer host que não seja local: nunca execute carga contra o
Firestore de produção. O CI roda 10 sessões em PRs; os perfis maiores ficam no
workflow agendado/manual `Realtime load CI`.

## Estrutura do repositório

```text
app/                    Android nativo
shared/                 domínio e modelos KMP
composeApp/             UI Compose Multiplatform
iosApp/                 host iOS
web/                    aplicação React/PWA
functions/              Cloud Functions em produção
firestore-rules-tests/  testes de autorização e integridade
docs/                   documentação operacional
specs/                  specs e decisões técnicas
scripts/                automações, migrações e validadores
release-notes/          fontes das notas por plataforma
.github/workflows/      CI, segurança, release e automações
archive/backend/        backend legado arquivado
```

## Fluxo de desenvolvimento

1. Sincronize `master` e crie uma branch curta; não trabalhe diretamente na branch protegida.
2. Verifique se já existe issue ou PR para o mesmo problema.
3. Use uma spec em [`specs/`](specs/) quando o trabalho exigir decisão de produto, regra ou arquitetura.
4. Implemente com testes e valide todas as plataformas afetadas.
5. Use [Conventional Commits](https://www.conventionalcommits.org/) e abra um PR com impacto, causa, validação e riscos.
6. Faça squash merge somente com CI verde e os requisitos de revisão atendidos.

Detalhes: [`CONTRIBUTING.md`](CONTRIBUTING.md), [`AGENTS.md`](AGENTS.md) e [`docs/AGENT_OPERATING_MODEL.md`](docs/AGENT_OPERATING_MODEL.md).

## Releases e deploy

Mudanças visíveis aos usuários exigem versionamento e rastreabilidade completos:

1. Atualize a plataforma por `node scripts/bump-version.js <platform> <patch|minor|major>`.
2. Crie `release-notes/<platform>/<version>.md`.
3. Rode `node scripts/release-notes.js validate`, `changelog` e `bundle`.
4. Valide, abra PR, aguarde CI e faça squash merge.
5. Implante somente a plataforma afetada a partir do commit integrado em `master`.
6. Publique tag e GitHub Release e verifique a superfície ao vivo.

Não faça deploy silencioso nem publique a partir de checkout destacado, árvore suja ou branch não integrada. Processo completo: [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md).

No Android, `release.yml` cria o GitHub Release anexando AAB/APK diretamente do
workspace, enquanto `deploy-production.yml` cuida exclusivamente do Play
Internal. Artefatos de CI têm retenção padrão curta; releases publicadas são a
fonte durável para binários de distribuição.

## Segurança e configuração

- Nunca commite `.env`, `local.properties`, credenciais, keystores ou configurações Firebase privadas.
- Não publique vulnerabilidades em issues públicas. Siga [`SECURITY.md`](SECURITY.md).
- Prefira emuladores e dados de teste; ações em produção exigem autorização explícita.
- Mantenha Secret Scanning, validação de segredos e Push Protection habilitados
  no GitHub; um push bloqueado deve ser corrigido, não contornado com credencial real.
- Use chaves Firebase de cliente separadas por plataforma: Browser restrita aos
  domínios autorizados e Android restrita ao package name e certificados SHA-1.
  Embora essas chaves apareçam no cliente, nunca deixe suas restrições abertas.
- Escritas Firestore devem validar entrada, tratar erro e usar timestamps do servidor; operações multi-documento devem ser atômicas.
- CodeQL, Semgrep, regras Firebase e CI complementam a revisão humana, mas não substituem testes do fluxo real.

## Documentação

| Documento | Finalidade |
| --- | --- |
| [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md) | Pastas, fronteiras e comandos principais |
| [`docs/LLM_WORKSPACE_GUIDE.md`](docs/LLM_WORKSPACE_GUIDE.md) | Ordem de leitura e fontes de verdade para agentes |
| [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) | Jogos, XP, ranking e regras de domínio |
| [`docs/MONTHLY_FINANCE.md`](docs/MONTHLY_FINANCE.md) | Mensalistas, recorrência, feriados, baixa e estorno |
| [`docs/LOCATION_TIMEZONES.md`](docs/LOCATION_TIMEZONES.md) | Fusos IANA, horários overnight e backfill de locais |
| [`docs/operations/GROUP_WALL_MEDIA_PIPELINE.md`](docs/operations/GROUP_WALL_MEDIA_PIPELINE.md) | Mural, mídia, FFmpeg, retries, escala, IAM e rollback |
| [`docs/QA_SMOKE_MATRIX.md`](docs/QA_SMOKE_MATRIX.md) | Gates de regressão e release |
| [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md) | Versionamento, notas, tags e deploy |
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Setup detalhado por plataforma |
| [`specs/DECISIONS.md`](specs/DECISIONS.md) | Decisões arquiteturais vigentes |

## Contribuição e licença

O acesso ao código é restrito. Colaboradores autorizados devem seguir [`CONTRIBUTING.md`](CONTRIBUTING.md), a proteção de `master`, CODEOWNERS e os checks obrigatórios.

Distribuído sob a [licença MIT](LICENSE). © Tech Fernandes Ltda.
