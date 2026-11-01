# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

> O bloco entre os marcadores `AUTOGEN` abaixo é **gerado automaticamente** a
> partir de `release-notes/<plataforma>/<versão>.md` por
> `node scripts/release-notes.js changelog`. **Não edite esse bloco à mão** —
> edite os arquivos-fonte. Versões anteriores à adoção do sistema (2026-05-22)
> estão preservadas em "Histórico anterior", mais abaixo.

## Unreleased

Mudanças já na `master` que ainda não saíram nas lojas. Entram nas notas da próxima versão de cada plataforma.

### iOS (próxima versão após 1.8.0)
- App abre no simulador, exclusão de conta pela callable `deleteAccount` e ajustes de prontidão para a App Store (#4421).
- Exclusão de conta distingue grupos sem dono de login antigo (#4442).

### Repositório e CI
- Repositório público com ruleset na `master` (PR, squash, 5 checks), aprovação para PRs de fork e secret scanning (#4394).
- Runners self-hosted no Mac e no prod-01; versões do projeto fixadas com mise (#4387).

<!-- AUTOGEN:START -->

## Android

### [1.42.0][android-1.42.0] - 2026-11-01

#### Mudado
- APK de 55 para 14 MB, startup mais leve e dependências mortas removidas (#4412).
- `androidx.datastore` 1.2.0 → 1.3.0: a `libdatastore_shared_counter.so` passa a ser compilada com o NDK r27, como a Play pede para 16 KB (#4475).

#### Corrigido
- R8: a regra `-keep class com.futebadosparcas.shared.**` não casava com nenhuma classe, e 22 modelos de `domain.model` lidos por `toObject()` eram renomeados ou removidos no release. Agora `domain.model.**` é mantido, e o teste `FirestoreReflectionKeepRulesTest` impede a regressão (#4410, #4471).
- Exclusão de conta pela callable `deleteAccount`, com reautenticação e grupos sem dono (#4391, #4438).
- Exclusão de vídeo de jogo não para quando a miniatura falha (#4413, #4472).

_Issues: #4391, #4410, #4413 · PRs: #4412, #4438, #4471, #4472, #4475_

### [1.41.0][android-1.41.0] - 2026-10-12

#### Adicionado
- Seletor de quadras por cidade atual com ordenação por últimos jogos e busca inteligente (#4371, #4373).
- Guardas de CI para a Play: `scripts/ci/check-16kb-alignment.js` (ELF/zipalign 16 KB do AAB/APK no `deploy-production.yml` e no `release.yml`) e `scripts/ci/play-requirements-contract.test.js` (`targetSdk` mínimo e `compileSdk >= targetSdk`) (#4384).

#### Mudado
- targetSdk 36 (Android 16), exigido pela Google Play para publicar atualizações; compileSdk 37 (#4253).
- Migração da toolchain Android (#4265): Kotlin 2.4.20, KSP2 e Room 2.8.5 (etapa 2, #4357); Ktor 3.6.0, coroutines 1.11, serialization 1.11 e datetime 0.8 (etapa 3, #4366); androidx core 1.19, navigation 2.10 e lifecycle 2.11 (etapa 4a, #4369). A etapa 4b (iOS/CMP) segue bloqueada sem Mac.
- Edge-to-edge com `enableEdgeToEdge()` em Main/Login/Register; removidos `statusBarColor`/`navigationBarColor` (obsoletos na API 35) do tema Compose e dos `themes.xml` (#4384).

#### Corrigido
- `libdatastore_shared_counter.so` desalinhada em 16 KB: `keepDebugSymbols` impede o `strip` do AGP de reescrever a biblioteca prebuilt (#4384).
- Tela Sobre não encerra a Activity quando não há app para tratar o Intent (#4376, #4378).

_Issues: #4265, #4371, #4376 · PRs: #4253, #4357, #4366, #4369, #4373, #4378, #4384_

### [1.40.0][android-1.40.0] - 2026-10-01

#### Adicionado
- `refreshCurrentLocation` via callable `updateMyLocation` antes de `discoverNearbyPlayers` (#4123).
- Intent-filter `FLUTTER_NOTIFICATION_CLICK` na SplashActivity + `default_notification_channel_id` no manifest + `copyPushExtras` para deep link de jogo (#4140).
- `BadgeCatalog` local com todos os IDs gravados pelas Cloud Functions (milestones UPPERCASE, ambassador, mito_rodada, mvp_liga) (#4138).
- `BatchOperationHelper.parallelGetByIds` para leitura unitária em vez de `whereIn(documentId)` (#4126).
- `LegacySmartReminderCleaner` cancelando alarmes WEEKLY_RECAP/STREAK_CHECK legados no boot (#4142).

#### Mudado
- targetSdk 35 → 36 (Android 16), exigência da Google Play para atualizações; compileSdk já era 36.
- `DirectMessagesRepository.sendMessage` via callable `submitDirectMessage` (#4119).
- `checkTimeConflict`/`getGamesByFieldAndDate` via callable `getFieldAvailability` (janela D-1..D, `excludeGameId` server-side); `TimeConflict` sem `Game` inteiro (#4127).
- `getUpcomingGames`/Flow com `whereIn visibility`; `getGamesByGroup` mantém constraint de grupo (#4126).
- `cancelConfirmation`/`removePlayerFromGame` no KMP shared trocam delete por update→CANCELLED (#4144).
- `SetupSystemBars` removido (SideEffect do FutebaTheme é a única fonte de system bars) (#4125); `BackHandler` raiz removido (#4149).
- `KeyboardOptions(capitalization = Sentences)` em campos de texto livre de 6 telas (#4137).

#### Corrigido
- Preço com vírgula normalizado antes de `toDoubleOrNull` (#4136).
- Streak server-side com janela de 8 dias e mesmo dia sem incremento (#4150).
- `ic_notification` silhueta monocromática (#4141).

_Issues: #4096, #4097, #4098, #4099, #4108, #4109, #4119, #4120, #4125, #4127, #4136, #4137, #4138, #4140, #4141, #4142, #4145, #4146, #4149, #4150 · PRs: #4118, #4153, #4154, #4155, #4157, #4159, #4161_

### [1.39.5][android-1.39.5] - 2026-08-28

#### Adicionado
- `DivisionColors` centraliza tokens de identidade e foreground por tema para as quatro divisões.
- `AndroidGameWaitlist` adapta o schema snake_case do Firestore e normaliza timestamps.
- Testes parametrizados cobrem contraste AA das divisões nos temas claro e escuro (e alto contraste no badge).

#### Mudado
- `WaitlistRepositoryImpl` usa `joinGameWaitlist` e deixa criação, posição e timestamps autoritativos no backend.
- League ranking e componentes de estatísticas compartilham o modelo de `LeagueDivision` e os tokens centralizados.
- `DivisionColorsTest` valida contra os tokens reais do `ColorScheme`, não literais de alto contraste.

#### Removido
- Métodos client-side mortos de waitlist (`promoteNextInLine`/`notifyNextInLine`/`updateWaitlistStatus`).
- 18 símbolos sem caller em `Gradients.kt` e a pintura de gradiente ocluída em `GroupsScreen`.
- `colorHex` morto do enum `LeagueDivision` (fonte única em `DivisionColors`).

#### Corrigido
- Contraste de Ouro, Prata, Bronze, Diamante e cartões de jogo corrigido sobre fundos reais.
- Writes client-authored de `queue_position` e datas da fila removidos do Android.
- Tokens dark de Bronze (`#EBC98F`) e Ouro (`#FFE45A`) e `MatchEventColors.RedCard` (`#C62828`) corrigidos para AA.

_Issues: #4063, #4064, #4065, #4066, #4067, #4068, #4069, #4070, #4071, #4084, #4085, #4088, #4089, #4090 · PRs: #4072, #4073, #4074, #4075, #4093, #4094_

### [1.39.4][android-1.39.4] - 2026-08-15

#### Adicionado
- `LocalIsDarkTheme` expõe o tema resolvido pelo app como fonte única.
- `GamificationTextColors` e `GamificationTextColorsDark` para uso como primeiro plano.

#### Mudado
- `ContrastHelper.getContrastingTextColor` compara as duas opções por razão de contraste em vez de limiar fixo.

#### Removido
- `ResponsiveTypography.kt` e `DynamicTypeHelper.kt` (667 linhas de código morto).

_Issues: #4037, #4059, #4060, #4061_

### [1.39.3][android-1.39.3] - 2026-08-08

#### Mudado
- `GameVideosRepository` usa a callable `createGameVideo` apos o upload no Storage.

#### Segurança
- URL, tamanho, tipo, autorizacao e idempotencia do video sao derivados ou validados no backend.

_Issues: #4024_

### [1.39.2][android-1.39.2] - 2026-08-01

#### Mudado
- `secondary` mobile: `#FF9600` → `#005FCC` (alinhado ao `palette.secondary.main` web).
- `tertiary` seed: `#FF6D00` (antes colapsava em secondary por ser null).
- `DefaultSeeds` em `ThemeConfig.kt`: constantes canônicas ARGB centralizadas.

#### Removido
- `FutebaLightColorScheme`, `FutebaDarkColorScheme` e 68 constantes `md3_*` privadas sem consumidores.

#### Corrigido
- `check-design-tokens-parity.js`: gate CI valida seeds vivas em vez de constantes mortas.

_Issues: #3934, #3933_

### [1.39.1][android-1.39.1] - 2026-07-20

#### Adicionado
- `Game.priceManualOverride`: novo campo no model KMP espelhando o Firestore.
- `Game.resolveExpectedPayment()`: método no model KMP que implementa a fórmula canônica de preço (espelha `web/src/utils/gamePayment.ts` e o callable `confirmGamePresence`).

#### Corrigido
- `GameFinancialDashboard` e `GameOwnerComponents` usavam `totalCost / confirmados`; agora usam `Game.resolveExpectedPayment()`.
- `PostGameReportScreen` usava `dailyPrice` cru; agora usa `resolveExpectedPayment()` e soma pagamentos parciais.
- `GameRepositoryImpl.confirmPlayerAsOwner` agora chama o callable `confirmPlayerAsManager` (antes fazia write direto bloqueado pelas rules).
- `FirebaseDataSourceImpl.cancelConfirmation`: `batch.delete()` → `batch.update({status:'CANCELLED'})`, restaurando o trigger `onGameVacancy` de promoção da waitlist.

_Issues: #3862_

### [1.39.0][android-1.39.0] - 2026-07-19

#### Adicionado
- Modelos mobile aceitam o breakdown agregado expandido mantendo compatibilidade com logs antigos.

#### Mudado
- Calculadores e fixtures Android/KMP foram alinhados aos valores canônicos server-authoritative.

#### Corrigido
- As duas árvores de recursos PT-BR permanecem sincronizadas e preservam placeholders.

_Issues: #3844, #3847, #3848, #3849, #3850, #3851, #3852, #3853, #3854, #3855, #3856_

### [1.38.1][android-1.38.1] - 2026-07-16

#### Adicionado
- Drawables `nodpi` RGBA para `ic_level_badge_11` a `ic_level_badge_20`.
- Teste de mapeamento dos dez recursos de níveis lendários.

#### Mudado
- `LevelBadgeHelper` usa referências compiladas diretamente, sem reflexão ou fallback indevido.

### [1.38.0][android-1.38.0] - 2026-07-14

#### Adicionado
- Android Verified App Links com Digital Asset Links, parser validado e suporte a cold e warm start.
- Histórico de busca persistente e pull-to-refresh integrados à arquitetura Compose.

#### Mudado
- Estados de presença, votação, navegação e loading passam a ser explícitos e testáveis no ViewModel/UI.
- Catálogos PT-BR, inglês e espanhol recebem os rótulos de enums e ações antes hardcoded.

#### Corrigido
- Touch targets, semantics, rotas mortas, callback de local e feedback de notificações foram corrigidos.

_Issues: #3600, #3602, #3603, #3604, #3617, #3618, #3619, #3620, #3622, #3624, #3627, #3630, #3631, #3632, #3633, #3634, #3635, #3636, #3637, #3638, #3639, #3640, #3641, #3642, #3643, #3644, #3645 · PRs: #3649, #3666, #3667, #3671, #3672, #3673, #3674, #3675, #3676_

### [1.37.0][android-1.37.0] - 2026-07-11

#### Adicionado
- `GroupWallMediaPipeline` com callable protegido por App Check de uso limitado, upload resumível e listener de estado.
- Validação por magic bytes, MIME real, limite de 10 MiB para imagens, 25 MiB para vídeos e 30 segundos de duração.
- ExoPlayer criado somente após interação, com poster acessível e sem download antecipado do vídeo.

#### Corrigido
- Modelo Android passa a mapear `thumbnail_url` publicado pelo backend.
- ViewModel mantém UUID estável durante retries recuperáveis e o reinicia apenas em estados terminais.
- Estados de progresso, cancelamento, processamento e erro ficam alinhados ao contrato compartilhado do Mural.

_Issues: #3518, #3519_

### [1.36.8][android-1.36.8] - 2026-07-11

#### Corrigido
- `ScheduleRepositoryImpl` converte explicitamente entre o modelo KMP e o modelo Android anotado com `@PropertyName`.

_Issues: #3529_

### [1.36.7][android-1.36.7] - 2026-07-10

#### Adicionado
- Telemetria realtime tipada, amostrada em até 5% e sem IDs, nomes, paths ou mensagens.

#### Corrigido
- Paginação com dedupe para feed, jogos públicos e locais; zero refetch por emissão no live game.
- Upload de perfil valida o payload comprimido abaixo de 2 MiB e preserva o formulário quando o envio falha.

_Issues: #3267, #3499, #3501, #3504, #3508, #3510 · PRs: #3511_

### [1.36.6][android-1.36.6] - 2026-07-10

#### Corrigido
- Biometria exige `CryptoObject` AES/GCM com chave auth-per-use no Android Keystore e invalidação por novo cadastro biométrico.
- Intents de FCM, notificações e alarmes são explicitamente limitadas ao pacote do aplicativo.
- Ranking usa `collectLatest` e aguarda o preenchimento paralelo do cache antes de emitir o estado de sucesso.

_Issues: #3497 · PRs: #3498_

### [1.36.5][android-1.36.5] - 2026-07-10

#### Corrigido
- Flows de placar, eventos e estatísticas propagam falhas para a UI em vez de substituí-las por valores vazios.
- O cliente não lista votos brutos; lê somente os documentos determinísticos do próprio eleitor e conclui via callable.
- Resultado da votação consome exclusivamente os agregados autoritativos e reações do documento do jogo.

_Issues: #3495 · PRs: #3496_

### [1.36.4][android-1.36.4] - 2026-07-09

#### Mudado
- Alinha `versionName` em 1.36.4 e `versionCode` em 67 no Android e em `versions.json`.

_PRs: #3378_

### [1.36.3][android-1.36.3] - 2026-07-09

#### Corrigido
- `InviteRepositoryImpl` remove escritas client-side de membership, `member_count`, espelho `users/{uid}/groups` e notificacoes de resposta.
- `GroupInvite` passa a mapear `updated_at`.

### [1.36.2][android-1.36.2] - 2026-07-08

#### Corrigido
- `LevelCalculator` passa a ser uma fachada sobre `LevelTable`.
- Defaults de `User`, `XpLog` e validacao de nivel foram alinhados para 0-20.
- Testes compartilhados e JVM foram atualizados para a curva canonica.

### [1.36.1][android-1.36.1] - 2026-07-05

#### Mudado
- `GroupWallRepository` observa posts recentes e fixados separadamente, deduplicando por `id`.
- Composer Android valida texto obrigatório antes de permitir envio.
- Bundles Android de release notes foram regenerados com correções técnicas.

#### Corrigido
- Posts fixados fora da janela dos 20 mais recentes deixam de desaparecer do topo.
- Cleanup cliente tenta remover `mediaPath` e `thumbnailPath` em falhas de escrita/remoção.

_Issues: #3265, #3266, #3267, #3271 · PRs: #3274, #3275, #3277_

### [1.36.0][android-1.36.0] - 2026-07-04

#### Adicionado
- Repositórios, ViewModels, telas Compose e rotas para DMs, follow, feed social, jogadores próximos, comentários e vídeos.
- `SocialReactionBar` reutilizável e integrações em mural, jogo e votação.
- Strings em `pt-BR`, `en` e `es` para as novas superfícies sociais.

#### Mudado
- `AppNavGraph`, módulos Koin, home e telas de jogo/perfil foram integrados ao épico social.
- `GameChatRepository` passou a ordenar desc + reverse local para evitar congelamento após 50 mensagens.
- `versions.json` e `app/build.gradle.kts` foram alinhados para Android 1.36.0, build 63.

#### Corrigido
- Mural Android acompanha o contrato de rules para pin/unpin e validação de mídia.

#### Segurança
- Fluxos Android dependem das novas rules/callables para DMs, follows, localização, vídeos e comentários.

_Issues: #3231, #3233, #3234, #3235, #3236, #3237, #3238, #3239, #3247, #3248, #3249 · PRs: #3258_

### [1.35.0][android-1.35.0] - 2026-07-04

#### Adicionado
- Repositórios, ViewModels, telas Compose e rotas para DMs, follow, feed social, jogadores próximos, comentários e vídeos.
- `SocialReactionBar` reutilizável e integrações em mural, jogo e votação.
- Strings em `pt-BR`, `en` e `es` para as novas superfícies sociais.

#### Mudado
- `AppNavGraph`, módulos Koin, home e telas de jogo/perfil foram integrados ao épico social.
- `GameChatRepository` passou a ordenar desc + reverse local para evitar congelamento após 50 mensagens.

#### Corrigido
- Mural Android acompanha o contrato de rules para pin/unpin e validação de mídia.

#### Segurança
- Fluxos Android dependem das novas rules/callables para DMs, follows, localização, vídeos e comentários.

_Issues: #3231, #3233, #3234, #3235, #3236, #3237, #3238, #3239, #3247, #3248, #3249_

### [1.34.0][android-1.34.0] - 2026-07-04

#### Adicionado
- Chat por jogo: `GameChatMessage.kt`, `GameChatRepository.kt`, `GameChatViewModel.kt`, `GameChatSection.kt` e testes `GameChatViewModelTest.kt`.
- Mural do grupo: `GroupWallPost.kt`, `GroupWallRepository.kt`, `GroupWallViewModel.kt`, `GroupWallScreen.kt`, `WallPostCard.kt`, `WallPostComposer.kt`.
- Rota `Screen.GroupWall` e navegação a partir do menu de `GroupDetailScreen`.
- Registro Koin em `RepositoryKoinModule` e `ViewModelKoinModule`.
- Strings em `pt-BR`, `en` e `es`.

_Issues: #3230, #3232_

### [1.33.0][android-1.33.0] - 2026-07-03

#### Adicionado
- Suporte Android a lifecycle e live operations via callable em `StartGameUseCase`, `FinishLiveGameUseCase` e camadas de repositório.
- Campos e mapeamentos de validação em `Game.kt`, `ModelMappers.kt` e fontes Firebase para refletir confidence score, review status e reward hold.

#### Mudado
- `GameDetailScreen`, `LiveGameViewModel`, `LiveEventsViewModel` e `LiveStatsViewModel` passaram a depender de fluxos server-side para ações sensíveis.
- `GameExperienceRepositoryImpl` e repositórios Firebase foram alinhados ao gate de XP e aos novos estados do jogo.

#### Corrigido
- Ajustes de compatibilidade entre Android, shared e Functions para evitar início/fim de jogo fora do contrato novo de validação.

#### Segurança
- O cliente Android deixou de depender de escritas diretas para estados críticos do jogo e passou a operar com backend auditável.

_Issues: #3208, #3209, #3211, #3213, #3214, #3215, #3216 · PRs: #3218_

### [1.32.2][android-1.32.2] - 2026-06-30

#### Mudado
- `Location` no Android e no KMP agora inclui campos comerciais, de conta de quadra e agregados de descoberta.
- Mappers Android/KMP preservam os campos monetizados nas duas direções.
- Desserialização Firestore do shared lê os campos comerciais e agregados usados pela web.
- Docs e matriz de QA registram o contrato cross-platform de quadras monetizadas.

_Issues: #3109, #3129 · PRs: #3166_

### [1.32.1][android-1.32.1] - 2026-06-28

#### Corrigido
- `CreateGameScreen` usa `KeyboardOptions` adequadas para campos numéricos.
- `NumberStepper` passa a exibir helper text com os limites aceitos.
- Recursos de string do fluxo de Criar Jogo foram atualizados para documentar ranges e exemplos.

### [1.26.0][android-1.26.0] - 2026-05-22

#### Adicionado
- Histórico de busca persistente e contadores na checklist de onboarding (#1413).

#### Mudado
- WeeklyRecap com tema dinâmico; GamificationColors consolidado (#1466).
- 3 telas migradas para AppTopBar; 3 TODOs do GameDetailViewModel reconectados (#1414).
- Logo padronizada entre Android e Web; contraste do perfil no dark mode (#1415).

#### Corrigido
- fontSize via MaterialTheme e overflow do hero no WeeklyRecap (#1480).
- TacticalBoard no dark mode; persistência do histórico de busca (#1413).
- Cashbox Android, getMyGroupsFlow, blockPlayer atômico e memory leaks.

_Issues: #1405, #1410, #1402, #1403, #1404, #1406 · PRs: #1480, #1466, #1415, #1414, #1413_

### [1.25.0][android-1.25.0] - 2026-05-17

#### Adicionado
- Onboarding moderno: welcome carousel + checklist gamificada, Fase 1 (#1295).

#### Mudado
- Gate anti-bot pós-login via VerificationGateViewModel (#1313).

#### Corrigido
- Saga de token refresh do CPF portada de web para Android (#1312).
- Falhas de CI: badge helper, testes desatualizados, avisos do detekt (#1286).

_Issues: #443, #1303, #1310 · PRs: #1295, #1313, #1312, #1286_

### [1.24.0][android-1.24.0] - 2026-05-11

#### Mudado
- Bump de versão de manutenção após a mega audit wave de 2026-05-11, sem mudanças funcionais no Android nesta tag.

## Web

### [1.60.0][web-1.60.0] - 2026-10-31

#### Adicionado
- `useDeleteAccount`, `deleteAccountErrors` e diálogos de reautenticação e de grupos bloqueantes, consumindo `details.reason` da callable `deleteAccount` (#4419).
- Links `apple-touch-startup-image` do tema escuro em 18 tamanhos com `prefers-color-scheme` (#4405).

#### Mudado
- `vh` → `dvh` em 14 pontos; toasts com `env(safe-area-inset-*)` (#4402).
- Alvos de toque de 48px (links de login, breadcrumb, skip link) e de 44px em `pointer: coarse` para chips, tabs e toggles (#4402, #4406, #4407).
- `AppLogo` em WebP (9,8 KB, antes PNG de 292 KB); og:image da home em JPEG 1200x630 de 240 KB (antes PNG de 1,2 MB) (#4402, #4404).
- Hero estático das guias públicas igual ao do React (`.pr-lead`, `leadStrong`, `heroCenter`), para o LCP ficar no HTML pré-renderizado (#4403).
- `GroupDetailScreen` consulta jogos em lotes de 9, dentro do limite de 10 leituras por query das novas rules (#4414).

#### Segurança
- Dependências: dompurify 3.4.17, undici 7.30.1, re2js 2.9.1, qs 6.17.1 e transitivas do lockfile (#4441, #4447, #4450).

_Issues: #4391, #4393, #4403, #4404, #4405, #4406, #4407 · PRs: #4402, #4414, #4415, #4419, #4441, #4446, #4447, #4450_

### [1.59.0][web-1.59.0] - 2026-10-12

#### Adicionado
- `utils/venueSearch.ts`: busca compartilhada (normalização sem acento, multi-termo, 1 erro de digitação em palavras com 5+ letras, prefixo, abreviações) usada no seletor, no mapa público e no admin (#4370).
- Seletor de quadras por cidade atual (geolocalização → quadra mais próxima, cidade do perfil, última cidade salva), consulta por `city`/`state` com cursor, sem o teto de `limit(200)` (#4370).
- Admin de quadras: cascata UF → cidade → bairro com contagens, filtros/busca/ordenação na URL, carga paginada por cursor, painel lateral (desktop) e bottom sheet (mobile), ações em lote publicar/verificar/desativar (#4372).

#### Corrigido
- Valor de XP do goleiro vinha fixo fora de `shared/xp-constants.json` (#4341).
- Rotas inexistentes respondiam com o shell indexável da home; agora saem `noindex` e sem canonical (#4327).
- i18n da tela de gestão de usuários (#4339).

_Issues: #4370, #4372, #4339, #4341, #4327_

### [1.58.1][web-1.58.1] - 2026-10-08

#### Mudado
- Boot adiado nas páginas públicas: o JS (entry + modulepreload) só começa a baixar depois do first-contentful-paint, via `boot-<hash>.js` externo e bloco JSON `boot-assets` (sem inline novo, exceto o guard da home) (#4196).
- Handoff do HTML prerenderizado (`src/utils/prerenderHandoff.ts`): o conteúdo estático fica em `#prerender` e o `#root` do React só aparece quando renderiza um `<h1>` (timeout de 10 s como rede de segurança), mantendo o LCP no HTML estático e sem CLS (#4196).
- Home (`/`) prerenderizada no shell com o hero da LaunchPage (textos conferidos por `prerenderParity.test.ts`). Guard inline (hash sha256 no CSP do `firebase.json`) desliga o estático fora de `/` e para quem tem sessão conhecida (`fdp:auth-hint`, gravada pelo `AuthContext`) (#4196).
- Poppins self-hosted (`web/public/fonts`, latin, `font-display: swap`, preload de 400 e 700) no lugar do CSS render-blocking do Google Fonts; logotipo do cabeçalho da landing em `logo-96.webp` (3,5 KB) no lugar do PNG de 292 KB (#4196).
- Chunking por `build.rolldownOptions.output.codeSplitting.groups` (`web/vite/chunkGroups.ts`): react/recharts/Firebase de serviços frios/MUI icons/i18n em grupos próprios, com teste `chunkGroups.test.ts` (vendor-mui de 605 KB para 450 KB) (#4196).
- `useResourcePreloading` só antecipa telas autenticadas quando há sessão (`prefetchRoutes`) (#4196).
- `.lighthouserc.cjs`: gate de performance mobile passa a bloqueante (0,85; meta 0,9, medida 91-97 no método de referência) (#4196).
- Lighthouse CI serve `dist` com `web/scripts/serve-dist.mjs` (replica o `firebase.json`: HTML prerenderizado por rota, rewrites, CSP); o `vite preview` ignorava `dist/<rota>/index.html` e media o shell SPA (#4196).

_Issues: #4196_

### [1.58.0][web-1.58.0] - 2026-10-07

#### Adicionado
- Rotas públicas `/organizar-pelada`, `/ranking-futebol-amador`, `/gestao-de-pelada`, `/como-funciona` e `/parcerias` (`web/src/pages/growth`) (#4197).
- `buildUtmUrl` em `utils/analytics.ts`, evento `partnership_inquiry_clicked` e novas páginas em `landing_viewed` (#4197).
- Metadados por rota em `seo/metadata.ts` (title, description, canonical, OG/Twitter, BreadcrumbList) e cartões `web/public/og/*.png` gerados por `scripts/generate-og-images.mjs` (#4196).
- Prerender estático pós-build (`scripts/prerender-public-pages.mjs`, dados em `prerender-routes.mjs`) com HTML indexável por rota, sem alterar o `index.html` da raiz (#4177).
- Testes `prerenderParity.test.ts` (prerender x metadata.ts e index.html x metadata.ts) e `growthPages.test.tsx` (copy verificável, UTMs, XP conforme `shared/xp-constants.json`).
- `docs/parcerias-quadras.md` com o programa de parcerias para quadras (#4197).

#### Mudado
- `WhatsNewDialog` passa de `Dialog` modal MUI para painel não-modal (`role="dialog"`, `aria-modal="false"`) com foco e Esc, para não marcar `<main>` com `aria-hidden` (#4189).
- `MobileTopBar` com links de breadcrumb de no mínimo 44x44 (#4190); guardas de rota extraídos para `utils/routeGuards.ts` com testes unitários e de mutação (#4191).
- `useInvitePlayers` não lê mais `groups/{id}` dentro da transação do convite; a validação do grupo fica no trigger `onInviteRedeemed` (#4209).
- `firestore.rules`: leitura do próprio doc em `groups/{id}/blocked_players/{uid}` liberada a qualquer usuário autenticado (#4209).
- `firestore.indexes.json`: `league_seasons.is_active` movido para `fieldOverrides` e quatro índices compostos de `games` implantados (#4215).
- `sitemap.xml` com as 6 URLs públicas e `robots.txt` bloqueando áreas autenticadas (#4177).
- `firebase.json` hosting com `trailingSlash: false` para que `/organizar-pelada` sirva o HTML prerenderizado sem redirecionar para `/organizar-pelada/`, igual ao canonical (#4177).
- `.lighthouserc.cjs` audita as 6 rotas públicas; a meta de performance 0.9 fica em `warn` porque o preset mobile ainda não a atinge (#4196).
- Hero da landing servido como `og-futeba-dos-parcas-hero.webp` (1000x525, 70 KB) com preload no `index.html`; o PNG de 1,2 MB segue só para OG/Twitter (#4196).
- Imports de ícones dos guias por caminho (`@mui/icons-material/X`), o que destrava os testes no vitest (o barrel travava o worker) (#4197).
- JSON-LD e OG description estáticos de `web/index.html` sincronizados com `seo/metadata.ts`; `operatingSystem` passa a `Web, Android`, pois o app iOS ainda não está publicado (#4187).

_Issues: #4177, #4196, #4197, #4187, #4185, #4189, #4190, #4191_

### [1.57.0][web-1.57.0] - 2026-10-01

#### Adicionado
- Callable `updateMyLocation` server-owner com cooldown de 10 min, checagem de plausibilidade e geohash calculado no servidor (#4123).
- Trigger `onDirectMessageDeleted` recalculando preview de chats após exclusão de mensagem (#4120).
- Espelho `user_badges` para badges de subcoleção (ambassador/mito_rodada/mvp_liga) + backfill `backfill-badges-mirror.ts` (#4138).
- Índices COLLECTION_GROUP `league_seasons.is_active` e compostos de games (deleted_at/status/visibility/dateTime, visibility/locationName) (#4128, #4126).
- 18 apple-touch-startup-images por modo/dispositivo (#4131).

#### Mudado
- Página Sobre com a chave i18n `about.aProductOf` (pt-BR, en, es) e CTAs da landing com `minHeight: 44` (#4181).
- `AppSidebar` com `aria-label` explícito nos botões de busca e criar jogo no rail colapsado (#4208).
- Rules de `games`: get/list em whitelist por acesso direto de campo (PUBLIC_OPEN/PUBLIC_CLOSED, owner, grupo); `create` exige `visibility` válido (#4126).
- Rules de `user_locations`: `create: if false` e `update` apenas para revogação — posição só via callable (#4123).
- Queries de LIST em games migradas para constraints server-side (useGames, usePublicGames, usePrefetchHome, SearchPanel, WeeklyRecap via confirmations) (#4126).
- `stripUndefinedValues` compartilhado preservando FieldValue/Timestamp/GeoPoint (#4147).
- theme-color passa a usar `background.default` (superfície M3) (#4132); status-bar PWA `default` + safe-area na landing (#4130).

#### Corrigido
- Confirmações removidas de grupo marcadas CANCELLED em vez de apagadas, disparando promoção de waitlist (#4144).
- Health check CHECK 5 sem query de 2 desigualdades (#4129).
- `onGameUpdatedNotification` compara dateTime normalizado com toMillis (#4143).
- Cancelamentos do sistema não enviam push "cancelado pelo organizador" (#4135).
- `removeGroupMembershipArtifacts` e cron da waitlist com gate de status do jogo (#4134, #4148).
- onUserDeleted com recursiveDelete de subcoleções e purge de user_locations (#4139, #4124).

_Issues: #4181, #4208, #4096, #4097, #4098, #4099, #4100, #4107, #4108, #4109, #4110, #4111, #4112, #4113, #4114, #4115, #4121, #4122, #4123, #4124, #4126, #4127, #4129, #4130, #4131, #4132, #4134, #4135, #4138, #4139, #4143, #4146, #4147, #4148 · PRs: #4118, #4151, #4152, #4154, #4155, #4156, #4158, #4159, #4160, #4161_

### [1.56.9][web-1.56.9] - 2026-08-20

#### Adicionado
- Callable `joinGameWaitlist` transacional e idempotente para atribuição server-authoritative de `queue_position`.
- Testes de contraste AA após composição de overlays e testes de contrato para tema e landing page.

#### Mudado
- `ThemeProvider` passa a aplicar `documentThemeOverride` também ao tema MUI e ao `CssBaseline`.
- `useWaitlist` remove writes client-authored de posição e timestamps, usando a callable e normalizando `Timestamp`, `Date` e epoch millis.
- CTA do hero usa a paleta da marca com fundo branco e texto `primary.dark`; brilho radial fica restrito a `md+`.

#### Corrigido
- Contraste de subtítulos, CTA e elementos de divisão corrigido para atender WCAG AA.
- Join duplicado e corrida de posições da lista de espera eliminados no fluxo Web.

_Issues: #4063, #4064, #4065, #4066, #4067, #4068, #4069, #4070, #4071 · PRs: #4072, #4073, #4074, #4075_

### [1.56.8][web-1.56.8] - 2026-08-15

#### Adicionado
- Novas variantes de cor de gamificação para primeiro plano com contraste AA.
- Testes de contrato de contraste (raridade, gamificação e hover de botões) e de cabeçalho duplicado.

#### Corrigido
- `getContrastText` usa limiar 4.5 em vez do default 3.0 do MUI.
- Tier `form` do `PageContainer` respeita o limite de 900px (antes renderizava 1500px).
- Upload de fotos migrado para a callable autoritativa `createGamePhoto`.
- Empty states e legendas usam `text.secondary` em vez de `text.disabled`.

_Issues: #4041, #4042, #4047, #4048, #4050, #4051, #4052, #4055, #4056, #4057_

### [1.56.7][web-1.56.7] - 2026-08-08

#### Adicionado
- Testes de contraste WCAG e contratos de regressao para renderizacao segura de videos.

#### Corrigido
- Upload de video usa callable autoritativa e nao grava URL fornecida pelo cliente.
- Falhas de rede durante a criacao de video nao removem um upload que pode ja ter sido persistido no servidor.

_Issues: #4024, #4025, #4026_

### [1.56.6][web-1.56.6] - 2026-08-08

#### Adicionado
- Contratos de regressao para contraste WCAG e aninhamento de HTML.

#### Corrigido
- Criacao de `game_videos` migrada para callable autoritativa e idempotente.
- Cleanup de uploads com resposta de rede ambigua preserva o objeto para reconciliacao server-side.
- Disponibilidade truncada e tratada como falha fechada no fluxo de criacao de jogo.

_Issues: #4016, #4018, #4024, #4025, #4026_

### [1.56.5][web-1.56.5] - 2026-08-01

#### Adicionado
- `LiveGameScore.scores?: Record<string, number>` no tipo (canônico 2-4 times).
- `readScoresMap()` e `buildTeamScores()` com fallback legado e ordenação estável.
- `LiveScoreboard`: componente presentacional com grid responsivo 2-4 times e `aria-live`.
- `monitoring/app-check-missing-invalid-alert.json`: alerta Cloud Monitoring para falhas de App Check.

#### Corrigido
- `app-check.spec.ts`: gate de regressão usava variável de ambiente inexistente; agora usa `E2E_BASE_URL` e funciona contra produção.
- `validate-patterns.yml`: gate de paridade do grace de verificação adicionado ao CI.
- `playwright.config.ts`: suporte a remote target via `E2E_BASE_URL`.

_Issues: #3942, #3929, #3869_

### [1.56.4][web-1.56.4] - 2026-07-20

#### Corrigido
- `/admin/performance` preserva a proteção de administrador e redireciona para `/admin/users`.
- O import lazy de `PerformanceDashboard` foi removido do bundle.
- Adicionado contrato automatizado para o redirecionamento da rota legada.

_Issues: #3872_

### [1.56.3][web-1.56.3] - 2026-07-20

#### Corrigido
- `PendingPlayersSection` passou a usar `getFunctionsErrorMessage`.
- Adicionado fallback traduzido em português, inglês e espanhol.
- Contrato automatizado impede regressão para o mapeador incorreto de Firestore.

_Issues: #3868_

### [1.56.2][web-1.56.2] - 2026-07-20

#### Corrigido
- `PendingPlayersSection` deixou de usar `secondaryAction` absoluto na lista.
- Conteúdo e ação agora têm layout responsivo `column`/`row`, quebra segura de nomes e largura adaptativa.
- Adicionado contrato automatizado para impedir regressão do layout mobile.

_Issues: #3866_

### [1.56.1][web-1.56.1] - 2026-07-20

#### Corrigido
- `useAutoInviteMembers` hidrata nomes ausentes ou genéricos com `getLeaguePlayers` limitado ao grupo.
- `getUsersByIds` aceita `groupId` para incluir membros autorizados que não estão no diretório público global.
- Adicionada cobertura de regressão para membro com placeholder no documento do grupo.

_Issues: #3864_

### [1.56.0][web-1.56.0] - 2026-07-20

#### Adicionado
- `GameRidesDialog`: carona movida de Card inline para Dialog acionado por `IconButton` + `Badge` no header.
- `PendingPlayersSection`: seção para gestores confirmarem jogadores PENDING via callable `confirmPlayerAsManager`.
- Wrapper `confirmPlayerAsManager` em `cloudFunctions.ts`.
- `DirectionsCarIcon` adicionado ao resolver de `gameDetailRuntimeComponents`.

#### Mudado
- `GameRidesPanel` refatorado para receber `ridesApi` via props (hook liftado para `GameDetailScreen` alimentar o badge).
- `PostGameReportScreen` soma `partialPayment` ao `totalCollected`.

#### Corrigido
- `LiveEventsScreen` reconhece co-organizadores e admins no `canManage`.
- `LiveGameScreen` não renderiza mais ícones de eventos não suportados pelo backend.

_Issues: #3862_

### [1.55.1][web-1.55.1] - 2026-07-20

#### Corrigido
- Impedido o crescimento flexível do `ListItemButton` de atalhos no drawer desktop.
- Aplicado o token compartilhado de 24 px ao ícone de atalhos.
- Adicionado contrato automatizado para o tamanho e o comportamento flexível do item.

_Issues: #3860_

### [1.55.0][web-1.55.0] - 2026-07-19

#### Adicionado
- Suporte aos novos campos opcionais do breakdown agregado de XP.
- Apresentação dos alertas de streak em risco, quase-nível e quase-conquista.

#### Mudado
- Consumers web usam os novos valores canônicos de XP sem recalcular persistência.
- Recursos PT-BR mantêm paridade de chaves com inglês e espanhol.

#### Corrigido
- Traduções e terminologia de gamificação foram corrigidas sem alterar placeholders.

_Issues: #3843, #3847, #3848, #3849, #3850, #3851, #3852, #3853, #3854, #3855, #3856_

### [1.54.23][web-1.54.23] - 2026-07-17

#### Mudado
- O shell mobile ganhou um mecanismo explícito para telas que já possuem cabeçalho próprio.
- O anúncio de rotas cobre `/guide` e deep links `/checkin/:gameId/:token`.
- `EvolutionScreen` usa a API Grid2 compatível com a versão atual do MUI.
- Build, lint, testes focados e a suíte completa web foram validados.

_Issues: #3818, #3819, #3820_

### [1.54.22][web-1.54.22] - 2026-07-17

#### Adicionado
- Modal responsivo e acessível para detalhes de nível, com estados atual, conquistado e bloqueado.
- Testes de interação, fechamento e cálculo de XP restante.

#### Mudado
- Cartões bloqueados deixaram de ser controles desabilitados e agora preservam contraste e foco sem perder a indicação de bloqueio.
- Textos da jornada foram atualizados em português, inglês e espanhol.

_Issues: #3821_

### [1.54.21][web-1.54.21] - 2026-07-16

#### Adicionado
- Eventos reais de conversão para cadastro concluído, grupo criado, jogo criado e presença confirmada.
- Testes garantem que os eventos são emitidos somente após operações bem-sucedidas e diferenciam novo cadastro Google de login existente.

#### Mudado
- O playbook de SEO passa a tratar `/` como landing canônica e registra a propriedade verificada, o sitemap processado e a indexação solicitada no Search Console (#3705, #3706).
- O acompanhamento dos indicadores de busca passa a ser uma rotina mensal automatizada; o primeiro baseline será capturado assim que o Google concluir o processamento inicial.

### [1.54.20][web-1.54.20] - 2026-07-16

#### Mudado
- O shell móvel escreve o progresso do swipe diretamente no compositor, no máximo uma vez por frame, sem renderizar novamente toda a rota.
- A troca de rota preserva o estado dos filhos e move o foco somente depois do fim real da animação, com conclusão imediata para movimento reduzido.
- A contagem de notificações usa um único provider e evita listeners Firestore duplicados.
- A navegação antecipa chunks por foco ou hover e aplica fallbacks específicos às rotas mais pesadas.
- Propriedades CSS lógicas, posicionamento RTL e atalhos por plataforma completam os contratos de internacionalização.

_Issues: #3748, #3750, #3752, #3753, #3754, #3755, #3762, #3764, #3765, #3766, #3767, #3768, #3774, #3777, #3781, #3784, #3785, #3788, #3791, #3793, #3796, #3798, #3801, #3803, #3807_

### [1.54.19][web-1.54.19] - 2026-07-16

#### Mudado
- Superfícies de navegação compartilham tokens de vidro, opacidade, fallback e dimensões semânticas.
- O gesto de voltar reage a alterações em `prefers-reduced-motion` e promove a camada somente durante o arraste.
- A persistência da rolagem usa debounce com flush no descarte, evitando escrita por pixel sem perder a última posição.
- Listeners de teclado são estáveis e delegam estado mutável por refs, evitando reanexação a cada abertura.
- `ShortcutsDialog` foi isolado em chunk lazy dedicado.

_Issues: #3789, #3790, #3792, #3794, #3795, #3797, #3800, #3802, #3804, #3806_

### [1.54.18][web-1.54.18] - 2026-07-16

#### Mudado
- A sidebar responsiva passou a compartilhar tokens de layout e estilos entre os seus elementos.
- Ícones decorativos foram ocultados da árvore de acessibilidade quando já existe rótulo textual equivalente.
- Separadores e textos auxiliares deixaram de usar a cor de conteúdo desabilitado.
- Os status sobre superfícies claras agora combinam a cor principal de severidade com seu `contrastText` correspondente.

_Issues: #3715, #3742, #3743, #3744, #3745, #3746, #3747, #3756, #3779, #3780, #3783, #3786, #3799_

### [1.54.17][web-1.54.17] - 2026-07-16

#### Mudado
- A resolução da navegação ativa agora usa identificadores canônicos e relações explícitas entre itens pais e filhos.
- Breadcrumbs automáticos deixam de competir com breadcrumbs mantidos pelas próprias telas.
- Rotas agrupadoras inexistentes são exibidas sem link, prevenindo navegação para o fallback 404.
- Foram adicionados contratos automatizados para desktop, mobile e internacionalização.

_Issues: #3751, #3758, #3759, #3760, #3761, #3763, #3770, #3771, #3772, #3773, #3775, #3776, #3778_

### [1.54.16][web-1.54.16] - 2026-07-16

#### Segurança
- `websocket-driver` foi atualizado de `0.7.4` para `0.7.5` em todos os lockfiles monitorados, incluindo ferramentas, testes de regras, armazenamento Kotlin/JS e o backend arquivado.
- Os audits dos pacotes afetados não encontram vulnerabilidades após a atualização.

_Issues: #3739_

### [1.54.15][web-1.54.15] - 2026-07-16

#### Mudado
- `ThemeContext` passa a usar `light` como fallback para instalações novas e valores inválidos.
- `LaunchPage` recebe um boundary MUI claro e sincroniza `color-scheme` e `theme-color` durante sua montagem.
- `AuthProvider` faz heartbeat de `getIdToken(false)` aos 55 minutos, com retomada por `visibilitychange`, sem reads adicionais de perfil.
- Cobertura do padrão claro, preservação explícita de `system`, landing sob tema pai escuro e renovação sem chamadas FCM.

_Issues: #3740_

### [1.54.14][web-1.54.14] - 2026-07-16

#### Adicionado
- Coleção PNG RGBA transparente dos níveis 11–20, com direção “Brasões da Eternidade”.
- Resolução declarativa do destino de navegação por papel e testes para PLAYER, FIELD_OWNER e ADMIN.

#### Corrigido
- `/locations` usa `/map/locations` como fallback seguro para usuários sem papel de gestão.

_Issues: #3737_

### [1.54.13][web-1.54.13] - 2026-07-15

#### Corrigido
- Navegação consolidada em `NAV_ITEMS`, com matching por rota, fallback por superfície e `aria-current`.
- Rail `md` com popover acessível e drawer `lg` derivados da mesma fonte de dados.
- 404 sensível à autenticação e foco pós-navegação compatível com movimento reduzido.
- Breadcrumbs dinâmicos hierárquicos com redirects de pais válidos.
- Tokens de tema, contraste dark-mode e pluralização i18n alinhados.

_Issues: #3726, #3727, #3728, #3729, #3730, #3731, #3732, #3733, #3734, #3735_

### [1.54.12][web-1.54.12] - 2026-07-15

#### Corrigido
- Identidade da `AppSidebar` migrada para `ListItemButton` acessível com rota `/profile/edit`.
- `SettingsScreen` usa a foto real do jogador e um grid responsivo para notificações.
- Contratos e testes cobrem a navegação do rodapé, o atalho de perfil e a ordem da ação de salvar.

_Issues: #3724_

### [1.54.11][web-1.54.11] - 2026-07-15

#### Corrigido
- A ação foi movida do rodapé da `ProfileTab` para o cabeçalho, acima do cartão de nível.
- Teste de regressão garante que o botão aparece antes do conteúdo longo e mantém a rota `/profile/edit`.

_Issues: #3722_

### [1.54.10][web-1.54.10] - 2026-07-15

#### Corrigido
- Payload público do perfil isolado e coberto por testes determinísticos.
- Cobertura de emulador adicionada para todos os campos editáveis e para `updated_at` protegido.
- Permissões de avatar validadas para owner, terceiros, anônimo, MIME, tamanho, filename e exclusão.

_Issues: #3720_

### [1.54.9][web-1.54.9] - 2026-07-15

#### Corrigido
- Centralização do contêiner responsivo, do conteúdo dos acordeões e das respostas.
- Identificação semântica da seção de FAQ para tecnologias assistivas.

_Issues: #3718_

### [1.54.8][web-1.54.8] - 2026-07-15

#### Corrigido
- Composição responsiva do hero reorganizada com CSS Grid e ordem semântica consistente.
- Restrições de flexbox ajustadas no cabeçalho e no selo de status.

_Issues: #3716_

### [1.54.7][web-1.54.7] - 2026-07-15

#### Mudado
- Roteamento raiz condicionado ao estado de autenticação, preservando o `AppLayout` para usuários ativos.
- Canonical e sitemap consolidados em `https://futebadosparcas.com.br/`.
- Imagem social reutilizada como elemento visual responsivo no hero da landing.

_Issues: #3713_

### [1.54.6][web-1.54.6] - 2026-07-15

#### Adicionado
- Metadata por rota com title, description, canonical, Open Graph, Twitter Cards e controle `index`/`noindex`.
- Dados estruturados `Organization` e `SoftwareApplication` em JSON-LD.
- Eventos reais de aquisição e conversão no Firebase Analytics, enriquecidos com UTMs e hostname de referência sem PII.
- Playbook de SEO e crescimento orgânico com clusters de busca, distribuição, mensuração e operação no Search Console.

#### Corrigido
- Rotas privadas e de autenticação recebem `noindex, nofollow`.
- O helper compartilhado de testes inclui o `PwaInstallProvider`, eliminando falhas de Login e Home.
- Mocks de busca e jogadores deixam de inicializar Cloud Functions fora do escopo dos testes.

_Issues: #3705, #3706, #3707, #3708, #3709_

### [1.54.5][web-1.54.5] - 2026-07-15

#### Mudado
- Manifesto sem bloqueio de orientação e com ícones `any`, `maskable` e Apple opacos.
- Cache PWA atualizado de `futeba-v17` para `futeba-v18`.

#### Corrigido
- O listener de `beforeinstallprompt` passou para um provider global e não perde mais o evento ao navegar entre telas.
- A persistência de storage é solicitada silenciosamente após instalação ou abertura standalone, sem bloquear o uso quando o navegador retorna `false`.
- Canonical, Open Graph, Twitter Cards e App Links agora apontam para `https://futebadosparcas.com.br`.
- `firebase-messaging-sw.js` deixou de receber cache imutável de um ano.
- O ciclo de atualização do service worker respeita a confirmação já apresentada pelo aplicativo.

_Issues: #3703_

### [1.54.4][web-1.54.4] - 2026-07-15

#### Corrigido
- `VITE_FIREBASE_AUTH_DOMAIN` agora usa `futebadosparcas.com.br`, mantendo o iframe e o handler de autenticação na mesma origem do aplicativo.
- O cliente OAuth Web autoriza `https://futebadosparcas.com.br` e `https://futebadosparcas.com.br/__/auth/handler`.

_Issues: #3700 · PRs: #3701_

### [1.54.3][web-1.54.3] - 2026-07-14

#### Corrigido
- `useFieldGames` e a validação final de conflito usam `getFieldAvailability`, que retorna apenas intervalos ocupados.
- Todas as listagens Web na coleção raiz `users` foram migradas para a projeção whitelist de `getLeaguePlayers`.
- Hidratações com mais de 500 IDs são divididas em lotes sem descarte silencioso.

#### Segurança
- Firestore mantém `get` público somente para perfis sanitizados e restringe `list` de `users` a administradores.
- Nenhum metadado de jogo privado ou campo de PII é retornado pelas novas consultas.

_Issues: #3688, #3691_

### [1.54.2][web-1.54.2] - 2026-07-14

#### Corrigido
- As regras de `games` separam `get` de `list` e reconhecem somente a confirmação determinística do próprio convidado.
- Chat, `game_rides` e `post_game_messages` reutilizam o contrato restrito de owner/coorganizador, preservando autoria e campos imutáveis.
- `LocationDetailScreen` condiciona listeners privados à autenticação e mantém o documento publicado disponível anonimamente.
- Reviews existentes usam `updateDoc` com `updated_at: serverTimestamp()`, sem regravar `created_at` ou `user_id`.

_Issues: #3686, #3687, #3689, #3690_

### [1.54.1][web-1.54.1] - 2026-07-14

#### Corrigido
- `useGameDetail` separa o listener do próprio convite da consulta protegida do elenco e não promove falhas auxiliares de confirmações a erro fatal do jogo.
- A consulta inicial restringe `confirmations` por `game_id` e `user_id`, preservando as regras que bloqueiam dados de outros jogadores antes da confirmação.

_Issues: #3684_

### [1.54.0][web-1.54.0] - 2026-07-14

#### Adicionado
- Digital Asset Links é publicado pelo Hosting para verificar links Android compartilhados.

#### Mudado
- Breadcrumbs, rotas estáticas e tokens de sombra/medalha passam a usar contratos semânticos testados.

#### Corrigido
- Estados de Home, recuperação de check-in, acessibilidade por teclado e internacionalização foram corrigidos.

_Issues: #3605, #3606, #3607, #3610, #3611, #3612, #3613, #3614, #3615, #3616, #3621, #3623, #3625, #3626, #3628, #3629, #3646 · PRs: #3660, #3661, #3662, #3663, #3664, #3665, #3668, #3669, #3670, #3673_

### [1.53.12][web-1.53.12] - 2026-07-13

#### Corrigido
- `web/src/pages/league/LeagueScreen.tsx`: o `IntersectionObserver` da sticky bar agora é desativado quando a Liga está embutida (`embedded`) ou em breakpoint abaixo de `md`, evitando overlay fixa no fluxo mobile da Home.

### [1.53.11][web-1.53.11] - 2026-07-13

#### Corrigido
- `web/src/utils/xpAccounting.ts`: `experience_points` agora tem prioridade sobre `experiencePoints`, e o nível efetivo passa a ser derivado do XP reconciliado.
- `web/src/hooks/usePlayerCard.ts`: player card passa a reutilizar os helpers canônicos de XP/nível.
- `web/src/pages/home/tabs/ProfileTab.tsx`: perfil deriva o nível do XP autoritativo e renderiza estado terminal correto no nível máximo.
- `web/src/pages/home/tabs/RankingsTab.tsx`: rankings, pódio, badge, cor, barra de progresso e ordenação de XP passam a usar o mesmo XP/nível reconciliado.
- `web/src/utils/xpAccounting.test.ts` e `web/src/pages/home/tabs/ProfileTab.test.tsx`: adicionadas regressões para conflito snake/camel, nível persistido obsoleto e nível máximo.

_Issues: #3581, #3582_

### [1.53.10][web-1.53.10] - 2026-07-13

#### Corrigido
- `web/src/hooks/useAutoInviteMembers.ts`: removido bloco que escrevia owner CONFIRMED no `writeBatch` (violava `firestore.rules:1468` `status == 'PENDING'` e `:1472` `user_id != userId()`). Agora chama `confirmGamePresence` callable após `batch.commit()`.
- `web/src/hooks/useAutoInviteMembers.test.ts`: adicionado mock de `confirmGamePresence`, 3 novos testes (todos convidados, sem membros, callable falha mas membros convidados).
- `web/src/hooks/useCashboxSummary.ts`: novo hook leve que lê apenas `cashbox_summary/current` via `onSnapshot` (retorna `entryCount`, `balanceCents`, `loading`).
- `web/src/pages/group/GroupDetailScreen.tsx`: substituído `group.totalBalance` (campo morto) por `useCashboxSummary(groupId)` para o card de saldo e checklist de onboarding. Critério do checklist mudou de `balanceValue !== 0` para `entryCount > 0`.
- Service worker `CACHE_NAME` bump v16 → v17.

### [1.53.9][web-1.53.9] - 2026-07-13

#### Corrigido
- `web/src/hooks/useGames.ts:528`: removido `xp_processed: false` do payload `useCreateGame` (bloqueado por `hasNoGameValidationClientFields` nas Firestore rules).
- `web/src/hooks/useDuplicateGameCopy.ts:111`: removido `xp_processed: false` do payload de duplicação de jogo.
- `web/src/hooks/useGames.test.ts:554`: removida assertion `xp_processed: false`.
- `firebase.json:65`: CSP `connect-src` adiciona `https://*.firebasestorage.app`.
- `functions/src/games/recurrence-engine.ts:267-268`: adiciona `gender` e `name` do pai ao child payload.
- `functions/src/games/recurrence-engine.ts:286`: `co_organizers` agora copia do pai em vez de sempre `[]`.
- `app/.../GameRepositoryImpl.kt`: `createGame` agora usa `gameToClientWriteMap()` que mapeia manualmente apenas campos client-writable em snake_case, excluindo todos os 27 campos server-managed.
- `app/.../GameRepositoryImpl.kt`: `updateGame` agora usa `SetOptions.merge()` em vez de `.set()` overwrite completo, preservando campos server-managed.
- `app/.../GameDetailViewModel.kt:543-573`: `buildNextGame` reseta todos os campos server-managed (xp_*, validation_*, voting_*, mvp_*, etc.) ao criar jogo recorrente.
- Service worker `CACHE_NAME` bump v15 → v16.

### [1.53.8][web-1.53.8] - 2026-07-13

#### Corrigido
- `WallPostVideoPlayer`: botão de fullscreen nativo (`FullscreenIcon`) agora só renderiza quando `autoActivate` é true (modo lightbox). No card inline, o botão `OpenInFullIcon` do `WallPostCard` já cumpre o papel de abrir o lightbox onde o fullscreen nativo está disponível.
- Service worker `CACHE_NAME` bump v14 → v15.

### [1.53.7][web-1.53.7] - 2026-07-12

#### Adicionado
- `WallPostVideoPlayer`: prop `autoActivate` que pula o poster e inicia o carregamento do vídeo automaticamente (usado no lightbox).
- `WallPostVideoPlayer`: `requestNativeFullscreen()` via Fullscreen API com fallback `webkitEnterFullscreen` para iOS Safari.
- `WallPostVideoPlayer`: botão IconButton com `FullscreenIcon` visível quando o vídeo está pronto (`status === 'ready'`).
- `WallPostCard`: `useMediaQuery` para detectar mobile e aplicar `fullScreen` no Dialog do lightbox.
- i18n: chave `groupWall.fullscreen` adicionada em pt-BR, en, es.

#### Mudado
- `WallPostCard`: expand button reposicionado de `top:8, right:8` para `bottom:8, left:8` (evita sobrepor controles nativos do `<video>`).
- `WallPostCard`: lightbox `maxHeight` agora `100dvh` no mobile / `90vh` no desktop.
- Service worker `CACHE_NAME` bump v13 → v14 (invalida bundle antigo sem fullscreen).

### [1.53.6][web-1.53.6] - 2026-07-12

#### Corrigido
- `WallPostVideoPlayer`: removido `crossOrigin="anonymous"`. Teste Playwright com Chromium real provou: sem o atributo o vídeo carrega (readyState=4, duration=22.67s); com o atributo fica bloqueado por CORS (readyState=0). O atributo só seria necessário para canvas frame capture, que o player não faz.
- Data fix em produção: post `e4ee9b9c...` (grupo Clube das quintas) marcado como `LEGACY_OBJECT_MISSING` (storage objeto deletado mas doc dizia READY).

_Issues: #3569_

### [1.53.5][web-1.53.5] - 2026-07-12

#### Corrigido
- `WallPostVideoPlayer`: removido `autoPlay` (bloqueado pelo iOS sem `muted`); play programático via `onCanPlay` mantém o gesture chain e o áudio. Cleanup no unmount via ref callback (`pause()` + clear `src`); prop `maxHeight` para o lightbox; `controlsList="nodownload"`.
- `WallPostCard`: lightbox de vídeo (Dialog com `WallPostVideoPlayer` em `maxHeight: 80vh` + botão expand), paridade com o lightbox de imagem.
- `GameVideosTab`: validação de duração pré-upload (`readVideoDuration`); `onError` com recovery de URL via `getDownloadURL` + remount por `key`; removido `muted` sem autoPlay; adicionado `aspectRatio`/`objectFit`/`minHeight`; `controlsList="nodownload"`.
- `WallPostComposer`: submit bloqueado até a duração do vídeo ser lida (`mediaDuration === null`), exceto quando a prévia falha.
- Testes: `videoDuration.test.ts` (novo), `WallPostVideoPlayer`/`WallPostComposer`/`WallPostCard` atualizados; i18n `openVideoFullscreen` (pt-BR/en/es).

_Issues: #3559_

### [1.53.4][web-1.53.4] - 2026-07-12

#### Corrigido
- O sentinela de `IntersectionObserver` usa dimensões CSS explícitas em pixels; valores numéricos de sizing do MUI eram convertidos para `100%`.

### [1.53.3][web-1.53.3] - 2026-07-12

#### Adicionado
- Campo canônico `time_zone` IANA, validação nos formulários e backfill idempotente com dry-run para documentos legados.

#### Corrigido
- `isLocationOpenAt` centraliza a conversão civil por fuso, limites inclusivos, virada semanal e fallback temporário para `America/Sao_Paulo`.
- `isOpenNow`, filtro e cards do mapa compartilham a mesma regra pura e fecham com segurança diante de dados explicitamente inválidos.

_Issues: #3550_

### [1.53.2][web-1.53.2] - 2026-07-12

#### Adicionado
- Outbox IndexedDB por usuário e grupo, com `File`, fingerprint, `clientRequestId`, TTL e recuperação após reload.
- `WallPostVideoPlayer` poster-first com reprodução inline, HTTP Range nativo e refresh limitado de URL por `mediaPath`/`thumbnailPath`.
- Política `storage.cors.json` restrita a `GET`/`HEAD` dos hosts oficiais, com headers de Range versionados.

#### Corrigido
- Reconciliação autoritativa usa `getDocFromServer` e `getMetadata`; fallback só ocorre após três observações estáveis de `AWAITING_UPLOAD` e `object-not-found`.
- Watchdog do resumable respeita o budget do SDK e pausa em `offline` ou `visibilityState=hidden`.
- Matriz de erros separa Auth, App Check, Rules, rede e integridade; o retry de `storage/unauthorized` fica restrito ao caso conhecido de propagação do logo recém-criado.
- Os dois MP4s reportados foram validados em produção como H.264/AAC, `READY`, poster WebP e respostas parciais HTTP 206.

_Issues: #3545, #3546_

### [1.53.1][web-1.53.1] - 2026-07-11

#### Corrigido
- Storage Rules do staging usam somente grupo e draft, mantendo autor, path, MIME, tamanho, expiração e imutabilidade validados.
- Upload resumível ganhou watchdog de inatividade, cancelamento seguro, proteção contra resolução duplicada e fallback para upload simples.
- Confirmações de rede perdidas consultam o draft autoritativo antes de solicitar um novo envio para o mesmo path imutável.
- Callable de reserva e renovação de credenciais agora têm timeout explícito; o backoff global de upload foi reduzido.

_Issues: #3535_

### [1.53.0][web-1.53.0] - 2026-07-11

#### Adicionado
- Reserva autenticada de rascunho, upload para staging exato, observação realtime e publicação somente após estado `READY`.
- Serviço Web tipado com idempotência por UUID, validação estrita do contrato e separação das fases de upload e processamento.
- Poster preguiçoso e criação do player somente após interação do usuário.

#### Corrigido
- Escritas diretas de posts com mídia foram substituídas pelo pipeline autoritativo, mantendo posts de texto leves.
- Paginação reversa e ordenação determinística do Mural preservam a mensagem mais recente no topo.
- Tokens App Check de uso limitado são solicitados nas operações protegidas contra replay.

_Issues: #3518, #3519_

### [1.52.0][web-1.52.0] - 2026-07-11

#### Adicionado
- Painel mensal realtime, editor de ocorrência, roster de mensalistas e callables tipadas para configuração, rebuild, override e baixa.
- Cobertura de snapshot histórico, 3/4/5 ocorrências, feriados, custo por jogo, estados vazios/erro/loading e privacidade por usuário.

#### Corrigido
- Fluxos de onboarding não tentam recadastrar um CPF já reconciliado durante a união de contas.
- Escritas de agenda, avatar e localização usam contratos validados, erro acionável e timestamps autoritativos.
- Operações mensais solicitam tokens App Check de uso limitado compatíveis com a proteção anti-replay do backend.

_Issues: #3529, #3530_

### [1.51.43][web-1.51.43] - 2026-07-10

#### Mudado
- Paginação do Mural por cursor em `created_at desc`, acionada por `IntersectionObserver` e com fallback manual.
- Detecção de mídia centralizada e cobertura para envio, armazenamento e renderização de vídeos legados.

_Issues: #3522, #3527 · PRs: #3528_

### [1.51.42][web-1.51.42] - 2026-07-10

#### Adicionado
- Sessão curta de união com requestId opaco e etapa explícita para religar Google.
- Estados `pending_cpf`, `ready`, `processing` e `completed` no fluxo de onboarding.

_Issues: #3525 · PRs: #3526_

### [1.51.41][web-1.51.41] - 2026-07-10

#### Corrigido
- Mantém o elemento `video` com opacidade total e altura mínima enquanto o MP4 prepara a reprodução.
- Adiciona cobertura regressiva para controles visíveis antes de `loadedmetadata` em navegadores móveis.

_Issues: #3522 · PRs: #3524_

### [1.51.40][web-1.51.40] - 2026-07-10

#### Corrigido
- O retry do Storage deixa de repetir exclusivamente o protocolo resumível e usa `uploadBytes` como fallback compatível.
- Adiciona cobertura unitária para a troca de protocolo após `storage/network-request-failed`.

_Issues: #3522 · PRs: #3523_

### [1.51.39][web-1.51.39] - 2026-07-10

#### Adicionado
- Upload resumível com progresso monotônico e proteção contra callbacks de operações antigas.

#### Corrigido
- Preview de imagem e vídeo usa Object URL com cleanup, reduzindo o uso de memória no navegador.
- O compositor mantém estados acessíveis de envio, erro e rascunho preservado.

_PRs: #3520_

### [1.51.38][web-1.51.38] - 2026-07-10

#### Corrigido
- Object URLs de vídeos MP4 são criadas e revogadas no ciclo de vida do arquivo selecionado, com cobertura para React Strict Mode.
- Falhas do elemento `<video>` agora exibem estado não bloqueante e preservam o envio do arquivo original.
- Adicionado teste de regressão para publicar vídeo após falha da pré-visualização.

_Issues: #3516 · PRs: #3516_

### [1.51.37][web-1.51.37] - 2026-07-10

#### Adicionado
- Suporte a vídeos `video/mp4` até 25 MB no Storage do Mural.
- Testes de timeline, vídeo MP4, limites de tamanho e bloqueio de WebM.

#### Corrigido
- Feed do Mural ordenado cronologicamente com paginação deduplicada e atualização realtime.
- Reprodução de mídia com fallback e retry acessível.

_Issues: #3514 · PRs: #3514_

### [1.51.36][web-1.51.36] - 2026-07-10

#### Adicionado
- Harness local de 10, 100 e 1.000 sessões e telemetria SLO amostrada sem PII.

#### Corrigido
- Listeners compartilhados por query, merge por ID e cursores determinísticos para históricos realtime.
- Confirmação e caixa usam callables idempotentes e server-authoritative.
- Upload de imagem compartilha retry para falhas transitórias e informa separadamente permissão, cancelamento e rede.

_Issues: #3267, #3499, #3500, #3501, #3503, #3505, #3506, #3507, #3510 · PRs: #3511_

### [1.51.35][web-1.51.35] - 2026-07-10

#### Corrigido
- Componentes de runtime do detalhe do jogo normalizam módulos ESM/CJS e falham cedo quando uma exportação não é um elemento React válido.
- Testes renderizam `Unstable_Grid2` e todos os ícones usados pela tela, cobrindo defaults aninhados.
- A sincronização best-effort de claims registra falhas e a configuração pública usa o SDK config Web oficial.

_Issues: #3497 · PRs: #3498_

### [1.51.34][web-1.51.34] - 2026-07-10

#### Corrigido
- Live Game usa quatro listeners Firestore recriáveis, mutações via callables transacionais e `requestId` estável por tentativa lógica.
- Votação em lote respeita a exigência read-before-write do Firestore e resultados consomem apenas agregados autoritativos do jogo.
- Regras limitam votos brutos ao próprio eleitor/admin e autorizam observação determinística do documento próprio ainda inexistente.

_Issues: #3495 · PRs: #3496_

### [1.51.33][web-1.51.33] - 2026-07-10

#### Mudado
- Consultas de temporada, grupos, convites e ranking passam a respeitar o estado ativo da aba Liga.
- A lista paginada de jogadores mantém referência estável para evitar novos filtros, ordenações e contagens sem mudança de dados.
- Refetches ao recuperar o foco foram desativados onde listeners ou caches já mantêm a Liga atualizada.
- O PlayerCard usa raio externo de 6 px e contorno interno de 4 px em todos os breakpoints.
- Testes cobrem pausa da aba preservada, ausência de consultas desativadas, estabilidade da lista e raio visual do card.
- URLs usadas pelo service worker e por integrações externas passam por parsing e validação explícita de origem, host e protocolo.

_Issues: #3486, #3487 · PRs: #3488_

### [1.51.32][web-1.51.32] - 2026-07-10

#### Corrigido
- A confirmação OTP e a sincronização de sessão do Firebase receberam timeouts e navegação não bloqueante.
- Composer, hook, Firestore Rules e Storage Rules do mural passaram a aceitar mídia sem legenda e a limpar drafts pelo próprio autor.
- Imagens do mural agora expõem loading, erro, retry, navegação por teclado e lightbox sem bloquear o carregamento lazy.
- O checklist executa ações customizadas sem navegar em seguida, evitando desmontar diálogos recém-abertos.
- Foram adicionados testes de onboarding, convites, mural, regras e acessibilidade do card do jogador.

_Issues: #3484 · PRs: #3485_

### [1.51.31][web-1.51.31] - 2026-07-09

#### Corrigido
- Hooks de Firestore e telas de grupos, jogos, locais, liga e perfil validam entradas, preservam timestamps e tratam falhas e concorrência de escrita.
- Fluxos de presença, fila de espera, convites, auto-invite e solicitações de entrada foram alinhados aos contratos server-authoritative.
- Storage e mídia usam paths compatíveis, limpeza compensatória e cancelamento de uploads; mensagens e notificações respeitam o contexto da tela.
- Consultas de busca, recentes, avaliações, standings, head-to-head, ranking e mapas foram corrigidas para ordenação, paginação, filtros e cálculos consistentes.
- A fila offline, atualizações otimistas, cache de DevTools, atalhos, breadcrumbs, PWA e autosave foram endurecidos contra retries, desmontagem e dependências instáveis.

_Issues: #3382, #3383, #3384, #3385, #3386, #3387, #3388, #3389, #3391, #3393, #3394, #3395, #3396, #3397, #3398, #3399, #3400, #3401, #3402, #3403, #3404, #3405, #3406, #3407, #3408, #3409, #3410, #3412, #3413, #3414, #3415, #3416, #3417, #3418, #3419, #3420, #3421, #3422, #3423, #3424, #3425, #3426, #3427, #3429, #3430, #3431, #3432, #3434, #3440, #3442, #3444, #3448, #3450, #3452, #3454, #3456, #3458, #3460, #3462, #3465, #3467, #3468, #3469, #3470, #3471, #3472, #3473, #3474, #3475, #3476, #3477, #3478, #3479, #3480, #3481_

### [1.51.30][web-1.51.30] - 2026-07-09

#### Corrigido
- `useLeagueInvites` restringe opções a grupos próprios e remove alvos de jogo do modal da Liga.
- A consulta de convite pendente inclui `invited_by_id`, evitando `permission-denied` nas regras.
- `group-invites` ganhou teste de leitura por remetente, grupo, destinatário e status.

### [1.51.29][web-1.51.29] - 2026-07-09

#### Corrigido
- `LeagueScreen` conecta o avatar ao `PlayerCard` em desktop e web mobile.
- `useLeagueInvites` filtra somente grupos com `ownerId` do usuário atual.
- `group_invites` nas Firestore Rules exige `owner_id` do grupo para criação.
- `InvitePlayersScreen` usa o UID canônico do Firebase como `invited_by_id`.

### [1.51.28][web-1.51.28] - 2026-07-09

#### Corrigido
- `signUp` limpa a conta Auth recem-criada se a criacao do documento `users/{uid}` falhar.
- `useLeagueInvites` deduplica por `group_id + invited_user_id + status` e usa transacao para convites de jogo.
- `useInvitePlayers` e `InvitePlayersScreen` seguem o mesmo contrato de convite direto.

### [1.51.27][web-1.51.27] - 2026-07-08

#### Mudado
- Reorganiza `LeaguePlayerItem` para mobile com grid responsivo, pílulas de estatísticas e ações em faixa própria.
- Ajusta filtros mobile, chips de promoção/rebaixamento e tabs de divisões com breakpoints específicos.
- Remove handlers locais duplicados de pull-to-refresh em `LeagueScreen`.
- Ajusta offset do FAB da Liga com `env(safe-area-inset-bottom)`.

### [1.51.26][web-1.51.26] - 2026-07-08

#### Mudado
- Compacta `GroupQuickActions` e remove descrições redundantes dos botões.
- Deduplica CTA de criar jogo por breakpoint.
- Adiciona `role="tabpanel"`, `aria-controls`, `aria-labelledby` e tooltips nas ações de cabeçalho.

### [1.51.25][web-1.51.25] - 2026-07-08

#### Corrigido
- Move o upload web de logos de grupo para `users/{uid}/group-logos/{groupId}/logo.{ext}`.
- Adiciona regra de Storage específica para esse path, validando dono do diretório, tipo de imagem e tamanho.
- Mantém `groups/{groupId}.photo_url` como fonte exibida para os demais usuários.

### [1.51.24][web-1.51.24] - 2026-07-08

#### Corrigido
- Adiciona retry curto para uploads de imagem que retornem `storage/unauthorized` ou `storage/unknown` durante a propagação de autorização.
- Reutiliza o mesmo retry no fluxo de criação e no fluxo de edição de grupo.
- Cobre o caso com teste em `useGroups.test.ts`.

### [1.51.23][web-1.51.23] - 2026-07-08

#### Corrigido
- Reordena `useCreateGroup` para gravar `groups/{groupId}` e `groups/{groupId}/members/{uid}` antes do upload em `groups/{groupId}/logo.jpg`.
- Atualiza `photo_url` e o espelho `users/{uid}/groups/{groupId}.group_photo` após `getDownloadURL`.
- Reforça `storage.rules` para aceitar dono por `owner_id` além de member-doc admin/owner em logos e thumbs de grupo.

### [1.51.22][web-1.51.22] - 2026-07-08

#### Corrigido
- Adiciona normalizador `xpAccounting` para aliases `xp_earned`, `level_after`, `experience_points` e legados.
- Remove fallbacks `|| 1` em leituras de nivel e usa a tabela canonica para derivar nivel por XP.
- Cobre regressao para preservar nivel 0 e ler logs de XP atuais.

### [1.51.21][web-1.51.21] - 2026-07-08

#### Corrigido
- `AuthContext` mantém um convite pendente em `useRef` e usa esse código quando `onAuthStateChanged` cria `users/{uid}` antes do submit terminar.
- Teste de regressão cobre o cenário em que `createUserWithEmailAndPassword` dispara o observer antes de `signUp` chamar `createUserDocument`.

### [1.51.20][web-1.51.20] - 2026-07-08

#### Mudado
- Adicionado watchdog no `AuthProvider` para continuar com o estado atual se o observador inicial do Firebase Auth não responder.
- Atualizado o cache do service worker para `futeba-v10`.

### [1.51.19][web-1.51.19] - 2026-07-08

#### Adicionado
- Adicionado hook `useAppPermissions` para centralizar status e solicitações de notificação, geolocalização e armazenamento persistente.
- Adicionado componente `AppPermissionsPrompt` com snooze local de 7 dias e estados de permissão suportada, pendente e bloqueada.

#### Mudado
- A Home substitui o snackbar isolado de notificações por um fluxo progressivo de permissões do PWA.

### [1.51.18][web-1.51.18] - 2026-07-08

#### Adicionado
- Adicionado hook `usePwaInstall` para capturar `beforeinstallprompt`, detectar standalone e diferenciar iOS, Android e desktop.
- Adicionado ícone Apple Touch 180x180 e metadados de instalação no manifest e no HTML.

#### Corrigido
- Service worker atualizado para `futeba-v9`, cacheando o novo ícone PWA e invalidando caches antigos após o deploy.

### [1.51.17][web-1.51.17] - 2026-07-08

#### Corrigido
- Hosting passa a responder um fallback JavaScript para chunks antigos em `/assets/**`, evitando servir `index.html` como se fosse modulo JS.
- O fallback remove service workers/caches antigos e recarrega a pagina atual com cache bust.
- `sw.js` foi atualizado para `futeba-v8`, purgando caches PWA anteriores na proxima ativacao.

### [1.51.16][web-1.51.16] - 2026-07-08

#### Corrigido
- `CreateGameScreen` agora resolve o preco final no submit a partir de `formData.totalCost` e `maxPlayers`, evitando `numericDrafts.dailyPrice` antigo quando outro campo numerico esta ativo.
- O app persiste `price_manual_override` e `duration_minutes` nos jogos criados.
- `resolveExpectedPayment` passa a preferir `total_cost / max_players` para jogos automaticos e preserva `daily_price` apenas quando o preco manual esta marcado.

### [1.51.15][web-1.51.15] - 2026-07-07

#### Corrigido
- O build web passa a resolver `@mui/icons-material` para os módulos ESM, evitando que o Rolldown empacote ícones CommonJS como objetos e dispare React #130 em `Button startIcon`.
- Feedback operacional relacionado: `/game/1R8x9xxbT5Ra5gAYTt4A`.

### [1.51.14][web-1.51.14] - 2026-07-07

#### Corrigido
- `GameDetailScreen` volta a importar ícones MUI diretamente por componente, removendo o resolvedor de módulos que podia entregar um objeto para o React e disparar React #130.
- Feedback operacional relacionado: `/game/1R8x9xxbT5Ra5gAYTt4A`.

### [1.51.13][web-1.51.13] - 2026-07-07

#### Corrigido
- `GameDetailScreen` agora normaliza módulos de ícones MUI antes de renderizá-los em `startIcon`, evitando React #130 quando o bundle entrega um módulo-objeto em vez do componente.
- Feedback operacional relacionado: `cdod51wm` em `/game/1R8x9xxbT5Ra5gAYTt4A`.

### [1.51.12][web-1.51.12] - 2026-07-07

#### Corrigido
- `GameDetailScreen` e componentes filhos passam a importar icones MUI por caminho direto, evitando que o bundle de producao renderize um objeto no lugar de um componente React.
- Feedback operacional relacionado: `QdqEkNJyKN2ahxBYA6AA`.

### [1.51.11][web-1.51.11] - 2026-07-07

#### Corrigido
- `UserManagementScreen` reserva largura fixa para o avatar e aplica `minWidth: 0`/quebra responsiva na coluna textual.
- `PlayersScreen` e `InvitePlayersScreen` passam a renderizar nome/e-mail com wrapping controlado em linhas de lista com avatar e acoes.

_PRs: #3354_

### [1.51.10][web-1.51.10] - 2026-07-07

#### Corrigido
- `HomeScreen` passa a montar `LeagueScreen` na aba `tab=3`, mantendo `/league` como rota secundaria equivalente.
- `LeagueScreen` recebe modo `embedded` para preservar o comportamento correto quando usada dentro da navegacao por abas.
- Cobertura focada garante que `/?tab=3` renderiza a tela nova.

_PRs: #3353_

### [1.51.9][web-1.51.9] - 2026-07-07

#### Corrigido
- Remove inconsistencia entre busca local imediata e busca server-side debounced.
- Evita mensagens de ranking baseadas em janela parcial quando a tela esta ordenada por outro campo.
- `useLeagueInvites` replica as validacoes de membership e limite de pendentes da tela dedicada de convites.

_PRs: #3351_

### [1.51.8][web-1.51.8] - 2026-07-07

#### Adicionado
- A tela de Liga envia busca, ordenacao e `pageToken` para `getLeaguePlayers`.
- `useLeague` passa a suportar paginas infinitas reais e total de jogadores carregados.
- Acoes sociais da Liga reutilizam os fluxos existentes de convites e mensagens diretas.

_PRs: #3350_

### [1.51.7][web-1.51.7] - 2026-07-07

#### Mudado
- `useLeague` passa a consumir `getLeaguePlayers`, uma callable sanitizada.
- Telas de Liga, Ranking e aba Rankings deixam de desabilitar a busca quando `seasonId` esta ausente.
- `useActiveSeason` aceita `isActive` e `is_active` para compatibilidade de dados.

#### Corrigido
- Remove leituras client-side de `users/{uid}` na Liga, evitando `PERMISSION_DENIED` em perfis com PII.

_PRs: #3349_

### [1.51.6][web-1.51.6] - 2026-07-07

#### Mudado
- A leitura de usuarios da Liga aceita os campos `is_searchable` e `isSearchable`, com deduplicacao.
- Convites de grupo passam a gravar metadados adicionais para listagens e notificacoes.

#### Corrigido
- Corrige perda de contexto de `/join/:code` ao navegar do login para o cadastro.
- Bloqueia aceite de convite expirado e transicoes invalidas de status nas regras do Firestore.

_PRs: #3347_

### [1.51.5][web-1.51.5] - 2026-07-06

#### Mudado
- `UserManagementScreen` passa a usar uma grade explicita no layout mobile da lista.
- A tela exibe o chip `QA/teste` para contas com padroes claros de teste, como dominio `@futeba.test`.

#### Corrigido
- Corrige overflow visual na lista mobile de usuarios administrativos.

### [1.51.4][web-1.51.4] - 2026-07-06

#### Mudado
- `useLeague` passa a usar usuarios pesquisaveis como base da lista e sobrepor dados de `season_participation`.
- O listener em tempo real da Liga tambem observa mudancas na base de jogadores.

#### Corrigido
- A Liga nao fica vazia ou incompleta quando usuarios reais ainda nao geraram XP na temporada ativa.

### [1.51.3][web-1.51.3] - 2026-07-06

#### Adicionado
- Testes novos para parsing monetario, auto-convite, validacao de agenda, ordenacao de jogos, merge realtime e busca.
- Cobertura adicional de Firestore Rules para polls, votes, rides, disponibilidade, posts ocultos e `users_private`.
- Indices Firestore alinhados com consultas web por `dateTime`, busca e filtros.

#### Mudado
- `AuthContext`, notificacoes, times favoritos e ranking reduzem trabalho no caminho inicial.
- Chat e mural agora fazem merge realtime por id sem descartar paginas antigas.
- A liga deixa de depender de limite crescente e passa a usar paginacao por cursor.
- Telas admin, public games, mobile forms e dialogs receberam ajustes de layout e a11y.

#### Corrigido
- `CashboxScreen` normaliza moeda PT-BR.
- `useAutoInviteMembers` limita convites automaticos a membros `ACTIVE`.
- Edicao/configuracao de grupo respeita donos legados por `owner_id`.
- `GroupChallengesScreen` e rules restringem acoes sensiveis a dono/admin.
- `GamesTab` e `CreateGameScreen` validam horario real de jogo.

_Issues: #3320, #3321, #3322, #3323, #3324, #3325, #3326, #3327, #3328, #3329, #3330, #3331, #3332, #3333, #3334, #3335, #3336, #3337, #3338, #3339, #3340, #3341_

### [1.51.2][web-1.51.2] - 2026-07-05

#### Adicionado
- `scripts/deploy/build-web-hosting.js` centraliza o predeploy do Firebase Hosting com Node 22, `npm ci --include=dev` e build sequencial.
- `docs/production-launch/go-no-go-checklist.md` consolida evidencias por issue e bloqueios externos.
- `docs/production-launch/performance-readiness.md` registra build, chunks e proximas metas de Web Vitals.

#### Mudado
- `web/package.json` chama TypeScript, Vite e ESLint pelos entrypoints dos pacotes, sem depender de `.bin`.
- `vite.config.ts` remove Storage e Functions do preload inicial.
- Docs de dominio/e-mail, campanha e readiness foram promovidos de draft para pacote repo-ready.

_Issues: #3281, #3298, #3299, #3300, #3301, #3308, #3310, #3312, #3313, #3314_

### [1.51.1][web-1.51.1] - 2026-07-05

#### Adicionado
- `DemoDataChip` centraliza o indicador visual de dados ficticios.
- Tipos de usuario e jogo ganharam metadados de origem (`dataOrigin`, `demoData`, `seedId`).
- `scripts/maintenance/demo-data-governance.js` adiciona inventario, marcacao e dry-run de limpeza futura.

#### Mudado
- Rankings e cards de jogo passam a respeitar metadados `is_mock`, `demo_data` e `data_origin`.

### [1.51.0][web-1.51.0] - 2026-07-05

#### Adicionado
- `FeedbackOperationsScreen` e `useAdminFeedbackQueue` criam a fila administrativa de `user_feedback`.
- `FirstStepsChecklist` adiciona onboarding reutilizavel para jogador e dono de grupo.
- `robots.txt` e `sitemap.xml` adicionam descoberta publica basica.

#### Mudado
- `usePrefetchHome` limita o prefetch de grupos recentes.
- Manifesto PWA e metadados HTML foram ajustados para installability e compartilhamento.
- Telas principais ganharam empty states e CTAs consistentes.

_Issues: #3304, #3305, #3306, #3307, #3309, #3311, #3315_

### [1.50.0][web-1.50.0] - 2026-07-05

#### Adicionado
- `useLeagueInvites` centraliza opções de grupo/jogo e escrita de `group_invites`, `game_summons`, `confirmations` e `notifications`.
- `LeagueScreen` ganhou botão e diálogo de convite no layout mobile e desktop.

#### Mudado
- Notificações web interpretam `action=group_invite/<id>` para responder convites diretos de grupo.

_Issues: #3296_

### [1.49.0][web-1.49.0] - 2026-07-05

#### Adicionado
- `ErrorBoundary` ganhou ação de reporte para criar documentos em `user_feedback` como `bug/high`.
- `errorFeedbackReporter` centraliza o payload seguro para feedback originado por crash.
- Firestore Rules de `user_feedback` aceitam `user_email` vazio para usuários autenticados sem e-mail no token, sem permitir spoofing de e-mail.
- Testes cobrem envio autenticado e orientação de login no fallback global de erro.

_Issues: #3294_

### [1.48.9][web-1.48.9] - 2026-07-05

#### Corrigido
- `GamesTab` envia filtros de status/data para `useGames` antes da consulta Firestore.
- `useGames` passa a aceitar `statuses` e `startDateTime`, usando `where('status', 'in', ...)` e `where('dateTime', '>=', ...)`.
- Testes unitários cobrem os novos filtros `status in` e `dateTime >=`.

_Issues: #3292_

### [1.48.8][web-1.48.8] - 2026-07-05

#### Corrigido
- `CreateGameScreen` remove a opção de criar jogo sem grupo e filtra grupos inelegíveis.
- `useCreateGame` valida o grupo antes de gravar em `games`.
- `firestore.rules` rejeita criação direta de jogo sem `group_id`, com grupo de outro dono, inativo/deletado ou com `member_count < 5`.

_Issues: #3290_

### [1.48.7][web-1.48.7] - 2026-07-05

#### Mudado
- `HomeScreen` deixa de chamar `usePrefetchHome()` no primeiro render, removendo consultas redundantes de games, grupos e notificações.
- `useNotificationPermission` carrega Firebase Messaging sob demanda e após idle quando notificações já estão concedidas.
- O timeout de proteção contra flicker no redirect para login foi reduzido de 1200ms para 300ms.
- `vite.config.ts` separa chunks frios de Firebase Messaging, Storage, Functions e Analytics do chunk Firebase principal.

_Issues: #3288_

### [1.48.6][web-1.48.6] - 2026-07-05

#### Corrigido
- `firestore.indexes.json` adiciona índice `COLLECTION_GROUP` para `wall_posts` com `group_id ASC` e `created_at DESC`, usado por `useSocialFeed`.

_Issues: #3286_

### [1.48.5][web-1.48.5] - 2026-07-05

#### Corrigido
- `firestore.rules` exige `group_id`, `created_by == userId()`, `created_at == request.time`, `status == ACTIVE` e whitelist de campos no create de `groups/{groupId}/cashbox`.
- `useCashbox` não inclui transações `VOIDED` no saldo calculado.
- Testes de Firestore Rules cobrem spoof de `created_by`, timestamp cliente, status inválido, campo extra e `group_id` divergente.

_Issues: #3284_

### [1.48.4][web-1.48.4] - 2026-07-05

#### Corrigido
- `CashboxScreen` deixou de usar `user.id` para checar/gravar permissões e passou a usar `firebaseUser.uid`.
- `firestore.rules` permite owner por `owner_id` em `cashbox` e `cashbox_summary` quando o doc legado em `members/{uid}` não existe.
- `storage.rules` aplica o mesmo fallback para recibos em `groups/{groupId}/receipts`.

_Issues: #3282_

### [1.48.3][web-1.48.3] - 2026-07-05

#### Corrigido
- `GroupChallengesScreen` deixou de depender exclusivamente de `official-groups` para resolver o grupo atual.
- Firestore indexes adicionados para `group-challenges` por `challenged_group_id/created_at` e `challenger_group_id/created_at`.

### [1.48.2][web-1.48.2] - 2026-07-05

#### Mudado
- `GroupDetailScreen` foi reorganizada em blocos responsivos para reduzir a densidade da tela em mobile.
- `useGames` passou a aceitar ordenação opcional por data para carregar histórico recente de grupos.
- Traduções web de grupos foram atualizadas em pt-BR, en e es.

_PRs: #3279_

### [1.48.1][web-1.48.1] - 2026-07-05

#### Mudado
- Hooks do mural foram separados entre listener e mutations para evitar `onSnapshot` duplicado.
- Bundles de release notes passaram a incluir correções técnicas publicadas.

#### Corrigido
- Cleanup de mídia do mural cobre paths publicados e reduz retenção de arquivos após soft-delete.
- Lighthouse CI recebeu instalação mais determinística para evitar falhas por binários ausentes.

#### Segurança
- Firestore Rules endurecidas para perfis públicos, follows, DMs e `wall_posts`.

_Issues: #3261, #3262, #3263, #3264, #3267, #3268 · PRs: #3274, #3275, #3276, #3277_

### [1.48.0][web-1.48.0] - 2026-07-04

#### Adicionado
- Hooks e telas web para DMs, reações, comentários de jogo, follow, feed social, jogadores próximos e vídeos.
- Regras e índices para chats, follows, comentários, vídeos, localização opt-in, feed e targets sociais de votação.
- Specs aprovadas em `specs/feat-2026-07-04-*.md` para as features do épico social.

#### Mudado
- `GameDetailScreen`, `VoteResultScreen`, `ProfileScreen`, home/nav e telas de grupo foram integradas às novas superfícies sociais.
- `useGameChat` passou a usar paginação desc + reverse local para histórico estável.

#### Corrigido
- Check-in web/QR, unpin do mural, soft-delete visível no mural, validação de imagem e tint dark mode.
- Billing parcial deixa de ativar quadra antes da soma de pagamentos aprovados cobrir a mensalidade.
- Auto-close não sobrescreve jogo finalizado e FINISH_TOO_EARLY passou a ser sinal acionável.

#### Segurança
- Firestore Rules reforçadas para chat, mural, reações, comentários, vídeos, DMs, follows, localização e votação social.

_Issues: #3231, #3233, #3234, #3235, #3236, #3237, #3238, #3239, #3246, #3247, #3248, #3249, #3250, #3251, #3252, #3253, #3254_

### [1.47.0][web-1.47.0] - 2026-07-04

#### Adicionado
- Chat por jogo: `web/src/hooks/useGameChat.ts`, `web/src/pages/game/GameChatSection.tsx`, `GameChatComposer.tsx`, `GameChatMessageBubble.tsx`.
- Mural do grupo: `web/src/hooks/useGroupWall.ts`, `web/src/pages/group/GroupWallTab.tsx`, `WallPostCard.tsx`, `WallPostComposer.tsx`.
- `web/src/utils/dateUtils.ts`: helper `formatRelativeTime`.
- Regras `firestore.rules` para subcoleções `games/{gameId}/chat` e `groups/{groupId}/wall_posts`.
- Índices `firestore.indexes.json` e regras `storage.rules` para `groups/{groupId}/wall_media/`.
- Toggle `groupWall` em `useNotificationSettings.ts` e `NotificationSettingsScreen`.

#### Mudado
- `GroupDetailScreen` ganhou aba "Mural" integrada via `GroupWallTab`.
- i18n atualizado em `pt-BR`, `en` e `es`.

_Issues: #3230, #3232_

### [1.46.0][web-1.46.0] - 2026-07-03

#### Adicionado
- `web/src/pages/admin/GameReviewQueueScreen.tsx` com fila de revisão para jogos retidos por antifraude e estados de decisão.
- `web/src/services/cloudFunctions.ts` e testes para callable de lifecycle, live events e ações administrativas de revisão/recompensa.
- Modelagem de validação expandida em `web/src/types/game.ts` para score, status, reward hold e auditoria visível na UI.

#### Mudado
- `GameDetailScreen`, `LiveGameScreen`, `LiveEventsScreen` e `MVPVoteScreen` passaram a consumir fluxos server-side para ações críticas.
- `GamesTab`, `GroupsTab`, `ProfileTab` e `useGames` foram alinhados aos novos estados e restrições de antifraude.

#### Corrigido
- Follow-ups da auditoria: cap de milestones XP, temporada ativa, reativação de invite code, retry de push multi-device, paginação e deletes batch-safe, Grid2 no home e consistência de badges/leaderboard.
- Regras e UX do web ficaram coerentes com o endurecimento de `firestore.rules` para impedir transições e escritas críticas no cliente.

#### Segurança
- Votação, início/fim de jogo, eventos críticos, score ao vivo e revisão de recompensa passaram a depender de validação no servidor e trilha de auditoria.

_Issues: #3199, #3200, #3201, #3202, #3208, #3209, #3211, #3213, #3214, #3215, #3216, #3219, #3220, #3221, #3222, #3223, #3224, #3225, #3226 · PRs: #3218, #3227_

### [1.45.0][web-1.45.0] - 2026-07-02

#### Adicionado
- `web/src/utils/cnpjValidator.ts`: validador CNPJ (mod-11), máscara progressiva, strip — sincronizado com `functions/src/validation/cnpj.ts` e `shared/.../CnpjValidator.kt` (3 camadas).
- `web/src/components/settings/ConnectedAccounts.tsx`: seção de contas conectadas (link/unlink Google via `linkWithPopup`/`unlink`, guard de método primário, dialog de confirmação, loading in-place).
- `AuthContext`: `linkGoogleAccount`/`unlinkGoogleAccount`; `validateInviteCode` server-side no fluxo Google com cleanup de conta Auth rejeitada; `AppAuthError` + códigos `app/invite-*`.
- `firebaseErrors`: mapeamento `auth/credential-already-in-use` (recovery) + `app/*` codes.

#### Corrigido
- `AuthContext.signInWithGoogle`: valida convite server-side antes de criar doc; remove conta Auth órfã se rejeitada (#3186).
- `ProfileSetupScreen`: `recomputeMyProfileClaim` + `refreshClaims` antes de navegar (fix re-gate loop, #3187).
- `AuthContext.setError`: sempre mapeado via `getAuthErrorMessage` (nunca mensagem crua).
- `CpfVerificationScreen`: erro `app/cpf-verification-failed` para auditoria precisa.
- `RegisterScreen`: min-length unificado em 2 via `validateName`.
- `OwnerOnboardingScreen`: campo CNPJ estruturado + mapeamento anti-enumeration de CNPJ duplicado.
- `VerificationBanner` removido (código morto).

#### Segurança
- `cnpj_index/{hash}` deny-all em `firestore.rules` (acesso só via Cloud Functions).
- CNPJ nunca armazenado em plaintext (hash SHA-256 + salt + prefixo `cnpj:`).
- Anti-enumeração preservada em convites e CNPJ duplicado (mensagens genéricas).

_Issues: #3186, #3187, #3188, #3189 · PRs: #3194, #3195, #3196_

### [1.44.3][web-1.44.3] - 2026-07-01

#### Corrigido
- Alinha `md3TypeScale` da web aos valores canônicos de `shared/design-tokens.json`.
- Amplia `scripts/check-design-tokens-parity.js` para validar peso e tracking da escala tipográfica web contra os tokens compartilhados.

_Issues: #3181_

### [1.44.2][web-1.44.2] - 2026-07-01

#### Corrigido
- Atualiza `og:image` e metadados Twitter para usar `/logo.png`, o asset canônico do splash.
- Declara tipo, dimensões e texto alternativo da imagem social.

### [1.44.1][web-1.44.1] - 2026-07-01

#### Corrigido
- Remove o link interpolado do texto enviado ao Web Share API, mantendo a URL apenas no campo `url`.
- Mantém as traduções de convite alinhadas em PT-BR, EN e ES.

### [1.44.0][web-1.44.0] - 2026-07-01

#### Adicionado
- Integra o cadastro Web com a callable `validateInviteCode` para validar códigos de apadrinhamento antes da criação do perfil.
- Propaga `invited_by_code` na criação de `users/{uid}` para permitir validação por Firestore Rules.

#### Segurança
- Bloqueia criação automática de perfil sem convite no AuthContext.
- Encerra sessão de novos usuários Google sem convite, mantendo login normal para usuários existentes.

### [1.43.38][web-1.43.38] - 2026-06-30

#### Corrigido
- Centraliza no Web o cálculo de valor esperado de confirmação a partir de `daily_price`, com fallback para `total_cost / max_players` em jogos legados.
- Persiste `payment_status`, `partial_payment`, `expected_payment` e `expected_payment_cents` na criação de confirmações Web e Android/KMP.
- Expande as Firestore Rules para permitir apenas os novos campos financeiros seguros na criação de confirmações.

### [1.43.37][web-1.43.37] - 2026-06-30

#### Corrigido
- Corrige o cálculo de `totalCost` na tela de criação de jogo para usar `hourlyPrice * duração / 60`.
- Adiciona helpers testáveis para normalizar preço por hora em reais ou centavos e preservar compatibilidade com cadastros antigos.

### [1.43.36][web-1.43.36] - 2026-06-30

#### Corrigido
- Restaura a paridade de chaves i18n entre `pt-BR`, `en` e `es`, corrigindo a falha do `Web CI`.

### [1.43.35][web-1.43.35] - 2026-06-30

#### Mudado
- Fortalece o contrato visual E2E para telas administrativas e de quadras em desktop e mobile.
- Atualiza fixtures e seeds E2E para usuários admin/dono de quadra completos e autenticáveis.
- Desativa App Check no modo emulador para evitar ruído falso de `403` em testes locais.

### [1.43.34][web-1.43.34] - 2026-06-30

#### Mudado
- `ManageLocationsScreen` passa a renderizar rankings derivados do conjunto filtrado.
- `manageLocationRankings` centraliza a regra de melhores quadras e quadras mais baratas por tipo.
- Cobertura adicionada para ranking por avaliação e menor preço por tipo.

_Issues: #3107 · PRs: #3166_

### [1.43.33][web-1.43.33] - 2026-06-30

#### Mudado
- `FieldOwnerDashboardScreen` passa a consumir agregados denormalizados em `locations`.
- Tipos web de `Location` agora expõem agregados comerciais mantidos pelo backend.
- Modelo KMP de `Location` foi alinhado com os novos campos denormalizados.

_Issues: #3106, #3128 · PRs: #3166_

### [1.43.32][web-1.43.32] - 2026-06-30

#### Corrigido
- `isLocationCommerciallyAvailable` não usa mais `venueAccountStatus` como substituto silencioso de `subscriptionStatus`.
- `getLocationCommercialIssues` torna mutuamente exclusivos os avisos de mensalidade individual e conta agregada.

_Issues: #3121 · PRs: #3166_

### [1.43.31][web-1.43.31] - 2026-06-30

#### Adicionado
- Campos editáveis de funcionamento no `LocationFormScreen`.
- Itens `geolocation` e `operating-hours` no checklist web de qualidade da quadra.

#### Corrigido
- `ownerDashboard` agora propaga latitude/longitude para o checklist de completude.

_Issues: #3122_

### [1.43.30][web-1.43.30] - 2026-06-30

#### Adicionado
- Formulário web em `/admin/users` usando a callable `upsertVenueAccount`.
- Teste cobrindo o salvamento da conta comercial agregada.

#### Mudado
- O gerenciamento de usuários deixa de apenas exibir `venue_accounts` e passa a operar a configuração comercial centralizada.

_Issues: #3121_

### [1.43.29][web-1.43.29] - 2026-06-30

#### Adicionado
- Modelo web de `Field` e drafts de quadra com `playersPerTeam`, `minBookingMinutes`, `rules` e `amenities`.
- Testes de checklist cobrindo pendência de detalhes operacionais por campo.

#### Mudado
- `LocationFieldsEditor` ganhou controles responsivos para capacidade, duração mínima, regras e comodidades por campo.
- `getLocationQualityChecklist` agora exige detalhes mínimos dos campos ativos antes de considerar o cadastro comercial completo.

_Issues: #3122_

### [1.43.28][web-1.43.28] - 2026-06-30

#### Adicionado
- Cobertura adicionada para garantir que uma conta comercial agregada suspensa bloqueia a disponibilidade mesmo quando o status legado da quadra está ativo.

#### Mudado
- `FieldOwnerDashboardScreen` agora lê os campos `venueAccount*` denormalizados em `locations`.
- `ownerDashboard` propaga `venueAccountStatus` para os cálculos de checklist, issues comerciais e disponibilidade.

_Issues: #3125, #3135_

### [1.43.27][web-1.43.27] - 2026-06-30

#### Adicionado
- Integração web com `venueAccount` no CRM admin e com campos `venueAccount*` no resumo financeiro de quadras.
- Teste de regras garantindo leitura controlada de `venue_accounts` e bloqueio de escrita cliente nos campos denormalizados.

#### Mudado
- Filtros e alertas comerciais de quadras passam a considerar `venueAccountStatus` antes do status legado por quadra.

_Issues: #3087, #3119, #3122, #3135_

### [1.43.26][web-1.43.26] - 2026-06-29

#### Adicionado
- Novos campos comerciais para plano, ciclo, valor base e exceção comercial no contrato web de `Location`.
- Exportação administrativa de billing com colunas para plano, ciclo, valor base, início da cobrança e exceção comercial.

#### Mudado
- `ManageLocationsScreen` passa a salvar e renderizar a configuração comercial expandida por quadra.
- `FieldOwnerDashboardScreen` passa a carregar campos por subcoleção da location e fallback legado, reduzindo erros de permissão em produção.

_Issues: #3121, #3125_

### [1.43.25][web-1.43.25] - 2026-06-29

#### Adicionado
- Contrato web para `requestLocationCommercialReview` e `reviewLocationCommercialRequest`.
- Novos tipos de request comercial e metadados resumidos na entidade `Location`.

#### Mudado
- `FieldOwnerDashboardScreen` integra CTA, status e modal de solicitação comercial por quadra.
- `ManageLocationsScreen` passa a renderizar fila de revisão comercial e diálogo administrativo de decisão.

_Issues: #3115, #3125_

### [1.43.24][web-1.43.24] - 2026-06-29

#### Adicionado
- Novo helper testável `ownerDashboard` para centralizar métricas, checklist comercial, preço médio e status por quadra.
- Cobertura unitária para a lógica agregada do dashboard e para os estados principais da `FieldOwnerDashboardScreen`.

#### Mudado
- `FieldOwnerDashboardScreen` foi reestruturada para um layout responsivo com cards SaaS, blocos de ação e fluxo de comprovantes integrado.
- Textos PT-BR, EN e ES do dashboard do dono de quadra foram expandidos para cobrir os novos estados e ações.

_Issues: #3103_

### [1.43.23][web-1.43.23] - 2026-06-29

#### Adicionado
- Novo helper testável `publicLocationFilters` para centralizar filtros, ordenação, distância, preço e funcionamento por horário.
- Cobertura unitária para filtros públicos, ordenação, cálculo de distância, preço e horários overnight.

#### Mudado
- `LocationsMapScreen` usa estado único de filtros e métricas de campos por location para buscar tipo e menor preço com mais consistência.

_Issues: #3105_

### [1.43.22][web-1.43.22] - 2026-06-29

#### Adicionado
- `LocationDetailScreen` passa a ler `commercial_events` e `subscription_ledger` com estados de loading, erro e vazio.
- `manageLocationFilters` exporta checklist testável de qualidade cadastral/comercial.

#### Mudado
- O detalhe da quadra reutiliza as regras comerciais compartilhadas para manter lista e detalhe consistentes.

_Issues: #3100_

### [1.43.21][web-1.43.21] - 2026-06-29

#### Adicionado
- Helper testável centraliza os filtros comerciais de `ManageLocationsScreen`.
- Testes unitários cobrem fallback de publicação, filtros comerciais e checklist de pendências.

#### Mudado
- A lista admin reaproveita regras comerciais compartilhadas para evitar divergência entre filtro, chips e alerta de disponibilidade.

_Issues: #3099_

### [1.43.20][web-1.43.20] - 2026-06-29

#### Mudado
- `UserManagementScreen` passa a consumir `lastLoginAtIso` da callable `searchAdminUsers`.
- A UI deixa de tratar login como atualização cadastral, evitando leitura incorreta no CRM admin.
- Cobertura unitária valida a exibição separada de última atualização e último login.

_Issues: #3101_

### [1.43.19][web-1.43.19] - 2026-06-29

#### Mudado
- `UserManagementScreen` reutiliza a mensagem calculada por `getFunctionsErrorMessage` no toast.
- `getFunctionsErrorMessage` recebeu mensagens mais acionáveis para `failed-precondition` e `unavailable`.
- Cobertura unitária adicionada para erros de Cloud Functions no mapper Firebase.
- A versão web foi atualizada para `1.43.19`.

_Issues: #3149_

### [1.43.18][web-1.43.18] - 2026-06-29

#### Adicionado
- Novos campos tipados em `AdminLocationBillingSummaryRow` para ciclo atual.
- Chips administrativos para ciclo, vencimento e suspensao.
- Alerta financeiro no painel do dono de quadra baseado em `current_billing_open_balance_cents`.
- A versao web foi atualizada para `1.43.18`.

_Issues: #3132, #3124, #3119, #3086, #3084_

### [1.43.17][web-1.43.17] - 2026-06-29

#### Adicionado
- Integração web com `getAdminLocationBillingSummary`.
- Cards administrativos alimentados por resumo financeiro server-side.
- Filtros comerciais adicionais para vencimento, cidade e UID do dono.
- Exportação CSV admin baseada nas linhas retornadas pelo backend.
- A versão web foi atualizada para `1.43.17`.

_Issues: #3124, #3119, #3086, #3084_

### [1.43.16][web-1.43.16] - 2026-06-29

#### Adicionado
- Leitura de `locations/{locationId}/subscription_ledger` no gerenciamento de quadras.
- Labels e timeline para eventos financeiros comerciais.
- Resumo administrativo calculado a partir dos status comerciais carregados.
- A versão web foi atualizada para `1.43.16`.

_Issues: #3114, #3091, #3084_

### [1.43.15][web-1.43.15] - 2026-06-29

#### Adicionado
- Rota web `/owner/onboarding` para solicitação de dono de quadra.
- Revisão admin integrada ao `UserManagementScreen`.
- A versão web foi atualizada para `1.43.15`.

_Issues: #3137, #3115, #3125, #3088, #3084_

### [1.43.14][web-1.43.14] - 2026-06-29

#### Mudado
- `UserManagementScreen` passa a renderizar o detalhe comercial usando dados retornados por `searchAdminUsers`.
- A versão web foi atualizada para `1.43.14`.

_Issues: #3126, #3101, #3087, #3084_

### [1.43.13][web-1.43.13] - 2026-06-29

#### Mudado
- `UserManagementScreen` deixa de depender apenas do primeiro lote local de 50 usuários para busca e filtros.
- Integração web adicionada para a callable `searchAdminUsers`.
- A versão web foi atualizada para `1.43.13`.

_Issues: #3136, #3101, #3087, #3084_

### [1.43.12][web-1.43.12] - 2026-06-29

#### Mudado
- `ManageLocationsScreen` passou a listar os últimos pagamentos da subcoleção `subscription_payments` para owner/admin.
- O fluxo admin usa `submitLocationSubscriptionReceipt` seguido de `reviewLocationSubscriptionReceipt` para registrar e aprovar manualmente mantendo auditoria.
- A versão web foi atualizada para `1.43.12`.

_Issues: #3123, #3119, #3084_

### [1.43.11][web-1.43.11] - 2026-06-29

#### Adicionado
- Tela `ManageLocationsScreen` ganhou diálogo de comprovantes com upload privado, pendências e ações de aprovação/rejeição.
- Cliente web passou a consumir as callables `submitLocationSubscriptionReceipt` e `reviewLocationSubscriptionReceipt`.

#### Segurança
- Uploads de comprovantes usam path oficial `locations/{locationId}/subscription_receipts/{ownerId}/{fileName}`.
- Comprovantes comerciais não usam URL pública e ficam legíveis apenas para owner/admin pelas regras de Storage.

_Issues: #3133, #3091, #3084_

### [1.43.10][web-1.43.10] - 2026-06-28

#### Adicionado
- `ManageLocationsScreen` ganhou o painel "Dono e gerentes" para transferência administrativa e convites de managers.
- `LocationDetailScreen` passou a carregar campos e fotos da quadra para uma visão unificada de visualização e edição.
- Cliente web passou a consumir as callables `assignLocationOwner`, `inviteLocationManager`, `acceptLocationManagerInvite` e `removeLocationManager`.

#### Segurança
- A UI deixa claro que managers não podem publicar, cobrar, alterar dono ou mensalidade.
- `AuthContext` aplica a role efetiva das custom claims quando disponível, evitando perda temporária de menus administrativos.

_Issues: #3102, #3127, #3087, #3091_

### [1.43.9][web-1.43.9] - 2026-06-28

#### Mudado
- `CreateGameScreen` limpa selecoes de locais que deixam de estar disponiveis e exige `fieldId` ativo para locais catalogados.
- `QuickLocationDialog` continua salvando rascunho de local, mas o jogo usa os dados como local manual ate aprovacao comercial.

#### Segurança
- Firestore Rules agora bloqueiam criacao direta de jogos com `location_id` de quadra suspensa, vencida, nao publicada, sem verificacao ou sem campo ativo.
- Testes de rules cobrem location publicada, suspensa, vencida, sem `field_id` e field inativo.

_Issues: #3120, #3084, #3091_

### [1.43.8][web-1.43.8] - 2026-06-28

#### Adicionado
- Editor reutilizável para CRUD de campos dentro do cadastro de locais.
- Utilitários testados para normalizar preço por hora, carregar campos persistidos e gerar resumo denormalizado de disponibilidade.

#### Mudado
- O cadastro de locais passa a gravar campos em `locations/{locationId}/fields` com `writeBatch()`, `serverTimestamp()` e compatibilidade com `photoUrl` legado.
- O resumo do local passa a manter `field_count`, `primary_field_type` e `has_active_fields` para filtros e ranking comercial.

#### Segurança
- Edição de cadastro não força mais `is_active: true`, evitando reativação indevida de quadras suspensas e preservando as regras administrativas.

_Issues: #3084, #3085, #3088, #3097, #3098_

### [1.43.7][web-1.43.7] - 2026-06-28

#### Adicionado
- Helpers compartilhados para comodidades comerciais de quadras.
- Consulta auxiliar de preços ativos das quadras para filtros públicos.

#### Mudado
- `ManageLocationsScreen`, `LocationsMapScreen`, `FieldOwnerDashboardScreen` e `UserManagementScreen` passam a consumir o status comercial de quadras de forma mais explícita.

#### Segurança
- O fluxo continua preservando as alterações comerciais críticas via Cloud Functions protegidas.

_Issues: #3084, #3099, #3100, #3101, #3103, #3105_

### [1.43.6][web-1.43.6] - 2026-06-28

#### Adicionado
- Contrato web para status de publicação, assinatura e mensalidade de quadras.
- Documentação `docs/VENUE_MONETIZATION.md` para o modelo de monetização.

#### Mudado
- `useLocations` e o mapa público filtram quadras comercialmente indisponíveis.
- Cadastro completo e criação rápida iniciam quadras como `PENDING_REVIEW` e `TRIAL`.

#### Segurança
- Campos comerciais passam a depender das novas operações administrativas protegidas no backend.

_Issues: #3084, #3092, #3093, #3094, #3095, #3096, #3104_

### [1.43.5][web-1.43.5] - 2026-06-28

#### Mudado
- `FieldAvailabilityTimeline` passa a renderizar uma experiência compacta em telas pequenas.
- `CreateGameScreen` deduplica sugestões de horário e evita blocos repetidos no fluxo de data e horário.

### [1.43.4][web-1.43.4] - 2026-06-28

#### Corrigido
- `CreateGameScreen` separa rascunho de digitação dos valores numéricos validados.
- Payload de criação usa os valores normalizados no submit, evitando envio de número antigo após campo limpo.
- Traduções `pt-BR`, `en` e `es` mantidas em paridade para novas mensagens do formulário.

### [1.43.3][web-1.43.3] - 2026-06-28

#### Corrigido
- `GroupDetailScreen` passa a condicionar ações sensíveis por membership/admin e usa tabs scrollable no mobile.
- `CashboxScreen` adiciona ledger com filtros, `receipt_url` opcional e fluxo de `VOIDED` auditável.
- `GroupEditScreen` e `storage.rules` alinham extensões reais de logo do grupo.
- `GroupSettingsScreen` oculta menus sem ações possíveis e remove textos hardcoded.
- `GroupPhotosPanel` agrega `game_photos` a partir de jogos reais do grupo sem duplicar dados.

_Issues: #3030, #3031, #3032, #3033, #3034, #3035, #3036, #3037, #3038_

### [1.43.2][web-1.43.2] - 2026-06-28

#### Corrigido
- `usePlayerCard`, `useStatistics`, `usePlayers` e `AuthContext` passam a ler `statistics/{uid}` e `user_streaks` como fonte canônica.
- Adiciona normalizador compartilhado para mapear `gamesWon`, `bestPlayerCount`, `totalGames` e campos legados sem drift.

### [1.43.1][web-1.43.1] - 2026-06-28

#### Corrigido
- Adiciona `maxHeight`/`overflowY` responsivo no modal do `PlayerCard` e compacta estilos `xs` para viewport mobile com barras do navegador.

### [1.43.0][web-1.43.0] - 2026-06-28

#### Adicionado
- Teste de componente para validar a renderização do novo `PlayerCard` com dados mockados.

#### Mudado
- Reestrutura `web/src/components/player/PlayerCard.tsx` com layout novo, tiles de estatísticas e barras de atributos redesenhadas.

### [1.42.1][web-1.42.1] - 2026-06-28

#### Corrigido
- Remove o wrapper `AdaptiveFormSheet` da `CreateGameScreen` para evitar Drawer lateral no desktop.

### [1.42.0][web-1.42.0] - 2026-06-28

#### Adicionado
- Componente local de seção para a tela de criação de jogo.
- Resumo vivo com progresso dos campos essenciais.

#### Mudado
- Reorganização visual da tela `CreateGameScreen` com layout responsivo em grade.
- Testes atualizados para cobrir o novo hero, seções e resumo.

### [1.41.0][web-1.41.0] - 2026-06-27

#### Adicionado
- Utilitário `groupMatchmaking` para pontuar e ordenar grupos oficiais.
- Testes para match por região, categoria de horário e ordenação por compatibilidade.

#### Mudado
- `DiscoverGroupsScreen` ganhou filtros de matchmaking, score visual, motivos do match e CTA de entrada guiada.

_Issues: #2975_

### [1.40.0][web-1.40.0] - 2026-06-27

#### Adicionado
- Utilitário `friendlyComparison` para montar resumo, headline e texto compartilhável.
- Testes unitários para vitórias, desempate por gols e cenário equilibrado.

#### Mudado
- `HeadToHeadScreen` passa a exibir um card de rivalidade amistosa quando há jogos em comum.

_Issues: #2976_

### [1.39.0][web-1.39.0] - 2026-06-27

#### Adicionado
- Utilitário `headToHeadPeriod` com tipo `HeadToHeadPeriod` e função `isGameWithinHeadToHeadPeriod`.
- Testes unitários para os períodos `30d`, `90d`, `365d` e `all`.

#### Mudado
- `useHeadToHead` agora inclui o período no `queryKey` e filtra partidas finalizadas antes de calcular estatísticas.

_Issues: #2977_

### [1.38.0][web-1.38.0] - 2026-06-27

#### Adicionado
- Utilitário `compareGroupLeagueStandings` com desempate por presença e critérios esportivos.
- Testes unitários para ordenação por pontos, presença, vitórias, saldo, gols e nome.

#### Corrigido
- `useGroupLeague` agora usa a temporada selecionada no query key, fetch e listener em tempo real.

_Issues: #2978_

### [1.37.0][web-1.37.0] - 2026-06-27

#### Adicionado
- Utilitário `buildPostGameHighlights` com heurística testável para MVP, melhor dupla e lance marcante.
- Componente `PostGameHighlightsPanel` integrado ao `GameDetailScreen`.
- Testes unitários para cálculo e texto compartilhável dos destaques pós-jogo.

_Issues: #2969_

### [1.36.0][web-1.36.0] - 2026-06-27

#### Adicionado
- Hook web `usePostGameReputation` para carregar avaliações enviadas e chamar a Function server-side.
- Componente `PostGameReputationPanel` integrado ao `GameDetailScreen`.
- Agregados `reputation_*` exibidos no `ProfileScreen`.

#### Segurança
- Cliente não escreve agregados de reputação diretamente; a UI chama `submitPostGameReputation`.

_Issues: #2968_

### [1.35.0][web-1.35.0] - 2026-06-27

#### Adicionado
- Hook `useGameRides` com listener em tempo real para `game_rides`.
- Painel web `GameRidesPanel` integrado ao `GameDetailScreen`.
- Notificações internas `GAME_RIDE` criadas junto da publicação via `writeBatch()`.

#### Segurança
- Firestore Rules para `game_rides` validam schema, autoria, documento `{gameId}_{uid}`, origem/destino aproximados, limite de vagas e atualização apenas pelo dono da carona.

_Issues: #2980_

### [1.34.0][web-1.34.0] - 2026-06-27

#### Adicionado
- Componente social de check-in usando `checked_in`/`checked_in_at` das confirmações.

#### Corrigido
- Condição web agora usa `checkedIn` em vez de depender do status `CHECKED_IN`, que a Cloud Function não grava.

_Issues: #2981_

### [1.33.0][web-1.33.0] - 2026-06-27

#### Adicionado
- Componente web `GamePhotosTab` integrado ao `GameDetailScreen`.
- Testes de Firestore Rules para criação, bloqueios de abuso e exclusão de `game_photos`.

#### Segurança
- `game_photos` agora valida schema, tipo MIME, tamanho, legenda, status e `storage_path` pertencente ao uploader.
- Storage Rules adicionam caminho `games/{gameId}/photos/{userId}/{fileName}` com upload apenas pós-jogo e deleção por uploader/organização/admin.

_Issues: #2982_

### [1.32.0][web-1.32.0] - 2026-06-27

#### Adicionado
- Hook `useUpdateChallengeProgress` para progresso/finalização com toast e notificação interna.
- Testes de Firestore Rules para criação, update permitido e bloqueios de abuso em `group-challenges`.

#### Corrigido
- Criação web de desafios passa a gravar `created_by`, `updated_at`, meta, alvo e prazo.

#### Segurança
- Rules de `group-challenges` agora validam schema, autor autenticado, associação ao grupo, progresso máximo e imutabilidade de autor/grupos/meta/alvo/prazo.

_Issues: #2984_

### [1.31.0][web-1.31.0] - 2026-06-27

#### Adicionado
- Hook `useFavoriteSquads` com listener, toasts e validação client-side.
- Utilitário testável para normalizar, validar, filtrar e aplicar favoritos na formação.
- Rules owner-only para `users/{uid}/favorite_squads`.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Favoritos são privados ao dono do perfil e limitados por schema nas Firestore Rules.

_Issues: #2985_

### [1.30.0][web-1.30.0] - 2026-06-27

#### Adicionado
- Utilitário testável `getReconnectSuggestions` para priorizar grupos que merecem reencontro.
- Widget `ReconnectSuggestionWidget` no dashboard web, reaproveitando `useGroups()` sem novas consultas Firestore.
- Testes unitários para janela de reconexão, grupos com jogo futuro e ordenação por distância sem jogo.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Sem novas permissões ou regras nesta versão; a sugestão usa apenas dados de grupos já carregados para o usuário.

_Issues: #2986_

### [1.29.0][web-1.29.0] - 2026-06-27

#### Adicionado
- Utilitário testável `groupNotificationsByContext` para organizar notificações por contexto.
- Mutação `declineGameInvite` com `writeBatch()` e fallback para resolver convites mesmo quando não há confirmação pendente apagável.
- Testes unitários para agrupamento contextual e recusa rápida de convites.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Sem mudanças de regras nesta versão; a recusa usa permissões existentes de deleção da própria confirmação.

_Issues: #2987_

### [1.28.0][web-1.28.0] - 2026-06-27

#### Adicionado
- Campo `lastGameDate` no parse web de usuários para consumir `last_game_date` do Firestore.
- Filtro `recentPresenceOnly` em `usePositionReinforcements`.
- Testes unitários para presença recente, janela de 30 dias e filtro de candidatos.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Sem mudanças de segurança nesta versão.

_Issues: #2972_

### [1.27.0][web-1.27.0] - 2026-06-27

#### Adicionado
- `useLookingForGameToday` e badge de disponibilidade nas telas de perfil/busca.
- Ranking de candidatos de reforço por posição com testes unitários.
- Painel `PositionReinforcementsPanel` no detalhe do jogo para owners/admins.

#### Corrigido
- Fluxo de convocação de reforço usa `writeBatch()` para manter confirmação pendente, summon e notificação consistentes.

#### Segurança
- `game_summons` passou a exigir whitelist de campos, `status=PENDING` na criação e enum fechado de posição.

_Issues: #2974, #2973 · PRs: #3002, #3003_

### [1.26.3][web-1.26.3] - 2026-06-21

#### Mudado
- `canSendSmsOtp` mantém App Check obrigatório, mas não consome o token antes do Firebase Phone Auth.
- O web renderiza explicitamente o reCAPTCHA invisível e continua o Phone Auth quando o preflight consultivo falha.
- O Android resolve a `Activity` a partir de `ContextWrapper` antes de iniciar `PhoneAuthProvider.verifyPhoneNumber`.

#### Corrigido
- Fluxo de verificação por SMS deixa de bloquear cadastro legítimo em falhas transitórias do preflight.

_PRs: #2810_

### [1.26.2][web-1.26.2] - 2026-06-21

#### Adicionado
- `autoClosePastGames` roda de hora em hora e fecha jogos ativos com mais de 2 dias de atraso.
- Jogos antigos com quórum confirmado, ou em status `LIVE`, viram `FINISHED`; sem quórum viram `CANCELLED`.

#### Mudado
- `useNextGame`, `usePrefetchHome` e `usePublicGames('map')` filtram `dateTime >= agora`.
- A aba `GamesTab` aplica uma tolerância visual curta para esconder ativos vencidos antes do cron.

#### Corrigido
- Listas e cards de próximo jogo não priorizam mais partidas antigas que ficaram com status ativo no Firestore.

_PRs: #2810_

### [1.26.1][web-1.26.1] - 2026-06-21

#### Mudado
- `useScrollRestoration` agora chaveia por `pathname + search`, rola para o topo em navegações novas e restaura posição apenas em navegação `POP`.
- `useFocusOnNavigate` usa `focus({ preventScroll: true })` para preservar o alinhamento visual após troca de rota.
- Componentes de auth, containers e topbar mobile receberam proteções de layout responsivo.

#### Corrigido
- Scroll inicial de páginas e abas web ajustado para não ficar escondido sob a topbar.
- Bundle de release notes web atualizado para refletir as mudanças recentes.

_PRs: #2810_

### [1.26.0][web-1.26.0] - 2026-05-22

#### Adicionado
- Tela "Novidades" / release notes (spec feat-2026-05-22).

#### Mudado
- i18n, responsividade e dark mode em 14+ telas (#1465).
- Logo padronizada em splash/login/register/forgot-password (#1417).

#### Corrigido
- LiveGameScreen com maxWidth no desktop e MuiDialog no tema escuro (#1479).
- Erros duplicados Alert+Toast em EditProfile e no fluxo de CPF (#1421, #1420).

_Issues: #1465, #1479, #1421, #1420 · PRs: #1465, #1479, #1421, #1420, #1417_

## iOS

### [1.8.0][ios-1.8.0] - 2026-10-01

#### Adicionado
- Tela de tema iOS (Claro/Escuro/Sistema + alto contraste) persistida em `NSUserDefaults`; default `SYSTEM` (#4097).

#### Mudado
- `platformTypographyFontFamily` efetivamente aplica SF no iOS; Poppins realocada para `nonIosMain` (#4109).
- PostGameReportScreen usa `onColorFor`/tokens em vez de `Color.White` hardcoded; 6 literais trocados por tokens (#4096).
- Removidas as 5 paletas CMP sem consumidor (#4098).

_Issues: #4096, #4097, #4098, #4099, #4109 · PRs: #4118, #4154_

### [1.7.2][ios-1.7.2] - 2026-08-28

#### Mudado
- `AppContent()` passa `AppThemeConfig(mode = ThemeMode.SYSTEM)` para `FutebaTheme`, fazendo `isSystemInDarkTheme()` voltar a ser lido.

#### Corrigido
- Comentários desatualizados sobre o controle da status bar no iOS (`Theme.ios.kt` / `MainViewController.kt`) corrigidos para descrever o mecanismo real (segue o sistema via `UIUserInterfaceStyle = Automatic`).

_Issues: #4086_

### [1.7.1][ios-1.7.1] - 2026-08-01

#### Mudado
- `secondary` iOS: `#FF9600` → `#005FCC` (alinhado ao `palette.secondary.main` web).
- `tertiary` seed: `#FF6D00` (antes colapsava em secondary por ser null).
- `DefaultSeeds` em `ThemeConfig.kt` (KMP): constantes canônicas ARGB centralizadas.

#### Removido
- `FutebaLightColorScheme`, `FutebaDarkColorScheme` e constantes `md3_*` sem consumidores no `composeApp`.

#### Corrigido
- `check-design-tokens-parity.js`: gate CI valida seeds vivas em vez de constantes mortas.

_Issues: #3934, #3933_

### [1.7.0][ios-1.7.0] - 2026-07-19

#### Adicionado
- Campos opcionais do breakdown agregado foram incorporados ao contrato KMP.

#### Mudado
- Defaults e testes compartilhados acompanham a Gamificação 2.0.

#### Corrigido
- As duas árvores de recursos PT-BR mantêm conteúdo e placeholders sincronizados.

_Issues: #3844, #3847, #3848, #3849, #3850, #3851, #3852, #3853, #3854, #3855, #3856_

### [1.6.3][ios-1.6.3] - 2026-07-16

#### Adicionado
- `PushTokenManager` com armazenamento no Keychain, sequência persistente, retry limitado e timeout.
- Timeout de registro tolera cold starts do backend; falhas do Keychain são registradas sem expor o token.
- O KMP remove o registro no servidor, mas preserva no Keychain o identificador da instalação para reassociação segura no próximo login.
- Entitlements de Push Notifications e App Attest separados por configuração de build.

#### Segurança
- Registro identifica a instalação sem expor o token FCM em coleções públicas ou logs.
- Tombstones e barreiras transacionais protegem logout, troca de conta e exclusão LGPD contra corridas.

_Issues: #3741_

### [1.6.2][ios-1.6.2] - 2026-07-14

#### Mudado
- A camada Keychain converte `OSStatus` em resultados explícitos sem registrar tokens ou segredos.

#### Corrigido
- Leitura, atualização e remoção preservam a semântica de item inexistente e propagam as demais falhas.

_Issues: #3609 · PRs: #3658_

### [1.6.1][ios-1.6.1] - 2026-07-10

#### Mudado
- `LiveGameRepositoryImpl` foi unificado em `nativeAndAndroidMain`, com lifecycle, reconexão e request ID idempotente.
- DI e navegação iOS propagam `gameId`, `groupId` e `ownerId` reais.

_Issues: #3499, #3504, #3509 · PRs: #3511_

### [1.6.0][ios-1.6.0] - 2026-05-22

#### Adicionado
- Fundação iOS: shared/iosMain e scaffold composeApp com navegação e Koin (#1294).
- CMP Fase 3: 8 telas Core portadas para composeApp/commonMain (#1298).
- Contrato AuthRepository com signIn/signUp; VMs de Login/Register conectadas (#1299).

#### Mudado
- Entrada com published false — o app iOS ainda não está disponível para usuários finais, então não vai ao Firestore.

#### Corrigido
- Geração dos 9 PNGs de AppIcon a partir do logo da marca (#1468).

_Issues: #1297 · PRs: #1294, #1298, #1299, #1468_

## Cloud Functions

### [1.14.0][functions-1.14.0] - 2026-10-31

#### Adicionado
- Callable `deleteAccount`, que web e Android já chamavam mas nunca tinha sido exportada; erros com `details.reason` para reautenticação e grupos bloqueantes (#4416).

#### Mudado
- `firestore.rules`: `canViewGameById(gameId)` na mídia e na fila de espera de jogos; listagem de mídia sem filtro por `game_id` negada (#4414).
- `storage.rules`: `canViewGameMedia` nos caminhos de fotos e vídeos de jogo; caminho só de leitura para `video_thumbnails` (#4414).

#### Corrigido
- `onUserDeleted` apagava a lista de grupos antes de anonimizar membros, caixa e pagadores; a cascata agora também cobre seguidores, presenças antigas, fila de espera, jogos e grupos deixados (#4416).

#### Segurança
- Dependências: multer 2.5.0, undici e transitivas do lockfile (zod 4.6.7, body-parser 2.4.0, qs 6.17.1) (#4441, #4450).

_Issues: #4391, #4393 · PRs: #4414, #4416, #4441, #4450_

### [1.13.0][functions-1.13.0] - 2026-10-01

#### Adicionado
- Callable `updateMyLocation` (App Check, rate limit, cooldown de 10 min, plausibilidade de movimento, geohash server-side) (#4123).
- Trigger `onDocumentDeleted` de confirmations → `promoteWaitlistOnVacancy` compartilhado com `onGameVacancy` (#4144).
- Trigger `onDirectMessageDeleted` recalculando preview de chats (#4120).
- `mirrorBadgeToRoot` para ambassador/mito_rodada/mvp_liga + backfill de badges históricas (#4138).
- `audit_logs` com `AUTO_CANCEL_LOW_QUORUM` e opt-out por jogo (`auto_cancel_enabled`) (#4133).
- Backfills: `backfill-badges-mirror.ts`, `backfill-lgpd-ghost-users.ts` (#4138, #4139).

#### Mudado
- `processExpiredWaitlistEntries` lê o jogo na transação: cancelado/iniciado/cheio não convoca a fila (#4134).
- Quórum efetivo = min(min_players, max_players) no auto-cancel (#4133).
- Rules de `games` (get/list whitelist, create com visibility) e `user_locations` (create: false, update só revogação) (#4126, #4123).
- `stripUndefinedValues` único preservando FieldValue/Timestamp/GeoPoint (#4147).
- `calculateNextParticipationStreak` com janela STREAK_KEEP_GAP_DAYS=8; compact-streaks reset > 9 dias; nudge streak_at_risk limitado à janela (#4150).
- onUserDeleted: recursiveDelete de users/{uid} + user_locations + anonimização de DMs (#4139, #4124, #4120).
- account-merge migra gamificação completa e apaga user_locations da origem (#4118, #4124).

#### Corrigido
- `listManagedGroupIds` com índice COLLECTION_GROUP de league_seasons e paginação startAfter (#4128).
- systemHealthCheck CHECK 5 sem query de 2 desigualdades (#4129).
- `onGroupDeleted` cascata paginada (#4118).
- billing_expires_at vencido → CANCELLED uma vez, com ledger (#4118).
- `hasGameUpdateNotificationRelevantChange` com toMillis (#4143).
- Push de cancelamento do sistema suprimido + mute_groups respeitado (#4135).

_Issues: #4100, #4107, #4108, #4109, #4110, #4111, #4112, #4113, #4119, #4120, #4123, #4124, #4126, #4128, #4129, #4133, #4134, #4135, #4138, #4139, #4140, #4141, #4143, #4144, #4147, #4150 · PRs: #4118, #4151, #4152, #4153, #4154, #4155, #4156, #4159, #4161_

### [1.12.6][functions-1.12.6] - 2026-08-28

#### Adicionado
- `joinGameWaitlistHandler` com autenticação, validação de argumentos, idempotência e atribuição transacional de `queue_position`.
- `joinGameWaitlist` agora é `secureCallable` com App Check, rate limit, audit log, autorização de grupo/status e teto de fila (`MAX_WAITLIST_PER_GAME`).
- Índice composto `game_videos(status ASC, created_at ASC)` para o janitor server-side.
- Logs de saturação para o janitor de vídeos e a invalidação paginada do cache de leaderboard.

#### Mudado
- `onGameVacancy` e `processExpiredWaitlistEntries` ordenam a fila por `queue_position`.
- `processExpiredWaitlistEntries` persiste a notificação antes do push (com retry) e não reverte a entrada promovida em falha de entrega.
- `createGamePhoto` usa download token rotacionável (`firebaseDownloadUrl`) em vez de `getSignedUrl` irrevogável.
- Passo 16 de `onUserDeleted` pagina com `startAfter` + guarda `MAX_ANON_ITERATIONS`.
- `reconcileStaleProcessingGameVideos` filtra e ordena por `created_at` no Firestore antes de processar a página.

#### Corrigido
- Lookup de Storage deixou de colapsar erro transitório em ausência de objeto, evitando rejeição destrutiva.
- Promoção e join da fila foram centralizados no backend para impedir corridas entre clientes.
- Leitura duplicada no passo 16 de `onUserDeleted` eliminada (log de auditoria LGPD sem total inflado).

_Issues: #4063, #4064, #4065, #4066, #4067, #4068, #4069, #4070, #4071, #4081, #4082, #4083, #4087 · PRs: #4072, #4073, #4074, #4075, #4091, #4092_

### [1.12.5][functions-1.12.5] - 2026-08-15

#### Adicionado
- `createGamePhoto` com teto por jogo e por usuário, espelhando `createGameVideo`.
- Job de reconciliação para documentos de vídeo presos em `PROCESSING`.
- Cooldown e supressão por não-engajamento nos nudges de gamificação.

#### Corrigido
- Corrida entre reaper e criação de vídeo resolvida (delete condicional e atômico).
- `onGameVacancy` ordena por `added_at` e promove a primeira entrada para `NOTIFIED`.
- Merge de conta pagina coleções de alto volume em vez de bloquear permanentemente.
- Invalidação de cache de ranking com teto de páginas e filtro no servidor.
- Rate limit adicionado a `getFieldAvailability`.
- XP de MVP é creditado na temporada do jogo, não na ativa na hora do voto.
- Índice `confirmations(user_id, status)` restaurado, alinhando repo e produção.

#### Segurança
- `added_at` da fila de espera ancorado ao relógio do servidor (janela de 60s).

_Issues: #4038, #4039, #4040, #4043, #4044, #4045, #4046, #4049, #4053, #4054, #4058_

### [1.12.4][functions-1.12.4] - 2026-08-08

#### Adicionado
- Callable `createGameVideo` com rate limit, validacao de Storage e transacao idempotente.

#### Corrigido
- Indice composto para a consulta de videos ativos.
- URL de video derivada do token de Storage, sem aceitar URL fornecida pelo cliente.
- Falhas de consulta de limite rejeitam o processamento em vez de deixar documentos presos.

_Issues: #4016, #4017, #4024_

### [1.12.3][functions-1.12.3] - 2026-08-01

#### Adicionado
- `onUserRoleUpdated`: trigger bidirecional reconcilia role Firestore → Custom Claims em qualquer origem (console, CRM, Admin SDK).
- `recoverStaleProcessingDocs`: recuperação paginada de docs de notificação presos em PROCESSING.
- `readScoresMap`: leitor canônico de placar por time (2-4), com fallback legado transparente.

#### Mudado
- `isScoreConsistentFromEventStream` usa `Map<teamId, number>`.
- Event payload usa `score_team_id` canônico com fallback legado.

#### Corrigido
- `concludeMvpVoting` adia XP quando `xp_reward_status` é HELD_FOR_REVIEW ou REJECTED_BY_ADMIN.
- Pipeline principal consulta logs de votação antes de aplicar MVP/Bola Murcha (defesa em profundidade).
- `setUserVerified` e `account-merge` não escrevem mais `phone` em `users/{uid}`.
- `phone` adicionado a `PII_FIELDS` com caminho de reparo via `removePiiFromUsers`.
- Fila de notificações: orçamento de 90s, claim-on-demand paginado, parallel prefetch, batching de settings, enqueue slicing.
- Rules: `phone_verified` removido do guarda PII (é booleano, não PII); `phone` E.164 permanece protegido.

_Issues: #3938, #3940, #3941, #3935, #3942_

### [1.12.2][functions-1.12.2] - 2026-07-20

#### Corrigido
- `confirmPlayerAsManager` aceita temporariamente requests autenticados sem App Check enquanto a emissão web retorna 403.
- Teste de regressão fixa explicitamente a configuração transitória para evitar mudança silenciosa.
- A reativação da exigência de App Check permanece vinculada ao reparo da atestação web.

_Issues: #3868_

### [1.12.1][functions-1.12.1] - 2026-07-20

#### Corrigido
- `recurrence-engine` resolve nomes ausentes ou genéricos em `users/{uid}` antes de persistir confirmations.
- Adicionado fallback seguro “Jogador” apenas para perfis sem qualquer nome utilizável.
- Incluído script idempotente, com dry-run padrão, para reparar somente `user_name` na partida afetada.

_Issues: #3864_

### [1.12.0][functions-1.12.0] - 2026-07-20

#### Adicionado
- `functions/src/games/confirm-player-as-manager.ts`: callable com AppCheck, rate limit, validação de `canManageGame`, checagem de capacidade em transaction e auditoria em `audit_logs/`. Idempotente (já CONFIRMED retorna success).

#### Mudado
- `finishGameLifecycle` agora chama `isScoreConsistentFromEventStream` antes do commit da transaction. Divergências entre `live_scores` e o stream de eventos GOAL são logadas como warning (não bloqueiam a finalização), espelhando o `auto-close-past-games`.

#### Corrigido
- `submitLiveGameEvent` rejeita novos eventos quando o jogo atinge 500 (cap ativo durante o LIVE). Antes o limite só era verificado na finalização, deixando o jogo preso em LIVE sem feedback até alguém tentar finalizar.

_Issues: #3862_

### [1.11.1][functions-1.11.1] - 2026-07-20

#### Corrigido
- Declarado o índice composto do collection group `members` usado por `createDirectChat` para validar `status` e `user_id`.
- Adicionado contrato automatizado para impedir a remoção acidental do índice.

_Issues: #3858_

### [1.11.0][functions-1.11.0] - 2026-07-19

#### Adicionado
- Campos opcionais no log agregado e marcadores transacionais mensais em timezone America/Sao_Paulo.
- Testes de boundary, cap, anti-fraude, concorrência e retry para as novas regras.

#### Mudado
- O pipeline mantém um documento idempotente por jogo e jogador e não executa backfill retroativo.
- Defaults canônicos e overrides administrativos compatíveis usam a nova economia.

#### Corrigido
- Mensagens `HttpsError` visíveis foram corrigidas sem alterar códigos ou condições.

#### Segurança
- O teto de 500 XP, validação server-side e deduplicação transacional permanecem obrigatórios.

_Issues: #3845, #3847, #3848, #3849, #3850, #3851, #3852, #3853, #3854, #3855, #3856_

### [1.10.3][functions-1.10.3] - 2026-07-17

#### Mudado
- Build, lint, testes unitários de Functions e suítes completas de regras foram validados.

#### Corrigido
- Recorrência tolera campos ausentes sem retries infinitos.
- Liga usa snapshots transacionais e clamp anti-cheat.
- Auto-close cobre `dateTime`, `date_time` e `date`.
- Datas legadas combinam dia e horário em São Paulo antes de aplicar a tolerância de 48 horas.
- Deduplicação de notificações concluídas mantém evidência por sete dias.
- Processamento XP tolera usuários ausentes e respeita o orçamento de writes.
- Carrasco usa placar canônico e histórico limitado, ordenado e testado.
- Liga revalida o estado atual do jogo dentro da transação antes de aplicar standings.

#### Segurança
- Regras limitam estatísticas de confirmações, tornam flags de MVP exclusivas do servidor e restringem grupos oficiais a administradores.
- Mirrors de memberships só aceitam dados coerentes com a fonte autoritativa; uploads legados continuam bloqueados para grupos inativos.

_Issues: #3816, #3817, #3823, #3824, #3825, #3826, #3827, #3828, #3829, #3830, #3831, #3832, #3833, #3834, #3835, #3836_

### [1.10.2][functions-1.10.2] - 2026-07-16

#### Adicionado
- Callables autenticadas e protegidas por App Check para registrar e remover tokens por instalação.
- Limite de instalações, expiração de 90 dias e limpeza programada de registros antigos.
- Índice canônico global por hash para deduplicação e resolução de proprietário.

#### Segurança
- Regras negam acesso direto do cliente às coleções raiz privadas.
- Sequências, tombstones, preconditions e barreira LGPD tornam as mutações resistentes a concorrência.
- Senders diretos, em lote e multicast usam resolução canônica fail-closed antes do fallback legado.
- Tokens removidos, rotacionados ou expirados mantêm apenas um hash de revogação sem credencial nem usuário, impedindo reativação por campos legados.
- Falhas da consulta canônica geram alerta operacional sem registrar tokens ou IDs sensíveis.

_Issues: #3741_

### [1.10.1][functions-1.10.1] - 2026-07-14

#### Adicionado
- Callable `getFieldAvailability` autenticada e protegida por App Check, limitada a 60 dias e a uma allowlist de intervalos.
- Filtro opcional `userIds` em `getLeaguePlayers` para hidratações públicas em lotes.

#### Mudado
- O schema do cache público da Liga foi versionado para incluir somente sinais esportivos sanitizados necessários aos clientes.

#### Segurança
- Projeções via Admin SDK filtram soft-delete, perfis não pesquisáveis e PII antes de responder ao cliente.

_Issues: #3688, #3691_

### [1.10.0][functions-1.10.0] - 2026-07-14

#### Mudado
- Functions e Firestore Rules passam a compartilhar invariantes canônicos de status, autoria e membership.
- Operações multi-documento usam transações, batches e checkpoints idempotentes.

#### Corrigido
- Corridas de votação, comentários órfãos, waitlist, reações e writers de notificações receberam regressões automatizadas.

#### Segurança
- Escritas de clientes em notificações, reações e relações protegidas foram restringidas às identidades e vínculos autorizados.

_Issues: #3585, #3586, #3587, #3588, #3589, #3590, #3591, #3592, #3593, #3594, #3595, #3596, #3597, #3598, #3599, #3601, #3608 · PRs: #3648, #3650, #3651, #3652, #3653, #3654, #3655, #3656, #3657, #3659_

### [1.9.2][functions-1.9.2] - 2026-07-13

#### Corrigido
- `functions/src/xp/processing.ts`: `processXpIdempotent` passa a sinalizar corretamente `alreadyProcessed` quando perde a corrida do marker dentro da transaction.
- `functions/src/xp/processing.ts`: `processXpBatch` mantém estado progressivo em memória por usuário dentro do chunk, preservando cadeia de XP, nível final e consumo único de milestones.
- `firestore.rules`: `xp_logs` agora aceita somente leitura autenticada/autorizada; create/update/delete ficam bloqueados para clientes.
- `functions/test/xp-dedup-retry.test.ts`, `functions/test/processing.test.ts` e `firestore-rules-tests/src/xp-logs.test.ts`: adicionadas regressões para corrida de marker, usuário repetido no mesmo batch e bloqueio client-side de `xp_logs`.

_Issues: #3578, #3579, #3580_

### [1.9.1][functions-1.9.1] - 2026-07-11

#### Corrigido
- O predeploy executa `install:ffmpeg` antes de lint e build e inclui `vendor/ffmpeg/ffmpeg` com modo executável no source bundle.
- Hosts macOS validam SHA-256 do archive e do ELF Linux; o runtime Linux mantém a validação executável da versão 8.1.2.
- Testes protegem o contrato cross-platform e a ordem obrigatória do predeploy.

_Issues: #3533_

### [1.9.0][functions-1.9.0] - 2026-07-11

#### Adicionado
- Callable `createGroupWallMediaDraft`, trigger `onGroupWallMediaStaged` e limpeza programada `cleanupExpiredGroupWallMediaDrafts`.
- Contrato de mídia com limites por tipo, inspeção de magic bytes, validação de codec/duração e precondições de geração do Storage.
- Conversão de imagens e posters com Sharp, extração segura de quadro com FFmpeg e objetos finais imutáveis por conteúdo.
- Rate limit por usuário, lease de processamento, métricas sem PII e harness real de carga para 10, 100 e 1.000 usuários.
- FFmpeg 8.1.2 pinado por dois hashes, mirror imutável, gate Linux real e runtime sem papel Editor para mídia do Mural e vídeos de jogos.

#### Corrigido
- Publicação atômica do post e do estado `READY`, inclusive após confirmação ambígua do Firestore.
- Regras bloqueiam sobrescrita do staging, upload legado e criação client-side de post com mídia.
- Cleanup usa geração específica e não remove um objeto válido criado por uma tentativa posterior.
- Expiração síncrona, teto de retries, revalidação de grupo/membership e janitor paginado impedem filas abusivas e publicação após arquivamento.
- Compatibilidade de clientes antigos fica limitada por kill switch com data, bucket/path do próprio autor e MIME/extensão exatos.

_Issues: #3518, #3519_

### [1.8.0][functions-1.8.0] - 2026-07-11

#### Adicionado
- `configureMonthlyFinance`, `setMonthlyMember`, `rebuildMonthlyCycle`, `setMonthlyGameOverride` e `settleMonthlyCharge`.
- Snapshots por competência ligados a revisões de configuração/roster, expansão de séries não materializadas e `payment_sequence` monotônico.
- Índices do calendário mensal/recorrência/settlements e TTL de deduplicação de notificações.

#### Corrigido
- Operações financeiras com centavos, settlement permanente, replay por intenção completa e estorno fora de ordem.
- Locks com lease, paginação de reminders e retomada durável da criação de recorrências.
- Regras de identidade, autorização e migração de referências ativas na união de contas.
- Callables mensais com audit log, rate limits dedicados e App Check anti-replay.

_Issues: #3529, #3530_

### [1.7.19][functions-1.7.19] - 2026-07-10

#### Adicionado
- `phone_index` com HMAC-SHA-256, `account_aliases` e executor `completeAccountMerge`.
- Lease contra processamento concorrente, manifesto, auditoria e expiração das provas.
- Backfill idempotente de índices de telefone sem registrar PII em logs.

#### Corrigido
- Cleanup de conta só remove índices de CPF/telefone que ainda pertencem ao UID apagado.
- Requests de união não retornam mais UIDs no identificador público.

_Issues: #3525 · PRs: #3526_

### [1.7.18][functions-1.7.18] - 2026-07-10

#### Corrigido
- `wall-media-cleanup` aceita JPG, JPEG, PNG, WebP e MP4 sob o prefixo autorizado do grupo.
- Exclusões permanecem idempotentes com `ignoreNotFound` e preservam os guardrails existentes.

_PRs: #3520_

### [1.7.17][functions-1.7.17] - 2026-07-10

#### Adicionado
- Rollup de SLO realtime com p50, p95, p99, erro, trigger lag, `ABORTED` e `RESOURCE_EXHAUSTED`.
- Markers idempotentes com TTL para contadores de membros, confirmações e operações do caixa.

#### Segurança
- Jogo privado exige owner, membership ativa ou convite para confirmar presença.
- Firestore Rules bloqueiam writes diretos no ledger e no resumo do caixa.
- Firestore e Storage Rules reconhecem membros legados sem `status` como ativos, mantendo `INACTIVE` e outsiders bloqueados.

_Issues: #3267, #3499, #3500, #3501, #3502, #3503, #3504, #3510 · PRs: #3511_

### [1.7.16][functions-1.7.16] - 2026-07-10

#### Corrigido
- `sanitizeText` usa normalização NFKC e parsing estrutural em vez de substituições regex incompletas, corrigindo o alerta CodeQL de severidade alta.
- Contrato automatizado mantém a query `dateTime == null` alinhada ao índice composto `dateTime/date/__name__`.

_Issues: #3497 · PRs: #3498_

### [1.7.15][functions-1.7.15] - 2026-07-10

#### Corrigido
- `submitLiveGameEvent` usa documento determinístico por `requestId` e valida o vínculo entre `eventId` e `gameId` na reversão.
- `finishGameLifecycle` usa lock transacional recuperável para serializar eventos e agregação sem expor status transitório aos clientes.
- `submitMvpVotes` executa todas as leituras antes das escritas e `concludeMvpVoting` persiste vencedores, totais e time vencedor canônicos.

_Issues: #3495 · PRs: #3496_

### [1.7.14][functions-1.7.14] - 2026-07-09

#### Corrigido
- Soft delete de grupos e jogos ganhou cascatas, limites de iteração e bloqueio de concorrência; convites de grupos removidos são invalidados.
- Triggers de criação e atualização de jogos, notificações, badges e level-up usam guards de idempotência, deduplicação e transações adequadas.
- Paginação de migrações, rankings e manutenção passou a usar ordenação estável; jobs concorrentes são serializados quando necessário.
- Ligas e temporadas corrigem recomputação de standings, atribuição de placar, archive de estatísticas, reputação e XP por temporada.
- Cashbox usa centavos inteiros e pagina o histórico completo; validações de janela pós-jogo e privacidade de nearby players foram alinhadas às regras de negócio.

_Issues: #3390, #3392, #3411, #3422, #3428, #3429, #3433, #3435, #3436, #3437, #3438, #3439, #3441, #3443, #3445, #3446, #3447, #3449, #3451, #3453, #3455, #3457, #3459, #3461, #3463, #3464, #3466, #3467_

### [1.7.13][functions-1.7.13] - 2026-07-09

#### Corrigido
- `onGroupInviteResponse` cria membership antes do guard de deduplicacao da notificacao.
- `onInviteRedeemed` valida `expires_at` antes de chamar `toMillis`.
- `onUserCreatedProcessInvite` so loga processamento quando a transacao concede XP.

### [1.7.12][functions-1.7.12] - 2026-07-08

#### Corrigido
- `onMemberWritten` deixa de depender de delta acumulado e grava o valor absoluto recontado de `groups/{gid}/members`.
- Escritas repetidas, aprovacoes de join-request ja contadas e dados legados convergem para o mesmo `member_count`.
- Teste cobre drift real: grupo salvo com 2 membros e apenas 1 membro ativo.

### [1.7.11][functions-1.7.11] - 2026-07-08

#### Corrigido
- `isParticipationEligible` centraliza status, overlap suspeito e campos `checked_in`/`was_present`.
- `onGameStatusUpdate` calcula streak dentro da transaction de XP e grava `user_streaks`.
- `submitMvpVote`, `submitMvpVotes` e `concludeMvpVoting` filtram participantes inelegiveis.
- `processXpBatch` deduplica entradas repetidas no mesmo input antes de incrementar XP.
- Scripts de auditoria somam `xp_earned` e aceitam aliases legados sem subcontar logs atuais.

### [1.7.10][functions-1.7.10] - 2026-07-08

#### Corrigido
- `validateInviteCode` grava `pending_app_invites/{uid}` para usuarios autenticados, com validade curta.
- `onUserCreatedProcessInvite` usa essa pendencia como fallback antes de desistir com "User created without app invite code".
- Testes de regressao cobrem o fallback de cadastro Google sem `invited_by_code`.

### [1.7.9][functions-1.7.9] - 2026-07-08

#### Corrigido
- `onGameFinishedCreateRecurrence` copia `duration_minutes` e `price_manual_override`, evitando que recorrencias caiam em fallback de duracao ou percam a distincao entre preco automatico e manual.

### [1.7.8][functions-1.7.8] - 2026-07-07

#### Corrigido
- `autoClosePastGames` remove valores `undefined` recursivamente antes de chamar `tx.update`, evitando rejeição do Firestore em metadados opcionais de validação.
- Adicionada regressão cobrindo payload de validação com `score_event_consistent` ausente.

### [1.7.7][functions-1.7.7] - 2026-07-07

#### Mudado
- `getLeaguePlayers` grava o diretório público da Liga em cache Firestore chunked, chaveado por temporada, grupo e gênero, e aplica busca/ordenação/paginação sobre essa base reutilizada.
- `discoverNearbyPlayers` troca leituras pontuais `doc.get()` por `getAll` chunked para perfis públicos e `following`.
- Adiciona regressões para cache chunked do diretório da Liga.
- Adiciona regressões para batching de leituras em `nearby-players`.

_Issues: #3358, #3359_

### [1.7.6][functions-1.7.6] - 2026-07-07

#### Corrigido
- `calculateGameValidationScore` omite `score_event_consistent` do resumo quando o sinal e indefinido, evitando `undefined` em updates do Firestore.
- Adiciona regressao para preservar `false` quando ha divergencia real e omitir o campo quando nao existe evidencia de placar.

_Issues: #3355 · PRs: #3356_

### [1.7.5][functions-1.7.5] - 2026-07-07

#### Corrigido
- Adiciona `checkRateLimit` em `toggleFollowUser` e `joinPublicGame`.
- Troca o agregado de reputacao por somas incrementais persistidas em `users/{uid}`.
- Mantem seed legado fora da transacao para perfis que ainda nao possuem os campos de soma.
- Cobre rejeicao `resource-exhausted` e regressao contra full-scan transacional nos testes de Functions.

_Issues: #3343, #3344_

### [1.7.4][functions-1.7.4] - 2026-07-07

#### Corrigido
- Separa limite de pagina do limite de varredura do diretorio publico da Liga.
- Varre `is_searchable` e `isSearchable` com cursor por ID de documento para montar a lista deduplicada.
- Trigger de convite aceito deixa de sobrescrever `role`, `joined_at` e `total_games` de membro ja existente.

_PRs: #3351_

### [1.7.3][functions-1.7.3] - 2026-07-07

#### Adicionado
- `getLeaguePlayers` aceita `search`, `sortField`, `sortDirection` e `pageToken`.
- A callable retorna `totalCount`, `hasMore` e `nextPageToken`.

#### Corrigido
- Leitura de Liga em grupo passa a considerar somente membros `ACTIVE`.
- Grupo arquivado ou inativo deixa de liberar leitura publica.

_PRs: #3350_

### [1.7.2][functions-1.7.2] - 2026-07-07

#### Adicionado
- Nova callable `getLeaguePlayers` retorna somente campos publicos e stats de Liga.

#### Corrigido
- Evita que regras de privacidade de `users/{uid}` bloqueiem a tela de Liga quando os docs contem PII.

_PRs: #3349_

### [1.7.1][functions-1.7.1] - 2026-07-05

#### Mudado
- `searchAdminUsers` passa a retornar `isMock`, `demoData`, `dataOrigin`, `seedId`, `cpfVerified`, `phoneVerified` e `realDataProtected`.

### [1.7.0][functions-1.7.0] - 2026-07-05

#### Adicionado
- `submitDirectMessage` escreve mensagens diretas via Cloud Functions com App Check, rate limit e transacao atomica.
- `submitContentReport` cria denuncias com Admin SDK apos validar tipo, motivo, existencia do alvo e limite de uso.
- Testes de Firestore Rules cobrem bloqueio de escrita direta em mensagens e novos tipos de denuncia.

#### Mudado
- `createDirectChat` passou a aplicar rate limit server-side.
- Regras de Firestore bloqueiam `chats/{chatId}/messages` e `reports` client-side create e restringem revisao de `reports` a admins.

#### Segurança
- Dados publicos do remetente de DM agora sao derivados do usuario autenticado no backend, evitando spoofing pelo cliente.

_Issues: #3302, #3303_

### [1.6.2][functions-1.6.2] - 2026-07-05

#### Mudado
- `onGroupInviteResponse` passou a criar membership idempotente antes de notificar o convidador sobre aceite.

_Issues: #3296_

### [1.6.1][functions-1.6.1] - 2026-07-05

#### Adicionado
- Cloud Function `onGroupWallPostSoftDeletedCleanupMedia` para limpeza de mídia publicada do mural.
- Testes para cleanup de mídia e novos cenários de segurança em Firestore Rules.

#### Mudado
- Discovery social deixou de usar email como fallback de nome público.
- Rules de DMs bloquearam update client-side isolado de preview/unread metadata.

#### Segurança
- `users/{uid}`, `following/followers`, DMs e `groups/{groupId}/wall_posts` receberam validações mais restritivas.

_Issues: #3261, #3262, #3263, #3264, #3267 · PRs: #3276, #3277_

### [1.6.0][functions-1.6.0] - 2026-07-04

#### Adicionado
- `functions/src/social/` com handlers sociais e cobertura unitária de follow.
- `functions/src/storage/generate-video-thumbnails.ts` para vídeos de jogos.
- Rules-tests para DMs, follows, comentários, vídeos, localização, votação social e mural.

#### Mudado
- `joinPublicGame` diferencia capacidade de jogos públicos recorrentes.
- `auto-close-past-games` cancela por transação com status ainda ativo.
- `game-validation/aggregate` passa a receber o documento do jogo para avaliar FINISH_TOO_EARLY.

#### Corrigido
- `location-management` recomputa soma aprovada por período antes de ativar assinatura.
- `voting/check-in` aceita payloads web canônicos e legados.

#### Segurança
- Firestore/Storage Rules endurecidas para escrita social, mídia de jogo, localização opt-in e voting-result social.

_Issues: #3231, #3233, #3234, #3235, #3236, #3237, #3238, #3248, #3250, #3251, #3252, #3253, #3254_

### [1.5.0][functions-1.5.0] - 2026-07-03

#### Adicionado
- `functions/src/games/lifecycle.ts` com callables server-side para iniciar e finalizar partidas com validações centrais.
- `functions/src/games/live-events.ts`, `functions/src/voting/mvp-voting.ts` e `functions/src/voting/check-in.ts` para consolidar score, eventos críticos e voto MVP no servidor.
- `functions/src/games/reward-review.ts` e agregadores em `functions/src/game-validation/` para revisão administrativa, confidence score e retenção/liberação de XP.

#### Mudado
- `functions/src/xp/pipeline.ts` e `functions/src/xp/processing.ts` agora bloqueiam ranking, badges e XP automáticos quando o jogo exige revisão ou liberação explícita.
- `functions/src/games/auto-close-past-games.ts` passou a orientar fechamento por evidências em vez de premiar jogos de baixa confiança.
- `functions/src/index.ts` foi reorganizado para expor os novos handlers de lifecycle, live events, reward review e antifraude.

#### Corrigido
- Audit follow-ups em temporada ativa, engine de recorrência, limits mensais, xp milestones, game badges, invite reactivation, batch sender, reminders paginados e season idempotency.
- Correções de consistência transacional em cache de leaderboard, processamento de XP e composição de estatísticas derivadas.

#### Segurança
- `firestore.rules` e funções passaram a bloquear transições client-side para `LIVE` e `FINISHED`, votos diretos em `mvp_votes` e escritas críticas em `game_events` e dados derivados.

_Issues: #3199, #3200, #3201, #3202, #3208, #3209, #3211, #3213, #3214, #3215, #3216, #3219, #3220, #3221, #3222, #3223, #3224, #3225 · PRs: #3218, #3227_

### [1.4.0][functions-1.4.0] - 2026-07-02

#### Adicionado
- `functions/src/validation/cnpj.ts`: `isValidCnpj` (mod-11 c/ pesos CNPJ), `stripCnpj`, `hashCnpj` (SHA-256 + `CPF_SALT` + prefixo `cnpj:` para evitar colisão cross-domain com hashes de CPF), `maskCnpj`.
- `venue-owner-onboarding.ts`: campo `cnpj?` opcional validado server-side; transação verifica `cnpj_index/{hash}` (mesmo uid = idempotente; uid diferente = bloqueia com mensagem genérica anti-enumeration); troca de CNPJ libera o hash antigo; `REJECTED` libera `cnpj_index` para reuso (delete condicionado ao uid dono). Armazena apenas `cnpj_hash` + `cnpj_masked` (nunca plaintext).
- `secure-callable-wrapper.ts`: opção `secrets?: string[]` para declarar secrets do Firebase Functions (acessíveis via `process.env` em runtime). `requestVenueOwnerOnboarding` declara `CPF_SALT`.
- `firestore.rules`: `cnpj_index/{cnpjHash}` deny-all (acesso só via Cloud Functions).

#### Corrigido
- `auth/invite-code.ts` `onUserCreatedProcessInvite`: código desconhecido marca `invite_status: INVALID_CODE` no doc do usuário (auditável) em vez de no-op silencioso. Blocking functions fora de escopo (#940).

#### Segurança
- CNPJ nunca em plaintext; hash com salt + prefixo de domínio.
- Anti-enumeração: CNPJ duplicado de outra conta retorna mensagem genérica (não revela existência).
- `cnpj_index` deny-all no cliente.
- Requer `CPF_SALT` secret configurado (`firebase functions:secrets:set CPF_SALT`) — já usado pelo fluxo de CPF, reutilizado para CNPJ com prefixo de domínio.

_Issues: #3186, #3187, #3188 · PRs: #3194, #3195_

### [1.3.0][functions-1.3.0] - 2026-07-01

#### Adicionado
- Adiciona a callable pública `validateInviteCode` com rate limit por IP.
- Cria `app_invite_redemptions/{uid}` como trilha de auditoria do primeiro acesso por convite.
- Registra `xp_logs/app_invite_<padrinho>_<convidado>` para o bônus de apadrinhamento.

#### Segurança
- Sincroniza `invite_codes/{code}` com o dono do código para validação nas Firestore Rules.
- Bloqueia updates client-side em `invite_code`, `invite_count`, `invited_by`, `invited_by_code`, `invite_accepted_at` e `invite_source`.

### [1.2.23][functions-1.2.23] - 2026-06-30

#### Adicionado
- `recomputeLocationCommercialStats` para recomputar uma quadra específica ou um lote limitado.
- `rebuildLocationCommercialStats` como job diário.
- Triggers `onNestedLocationFieldWrittenUpdateStats`, `onRootFieldWrittenUpdateLocationStats`, `onLocationReviewWrittenUpdateStats` e `onGameWrittenUpdateLocationStats`.
- Helpers testados para agregados de campos/preços, jogos e reviews.

_Issues: #3106, #3128 · PRs: #3166_

### [1.2.22][functions-1.2.22] - 2026-06-30

#### Corrigido
- `backfill-venue-commercial-data` compara o snapshot existente antes de marcar conta agregada como pendente de sync.
- Valores `0` em centavos passam a ser tratados como válidos no backfill.
- `persistVenueAccount` registra falha de evento/audit log sem transformar uma atualização já persistida em erro para o callable.

_Issues: #3121 · PRs: #3166_

### [1.2.21][functions-1.2.21] - 2026-06-30

#### Corrigido
- `upsertVenueAccount` passa a validar `billingDueDay` com limite máximo de 31.
- Adiciona cobertura de regressão para preservar dados comerciais existentes e validar campos de cobrança antes da persistência.

_Issues: #3122_

### [1.2.20][functions-1.2.20] - 2026-06-30

#### Mudado
- `buildLocationCommercialRequestSnapshot` adiciona pendências `geolocation` e `operating-hours`.
- `ready_for_publication_approval` agora depende de mapa e horários operacionais válidos.

_Issues: #3122_

### [1.2.19][functions-1.2.19] - 2026-06-30

#### Mudado
- `setLocationPublicationStatus` calcula o snapshot comercial antes de publicar e bloqueia `PUBLISHED` quando `ready_for_publication_approval` não é verdadeiro.

#### Corrigido
- Fecha o gap em que uma quadra poderia ser publicada sem o evento comercial/financeiro mínimo definido.

_Issues: #3121_

### [1.2.18][functions-1.2.18] - 2026-06-30

#### Adicionado
- Nova coleção `venue_accounts/{ownerUid}` com eventos imutáveis em subcoleção e auditoria global.
- Novos callables admin-only: `upsertVenueAccount`, `linkLocationToVenueAccount`, `unlinkLocationFromVenueAccount`.
- Backfill de monetização passa a criar/sincronizar contas comerciais agregadas e denormalizar `venue_account_*` nas quadras elegíveis.
- Testes unitários cobrindo criação, vínculo, desvínculo, auditoria e rejeição de vínculos inválidos.

#### Mudado
- Firestore rules protegem `venue_accounts` e impedem escrita cliente nos campos comerciais agregados de `locations`.

_Issues: #3087, #3119, #3122, #3135_

### [1.2.17][functions-1.2.17] - 2026-06-29

#### Adicionado
- Validações de `billingPlanCode`, `billingCycle`, `billingBaseFeeCents` e coerência entre início e fim de cobrança em `setLocationSubscription`.
- Persistência de `billing_plan_code`, `billing_plan_label`, `billing_cycle`, `billing_base_fee_cents` e `billing_exception_note` na location e no `subscription_ledger`.

#### Mudado
- `getAdminLocationBillingSummary` passa a incluir plano, ciclo, valor base, início da cobrança e exceção comercial.
- Eventos e snapshots comerciais de assinatura ficam mais completos para auditoria de antes/depois.

_Issues: #3121_

### [1.2.16][functions-1.2.16] - 2026-06-29

#### Adicionado
- Novas callables `requestLocationCommercialReview` e `reviewLocationCommercialRequest`.
- Snapshot comercial com checklist, pendências e issues operacionais salvo junto da solicitação.
- Subcoleção `publication_requests` adicionada ao lifecycle auditável de quadras.

#### Mudado
- O backend consolida o último status de solicitação comercial também no documento principal da `location`.
- Eventos de submissão e revisão comercial passam a alimentar `commercial_events` para rastreabilidade.

_Issues: #3115_

### [1.2.15][functions-1.2.15] - 2026-06-29

#### Mudado
- `searchAdminUsers` adiciona `lastLoginAtIso` ao contrato da linha de usuário.
- `updatedAtIso` fica restrito a campos de atualização cadastral.

_Issues: #3101_

### [1.2.14][functions-1.2.14] - 2026-06-29

#### Corrigido
- `searchAdminUsers` passa a usar `consumeAppCheckToken: false`, mantendo `enforceAppCheck` ativo para a callable.
- Teste regressivo cobre a configuração segura da callable admin de leitura.

#### Segurança
- Mantém autenticação, App Check, rate limit e role `ADMIN` obrigatórios no CRM de usuários.

_Issues: #3149_

### [1.2.13][functions-1.2.13] - 2026-06-29

#### Corrigido
- `secureCallable` passa a separar `enforceAppCheck` de `consumeAppCheckToken`.
- `getAdminLocationBillingSummary` usa `consumeAppCheckToken: false`, preservando App Check obrigatorio sem bloquear retries legitimos de leitura.
- Teste regressivo garante a configuracao segura do callable do painel financeiro.

#### Segurança
- Mantem App Check e role `ADMIN` obrigatorios no painel financeiro, sem reduzir autorizacao do endpoint.

_Issues: #3149_

### [1.2.12][functions-1.2.12] - 2026-06-29

#### Corrigido
- `getAdminLocationBillingSummary` usa paginacao por `documentId` com `scanComplete: true` apenas apos varrer todas as paginas.
- Leituras de `subscription_payments` usam `where("period_key", "==", periodKey)` e paralelismo controlado por chunks.
- Teste regressivo cobre mais de 500 quadras, pagamento antigo fora do periodo e pagamento aprovado duplicado no mesmo ciclo.

#### Segurança
- Reduz risco de decisao administrativa com MRR subestimado ou recebido inflado por dados financeiros duplicados.

_Issues: #3149_

### [1.2.11][functions-1.2.11] - 2026-06-29

#### Corrigido
- `setLocationSubscription` agora distingue campo ausente de campo explicitamente `null`.
- Campos opcionais so sao gravados quando enviados pelo caller.
- Teste regressivo cobre alteracao parcial de status preservando `monthly_fee_cents`, `billing_due_day`, `billing_starts_at` e `billing_expires_at`.

#### Segurança
- Reduz risco de perda silenciosa de configuracao financeira em callable admin.

_Issues: #3148, #3132, #3121_

### [1.2.10][functions-1.2.10] - 2026-06-29

#### Adicionado
- Scheduler `processLocationBillingCycles` diario em America/Sao_Paulo.
- Callable admin `runLocationBillingAutomation`.
- Subcolecao `subscription_cycles/{periodKey}` com status `PAID`, `PARTIAL`, `PENDING`, `OVERDUE` e `SUSPENDED`.
- Ledger e evento comercial idempotentes para reativacao, atraso e suspensao por automacao.
- Testes unitarios cobrindo processamento mensal, idempotencia, callable admin e handler agendado.

#### Segurança
- Automacao manual exige `requiredRole: ADMIN` e rate limit dedicado.
- Saldos e status de ciclo sao calculados no backend a partir de pagamentos aprovados.

_Issues: #3132, #3124, #3119, #3091, #3086, #3084_

### [1.2.9][functions-1.2.9] - 2026-06-29

#### Adicionado
- Callable `getAdminLocationBillingSummary` exclusiva para admins.
- Resumo financeiro por período com linhas por quadra, saldo aberto e pendências de comprovante.
- Testes unitários cobrindo agregação financeira e validação de período.

#### Segurança
- Dados financeiros consolidados ficam atrás de `requiredRole: ADMIN`.

_Issues: #3124, #3119, #3091, #3086, #3084_

### [1.2.8][functions-1.2.8] - 2026-06-29

#### Adicionado
- Subcoleção `locations/{locationId}/subscription_ledger`.
- Entradas de ledger para status/plano, pagamento registrado, comprovante enviado e revisão de comprovante.
- Testes unitários cobrindo ledger em Functions.

#### Segurança
- Firestore Rules permitem leitura do ledger apenas para owner, manager ou admin.
- Escrita direta no ledger segue bloqueada para clientes; somente Cloud Functions via Admin SDK gravam eventos.

_Issues: #3114, #3091, #3084_

### [1.2.7][functions-1.2.7] - 2026-06-29

#### Adicionado
- Callables `requestVenueOwnerOnboarding` e `reviewVenueOwnerOnboarding`.
- Coleção `venue_owner_onboarding/{ownerUid}` com eventos imutáveis em subcoleção.
- `searchAdminUsers` passa a retornar o resumo do onboarding comercial.
- Firestore Rules permitem leitura para owner/admin e bloqueiam escrita direta do cliente.

#### Segurança
- Owner não pode alterar estados sensíveis nem se promover para `FIELD_OWNER`.
- Aprovação admin exige checklist de contato, quadras, termos e cobrança.

_Issues: #3137, #3115, #3125, #3088, #3084_

### [1.2.6][functions-1.2.6] - 2026-06-29

#### Mudado
- `searchAdminUsers` retorna `ownerLocations`, contatos básicos, timestamps de atualização e agregados financeiros por owner.
- A versão Functions foi atualizada para `1.2.6`.

#### Segurança
- A callable continua admin-only, com App Check em produção, rate limit dedicado e auditoria habilitada.

_Issues: #3126, #3101, #3087, #3084_

### [1.2.5][functions-1.2.5] - 2026-06-29

#### Adicionado
- Callable admin-only `searchAdminUsers` com paginação, busca textual e filtros por role/status comercial.
- Agregação server-side de `locations` por owner para total de quadras, publicadas, pendentes, suspensas/vencidas e cadastro comercial incompleto.

#### Segurança
- A callable exige autenticação, role `ADMIN`, App Check fora do emulador e rate limit dedicado.

_Issues: #3136, #3101, #3087, #3084_

### [1.2.4][functions-1.2.4] - 2026-06-29

#### Adicionado
- Callable `submitLocationSubscriptionReceipt` para owner/admin criar pagamento `PENDING_REVIEW` com `receipt_storage_path` privado.
- Callable `reviewLocationSubscriptionReceipt` para admin aprovar/rejeitar comprovante e vincular o arquivo ao ledger de pagamentos.
- Cobertura de testes para submissão, aprovação, rejeição, permissões e paths inválidos.

#### Segurança
- Validação server-side exige path oficial de comprovante com `ownerId` da própria location.
- Managers não podem enviar comprovantes comerciais de mensalidade.

_Issues: #3133, #3091, #3084_

### [1.2.3][functions-1.2.3] - 2026-06-28

#### Adicionado
- Callable `assignLocationOwner` para administradores transferirem ownership de uma location.
- Callable `inviteLocationManager` para owner/admin criar convite pendente por UID ou email.
- Callable `acceptLocationManagerInvite` para o destinatário aceitar e entrar em `managers`.
- Callable `removeLocationManager` para owner/admin revogar acesso operacional.

#### Segurança
- Firestore Rules bloqueiam alteração client-side de `managers` por owner/manager.
- Convites em `locations/{locationId}/manager_invites` são somente leitura para owner, admin, manager atual ou destinatário.
- Clientes não criam, aceitam nem removem convites diretamente no Firestore.
- Cobertura dos callables de dono/gerente reforçada para convites por UID/email, aceite, remoção e fluxos inválidos.

_Issues: #3102, #3127, #3087, #3091_

### [1.2.2][functions-1.2.2] - 2026-06-28

#### Adicionado
- Callable `setLocationPublicationStatus` para publicar, suspender ou reprovar quadras.
- Callable `setLocationSubscription` para controlar mensalidade e status comercial.
- Callable `registerLocationSubscriptionPayment` para registrar pagamento manual e reativar assinatura.
- Eventos comerciais gravados em `locations/{locationId}/commercial_events` e `audit_logs`.

#### Segurança
- Firestore Rules bloqueiam escrita client-side em eventos comerciais e pagamentos.
- Donos e gerentes de quadra não podem alterar status de publicação, mensalidade ou pagamento diretamente.

_Issues: #3084, #3092, #3093, #3094, #3095, #3096_

### [1.2.1][functions-1.2.1] - 2026-06-28

#### Segurança
- `xp_logs` passam a gravar `transaction_id`, `source`, `source_collection`, `source_event_id` e `source_confirmation_id` no fluxo principal.
- XP de votação passa a gravar metadados da votação, incluindo categoria e contagem de votos.

### [1.2.0][functions-1.2.0] - 2026-06-27

#### Adicionado
- Callable `submitPostGameReputation` com App Check, perfil completo e rate limit.
- Collection `post_game_reputation` com documento `{gameId}_{reviewerId}_{targetUserId}`.
- Recalculo transacional de `reputation_overall_avg`, critérios e `reputation_reviews_count` em `users/{targetUserId}`.

#### Segurança
- Firestore Rules bloqueiam escrita direta em `post_game_reputation` e tornam `reputation_*` server-only em `users`.

_Issues: #2968_

### [1.1.0][functions-1.1.0] - 2026-06-27

#### Adicionado
- `checkInToGame` salva notificações `checkin` para outros confirmados após check-in novo.
- Tipo `NotificationType.CHECKIN` para padronizar o payload salvo em `notifications`.

#### Segurança
- Notificação roda server-side e best-effort, sem permitir escrita direta de presença pelo cliente.

_Issues: #2981_

### [1.0.0][functions-1.0.0] - 2026-05-22

#### Adicionado
- Versão 1.0.0 definida como linha de base das Cloud Functions no versions.json.
- Fundação de versionamento multi-plataforma (#1501).

#### Corrigido
- Atomicidade no temporal-overlap e get-then-set de season (#1478).
- processXpIdempotent usa doc ID determinístico contra race condition (#1467).
- Mocks de testes desatualizados restaurados (#1516).

_Issues: #1478, #1467 · PRs: #1478, #1467, #1500, #1501, #1516_


[android-1.42.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.42.0.md
[android-1.41.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.41.0.md
[android-1.40.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.40.0.md
[android-1.39.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.39.5.md
[android-1.39.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.39.4.md
[android-1.39.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.39.3.md
[android-1.39.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.39.2.md
[android-1.39.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.39.1.md
[android-1.39.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.39.0.md
[android-1.38.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.38.1.md
[android-1.38.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.38.0.md
[android-1.37.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.37.0.md
[android-1.36.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.8.md
[android-1.36.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.7.md
[android-1.36.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.6.md
[android-1.36.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.5.md
[android-1.36.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.4.md
[android-1.36.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.3.md
[android-1.36.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.2.md
[android-1.36.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.1.md
[android-1.36.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.36.0.md
[android-1.35.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.35.0.md
[android-1.34.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.34.0.md
[android-1.33.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.33.0.md
[android-1.32.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.32.2.md
[android-1.32.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.32.1.md
[android-1.26.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.26.0.md
[android-1.25.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.25.0.md
[android-1.24.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/android/1.24.0.md
[web-1.60.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.60.0.md
[web-1.59.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.59.0.md
[web-1.58.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.58.1.md
[web-1.58.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.58.0.md
[web-1.57.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.57.0.md
[web-1.56.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.9.md
[web-1.56.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.8.md
[web-1.56.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.7.md
[web-1.56.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.6.md
[web-1.56.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.5.md
[web-1.56.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.4.md
[web-1.56.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.3.md
[web-1.56.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.2.md
[web-1.56.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.1.md
[web-1.56.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.56.0.md
[web-1.55.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.55.1.md
[web-1.55.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.55.0.md
[web-1.54.23]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.23.md
[web-1.54.22]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.22.md
[web-1.54.21]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.21.md
[web-1.54.20]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.20.md
[web-1.54.19]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.19.md
[web-1.54.18]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.18.md
[web-1.54.17]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.17.md
[web-1.54.16]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.16.md
[web-1.54.15]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.15.md
[web-1.54.14]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.14.md
[web-1.54.13]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.13.md
[web-1.54.12]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.12.md
[web-1.54.11]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.11.md
[web-1.54.10]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.10.md
[web-1.54.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.9.md
[web-1.54.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.8.md
[web-1.54.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.7.md
[web-1.54.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.6.md
[web-1.54.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.5.md
[web-1.54.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.4.md
[web-1.54.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.3.md
[web-1.54.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.2.md
[web-1.54.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.1.md
[web-1.54.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.54.0.md
[web-1.53.12]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.12.md
[web-1.53.11]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.11.md
[web-1.53.10]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.10.md
[web-1.53.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.9.md
[web-1.53.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.8.md
[web-1.53.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.7.md
[web-1.53.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.6.md
[web-1.53.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.5.md
[web-1.53.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.4.md
[web-1.53.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.3.md
[web-1.53.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.2.md
[web-1.53.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.1.md
[web-1.53.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.53.0.md
[web-1.52.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.52.0.md
[web-1.51.43]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.43.md
[web-1.51.42]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.42.md
[web-1.51.41]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.41.md
[web-1.51.40]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.40.md
[web-1.51.39]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.39.md
[web-1.51.38]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.38.md
[web-1.51.37]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.37.md
[web-1.51.36]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.36.md
[web-1.51.35]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.35.md
[web-1.51.34]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.34.md
[web-1.51.33]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.33.md
[web-1.51.32]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.32.md
[web-1.51.31]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.31.md
[web-1.51.30]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.30.md
[web-1.51.29]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.29.md
[web-1.51.28]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.28.md
[web-1.51.27]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.27.md
[web-1.51.26]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.26.md
[web-1.51.25]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.25.md
[web-1.51.24]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.24.md
[web-1.51.23]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.23.md
[web-1.51.22]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.22.md
[web-1.51.21]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.21.md
[web-1.51.20]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.20.md
[web-1.51.19]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.19.md
[web-1.51.18]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.18.md
[web-1.51.17]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.17.md
[web-1.51.16]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.16.md
[web-1.51.15]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.15.md
[web-1.51.14]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.14.md
[web-1.51.13]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.13.md
[web-1.51.12]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.12.md
[web-1.51.11]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.11.md
[web-1.51.10]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.10.md
[web-1.51.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.9.md
[web-1.51.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.8.md
[web-1.51.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.7.md
[web-1.51.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.6.md
[web-1.51.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.5.md
[web-1.51.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.4.md
[web-1.51.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.3.md
[web-1.51.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.2.md
[web-1.51.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.1.md
[web-1.51.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.51.0.md
[web-1.50.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.50.0.md
[web-1.49.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.49.0.md
[web-1.48.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.9.md
[web-1.48.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.8.md
[web-1.48.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.7.md
[web-1.48.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.6.md
[web-1.48.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.5.md
[web-1.48.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.4.md
[web-1.48.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.3.md
[web-1.48.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.2.md
[web-1.48.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.1.md
[web-1.48.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.48.0.md
[web-1.47.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.47.0.md
[web-1.46.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.46.0.md
[web-1.45.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.45.0.md
[web-1.44.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.44.3.md
[web-1.44.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.44.2.md
[web-1.44.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.44.1.md
[web-1.44.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.44.0.md
[web-1.43.38]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.38.md
[web-1.43.37]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.37.md
[web-1.43.36]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.36.md
[web-1.43.35]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.35.md
[web-1.43.34]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.34.md
[web-1.43.33]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.33.md
[web-1.43.32]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.32.md
[web-1.43.31]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.31.md
[web-1.43.30]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.30.md
[web-1.43.29]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.29.md
[web-1.43.28]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.28.md
[web-1.43.27]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.27.md
[web-1.43.26]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.26.md
[web-1.43.25]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.25.md
[web-1.43.24]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.24.md
[web-1.43.23]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.23.md
[web-1.43.22]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.22.md
[web-1.43.21]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.21.md
[web-1.43.20]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.20.md
[web-1.43.19]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.19.md
[web-1.43.18]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.18.md
[web-1.43.17]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.17.md
[web-1.43.16]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.16.md
[web-1.43.15]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.15.md
[web-1.43.14]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.14.md
[web-1.43.13]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.13.md
[web-1.43.12]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.12.md
[web-1.43.11]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.11.md
[web-1.43.10]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.10.md
[web-1.43.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.9.md
[web-1.43.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.8.md
[web-1.43.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.7.md
[web-1.43.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.6.md
[web-1.43.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.5.md
[web-1.43.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.4.md
[web-1.43.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.3.md
[web-1.43.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.2.md
[web-1.43.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.1.md
[web-1.43.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.43.0.md
[web-1.42.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.42.1.md
[web-1.42.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.42.0.md
[web-1.41.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.41.0.md
[web-1.40.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.40.0.md
[web-1.39.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.39.0.md
[web-1.38.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.38.0.md
[web-1.37.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.37.0.md
[web-1.36.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.36.0.md
[web-1.35.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.35.0.md
[web-1.34.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.34.0.md
[web-1.33.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.33.0.md
[web-1.32.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.32.0.md
[web-1.31.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.31.0.md
[web-1.30.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.30.0.md
[web-1.29.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.29.0.md
[web-1.28.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.28.0.md
[web-1.27.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.27.0.md
[web-1.26.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.26.3.md
[web-1.26.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.26.2.md
[web-1.26.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.26.1.md
[web-1.26.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/web/1.26.0.md
[ios-1.8.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.8.0.md
[ios-1.7.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.7.2.md
[ios-1.7.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.7.1.md
[ios-1.7.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.7.0.md
[ios-1.6.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.6.3.md
[ios-1.6.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.6.2.md
[ios-1.6.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.6.1.md
[ios-1.6.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/ios/1.6.0.md
[functions-1.14.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.14.0.md
[functions-1.13.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.13.0.md
[functions-1.12.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.12.6.md
[functions-1.12.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.12.5.md
[functions-1.12.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.12.4.md
[functions-1.12.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.12.3.md
[functions-1.12.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.12.2.md
[functions-1.12.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.12.1.md
[functions-1.12.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.12.0.md
[functions-1.11.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.11.1.md
[functions-1.11.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.11.0.md
[functions-1.10.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.10.3.md
[functions-1.10.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.10.2.md
[functions-1.10.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.10.1.md
[functions-1.10.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.10.0.md
[functions-1.9.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.9.2.md
[functions-1.9.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.9.1.md
[functions-1.9.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.9.0.md
[functions-1.8.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.8.0.md
[functions-1.7.19]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.19.md
[functions-1.7.18]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.18.md
[functions-1.7.17]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.17.md
[functions-1.7.16]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.16.md
[functions-1.7.15]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.15.md
[functions-1.7.14]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.14.md
[functions-1.7.13]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.13.md
[functions-1.7.12]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.12.md
[functions-1.7.11]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.11.md
[functions-1.7.10]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.10.md
[functions-1.7.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.9.md
[functions-1.7.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.8.md
[functions-1.7.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.7.md
[functions-1.7.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.6.md
[functions-1.7.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.5.md
[functions-1.7.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.4.md
[functions-1.7.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.3.md
[functions-1.7.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.2.md
[functions-1.7.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.1.md
[functions-1.7.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.7.0.md
[functions-1.6.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.6.2.md
[functions-1.6.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.6.1.md
[functions-1.6.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.6.0.md
[functions-1.5.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.5.0.md
[functions-1.4.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.4.0.md
[functions-1.3.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.3.0.md
[functions-1.2.23]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.23.md
[functions-1.2.22]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.22.md
[functions-1.2.21]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.21.md
[functions-1.2.20]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.20.md
[functions-1.2.19]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.19.md
[functions-1.2.18]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.18.md
[functions-1.2.17]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.17.md
[functions-1.2.16]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.16.md
[functions-1.2.15]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.15.md
[functions-1.2.14]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.14.md
[functions-1.2.13]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.13.md
[functions-1.2.12]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.12.md
[functions-1.2.11]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.11.md
[functions-1.2.10]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.10.md
[functions-1.2.9]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.9.md
[functions-1.2.8]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.8.md
[functions-1.2.7]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.7.md
[functions-1.2.6]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.6.md
[functions-1.2.5]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.5.md
[functions-1.2.4]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.4.md
[functions-1.2.3]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.3.md
[functions-1.2.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.2.md
[functions-1.2.1]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.1.md
[functions-1.2.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.2.0.md
[functions-1.1.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.1.0.md
[functions-1.0.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/blob/master/release-notes/functions/1.0.0.md

<!-- AUTOGEN:END -->

---

## Histórico anterior

> Conteúdo anterior à adoção do sistema de release notes (2026-05-22). Mantido
> verbatim; **não** é regenerado pelo pipeline.

<!-- LEGACY:START -->
## [1.22.0] - 2026-05-11

### Corrigido (mega audit wave 2026-05-10 — 14 PRs merged, 141 fixes, 219 issues fechadas)

**Auditoria full-stack via 12 agentes paralelos**
- 174 bugs descobertos via 3 waves de auditoria (Cloud Functions, web, Android, KMP, backend, storage rules, Firestore rules, indexes, notifications, auth, cashbox, gamestate, CF deep, CI workflows)
- Triagem automatizada: 111 VALID / 30 FP / 25 WONTFIX / 1 DUP
- Cross-resolution: 5 issues pre-audit fechadas (já-fixadas por código existente)

**Backend Express (#974 — 13 issues)**
- 3 CRITICAL: JWT secret hardcoded `'default-secret-key'` (startup validation 32+ chars); zero rate-limit /login + /register (express-rate-limit 5/15min + 3/h); addExperience race condition (TypeORM transaction + pessimistic_write lock)
- 4 HIGH security: authorization missing em LocationController/ScheduleController/GameController/InviteController (admin middleware + ownership checks); FieldController query injection
- Perf: paginação em Location/Field/Schedule listEndpoints; N+1 submitStats paralelizado; JWT algoritmo explícito HS256; PostgreSQL TLS em prod; PII scrubbing logger

**Cloud Functions (#972 + #977 + #978 + #984 — 33 fixes)**
- 4 CRITICAL: triggers sem region em activities.ts/temporal-overlap.ts/index.ts (Firestore em southamerica-east1); onGameVacancy lendo `.collection("waitlist")` raiz inexistente → subcollection correta; events-rate-limit count() fora da transaction → `txn.get(query.limit())` atomic; rate-limiter fail-open → fail-closed com [ALERT] logger
- LGPD #786: onUserDeleted agora limpa 7 collections com PII (confirmations, mvp_votes, xp_logs, statistics, season_participation, activities, user_badges)
- WriteBatch reuse pattern fix em 3 sites (#787): batch-sender + parallel-processing + index — sempre cria batch novo após commit
- Promise.all → Promise.allSettled em XP batch (#793) — falha parcial não derruba chunks bem-sucedidos
- Notification preferences (#785) respeitadas em todos paths não-reminder; check-in window assimétrico (#784); XP anti-cheat caps específicos GOALS=15/ASSISTS=10/SAVES=30 (#789); checkSeasonEnd timezone America/Sao_Paulo (#790); maintainStreaks limit 5000 + filter (#788); restoreDeletedGame admin bypass (#792); softDeleteGroupCascade pagination (#757); denormalizeGameLocations cursor (#758); keepWarmFunctions removida (#760); leaderboard-cache consumeAppCheckToken (#961); compact-streaks timeout 540s (#962)
- FCM e2e (#978): fcmTokens array + fcm_token scalar unified read/write; APNS badge dinâmico (não-lidas count); TTL android.ttl/apns-expiration; service worker deep-link with origin check; reminders respeitam notification_settings + mute_groups; FcmService notify ID determinístico hash (não overflow)

**Firestore Security Rules (#979 — 12 issues)**
- 4 HIGH: game_events sem player_id validation; live_player_stats sem user ownership; mvp_votes leak anonymity → granular get/list; teams update pivot attack → fieldUnchanged
- 8 MEDIUM: groups/schedules/game_summons field whitelist; games/group_invites initial status validation; live_scores owner_id arbitrário; user_feedback list restricted to admin; invites expires_at check

**Web React (#975 + #976 + #983 — 32 fixes)**
- Hooks/race: useFeedback error callback; useNotifications/CashboxScreen catch + showError; RankingsTab async cancelled flag + batch getDocs (eliminou N+1 100 leituras por snapshot); Promise.allSettled em chunks (useGroups/useLeague/usePlayers); localStorage try/catch; SearchPanel orderBy('dateTime') correto
- A11y: autoComplete em forms (RegisterScreen, ForgotPassword, EditProfile); button keyboard nav (HomeTab); inputProps semânticos
- Auth: email enumeration mitigation (forgot-password sempre sucesso genérico, firebaseErrors.ts unificado); password reset session revoke; Google Sign-In account-exists handling
- UX: ícones MUI consistentes (HomeTab, RankingsTab); LeagueScreen tabs com cor por divisão; PostGameReport team names dinâmicos; MVPVoteScreen skeleton layout-matching; GamesTab empty state contextual; status colors via theme.palette; LiveGameScreen ícones reais (não strings); 7 boxShadow rgba → `alpha(theme.palette)` tokens

**Android Compose (#976 + #980 + #983 — 25 fixes)**
- Listener leaks: collectAsState → collectAsStateWithLifecycle (CpfVerification, PhoneVerification); ProfileViewModel statisticsListener via callbackFlow + awaitClose; observeGameEvents close(error) propaga falha; loadMyLocations try/catch
- Race conditions: setupStatisticsRealTimeListener cancela job anterior antes await; FieldValue.increment em times_used (elimina read-modify-write race)
- A11y: minimumInteractiveComponentSize em badges <48dp (ExpressiveHubHeader); Role.Button + stateDescription em Box clicáveis; MaterialTheme.typography.labelSmall.fontSize substitui 10sp hardcoded; mergeDescendants em PlayerCard
- Cores: WeeklyRecap AccentGreen WCAG-fail removido → primary; SocialComparison hardcoded colors → MaterialTheme.colorScheme.tertiary/error; TacticalBoard rgba → alpha(white)
- Auth: PhoneVerification consulta canSendSmsOtp; account delete reauth TODO documentado

**Storage Rules (#973 — 7 issues)**
- isImage SVG blacklist (image/svg+xml, image/xml — XSS via SVG upload)
- isAdmin agora usa `request.auth.token.role` Custom Claims (PERF_001) — eliminou 2 Firestore reads
- Trigger paths corrigidos: profile_photos/{uid} + groups/{groupId} consistentes com Android uploads
- games/{gameId}/photos write valida status; thumbUrl não-pública (drop)

**KMP Shared (#981 — 5 issues)**
- iOS deadlock: `runBlocking { auth.signOut() }` → `suspend fun logout()` chain (commonMain expect + nativeAndAndroidMain actual + wasmJsMain stub + AuthRepository + AuthRepositoryImpl)
- iOS UIKit calls com `withContext(Dispatchers.Main)` + connectedScenes (não keyWindow deprecated)
- createGame escreve dateTime Timestamp; createPayment usa serverTimestamp
- GeocoderService.ios threading: Dispatchers.Main no callback CLGeocoder
- @Throws(Exception::class) em ImagePicker suspend funs expostas a Swift

**Indexes + Cashbox + GameState (#982 — 9 issues)**
- 4 composite indexes adicionados: season_participation 3-field, saved_formations x2, verification_failures
- Cashbox: deleteCashboxEntry role OWNER||ADMIN aligned com rules; runTransaction em addEntry/deleteEntry; recalculateCashboxBalance limit(1000) safety
- Game state: TeamFormation runTransaction com version optimistic lock; xp_logs game_status filter em recalculateLeagueRating

**Cashbox migration spec + Fase 1 (#972 spec + #985 — #943 #944)**
- 2 CRITICAL: amount/balance Double IEEE 754 acumula erro em BRL; created_at salvo como `Instant.toString()` quebra orderBy temporal
- Spec [BUGFIX_CASHBOX_DOUBLE_AND_TIMESTAMP.md](specs/BUGFIX_CASHBOX_DOUBLE_AND_TIMESTAMP.md) com plano de 4 fases
- Fase 1 (compat read) merged: backend tolera `amount_cents` Long + `amount` Double + ISO timestamp + millis. Pré-requisito sem janela manutenção
- Fases 2-4 (backfill, switch writes, cleanup) pendentes — exigem janela combinada

**CI/CD Security (#977)**
- deploy-production.yml permissions block (id-token write + contents read)
- Third-party actions SHA-pinned: r0adkll/upload-google-play, wzieba/Firebase-Distribution, softprops/action-gh-release, EnricoMi/publish-unit-test-result, micnncim/action-label-syncer
- pr-review-to-issues.yml fork-PR guard

**Deploys em produção (2026-05-11)**
- Firestore rules + indexes
- Storage rules
- Cloud Functions (88+ functions, 2 redeploys + cleanup 5 obsolete: generateActivityOnGameFinish/us-central1, keepWarmFunctions/southamerica-east1, onConfirmationCreated/us-central1, onConfirmationWrite/us-central1, recalculateLeagueRating/us-central1)
- Web hosting https://futebadosparcas.web.app (Wave A-D)
- iOS pendente Apple Developer account; Android Play Store via /futeba-play-store quando próximo release

**Audit pipeline calibration confirmada**
- FP rate ~37% (30/82 reportados como bugs concretos descartados pós-Read direto)
- WONTFIX ~14% (25 com custo > benefício)
- 12 domínios cobertos sem overlap via ownership matrix
- Worktrees isolated mostraram inheritance progressivo das branches (esperado dado base compartilhada)
- 14 PRs squash-merged em master sem rollback necessário

## [1.21.3] - 2026-05-08

### Corrigido (bateria de auditorias 2026-05-08 — 8 PRs merged em master)

**Web (#600 + #602 + #603 + #604)**
- 3 CRITICAL: dirty guard em forms (root cause real do #574 que PR #598 não fixou),
  login redirect ignorando `?redirect=` (#514 regression), ProtectedRoute sem state.from
- Sweeps mecânicos em ~55 telas: onSnapshot sem error callback (8), catch swallow (9 telas/12 catches),
  navigate(-1) sem fallback (16 telas), Dialog sem fullScreen mobile (11 dialogs), virtualization
  Ranking/League, Login/Register 100dvh
- NotFoundScreen 404 (era redirect silencioso), JoinByInvite replace:true, a11y improvements,
  type-safety cleanup (16/17 any eliminados), ESLint rules custom (onSnapshot + catch swallow)

**Android (#605 + #606 + #607)**
- 2 CRITICAL: FCM extras nunca lidas em MainActivityCompose (notificações deep-link quebradas em prod);
  portrait lock travava 49/58 telas adaptive code morto (tablet, foldable, split-screen)
- 4 HIGH: PendingIntent collision (gameId.hashCode()), FLAG_ACTIVITY_CLEAR_TASK destroy back stack,
  BackHandler ausente em forms (DiscardChangesGuard reusable component criado)
- A11y: 6 Cards/Rows com mergeDescendants (TalkBack lê 1 frase coesa), WindowSizeClass adoption
  em CreateGame/EditProfile/LiveGame, Empty state em LiveStatsScreen

**Cloud Functions + cross-platform (#608)**
- 2 CRITICAL: App Check disabled em prod em 5 callables (verifyCpf, setUserVerified, pii-migration*,
  denormalizeGameLocations) — qualquer Auth token válido bypassava; in-memory Set dedup falhava
  cross-instance em onConfirmationWrite (race em players_count) → atomic FieldValue.increment
- 1 HIGH: recalculateLeagueRating sem lock → league_processing flag pattern análogo ao xp_processing
- A2 Android LOW: JoinRequestViewModel logger ausente, VoteResultViewModel job tracking

**Audit calibration**
- 8 agentes Sonnet 4.6 paralelos lançados em sweeps mecânicos
- Validação rigorosa via advisor + Read direto descartou ~50% false positives:
  viewModelScope auto-cancela, presentational screens recebem data via params,
  audit pipeline precisa grep mais específico antes de classificar bugs.
- ~55 telas modificadas / 100+ fixes / 8 PRs sequenciais

## [1.21.2] - 2026-05-08

### Corrigido

- **Play Store policy violation**: `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` removidas
  do AndroidManifest. App rejeitado por "Uso inválido das permissões de acesso a
  fotos e vídeos" (Play Store flagou que o app só precisa de acesso pontual).
  Migração:
  - 5 telas (CreateGroupScreen, ComposeGroupDialogs, EditProfileScreen,
    ComposeLocationDialogs) trocaram `ActivityResultContracts.GetContent()`
    por `ActivityResultContracts.PickVisualMedia()` (Photo Picker API).
  - Photo Picker é scoped, não requer permissão e oferece UX padrão Material.
  - Removidos do manifest: `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` (≤32),
    `WRITE_EXTERNAL_STORAGE` (≤28).
  - Mantido: `READ_MEDIA_AUDIO` (Voice Messages feature).
- `PermissionHelper.hasStoragePermission()` retorna sempre `true` (Photo Picker
  dispensa permissão). `getStoragePermissions()` retorna empty array.

## [1.21.1] - 2026-05-07

### Corrigido

- **Play Store compliance** (#571): legal HTMLs (privacy_policy, terms_of_service,
  delete_account, child_safety) não eram deployadas — `firebase.json` aponta `web/dist`
  mas arquivos estavam em `/public/` raiz. URLs mandatórias retornavam SPA index em prod.
  Corrigido movendo pra `web/public/` → Vite copia pra `web/dist/`.
- Android About: adicionados 2 links Play Store mandatórios que faltavam:
  "Excluir Conta" + "Segurança Infantil"
- Web About: link "Excluir Conta" + email contato `techfernandesltda@gmail.com`
- Web versions sincronizadas em todos lugares: 1.21.1 (build 43)
- `delete_account.html`: data "Última atualização" adicionada
- Test XP_MVP corrigido (50 → 30, source of truth `shared/xp-constants.json`)
- ESLint: `eslint-plugin-react-refresh` 0.5.2 → 0.4.20 (compat ESLint v8 legacy)
- Cleanup: `/public/` raiz removido (5 órfãos sem refs no código, -1064 linhas)

### Mudado

- Web AboutScreen footer: "© 2024-2026 Futeba dos Parças" (brand consistency com Android)
- Legal HTMLs copyright: "© 2024-2026 Tech Fernandes Ltda" (entidade legal)

## [1.21.0] - 2026-05-06

> Resumo consolidado de releases entre 1.8.0 e 1.21.0 (Fev–Mai 2026).
> Para granularidade detalhada, consulte git log + PRs no GitHub.

### Adicionado

- **Phone+CPF Verification (Anti-Bot/Anti-Fraud)** — EPIC #443 fechado, 6/6 fases
  - SMS OTP via Firebase Phone Auth (Web + Android + iOS)
  - CPF validator (mod-11) compartilhado KMP/JS/TS
  - `verifyCpf` + `setUserVerified` callables
  - Custom claim `verified=true` enforced em writes críticos
  - 30-day grace period pra users existentes
  - Anti-abuse: rate limit SMS, `verification_failures` log
- **PII Denormalization (LGPD)** — issue #433 fechada (3 stages)
  - `users_private` collection canonical pra email, fcm_token, birth_date, height_cm, weight_kg, gender
  - Triggers `onUserDocCreated`/`Updated` mantêm sync automático
  - Migration one-shot rodada: 101 users limpos
  - `updateUserPii` callable owner-only pra writes futuras
- **Game Location Privacy** — issue #442 fechada (2 stages)
  - `location_lat_approx`/`lng_approx` (3 decimais ~111m precisão) denormalizados
  - `games.read` exige `isVerifiedOrGrace()` reduzindo surface attack
  - Migration: 65 games denormalizados
- **App Check** — reCAPTCHA Enterprise (Web) + Play Integrity (Android)
- **Adaptive UI**
  - Web: Rail (md) + Drawer permanent (lg+) — issue #416
  - Android: `Modifier.adaptiveContentWidth()` helper aplicado em 25 telas — issue #489
  - PlayerCard theme tokens — issue #415
- **iOS Phone+CPF SwiftUI** — issue #447
  - PhoneVerificationView + CpfVerificationView + VerificationFlowView
  - APNs setup documentation em `iosApp/SETUP.md`

### Mudado

- **Cloud Functions perf** (issues #494, #495, #496)
  - `processXpBatch`: idempotência atômica via runTransaction (race condition #441 fix)
  - Memory bumps 256MB→512MB em onGameStatusUpdate, onGameDeleted, onGroupDeleted, checkSeasonEnd
  - Timeout bumps em triggers críticos (180–540s)
  - `collectHourlyMetrics`: paralelização (-85% latência)
  - `keepWarmFunctions`: Promise.all (-75% latência)
- Web: `EvolutionScreen` agora exibe error state com retry (#493)
- Android: `GamificationSettingsScreen` shimmer skeleton (#491)

### Corrigido

- **Race conditions e idempotência** em XP batch processing (#441)
- **PII exposure** via `is_searchable` em users docs (#433)
- **LGPD** lat/lng exato exposto (#442)
- **A11Y**: PlayerCard IconButton com texto → Button (#492)
- **Lint NewApi** em Coil disk cache (File.toPath API 26 vs minSdk 24)
- **Firestore index missing** em metrics(type, timestamp)

### Removido

- Dead code: `AdaptiveScaffold.kt` + `GameListDetailPane.kt` (642 linhas) — issue #490

### Segurança

- 5 stages de privacy denormalization completos
- 0 npm audit vulnerabilities (web + functions)
- 167 Dependabot alerts fixed historically; 0 abertos
- Custom Claims (PERF_001) eliminam 40% Firestore reads em authz checks

### Performance

- XP race condition fix evita XP duplicado em retry concorrente
- Memory/timeout bumps eliminam OOM em grupos com 200+ users
- Metrics queries paralelas reduzem cron latency em ~85%

### Migrations rodadas em prod

- `migratePiiToUsersPrivate`: 101 users → users_private
- `denormalizeGameLocations`: 65 games com `_approx` fields
- `removePiiFromUsers`: 101 users com PII removida de users docs
- `migrateAllUsersToCustomClaims`: role=PLAYER no JWT (PERF_001)

---

## [1.7.2] - 2026-02-01

### Removido
- Permissão ACCESS_BACKGROUND_LOCATION (não utilizada)
- Documentado roadmap para check-in automático via geofence (v1.8.0+)

### Documentação
- Adicionado ROADMAP_BACKGROUND_LOCATION.md

## [1.7.0] - 2026-01-31

### Adicionado
- Infraestrutura completa para iOS com Kotlin Multiplatform
- Compose Multiplatform para UI compartilhada (Android + iOS)
- Firebase bridges para iOS (Auth, Firestore, Storage)
- Serviços nativos iOS (Location, Apple Sign-In, Push)
- GitHub Actions CI/CD para builds iOS
- Spec completa de desenvolvimento iOS

### Mudado
- Estrutura do projeto para suportar KMP
- Compose Multiplatform plugin adicionado

### Documentação
- SPEC_IOS_KMP_DEVELOPMENT.md criada
- NEXT_STEPS_iOS.md para guia de setup Mac
- iosApp/SETUP.md para configuração Xcode

## [1.6.0] - 2026-01-20

### Adicionado
- Sistema de busca global com filtros avançados
- Melhorias visuais em múltiplas telas
- Responsividade para tablets
- Suporte multi-plataforma (portrait/landscape)

### Melhorado
- Performance de listas com paginação
- UI/UX geral do aplicativo

## [1.3.0] - 2026-01-06

### Novidades

- **Perfil do Jogador**: novos campos de perfil (data de nascimento, genero, altura/peso, pe dominante, posicoes, estilo de jogo e experiencia).
- **Autoavaliacao Inteligente**: notas automaticas calculadas pelo desempenho e combinadas com notas manuais para refletir a forma real do jogador.

### Melhorias

- **Consistencia de Ratings**: notas efetivas aplicadas no mercado de jogadores, comparador, cards e balanceamento de times.
- **Tela Inicial**: ajuste no carregamento de "Meus Proximos Jogos" para evitar cards cortados.

### Ajustes Tecnicos

- **Tema Padrao**: o app agora inicia no tema claro.

## [1.2.0] - 2026-01-05

### Correções (Fixes)

- **Criação de Jogos**: Corrigido bug crítico onde jogos "Apenas Grupo" eram criados sem o campo `dateTime` no banco de dados, tornando-os invisíveis nas listagens.
  - Implementada conversão robusta de Data/Hora usando `java.util.Date` e `java.time.ZoneId` para suportar adequadamente todas as instâncias do Firestore.
  - Adicionado "fallback" de segurança na camada de repositório (`GameRepositoryImpl`) para auto-corrigir jogos criados sem `dateTime` caso o problema ocorra novamente.
- **Compilação**: Resolvido erro de compatibilidade de API (Argument type mismatch) no `CreateGameViewModel` ao converter Timestamp.
- **Performance**: Melhoria na query de buscas de jogos de grupo, otimizando a recuperação de IDs de grupos do usuário.
- **Estabilidade**: Adicionado log de erros detalhado (AppLogger.e) nas Streams do Firestore para facilitar diagnóstico de falhas em tempo real (como índices faltando).
- **Limpeza**: Removidos logs de debug intrusivos que estavam poluindo o Logcat em produção.

### Mudanças Anteriores (Destaques Recentes)

- **Interface**: Melhorias na consistência visual do cabeçalho da "Liga" em relação às outras telas principais.
- **Gamification**: Ajustes nas regras de segurança do Firestore para permitir que donos de jogos validem partidas e atualizem XP.

---

## Tipos de Mudanças

- **Adicionado** - Novas funcionalidades
- **Mudado** - Mudanças em funcionalidades existentes
- **Depreciado** - Funcionalidades que serão removidas
- **Removido** - Funcionalidades removidas
- **Corrigido** - Correção de bugs
- **Segurança** - Vulnerabilidades corrigidas

[1.7.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/compare/v1.7.0...v1.7.2
[1.7.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/releases/tag/v1.6.0
<!-- LEGACY:END -->
