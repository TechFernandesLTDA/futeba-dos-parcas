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

### Segurança
- Corrige os 38 alertas abertos do Dependabot em `web`, `scripts`, `firestore-rules-tests`, `archive/backend` e `kotlin-js-store/wasm`, incluindo o alerta crítico de `shell-quote`.

### Documentação
- Atualiza README, índice de documentação, mapa do projeto e estratégia de branches com o status GitHub/release verificado em 2026-06-28.
- Adiciona `docs/GITHUB_STATUS.md` como painel operacional de issues, PRs, proteção de branch e versões correntes.

<!-- AUTOGEN:START -->

## Android

### [1.32.2] - 2026-06-30

#### Mudado
- `Location` no Android e no KMP agora inclui campos comerciais, de conta de quadra e agregados de descoberta.
- Mappers Android/KMP preservam os campos monetizados nas duas direções.
- Desserialização Firestore do shared lê os campos comerciais e agregados usados pela web.
- Docs e matriz de QA registram o contrato cross-platform de quadras monetizadas.

_Issues: #3109, #3129 · PRs: #3166_

### [1.32.1] - 2026-06-28

#### Corrigido
- `CreateGameScreen` usa `KeyboardOptions` adequadas para campos numéricos.
- `NumberStepper` passa a exibir helper text com os limites aceitos.
- Recursos de string do fluxo de Criar Jogo foram atualizados para documentar ranges e exemplos.

### [1.26.0] - 2026-05-22

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

### [1.25.0] - 2026-05-17

#### Adicionado
- Onboarding moderno: welcome carousel + checklist gamificada, Fase 1 (#1295).

#### Mudado
- Gate anti-bot pós-login via VerificationGateViewModel (#1313).

#### Corrigido
- Saga de token refresh do CPF portada de web para Android (#1312).
- Falhas de CI: badge helper, testes desatualizados, avisos do detekt (#1286).

_Issues: #443, #1303, #1310 · PRs: #1295, #1313, #1312, #1286_

### [1.24.0] - 2026-05-11

#### Mudado
- Bump de versão de manutenção após a mega audit wave de 2026-05-11, sem mudanças funcionais no Android nesta tag.

## Web

### [1.43.37] - 2026-06-30

#### Corrigido
- Corrige o cálculo de `totalCost` na tela de criação de jogo para usar `hourlyPrice * duração / 60`.
- Adiciona helpers testáveis para normalizar preço por hora em reais ou centavos e preservar compatibilidade com cadastros antigos.

### [1.43.36] - 2026-06-30

#### Corrigido
- Restaura a paridade de chaves i18n entre `pt-BR`, `en` e `es`, corrigindo a falha do `Web CI`.

### [1.43.35] - 2026-06-30

#### Mudado
- Fortalece o contrato visual E2E para telas administrativas e de quadras em desktop e mobile.
- Atualiza fixtures e seeds E2E para usuários admin/dono de quadra completos e autenticáveis.
- Desativa App Check no modo emulador para evitar ruído falso de `403` em testes locais.

### [1.43.34] - 2026-06-30

#### Mudado
- `ManageLocationsScreen` passa a renderizar rankings derivados do conjunto filtrado.
- `manageLocationRankings` centraliza a regra de melhores quadras e quadras mais baratas por tipo.
- Cobertura adicionada para ranking por avaliação e menor preço por tipo.

_Issues: #3107 · PRs: #3166_

### [1.43.33] - 2026-06-30

#### Mudado
- `FieldOwnerDashboardScreen` passa a consumir agregados denormalizados em `locations`.
- Tipos web de `Location` agora expõem agregados comerciais mantidos pelo backend.
- Modelo KMP de `Location` foi alinhado com os novos campos denormalizados.

_Issues: #3106, #3128 · PRs: #3166_

### [1.43.32] - 2026-06-30

#### Corrigido
- `isLocationCommerciallyAvailable` não usa mais `venueAccountStatus` como substituto silencioso de `subscriptionStatus`.
- `getLocationCommercialIssues` torna mutuamente exclusivos os avisos de mensalidade individual e conta agregada.

_Issues: #3121 · PRs: #3166_

### [1.43.31] - 2026-06-30

#### Adicionado
- Campos editáveis de funcionamento no `LocationFormScreen`.
- Itens `geolocation` e `operating-hours` no checklist web de qualidade da quadra.

#### Corrigido
- `ownerDashboard` agora propaga latitude/longitude para o checklist de completude.

_Issues: #3122_

### [1.43.30] - 2026-06-30

#### Adicionado
- Formulário web em `/admin/users` usando a callable `upsertVenueAccount`.
- Teste cobrindo o salvamento da conta comercial agregada.

#### Mudado
- O gerenciamento de usuários deixa de apenas exibir `venue_accounts` e passa a operar a configuração comercial centralizada.

_Issues: #3121_

### [1.43.29] - 2026-06-30

#### Adicionado
- Modelo web de `Field` e drafts de quadra com `playersPerTeam`, `minBookingMinutes`, `rules` e `amenities`.
- Testes de checklist cobrindo pendência de detalhes operacionais por campo.

#### Mudado
- `LocationFieldsEditor` ganhou controles responsivos para capacidade, duração mínima, regras e comodidades por campo.
- `getLocationQualityChecklist` agora exige detalhes mínimos dos campos ativos antes de considerar o cadastro comercial completo.

_Issues: #3122_

### [1.43.28] - 2026-06-30

#### Adicionado
- Cobertura adicionada para garantir que uma conta comercial agregada suspensa bloqueia a disponibilidade mesmo quando o status legado da quadra está ativo.

#### Mudado
- `FieldOwnerDashboardScreen` agora lê os campos `venueAccount*` denormalizados em `locations`.
- `ownerDashboard` propaga `venueAccountStatus` para os cálculos de checklist, issues comerciais e disponibilidade.

_Issues: #3125, #3135_

### [1.43.27] - 2026-06-30

#### Adicionado
- Integração web com `venueAccount` no CRM admin e com campos `venueAccount*` no resumo financeiro de quadras.
- Teste de regras garantindo leitura controlada de `venue_accounts` e bloqueio de escrita cliente nos campos denormalizados.

#### Mudado
- Filtros e alertas comerciais de quadras passam a considerar `venueAccountStatus` antes do status legado por quadra.

_Issues: #3087, #3119, #3122, #3135_

### [1.43.26] - 2026-06-29

#### Adicionado
- Novos campos comerciais para plano, ciclo, valor base e exceção comercial no contrato web de `Location`.
- Exportação administrativa de billing com colunas para plano, ciclo, valor base, início da cobrança e exceção comercial.

#### Mudado
- `ManageLocationsScreen` passa a salvar e renderizar a configuração comercial expandida por quadra.
- `FieldOwnerDashboardScreen` passa a carregar campos por subcoleção da location e fallback legado, reduzindo erros de permissão em produção.

_Issues: #3121, #3125_

### [1.43.25] - 2026-06-29

#### Adicionado
- Contrato web para `requestLocationCommercialReview` e `reviewLocationCommercialRequest`.
- Novos tipos de request comercial e metadados resumidos na entidade `Location`.

#### Mudado
- `FieldOwnerDashboardScreen` integra CTA, status e modal de solicitação comercial por quadra.
- `ManageLocationsScreen` passa a renderizar fila de revisão comercial e diálogo administrativo de decisão.

_Issues: #3115, #3125_

### [1.43.24] - 2026-06-29

#### Adicionado
- Novo helper testável `ownerDashboard` para centralizar métricas, checklist comercial, preço médio e status por quadra.
- Cobertura unitária para a lógica agregada do dashboard e para os estados principais da `FieldOwnerDashboardScreen`.

#### Mudado
- `FieldOwnerDashboardScreen` foi reestruturada para um layout responsivo com cards SaaS, blocos de ação e fluxo de comprovantes integrado.
- Textos PT-BR, EN e ES do dashboard do dono de quadra foram expandidos para cobrir os novos estados e ações.

_Issues: #3103_

### [1.43.23] - 2026-06-29

#### Adicionado
- Novo helper testável `publicLocationFilters` para centralizar filtros, ordenação, distância, preço e funcionamento por horário.
- Cobertura unitária para filtros públicos, ordenação, cálculo de distância, preço e horários overnight.

#### Mudado
- `LocationsMapScreen` usa estado único de filtros e métricas de campos por location para buscar tipo e menor preço com mais consistência.

_Issues: #3105_

### [1.43.22] - 2026-06-29

#### Adicionado
- `LocationDetailScreen` passa a ler `commercial_events` e `subscription_ledger` com estados de loading, erro e vazio.
- `manageLocationFilters` exporta checklist testável de qualidade cadastral/comercial.

#### Mudado
- O detalhe da quadra reutiliza as regras comerciais compartilhadas para manter lista e detalhe consistentes.

_Issues: #3100_

### [1.43.21] - 2026-06-29

#### Adicionado
- Helper testável centraliza os filtros comerciais de `ManageLocationsScreen`.
- Testes unitários cobrem fallback de publicação, filtros comerciais e checklist de pendências.

#### Mudado
- A lista admin reaproveita regras comerciais compartilhadas para evitar divergência entre filtro, chips e alerta de disponibilidade.

_Issues: #3099_

### [1.43.20] - 2026-06-29

#### Mudado
- `UserManagementScreen` passa a consumir `lastLoginAtIso` da callable `searchAdminUsers`.
- A UI deixa de tratar login como atualização cadastral, evitando leitura incorreta no CRM admin.
- Cobertura unitária valida a exibição separada de última atualização e último login.

_Issues: #3101_

### [1.43.19] - 2026-06-29

#### Mudado
- `UserManagementScreen` reutiliza a mensagem calculada por `getFunctionsErrorMessage` no toast.
- `getFunctionsErrorMessage` recebeu mensagens mais acionáveis para `failed-precondition` e `unavailable`.
- Cobertura unitária adicionada para erros de Cloud Functions no mapper Firebase.
- A versão web foi atualizada para `1.43.19`.

_Issues: #3149_

### [1.43.18] - 2026-06-29

#### Adicionado
- Novos campos tipados em `AdminLocationBillingSummaryRow` para ciclo atual.
- Chips administrativos para ciclo, vencimento e suspensao.
- Alerta financeiro no painel do dono de quadra baseado em `current_billing_open_balance_cents`.
- A versao web foi atualizada para `1.43.18`.

_Issues: #3132, #3124, #3119, #3086, #3084_

### [1.43.17] - 2026-06-29

#### Adicionado
- Integração web com `getAdminLocationBillingSummary`.
- Cards administrativos alimentados por resumo financeiro server-side.
- Filtros comerciais adicionais para vencimento, cidade e UID do dono.
- Exportação CSV admin baseada nas linhas retornadas pelo backend.
- A versão web foi atualizada para `1.43.17`.

_Issues: #3124, #3119, #3086, #3084_

### [1.43.16] - 2026-06-29

#### Adicionado
- Leitura de `locations/{locationId}/subscription_ledger` no gerenciamento de quadras.
- Labels e timeline para eventos financeiros comerciais.
- Resumo administrativo calculado a partir dos status comerciais carregados.
- A versão web foi atualizada para `1.43.16`.

_Issues: #3114, #3091, #3084_

### [1.43.15] - 2026-06-29

#### Adicionado
- Rota web `/owner/onboarding` para solicitação de dono de quadra.
- Revisão admin integrada ao `UserManagementScreen`.
- A versão web foi atualizada para `1.43.15`.

_Issues: #3137, #3115, #3125, #3088, #3084_

### [1.43.14] - 2026-06-29

#### Mudado
- `UserManagementScreen` passa a renderizar o detalhe comercial usando dados retornados por `searchAdminUsers`.
- A versão web foi atualizada para `1.43.14`.

_Issues: #3126, #3101, #3087, #3084_

### [1.43.13] - 2026-06-29

#### Mudado
- `UserManagementScreen` deixa de depender apenas do primeiro lote local de 50 usuários para busca e filtros.
- Integração web adicionada para a callable `searchAdminUsers`.
- A versão web foi atualizada para `1.43.13`.

_Issues: #3136, #3101, #3087, #3084_

### [1.43.12] - 2026-06-29

#### Mudado
- `ManageLocationsScreen` passou a listar os últimos pagamentos da subcoleção `subscription_payments` para owner/admin.
- O fluxo admin usa `submitLocationSubscriptionReceipt` seguido de `reviewLocationSubscriptionReceipt` para registrar e aprovar manualmente mantendo auditoria.
- A versão web foi atualizada para `1.43.12`.

_Issues: #3123, #3119, #3084_

### [1.43.11] - 2026-06-29

#### Adicionado
- Tela `ManageLocationsScreen` ganhou diálogo de comprovantes com upload privado, pendências e ações de aprovação/rejeição.
- Cliente web passou a consumir as callables `submitLocationSubscriptionReceipt` e `reviewLocationSubscriptionReceipt`.

#### Segurança
- Uploads de comprovantes usam path oficial `locations/{locationId}/subscription_receipts/{ownerId}/{fileName}`.
- Comprovantes comerciais não usam URL pública e ficam legíveis apenas para owner/admin pelas regras de Storage.

_Issues: #3133, #3091, #3084_

### [1.43.10] - 2026-06-28

#### Adicionado
- `ManageLocationsScreen` ganhou o painel "Dono e gerentes" para transferência administrativa e convites de managers.
- `LocationDetailScreen` passou a carregar campos e fotos da quadra para uma visão unificada de visualização e edição.
- Cliente web passou a consumir as callables `assignLocationOwner`, `inviteLocationManager`, `acceptLocationManagerInvite` e `removeLocationManager`.

#### Segurança
- A UI deixa claro que managers não podem publicar, cobrar, alterar dono ou mensalidade.
- `AuthContext` aplica a role efetiva das custom claims quando disponível, evitando perda temporária de menus administrativos.

_Issues: #3102, #3127, #3087, #3091_

### [1.43.9] - 2026-06-28

#### Mudado
- `CreateGameScreen` limpa selecoes de locais que deixam de estar disponiveis e exige `fieldId` ativo para locais catalogados.
- `QuickLocationDialog` continua salvando rascunho de local, mas o jogo usa os dados como local manual ate aprovacao comercial.

#### Segurança
- Firestore Rules agora bloqueiam criacao direta de jogos com `location_id` de quadra suspensa, vencida, nao publicada, sem verificacao ou sem campo ativo.
- Testes de rules cobrem location publicada, suspensa, vencida, sem `field_id` e field inativo.

_Issues: #3120, #3084, #3091_

### [1.43.8] - 2026-06-28

#### Adicionado
- Editor reutilizável para CRUD de campos dentro do cadastro de locais.
- Utilitários testados para normalizar preço por hora, carregar campos persistidos e gerar resumo denormalizado de disponibilidade.

#### Mudado
- O cadastro de locais passa a gravar campos em `locations/{locationId}/fields` com `writeBatch()`, `serverTimestamp()` e compatibilidade com `photoUrl` legado.
- O resumo do local passa a manter `field_count`, `primary_field_type` e `has_active_fields` para filtros e ranking comercial.

#### Segurança
- Edição de cadastro não força mais `is_active: true`, evitando reativação indevida de quadras suspensas e preservando as regras administrativas.

_Issues: #3084, #3085, #3088, #3097, #3098_

### [1.43.7] - 2026-06-28

#### Adicionado
- Helpers compartilhados para comodidades comerciais de quadras.
- Consulta auxiliar de preços ativos das quadras para filtros públicos.

#### Mudado
- `ManageLocationsScreen`, `LocationsMapScreen`, `FieldOwnerDashboardScreen` e `UserManagementScreen` passam a consumir o status comercial de quadras de forma mais explícita.

#### Segurança
- O fluxo continua preservando as alterações comerciais críticas via Cloud Functions protegidas.

_Issues: #3084, #3099, #3100, #3101, #3103, #3105_

### [1.43.6] - 2026-06-28

#### Adicionado
- Contrato web para status de publicação, assinatura e mensalidade de quadras.
- Documentação `docs/VENUE_MONETIZATION.md` para o modelo de monetização.

#### Mudado
- `useLocations` e o mapa público filtram quadras comercialmente indisponíveis.
- Cadastro completo e criação rápida iniciam quadras como `PENDING_REVIEW` e `TRIAL`.

#### Segurança
- Campos comerciais passam a depender das novas operações administrativas protegidas no backend.

_Issues: #3084, #3092, #3093, #3094, #3095, #3096, #3104_

### [1.43.5] - 2026-06-28

#### Mudado
- `FieldAvailabilityTimeline` passa a renderizar uma experiência compacta em telas pequenas.
- `CreateGameScreen` deduplica sugestões de horário e evita blocos repetidos no fluxo de data e horário.

### [1.43.4] - 2026-06-28

#### Corrigido
- `CreateGameScreen` separa rascunho de digitação dos valores numéricos validados.
- Payload de criação usa os valores normalizados no submit, evitando envio de número antigo após campo limpo.
- Traduções `pt-BR`, `en` e `es` mantidas em paridade para novas mensagens do formulário.

### [1.43.3] - 2026-06-28

#### Corrigido
- `GroupDetailScreen` passa a condicionar ações sensíveis por membership/admin e usa tabs scrollable no mobile.
- `CashboxScreen` adiciona ledger com filtros, `receipt_url` opcional e fluxo de `VOIDED` auditável.
- `GroupEditScreen` e `storage.rules` alinham extensões reais de logo do grupo.
- `GroupSettingsScreen` oculta menus sem ações possíveis e remove textos hardcoded.
- `GroupPhotosPanel` agrega `game_photos` a partir de jogos reais do grupo sem duplicar dados.

_Issues: #3030, #3031, #3032, #3033, #3034, #3035, #3036, #3037, #3038_

### [1.43.2] - 2026-06-28

#### Corrigido
- `usePlayerCard`, `useStatistics`, `usePlayers` e `AuthContext` passam a ler `statistics/{uid}` e `user_streaks` como fonte canônica.
- Adiciona normalizador compartilhado para mapear `gamesWon`, `bestPlayerCount`, `totalGames` e campos legados sem drift.

### [1.43.1] - 2026-06-28

#### Corrigido
- Adiciona `maxHeight`/`overflowY` responsivo no modal do `PlayerCard` e compacta estilos `xs` para viewport mobile com barras do navegador.

### [1.43.0] - 2026-06-28

#### Adicionado
- Teste de componente para validar a renderização do novo `PlayerCard` com dados mockados.

#### Mudado
- Reestrutura `web/src/components/player/PlayerCard.tsx` com layout novo, tiles de estatísticas e barras de atributos redesenhadas.

### [1.42.1] - 2026-06-28

#### Corrigido
- Remove o wrapper `AdaptiveFormSheet` da `CreateGameScreen` para evitar Drawer lateral no desktop.

### [1.42.0] - 2026-06-28

#### Adicionado
- Componente local de seção para a tela de criação de jogo.
- Resumo vivo com progresso dos campos essenciais.

#### Mudado
- Reorganização visual da tela `CreateGameScreen` com layout responsivo em grade.
- Testes atualizados para cobrir o novo hero, seções e resumo.

### [1.41.0] - 2026-06-27

#### Adicionado
- Utilitário `groupMatchmaking` para pontuar e ordenar grupos oficiais.
- Testes para match por região, categoria de horário e ordenação por compatibilidade.

#### Mudado
- `DiscoverGroupsScreen` ganhou filtros de matchmaking, score visual, motivos do match e CTA de entrada guiada.

_Issues: #2975_

### [1.40.0] - 2026-06-27

#### Adicionado
- Utilitário `friendlyComparison` para montar resumo, headline e texto compartilhável.
- Testes unitários para vitórias, desempate por gols e cenário equilibrado.

#### Mudado
- `HeadToHeadScreen` passa a exibir um card de rivalidade amistosa quando há jogos em comum.

_Issues: #2976_

### [1.39.0] - 2026-06-27

#### Adicionado
- Utilitário `headToHeadPeriod` com tipo `HeadToHeadPeriod` e função `isGameWithinHeadToHeadPeriod`.
- Testes unitários para os períodos `30d`, `90d`, `365d` e `all`.

#### Mudado
- `useHeadToHead` agora inclui o período no `queryKey` e filtra partidas finalizadas antes de calcular estatísticas.

_Issues: #2977_

### [1.38.0] - 2026-06-27

#### Adicionado
- Utilitário `compareGroupLeagueStandings` com desempate por presença e critérios esportivos.
- Testes unitários para ordenação por pontos, presença, vitórias, saldo, gols e nome.

#### Corrigido
- `useGroupLeague` agora usa a temporada selecionada no query key, fetch e listener em tempo real.

_Issues: #2978_

### [1.37.0] - 2026-06-27

#### Adicionado
- Utilitário `buildPostGameHighlights` com heurística testável para MVP, melhor dupla e lance marcante.
- Componente `PostGameHighlightsPanel` integrado ao `GameDetailScreen`.
- Testes unitários para cálculo e texto compartilhável dos destaques pós-jogo.

_Issues: #2969_

### [1.36.0] - 2026-06-27

#### Adicionado
- Hook web `usePostGameReputation` para carregar avaliações enviadas e chamar a Function server-side.
- Componente `PostGameReputationPanel` integrado ao `GameDetailScreen`.
- Agregados `reputation_*` exibidos no `ProfileScreen`.

#### Segurança
- Cliente não escreve agregados de reputação diretamente; a UI chama `submitPostGameReputation`.

_Issues: #2968_

### [1.35.0] - 2026-06-27

#### Adicionado
- Hook `useGameRides` com listener em tempo real para `game_rides`.
- Painel web `GameRidesPanel` integrado ao `GameDetailScreen`.
- Notificações internas `GAME_RIDE` criadas junto da publicação via `writeBatch()`.

#### Segurança
- Firestore Rules para `game_rides` validam schema, autoria, documento `{gameId}_{uid}`, origem/destino aproximados, limite de vagas e atualização apenas pelo dono da carona.

_Issues: #2980_

### [1.34.0] - 2026-06-27

#### Adicionado
- Componente social de check-in usando `checked_in`/`checked_in_at` das confirmações.

#### Corrigido
- Condição web agora usa `checkedIn` em vez de depender do status `CHECKED_IN`, que a Cloud Function não grava.

_Issues: #2981_

### [1.33.0] - 2026-06-27

#### Adicionado
- Componente web `GamePhotosTab` integrado ao `GameDetailScreen`.
- Testes de Firestore Rules para criação, bloqueios de abuso e exclusão de `game_photos`.

#### Segurança
- `game_photos` agora valida schema, tipo MIME, tamanho, legenda, status e `storage_path` pertencente ao uploader.
- Storage Rules adicionam caminho `games/{gameId}/photos/{userId}/{fileName}` com upload apenas pós-jogo e deleção por uploader/organização/admin.

_Issues: #2982_

### [1.32.0] - 2026-06-27

#### Adicionado
- Hook `useUpdateChallengeProgress` para progresso/finalização com toast e notificação interna.
- Testes de Firestore Rules para criação, update permitido e bloqueios de abuso em `group-challenges`.

#### Corrigido
- Criação web de desafios passa a gravar `created_by`, `updated_at`, meta, alvo e prazo.

#### Segurança
- Rules de `group-challenges` agora validam schema, autor autenticado, associação ao grupo, progresso máximo e imutabilidade de autor/grupos/meta/alvo/prazo.

_Issues: #2984_

### [1.31.0] - 2026-06-27

#### Adicionado
- Hook `useFavoriteSquads` com listener, toasts e validação client-side.
- Utilitário testável para normalizar, validar, filtrar e aplicar favoritos na formação.
- Rules owner-only para `users/{uid}/favorite_squads`.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Favoritos são privados ao dono do perfil e limitados por schema nas Firestore Rules.

_Issues: #2985_

### [1.30.0] - 2026-06-27

#### Adicionado
- Utilitário testável `getReconnectSuggestions` para priorizar grupos que merecem reencontro.
- Widget `ReconnectSuggestionWidget` no dashboard web, reaproveitando `useGroups()` sem novas consultas Firestore.
- Testes unitários para janela de reconexão, grupos com jogo futuro e ordenação por distância sem jogo.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Sem novas permissões ou regras nesta versão; a sugestão usa apenas dados de grupos já carregados para o usuário.

_Issues: #2986_

### [1.29.0] - 2026-06-27

#### Adicionado
- Utilitário testável `groupNotificationsByContext` para organizar notificações por contexto.
- Mutação `declineGameInvite` com `writeBatch()` e fallback para resolver convites mesmo quando não há confirmação pendente apagável.
- Testes unitários para agrupamento contextual e recusa rápida de convites.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Sem mudanças de regras nesta versão; a recusa usa permissões existentes de deleção da própria confirmação.

_Issues: #2987_

### [1.28.0] - 2026-06-27

#### Adicionado
- Campo `lastGameDate` no parse web de usuários para consumir `last_game_date` do Firestore.
- Filtro `recentPresenceOnly` em `usePositionReinforcements`.
- Testes unitários para presença recente, janela de 30 dias e filtro de candidatos.

#### Corrigido
- Sem correções nesta versão.

#### Segurança
- Sem mudanças de segurança nesta versão.

_Issues: #2972_

### [1.27.0] - 2026-06-27

#### Adicionado
- `useLookingForGameToday` e badge de disponibilidade nas telas de perfil/busca.
- Ranking de candidatos de reforço por posição com testes unitários.
- Painel `PositionReinforcementsPanel` no detalhe do jogo para owners/admins.

#### Corrigido
- Fluxo de convocação de reforço usa `writeBatch()` para manter confirmação pendente, summon e notificação consistentes.

#### Segurança
- `game_summons` passou a exigir whitelist de campos, `status=PENDING` na criação e enum fechado de posição.

_Issues: #2974, #2973 · PRs: #3002, #3003_

### [1.26.3] - 2026-06-21

#### Mudado
- `canSendSmsOtp` mantém App Check obrigatório, mas não consome o token antes do Firebase Phone Auth.
- O web renderiza explicitamente o reCAPTCHA invisível e continua o Phone Auth quando o preflight consultivo falha.
- O Android resolve a `Activity` a partir de `ContextWrapper` antes de iniciar `PhoneAuthProvider.verifyPhoneNumber`.

#### Corrigido
- Fluxo de verificação por SMS deixa de bloquear cadastro legítimo em falhas transitórias do preflight.

_PRs: #2810_

### [1.26.2] - 2026-06-21

#### Adicionado
- `autoClosePastGames` roda de hora em hora e fecha jogos ativos com mais de 2 dias de atraso.
- Jogos antigos com quórum confirmado, ou em status `LIVE`, viram `FINISHED`; sem quórum viram `CANCELLED`.

#### Mudado
- `useNextGame`, `usePrefetchHome` e `usePublicGames('map')` filtram `dateTime >= agora`.
- A aba `GamesTab` aplica uma tolerância visual curta para esconder ativos vencidos antes do cron.

#### Corrigido
- Listas e cards de próximo jogo não priorizam mais partidas antigas que ficaram com status ativo no Firestore.

_PRs: #2810_

### [1.26.1] - 2026-06-21

#### Mudado
- `useScrollRestoration` agora chaveia por `pathname + search`, rola para o topo em navegações novas e restaura posição apenas em navegação `POP`.
- `useFocusOnNavigate` usa `focus({ preventScroll: true })` para preservar o alinhamento visual após troca de rota.
- Componentes de auth, containers e topbar mobile receberam proteções de layout responsivo.

#### Corrigido
- Scroll inicial de páginas e abas web ajustado para não ficar escondido sob a topbar.
- Bundle de release notes web atualizado para refletir as mudanças recentes.

_PRs: #2810_

### [1.26.0] - 2026-05-22

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

### [1.6.0] - 2026-05-22

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

### [1.2.23] - 2026-06-30

#### Adicionado
- `recomputeLocationCommercialStats` para recomputar uma quadra específica ou um lote limitado.
- `rebuildLocationCommercialStats` como job diário.
- Triggers `onNestedLocationFieldWrittenUpdateStats`, `onRootFieldWrittenUpdateLocationStats`, `onLocationReviewWrittenUpdateStats` e `onGameWrittenUpdateLocationStats`.
- Helpers testados para agregados de campos/preços, jogos e reviews.

_Issues: #3106, #3128 · PRs: #3166_

### [1.2.22] - 2026-06-30

#### Corrigido
- `backfill-venue-commercial-data` compara o snapshot existente antes de marcar conta agregada como pendente de sync.
- Valores `0` em centavos passam a ser tratados como válidos no backfill.
- `persistVenueAccount` registra falha de evento/audit log sem transformar uma atualização já persistida em erro para o callable.

_Issues: #3121 · PRs: #3166_

### [1.2.21] - 2026-06-30

#### Corrigido
- `upsertVenueAccount` passa a validar `billingDueDay` com limite máximo de 31.
- Adiciona cobertura de regressão para preservar dados comerciais existentes e validar campos de cobrança antes da persistência.

_Issues: #3122_

### [1.2.20] - 2026-06-30

#### Mudado
- `buildLocationCommercialRequestSnapshot` adiciona pendências `geolocation` e `operating-hours`.
- `ready_for_publication_approval` agora depende de mapa e horários operacionais válidos.

_Issues: #3122_

### [1.2.19] - 2026-06-30

#### Mudado
- `setLocationPublicationStatus` calcula o snapshot comercial antes de publicar e bloqueia `PUBLISHED` quando `ready_for_publication_approval` não é verdadeiro.

#### Corrigido
- Fecha o gap em que uma quadra poderia ser publicada sem o evento comercial/financeiro mínimo definido.

_Issues: #3121_

### [1.2.18] - 2026-06-30

#### Adicionado
- Nova coleção `venue_accounts/{ownerUid}` com eventos imutáveis em subcoleção e auditoria global.
- Novos callables admin-only: `upsertVenueAccount`, `linkLocationToVenueAccount`, `unlinkLocationFromVenueAccount`.
- Backfill de monetização passa a criar/sincronizar contas comerciais agregadas e denormalizar `venue_account_*` nas quadras elegíveis.
- Testes unitários cobrindo criação, vínculo, desvínculo, auditoria e rejeição de vínculos inválidos.

#### Mudado
- Firestore rules protegem `venue_accounts` e impedem escrita cliente nos campos comerciais agregados de `locations`.

_Issues: #3087, #3119, #3122, #3135_

### [1.2.17] - 2026-06-29

#### Adicionado
- Validações de `billingPlanCode`, `billingCycle`, `billingBaseFeeCents` e coerência entre início e fim de cobrança em `setLocationSubscription`.
- Persistência de `billing_plan_code`, `billing_plan_label`, `billing_cycle`, `billing_base_fee_cents` e `billing_exception_note` na location e no `subscription_ledger`.

#### Mudado
- `getAdminLocationBillingSummary` passa a incluir plano, ciclo, valor base, início da cobrança e exceção comercial.
- Eventos e snapshots comerciais de assinatura ficam mais completos para auditoria de antes/depois.

_Issues: #3121_

### [1.2.16] - 2026-06-29

#### Adicionado
- Novas callables `requestLocationCommercialReview` e `reviewLocationCommercialRequest`.
- Snapshot comercial com checklist, pendências e issues operacionais salvo junto da solicitação.
- Subcoleção `publication_requests` adicionada ao lifecycle auditável de quadras.

#### Mudado
- O backend consolida o último status de solicitação comercial também no documento principal da `location`.
- Eventos de submissão e revisão comercial passam a alimentar `commercial_events` para rastreabilidade.

_Issues: #3115_

### [1.2.15] - 2026-06-29

#### Mudado
- `searchAdminUsers` adiciona `lastLoginAtIso` ao contrato da linha de usuário.
- `updatedAtIso` fica restrito a campos de atualização cadastral.

_Issues: #3101_

### [1.2.14] - 2026-06-29

#### Corrigido
- `searchAdminUsers` passa a usar `consumeAppCheckToken: false`, mantendo `enforceAppCheck` ativo para a callable.
- Teste regressivo cobre a configuração segura da callable admin de leitura.

#### Segurança
- Mantém autenticação, App Check, rate limit e role `ADMIN` obrigatórios no CRM de usuários.

_Issues: #3149_

### [1.2.13] - 2026-06-29

#### Corrigido
- `secureCallable` passa a separar `enforceAppCheck` de `consumeAppCheckToken`.
- `getAdminLocationBillingSummary` usa `consumeAppCheckToken: false`, preservando App Check obrigatorio sem bloquear retries legitimos de leitura.
- Teste regressivo garante a configuracao segura do callable do painel financeiro.

#### Segurança
- Mantem App Check e role `ADMIN` obrigatorios no painel financeiro, sem reduzir autorizacao do endpoint.

_Issues: #3149_

### [1.2.12] - 2026-06-29

#### Corrigido
- `getAdminLocationBillingSummary` usa paginacao por `documentId` com `scanComplete: true` apenas apos varrer todas as paginas.
- Leituras de `subscription_payments` usam `where("period_key", "==", periodKey)` e paralelismo controlado por chunks.
- Teste regressivo cobre mais de 500 quadras, pagamento antigo fora do periodo e pagamento aprovado duplicado no mesmo ciclo.

#### Segurança
- Reduz risco de decisao administrativa com MRR subestimado ou recebido inflado por dados financeiros duplicados.

_Issues: #3149_

### [1.2.11] - 2026-06-29

#### Corrigido
- `setLocationSubscription` agora distingue campo ausente de campo explicitamente `null`.
- Campos opcionais so sao gravados quando enviados pelo caller.
- Teste regressivo cobre alteracao parcial de status preservando `monthly_fee_cents`, `billing_due_day`, `billing_starts_at` e `billing_expires_at`.

#### Segurança
- Reduz risco de perda silenciosa de configuracao financeira em callable admin.

_Issues: #3148, #3132, #3121_

### [1.2.10] - 2026-06-29

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

### [1.2.9] - 2026-06-29

#### Adicionado
- Callable `getAdminLocationBillingSummary` exclusiva para admins.
- Resumo financeiro por período com linhas por quadra, saldo aberto e pendências de comprovante.
- Testes unitários cobrindo agregação financeira e validação de período.

#### Segurança
- Dados financeiros consolidados ficam atrás de `requiredRole: ADMIN`.

_Issues: #3124, #3119, #3091, #3086, #3084_

### [1.2.8] - 2026-06-29

#### Adicionado
- Subcoleção `locations/{locationId}/subscription_ledger`.
- Entradas de ledger para status/plano, pagamento registrado, comprovante enviado e revisão de comprovante.
- Testes unitários cobrindo ledger em Functions.

#### Segurança
- Firestore Rules permitem leitura do ledger apenas para owner, manager ou admin.
- Escrita direta no ledger segue bloqueada para clientes; somente Cloud Functions via Admin SDK gravam eventos.

_Issues: #3114, #3091, #3084_

### [1.2.7] - 2026-06-29

#### Adicionado
- Callables `requestVenueOwnerOnboarding` e `reviewVenueOwnerOnboarding`.
- Coleção `venue_owner_onboarding/{ownerUid}` com eventos imutáveis em subcoleção.
- `searchAdminUsers` passa a retornar o resumo do onboarding comercial.
- Firestore Rules permitem leitura para owner/admin e bloqueiam escrita direta do cliente.

#### Segurança
- Owner não pode alterar estados sensíveis nem se promover para `FIELD_OWNER`.
- Aprovação admin exige checklist de contato, quadras, termos e cobrança.

_Issues: #3137, #3115, #3125, #3088, #3084_

### [1.2.6] - 2026-06-29

#### Mudado
- `searchAdminUsers` retorna `ownerLocations`, contatos básicos, timestamps de atualização e agregados financeiros por owner.
- A versão Functions foi atualizada para `1.2.6`.

#### Segurança
- A callable continua admin-only, com App Check em produção, rate limit dedicado e auditoria habilitada.

_Issues: #3126, #3101, #3087, #3084_

### [1.2.5] - 2026-06-29

#### Adicionado
- Callable admin-only `searchAdminUsers` com paginação, busca textual e filtros por role/status comercial.
- Agregação server-side de `locations` por owner para total de quadras, publicadas, pendentes, suspensas/vencidas e cadastro comercial incompleto.

#### Segurança
- A callable exige autenticação, role `ADMIN`, App Check fora do emulador e rate limit dedicado.

_Issues: #3136, #3101, #3087, #3084_

### [1.2.4] - 2026-06-29

#### Adicionado
- Callable `submitLocationSubscriptionReceipt` para owner/admin criar pagamento `PENDING_REVIEW` com `receipt_storage_path` privado.
- Callable `reviewLocationSubscriptionReceipt` para admin aprovar/rejeitar comprovante e vincular o arquivo ao ledger de pagamentos.
- Cobertura de testes para submissão, aprovação, rejeição, permissões e paths inválidos.

#### Segurança
- Validação server-side exige path oficial de comprovante com `ownerId` da própria location.
- Managers não podem enviar comprovantes comerciais de mensalidade.

_Issues: #3133, #3091, #3084_

### [1.2.3] - 2026-06-28

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

### [1.2.2] - 2026-06-28

#### Adicionado
- Callable `setLocationPublicationStatus` para publicar, suspender ou reprovar quadras.
- Callable `setLocationSubscription` para controlar mensalidade e status comercial.
- Callable `registerLocationSubscriptionPayment` para registrar pagamento manual e reativar assinatura.
- Eventos comerciais gravados em `locations/{locationId}/commercial_events` e `audit_logs`.

#### Segurança
- Firestore Rules bloqueiam escrita client-side em eventos comerciais e pagamentos.
- Donos e gerentes de quadra não podem alterar status de publicação, mensalidade ou pagamento diretamente.

_Issues: #3084, #3092, #3093, #3094, #3095, #3096_

### [1.2.1] - 2026-06-28

#### Segurança
- `xp_logs` passam a gravar `transaction_id`, `source`, `source_collection`, `source_event_id` e `source_confirmation_id` no fluxo principal.
- XP de votação passa a gravar metadados da votação, incluindo categoria e contagem de votos.

### [1.2.0] - 2026-06-27

#### Adicionado
- Callable `submitPostGameReputation` com App Check, perfil completo e rate limit.
- Collection `post_game_reputation` com documento `{gameId}_{reviewerId}_{targetUserId}`.
- Recalculo transacional de `reputation_overall_avg`, critérios e `reputation_reviews_count` em `users/{targetUserId}`.

#### Segurança
- Firestore Rules bloqueiam escrita direta em `post_game_reputation` e tornam `reputation_*` server-only em `users`.

_Issues: #2968_

### [1.1.0] - 2026-06-27

#### Adicionado
- `checkInToGame` salva notificações `checkin` para outros confirmados após check-in novo.
- Tipo `NotificationType.CHECKIN` para padronizar o payload salvo em `notifications`.

#### Segurança
- Notificação roda server-side e best-effort, sem permitir escrita direta de presença pelo cliente.

_Issues: #2981_

### [1.0.0] - 2026-05-22

#### Adicionado
- Versão 1.0.0 definida como linha de base das Cloud Functions no versions.json.
- Fundação de versionamento multi-plataforma (#1501).

#### Corrigido
- Atomicidade no temporal-overlap e get-then-set de season (#1478).
- processXpIdempotent usa doc ID determinístico contra race condition (#1467).
- Mocks de testes desatualizados restaurados (#1516).

_Issues: #1478, #1467 · PRs: #1478, #1467, #1500, #1501, #1516_

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
