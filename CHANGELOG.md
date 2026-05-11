# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased] - 2026-05-10/11

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

## [Unreleased]

### Adicionado
- Componentes modernos UI/UX (Material 3):
  - `ShimmerLoading.kt` - Skeleton loading states com animação shimmer
  - `ErrorState.kt` - Estados de erro com retry e ícones ilustrativos (5 tipos)
  - `EmptyState.kt` - Estados vazios com CTAs (7 variantes pré-configuradas)
  - `LoadingButton.kt` - Botões com loading interno (6 variantes)
  - `AdaptiveNavigation.kt` - Navegação responsiva (bottom bar/rail/drawer)
  - `PullToRefreshContainer.kt` - Pull-to-refresh moderno Material 3
- Spec completa com 30 melhorias de UI/UX (`specs/UI_UX_IMPROVEMENTS_30.md`)
- Documentação consolidada para LLMs (`.claude/PROJECT_CONTEXT.md`)
- `.gitattributes` para padronização de line endings cross-platform

### Melhorado
- README.md atualizado para versão 1.8.0
- Documentação otimizada para Claude Code e outros LLMs

### Removido
- Arquivos temporários obsoletos (`build_errors*.txt`, `nul`)

### Segurança
- **PR #378**: Atualizações de dependências raiz (firebase-admin 10→13, jsonwebtoken, uuid, gaxios). Resolveu 12 alertas de segurança Dependabot (2 críticos, 1 alto, 9 moderados).
- **PR #379**: Atualizações backend (firebase-admin 10→13, multer 1→2 com DoS fixes, typeorm 0.3.19→0.3.28, node-cron 3→4). Resolveu 15 alertas (5 críticos, 2 altos, 8 moderados; 9 restantes são false positives de npm audit).
- **PR #380**: Resolução de dependências wasmJs via yarn overrides no build.gradle.kts. Resolveu 21 GHSAs de segurança.

### Planejado
- [ ] Aplicar componentes modernos em telas existentes (Fase 2)
- [ ] Animações de transição e micro-interações (Fase 3)
- [ ] Gráficos modernos com Vico Charts (Fase 3)
- [ ] Onboarding interativo (Fase 4)
- [ ] Check-in automático via geofence (v1.8.0)
- [ ] App iOS completo (v2.0.0)
- [ ] Widgets iOS (v2.1.0)
- [ ] Modo offline completo
- [ ] Sincronização multi-device

---

## Tipos de Mudanças

- **Adicionado** - Novas funcionalidades
- **Mudado** - Mudanças em funcionalidades existentes
- **Depreciado** - Funcionalidades que serão removidas
- **Removido** - Funcionalidades removidas
- **Corrigido** - Correção de bugs
- **Segurança** - Vulnerabilidades corrigidas

---

[1.7.2]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/compare/v1.7.0...v1.7.2
[1.7.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/TechFernandesLTDA/futeba-dos-parcas/releases/tag/v1.6.0
