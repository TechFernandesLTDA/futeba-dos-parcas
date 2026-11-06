# DIAGNÓSTICO do Futeba dos Parças

Fase 2 da missão "modernizar sem mudar a essência". Data: 04/11/2026. Base: `master` em `5d9be25e` (web 1.61.1, functions 1.15.1, Android 1.42.0 vc 83 aguardando a loja, iOS 1.6.1).

Este documento **só registra**: nada foi corrigido aqui. As regras de negócio e as telas estão no `ESSENCIA.md`; o que fazer com cada achado vai para o `PLANO.md`.

## Como ler

- **Severidade:** 🔴 alta (quebra para o usuário, risco de loja, de segurança ou de dado); 🟠 média (dívida que já atrapalha ou vai atrapalhar em breve); 🟡 baixa (limpeza).
- **Toca a essência?** "Sim" quer dizer que corrigir muda **o que** o app faz e depende de uma decisão sua (D1 a D14 do `ESSENCIA.md`, seção 9). "Não" quer dizer que muda só **como** é feito.
- Toda afirmação tem arquivo e linha, ou o comando que a produziu.

---

## 1. Resumo em uma tela

| Área | Situação | Pior achado |
|---|---|---|
| Produção (web + functions) | Saudável, publicada e verificada | nenhum |
| Android | Release 1.42.0 gravada, a página na loja dá 404 (#4499) | serviço Android Auto exportado sem classe |
| iOS | Casca funcional, longe da paridade | 30 rotas do Android ausentes; detalhe do grupo quebrado |
| Regras de negócio | Coerentes no servidor, divergentes nos clientes | sorteio do Android só embaralha e pode incluir quem não confirmou |
| Segurança | 0 vulnerabilidade de produção | `challenge_progress` gravável pelo cliente sem teste |
| Testes | Bons em functions, rules e web; fracos no app | 429 de 558 arquivos do app sem teste |
| Código morto | Muito | 12 telas Android prontas e inalcançáveis (~10,9 mil linhas) |
| Dependências | Em dia nas minors; atrasadas nas majors | ESLint 8 (fim de vida) na web |
| Ambiente | Mac ok | resíduos do Windows e um runner Windows offline registrado |

---

## 2. Bugs reais (o usuário percebe)

| # | Sev. | Achado | Onde | Toca a essência? |
|---|---|---|---|---|
| B1 | 🔴 | O "Gerar Times" do Android só embaralha os jogadores, ignora a opção `balanceTeams` e **inclui quem está PENDING** | `GameTeamRepositoryImpl.kt:28-109`, `FirebaseDataSource.kt:230-236` | Sim (D1) |
| B2 | 🟠 | Quem sobe para os níveis 11 a 20 recebe a notificação "Nivel N", sem o nome do nível | `functions/src/notifications/achievement-notifications.ts:99-103` (só 11 nomes) | Não: os nomes dos níveis 11 a 20 (Garrincha … Pelé) já estão em `shared/xp-constants.json:114-123`; basta a notificação ler a tabela |
| B3 | 🟠 | iOS: o detalhe do grupo é inalcançável e, se aberto, usa o id do jogo como id do grupo | `composeApp/.../App.kt:616` | Não |
| B4 | 🟠 | iOS: Ranking, Badges e Locais existem como rota mas nenhum botão leva até elas | `composeApp/.../App.kt` | Não |
| B5 | 🟠 | Badge `streak_7` lê `users.current_streak`, mas o streak vive em `user_streaks`: provavelmente nunca é concedida | `functions/src/badges/` | Não (é corrigir para fazer o que já promete) |
| B6 | 🟠 | Lista paginada de jogos em cache mostra `confirmedCount = 0` | `CachedGamesPagingSource` | Não |
| B7 | 🟠 | Estatísticas com métricas fixas em 0 | modelo `Statistics` (app) | Não |
| B8 | 🟡 | `UserExtensions.kt:63-66` responde "tem permissão" sempre (FIXME) | app | Sim: apertar a checagem muda quem consegue fazer o quê; precisa de aprovação depois de mapear quem chama |
| B9 | 🟡 | iOS: botão "Entrar com Google" falso e "Esqueci a senha" sem ação | `composeApp` | Não |
| B10 | 🟡 | Empates no ranking: o leaderboard desempata por `user_id`, a liga por XP→pontos→nome, e "Mito"/liga do grupo não desempatam | `leaderboard-cache.ts:1596-1601` | Sim (D7) |

## 3. Riscos de loja, segurança e privacidade

| # | Sev. | Achado | Onde |
|---|---|---|---|
| R1 | 🔴 | O manifesto declara um `CarAppService` **exportado** (`.auto.FutebaAutoService`), mas a classe não existe: o arquivo só tem dois `data class` e comentários. O Play pode recusar (apps para carro passam por revisão própria) e o sistema falha ao tentar abrir o serviço. **Pode ser a causa do R2**: vale olhar no Play Console se há aviso de Android para carros | `app/src/main/AndroidManifest.xml:213-222`, `app/.../auto/FutebaAutoService.kt` |
| R2 | 🔴 | O app não aparece na loja apesar da release 1.42.0 gravada | issue #4499 (precisa de você no Play Console) |
| R3 | 🔴 | Política de privacidade de 12/2025 não cobre CPF, GPS, mensagens, mídia e pagamentos | issue #4392 |
| R4 | 🔴 | `challenge_progress` pode ser gravado pelo cliente, sem teste de rules (FIXME no próprio arquivo) | `firestore.rules:4093` |
| R5 | 🟠 | FIXME de PII nas rules | `firestore.rules:768` |
| R6 | 🟠 | `client_secret` OAuth literal num script | issue #4343 (você decidiu não trocar agora) |
| R7 | 🟠 | Widget usa `<View>`, que não é suportado em RemoteViews (o widget pode mostrar "Problema ao carregar") | `app/src/main/res/layout/widget_next_game.xml:46,87` |
| R8 | 🟠 | Vazamento de Context em campo estático | `RankingViewModel:37`, `StatisticsViewModel:21`, `SmartImageCache:327` (Android Lint StaticFieldLeak) |
| R9 | 🟠 | `RestrictedApi` em 11 pontos do `DynamicThemeEngine` (API interna que pode sumir numa atualização) | Android Lint |
| R10 | 🟡 | 28 de 99 coleções sem teste de rules | `firestore-rules-tests/` |
| R11 | 🟡 | App Check em modo permissivo nas functions (o `CLAUDE.md` promete ligar "na semana 2") | `functions/src/` |
| R12 | 🟡 | Search Console sem acesso de proprietário | issue #4455 |

## 4. Regras de negócio duplicadas ou divergentes

A fonte da verdade do XP é `shared/xp-constants.json`. O servidor (`onGameStatusUpdate`) é quem paga. Os clientes só exibem, mas exibem coisas diferentes:

| # | Sev. | Achado | Onde | Toca a essência? |
|---|---|---|---|---|
| N1 | 🔴 | **Cinco algoritmos de sorteio**, com notas diferentes. Em uso: web (nível derivado do XP) e Android (embaralhar). Sem uso: `BalancedDrawAlgorithm`, `GreedyTeamBalancer`, `GeminiTeamBalancer` (não chama IA), `EnhancedTeamBalancer` | ver `ESSENCIA.md` 3.7 | Sim (D1) |
| N2 | 🟠 | Limites das divisões fixos no código, mesmo importando o JSON | `functions/src/league.ts:326-328`, `web/src/.../gamification.ts:411-413` | Não |
| N3 | 🟠 | Três catálogos de badges: app 51, web 44, shared 24 (sem consumidor) | app, web, `shared` | Sim (D3) |
| N4 | 🟡 | `XPCalculator.kt` do app sem STREAK_5, mas só é chamado pelo `processGameLegacy`, que está morto | `app/.../domain/ranking/XPCalculator.kt` | Não |
| N5 | 🟡 | Documentação com valores errados: tabela de XP do `CLAUDE.md`, skill `futeba-xp-validate`, `docs/BUSINESS_RULES.md`, comentários `applyVotingXpDelta` e `LeagueDivision.kt:15` | ver `ESSENCIA.md` 8 | Não |
| N6 | 🟡 | `mvp-voting.test.ts` usa um `LEVEL_TABLE` antigo e `MAX_XP_PER_GAME: 100` | functions/test | Não |

## 5. Testes

| Módulo | Testes | Arquivos sem teste | Observação |
|---|---|---|---|
| functions | 137 suítes | 26 módulos | bom; `bonus-rules`, check-in e ranking semanal cobertos |
| firestore-rules-tests | 65 | 28 coleções | bom |
| web | 352 unitários + 11 e2e | ~72 de ~453 | `typecheck:test` dá **122 erros** e não roda no CI |
| app (Android) | 93 unitários + 18 instrumentados | 429 de 558 | fraco |
| shared (KMP) | 24 + 7 iOS | 119 de 203 | fraco |
| composeApp (iOS) | 1 | quase tudo | sem source set de testes (#4433) |
| iosApp | 6 | | |

Regras importantes **sem teste**: fórmula completa do pipeline de XP no `onGameStatusUpdate` (função de ~1460 linhas), streak, milestones, todos os balanceadores do Android.

**Testes instáveis na web:** falham conjuntos diferentes quando a máquina está carregada. Causa: `testTimeout` padrão de 5 s, `asyncUtilTimeout` de 1 s, nenhum fake timer, e o teste de paginação leva 2,7 s sozinho.

## 6. Qualidade estática

| Ferramenta | Resultado | Problema |
|---|---|---|
| ESLint functions | 0 erros, 17 avisos | os 17 são `eslint-disable` sem uso |
| ESLint web | 0/0 | o override de `src/pages` **desliga** as regras R1 e R2 do próprio projeto; ligadas, aparecem R2=1, R3=21 (Container cru), R4=42 (maxWidth numérico) |
| tsc web e functions | ok | |
| Detekt | 31 achados novos, 77 no baseline, `maxIssues` 80 | **`shared` e `composeApp` não são analisados** (NO-SOURCE, 302 arquivos) |
| Android Lint | 3553 erros | 3456 são MissingTranslation (en/es com 568 de 4023 strings); 73 `LocalContextGetResourceValueCall`, 9 `NonObservableLocale`; baseline de 1889 entradas, 261 obsoletas |
| Cores e textos fixos | app: 74 `Color(0x…)` (~49 em telas órfãs) e 40 `Color.White/Black`; web: 92 hex (~82 em `pages/growth`); 23 `Text("…")` literais | contra as regras do próprio repo |

## 7. Código morto e arquivos gigantes

**Telas Android prontas e inalcançáveis (nenhuma rota as abre):** TeamFormation 1723 linhas, LocationSelector 1641, AvatarCustomizer 1194, WeeklyRecap 1164, VoteResult 774, PostGameReport 768, GlobalSearch 668, LocationMetrics 556, GameFinancialDashboard 504, OwnerStats 421, PublicGamesMap 357, BlockedPlayers 283. Total ~10,9 mil linhas. Algumas são funcionalidades que o produto parece querer (bloquear jogador é exigência de loja no iOS, #4423). **Ligar ou remover cada uma é decisão sua** (regra zero).

**Outros sem uso:** rotas `InviteFriend`, `DreamTeam`, `GroupChallenges`; `MatchFinalizationService.processGameLegacy`; `EditGameUseCase`; 12 classes do `shared`; nas functions, `admin-notifications`, `fake-notifications`, `rate-limiter.example`, `migration-example`, `parallel-processing` (só sobra `resetXpRateLimit`, sem efeito) e `xp/processing.ts` (só o teste usa). Room v6: tabelas `users`, `groups` e search sem consumidor. Pix do Android: o `PaymentBottomSheet` não está ligado, usa Pix simulado e geraria o QR em `api.qrserver.com`, mandando o payload para um terceiro (`PaymentRepositoryImpl.kt:51-62`); vira risco só se for ligado assim.

**Arquivos grandes demais para manter com segurança:**

| Arquivo | Linhas |
|---|---|
| `firestore.rules` | 4697 |
| `app/.../FirebaseDataSource.kt` | 4326 |
| `functions/src/location-management.ts` | 3624 |
| `functions/src/index.ts` | 2955 (`onGameStatusUpdate` sozinho em `:404-1863`) |
| `web/.../CreateGameScreen` | 2833 |

Outros FIXMEs: `AppDatabase` com `exportSchema=false` (migrações do Room sem histórico verificável), `leaderboard-cache.ts:1380` faz a mesma consulta duas vezes.

## 8. Dependências

- **Produção:** 0 vulnerabilidades (web, functions).
- **Desenvolvimento:** web 8 moderadas + 8 altas; functions 5 baixas + 27 moderadas. Os 6 alertas do Dependabot são de dev ou de `archive/backend`.
- **Majors atrasadas (web):** MUI 5→9, x-date-pickers 6→9, React 18→19, Firebase 12→13, TypeScript 5→7, **ESLint 8→10 (o 8 está fora de suporte)**, Vitest 4→5, date-fns 3→4, eslint-plugin-react-hooks 4→7.
- **Majors atrasadas (functions):** firebase-admin 13→14, TypeScript 5→7.
- **PRs de major abertas do Dependabot:** #4456 (TS 7 functions), #4459 (gradle), #4460 (actions), #4463 (rules-tests), #4465 (web, 6 pacotes). Nenhuma deve entrar sem passo próprio no plano: são trocas de biblioteca central.
- **Android e KMP:** toolchain em dia (Kotlin 2.4.21, AGP 9.4.1, Gradle 9.8.0, CMP 1.10.3). Atrasados: Compose BOM 2025.09.01 (~14 meses), Firebase BoM 33.7.0→35.1.0, Vico 1.14→3.3 (gráficos, API nova), Retrofit 2.9→3.0, todos na #4459.

## 9. Desempenho da web

- Bundle total de 5,0 MB; o boot baixa ~2,1 MB.
- O `index` importa de forma estática os idiomas do i18n (443 KB), `@mui/icons-material` e `firebase/functions` e `firebase/storage`, apesar do código tentar adiar.

## 10. iOS

- 24 rotas no `composeApp`; 30 rotas do Android não existem no iOS.
- Sem deep links nem universal links (#4426).
- Faltam fluxos centrais: criar jogo (#4437), confirmar presença (#4434), lista de espera (#4435), votação (#4436), bloquear e denunciar (#4423, exigido pela App Store).
- Sem conta Apple de publicação (#4395, depende de você).

## 11. Ambiente, CI e resíduos do Windows

- Runner `futeba-windows-local` registrado no GitHub e offline. Os do Mac e o `oci-prod01` estão online.
- `app/build.gradle.kts:146,158-164`: caminho `C:/TEMP` atrás de um guard de Windows (código morto no Mac).
- `gradle.properties:56-57`: `android.overridePathCheck=true`, que só existia por causa do "ç" no caminho do Windows.
- Documentação de runner WSL obsoleta: `CLAUDE.md:153`, `docs/ci/wsl2-self-hosted-runner.md`, `docs/CI_RUNNERS.md:131-193`, `scripts/SELF_HOSTED_RUNNER.md`, `AGENTS.md:136-137`.
- No sentido inverso, `firestore-rules-tests/package.json:8,10` fixa o `JAVA_HOME` do Homebrew do Mac (quebra em qualquer outra máquina).
- `CLAUDE.md` com versões e tabela de XP desatualizadas e caminhos que não existem (`NavDestinations.kt`, `routes/AppRoutes.kt`).
- Fora do repo: o plugin context-mode exige Node ≥24.15 e o mise usa Node 22 (o hook bloqueia leituras grandes). É configuração gerenciada pelo chezmoi, então fica com você.

## 12. O que está bom (não mexer sem motivo)

- Servidor como única autoridade do XP, com tabela compartilhada em JSON.
- Rules com 65 suítes de teste e Custom Claims.
- Pipeline de release com notas por plataforma, tags e gates de CI.
- KMP com Compose Multiplatform: a stack é madura e já roda em Android e iOS. A recomendação do `ESSENCIA.md` (Apêndice A) é **não migrar para Expo**.
