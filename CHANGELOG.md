# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
