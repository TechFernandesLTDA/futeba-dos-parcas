# SPEC: Time do Coração (Favorite Team)

> **Status:** `DRAFT`
> **Autor:** Renan Locatiz Fernandes
> **Data:** 2026-05-09
> **PR:** #xxx (preencher quando criar)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

Hoje o projeto Futeba dos Parças é um app de futebol amador, mas não permite que os jogadores expressem seu fandom de futebol profissional. Não há nenhum campo para o usuário declarar qual time torce, nem qualquer exibição visual de times em perfis ou rankings.

Isso é uma oportunidade clara de engajamento social: torcedores adoram exibir seus times, provocações saudáveis entre torcidas rivais aumentam interação e retenção, e o dado é extremamente relevante para segmentação de features futuras (notificações por time, estatísticas por torcida, gamificação por time etc.).

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador novo | No onboarding (ProfileSetup), escolhe seu time do coração de uma lista pesquisável | Time salvo no Firestore, visível no perfil |
| UC2 | Jogador existente | Edita perfil e seleciona/alterar time do coração | Time atualizado, visível imediatamente em todas as telas |
| UC3 | Jogador existente | Não quer declarar time (opcional) | Campo fica vazio/null, sem quebrar layout |
| UC4 | Qualquer jogador | Vê perfil de outro jogador (ProfileScreen, PlayerCard/Figurinha) | Escudo do time aparece próximo ao nome/foto |
| UC5 | Qualquer jogador | Vê lista de jogadores (Ranking, Liga, Grupo) | Escudo do time aparece no card de cada jogador |
| UC6 | Qualquer jogador | Vê racha confirmado (GameDetail) | Escudo aparece ao lado do nome de cada confirmado |
| UC7 | Qualquer jogador | Vota MVP/Bola Murcha | Escudo aparece no card de cada candidato |
| UC8 | Qualquer jogador | Home screen | Escudo visível no header do próprio perfil |
| UC9 | Torcedores do mesmo time | (futuro) Agrupamento por torcida em rankings | Fora de escopo desta spec |

### 1.3 Critérios de Aceite

- [ ] CA1: Campo `favorite_team` existe no documento `users/{uid}` no Firestore (nullable, string opcional)
- [ ] CA2: Collection `teams` existe no Firestore com ao menos os 20 times da Série A 2026 (name, badgeUrl)
- [ ] CA3: ProfileSetupScreen (web) oferece dropdown/seletor de time (opcional, pode pular)
- [ ] CA4: EditProfileScreen (web) oferece dropdown/seletor de time com busca
- [ ] CA5: EditProfileScreen (Android) oferece seletor de time com busca
- [ ] CA6: PlayerCard/Figurinha (web + Android) exibe escudo do time (se preenchido)
- [ ] CA7: ProfileScreen (web + Android) exibe escudo do time (se preenchido)
- [ ] CA8: RankingScreen + LeagueScreen + RankingsTab (web + Android) exibem escudo no card de cada jogador
- [ ] CA9: GameDetailScreen (web + Android) exibe escudo na lista de confirmados
- [ ] CA10: GroupDetailScreen + PlayersScreen (web + Android) exibem escudo no card de membro
- [ ] CA11: MVPVoteScreen (web + Android) exibe escudo no card de candidato
- [ ] CA12: HomeTab (web) e ExpressiveHubHeader (Android) exibem escudo no header
- [ ] CA13: Campo pode ficar vazio — layouts não quebram com time null
- [ ] CA14: Mapeamento Firestore → TypeScript (snakeToCamel) e Firestore → Kotlin (@SerialName) corretos
- [ ] CA15: Nenhum hardcode de cor hex, time name, ou badge URL — tudo do Firestore ou constante compartilhada

### 1.4 Fora de Escopo

- Ranking por torcida / agrupamento por time
- Notificações segmentadas por time
- Gamificação atrelada ao time (XP bônus por torcida, etc.)
- Estatísticas por torcida
- Filtro de jogadores por time na busca
- Badges ou conquistas relacionadas a times
- Sistema de rivalidades automatizado (ex: Gre-Nal, Fla-Flu)
- Avatar customizado com escudo do time (só exibição simples)
- iOS — app iOS não existe ainda

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[Onboarding/ProfileSetup] --seletor time (opcional)--> [Home]
                                                              |
[Home] --tab Perfil--> [ProfileScreen] --ver escudo no header
    |                       |
    |                   [EditProfile] --alterar time--> [ProfileScreen atualizado]
    |
    |--tab Rankings--> [RankingsTab] --ver escudos nos cards
    |
    |--Grupo--> [GroupDetail] --ver escudos nos membros
    |
    |--Racha--> [GameDetail] --ver escudos nos confirmados
                    |
                [MVPVote] --ver escudos nos candidatos
```

### 2.2 Telas e Estados — ONDE o escudo aparece

| Tela | Plataforma | Posição do escudo | Tamanho |
|------|-----------|-------------------|---------|
| **ProfileScreen** | Web + Android | Ao lado do nome, abaixo do avatar | 24x24dp |
| **EditProfileScreen** | Web + Android | Dropdown/seletor dentro do formulário | N/A (input) |
| **ProfileSetupScreen** | Web | Dropdown/seletor (opcional, com "Pular") | N/A (input) |
| **PlayerCard/Figurinha** | Web + Android | Canto superior direito do card, ou abaixo do nome | 28x28dp |
| **RankingCard** | Web + Android | À esquerda do nome, mesma linha | 20x20dp |
| **LeagueCard** | Web + Android | À esquerda do nome | 20x20dp |
| **GameDetail (confirmados)** | Web + Android | Ao lado do nome do jogador | 18x18dp |
| **GroupDetail (membros)** | Web + Android | Ao lado do nome no card de membro | 20x20dp |
| **PlayersScreen (membros)** | Web + Android | Ao lado do nome no card de membro | 20x20dp |
| **MVPVoteScreen (candidatos)** | Web + Android | Ao lado do nome | 20x20dp |
| **HomeTab (web)** | Web | Header, ao lado do nome "Olá, {nome}" | 28x28dp |
| **ExpressiveHubHeader (Android)** | Android | Header, ao lado do nome | 28x28dp |

**Estados visuais:**
- **Com time**: Exibe badge (escudo + nome do time em tooltip/label secundário)
- **Sem time (null)**: Não exibe nada, espaço reservado colapsa (sem gap vazio)

**Estados de tela (todas as telas acima):**
- **Loading**: Skeleton/shimmer placeholder para o escudo (círculo de ~20-28px)
- **Empty (sem time)**: Nada renderizado no espaço do escudo
- **Error**: Fallback silencioso — se imagem do escudo falhar, mostra placeholder com iniciais do time
- **Success**: Escudo renderizado com `object-fit: contain`, borda sutil (1px solid, cor do tema)

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Phone Portrait | Escudo à esquerda do nome, tamanho padrão |
| Phone Landscape | Sem alteração |
| Tablet (sw600dp+) | Escudo proporcionalmente maior (1.2x) |

### 2.4 Acessibilidade

- [ ] Todo escudo tem `contentDescription` = "Torcedor do {nome do time}" (Android) / `aria-label` (web)
- [ ] Touch targets >= 48dp (escudo NÃO é clicável, apenas decorativo)
- [ ] Imagem do escudo com `alt` text descritivo no web
- [ ] Seletor de time no EditProfile/Setup é navegável por teclado e TalkBack

### 2.5 Animações e Micro-interações

- Ao selecionar time no setup/edit: minibounce/scale no escudo selecionado (200ms ease-out)
- Transição suave (fade-in 300ms) quando escudo carrega nos cards

---

## 3. Technical Design

### 3.1 Arquitetura — Full Stack

```
[Web: React + MUI]                    [Android: Compose]
     │                                       │
     ├── useAuth() → User type               ├── User data class (KMP shared)
     ├── useUserProfile()                     ├── UserRepository
     ├── useTeam/teams hook (fetch teams)     ├── TeamsRepository
     │                                       │
     └────────────┬──────────────────────────┘
                  │
          [Firestore]
     ┌────────────────────┐
     │ users/{uid}         │  ← novo campo: favorite_team (string | null)
     │   ...               │
     │   favorite_team     │  ← "corinthians" (teamId)
     │                     │
     │ teams/{teamId}      │  ← nova collection (read-only, seed manual)
     │   name              │  ← "Corinthians"
     │   badge_url         │  ← "https://.../corinthians.png"
     │   short_name        │  ← "COR" (3 letras)
     │   category          │  ← "Série A" | "Série B" | "Internacional" | "Outros"
     │   state             │  ← "SP"
     └────────────────────┘
```

### 3.2 Modelos de Dados

#### Firestore (`users/{uid}`) — novo campo

```javascript
favorite_team: "corinthians"  // string | null (teamId da collection teams)
```

#### Web — TypeScript (`web/src/types/user.ts`)

```typescript
export interface User {
  // ... campos existentes ...
  favoriteTeam?: string; // teamId da collection 'teams', ex: "corinthians"
}
```

#### Web — TypeScript (`web/src/types/team.ts`) — NOVO ARQUIVO

```typescript
export interface Team {
  id: string;          // teamId, ex: "corinthians"
  name: string;         // "Corinthians"
  badgeUrl: string;     // URL do escudo
  shortName?: string;   // "COR"
  category?: string;    // "Série A", "Série B", etc.
  state?: string;       // "SP"
}
```

#### Android — KMP Shared (`shared/.../domain/model/User.kt`)

```kotlin
@Serializable
data class User(
    // ... campos existentes ...
    @SerialName("favorite_team") val favoriteTeam: String? = null,
    // ...
)
```

#### Android — KMP Shared (`shared/.../domain/model/Team.kt`) — NOVO ARQUIVO

```kotlin
@Serializable
data class Team(
    val id: String = "",
    val name: String = "",
    @SerialName("badge_url") val badgeUrl: String = "",
    @SerialName("short_name") val shortName: String? = null,
    val category: String? = null,
    val state: String? = null
)
```

### 3.3 API / Firestore

| Operação | Collection/Endpoint | Método | Payload |
|----------|---------------------|--------|---------|
| Buscar todos os times | `teams` | `getDocs` (com cache local) | - |
| Buscar time por ID | `teams/{teamId}` | `getDoc` | - |
| Salvar time do usuário | `users/{uid}` | `updateDoc` | `{ favorite_team: teamId }` |
| Remover time do usuário | `users/{uid}` | `updateDoc` | `{ favorite_team: null }` |
| Criar doc inicial (sign-up) | `users/{uid}` | `setDoc` | `{ favorite_team: null, ... }` |

### 3.4 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| Sem internet ao abrir seletor | Exibir lista de times do cache local (pre-carregada no app start) |
| Sem internet ao ver profile | Escudo pode não carregar (URL externa) — fallback para iniciais |
| Dados expirados | Times mudam raramente — TTL de 24h no cache é suficiente |

### 3.5 Segurança

- [ ] Nenhum token/secret hardcoded
- [ ] Collection `teams` é read-only para todos os authenticated users (Firestore rules)
- [ ] Campo `favorite_team` no `users/{uid}`: owner pode escrever; outros só leem
- [ ] URL do badge é validada (domínios permitidos: Firebase Storage, CDN conhecido)

### 3.6 Performance

- [ ] Lista de times carregada UMA vez no app start (web: contexto/hook; Android: Repository com cache em memória)
- [ ] Escudos são imagens pequenas (48x48px WebP, ~2-4KB cada)
- [ ] `TeamsContext` no web expõe `Map<string, Team>` para lookup O(1) em renders de lista
- [ ] Evitar re-fetch de times a cada navegação — usar `staleTime: Infinity` no TanStack Query (web) ou `MemoryCache` (Android)

### 3.7 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `favorite_team_set` | Ao selecionar/alterar time no perfil | `team_id: string`, `source: 'onboarding' \| 'edit_profile'` |
| `favorite_team_removed` | Ao remover time do perfil | `previous_team_id: string` |

---

## 4. Tasks (Breakdown Completo)

### Fase 1: Fundação — Modelo de Dados e Seed

| # | Task | Camada | Arquivos afetados | Estimativa |
|---|------|--------|-------------------|------------|
| 1.1 | Criar collection `teams` no Firestore com seed inicial (~30 times) | Firestore | Console/script de seed | 1h |
| 1.2 | Adicionar campo `favorite_team` (nullable) ao `createUserDocument` no AuthContext | Web | `web/src/contexts/AuthContext.tsx` | 30min |
| 1.3 | Adicionar campo `favoriteTeam?` ao type `User` no TypeScript | Web | `web/src/types/user.ts` | 10min |
| 1.4 | Criar type `Team` no TypeScript | Web | `web/src/types/team.ts` (novo) | 10min |
| 1.5 | Criar `TeamsContext` + `useTeams` hook (fetch + cache) | Web | `web/src/contexts/TeamsContext.tsx`, `web/src/hooks/useTeams.ts` | 1h |
| 1.6 | Adicionar campo `favoriteTeam` ao KMP `User` data class | Android | `shared/.../domain/model/User.kt` | 10min |
| 1.7 | Criar KMP `Team` data class + `TeamsRepository` | Android | `shared/.../domain/model/Team.kt`, `shared/.../data/repository/TeamsRepository.kt` | 1h |
| 1.8 | Atualizar `fetchUserData` (converter snake→camel) para incluir `favorite_team` | Web | `web/src/contexts/AuthContext.tsx` | 10min |
| 1.9 | Atualizar mapper Firestore→Kotlin (Android) para incluir `favorite_team` | Android | `app/.../data/remote/UserRemoteDataSource.kt` ou mapper relevante | 30min |

### Fase 2: Input — Seleção do Time

| # | Task | Camada | Arquivos afetados | Estimativa |
|---|------|--------|-------------------|------------|
| 2.1 | Criar componente `TeamSelector` (dropdown com busca + escudo) | Web | `web/src/components/team/TeamSelector.tsx` (novo) | 2h |
| 2.2 | Adicionar `TeamSelector` ao `ProfileSetupScreen` (opcional, com "Pular") | Web | `web/src/pages/onboarding/ProfileSetupScreen.tsx` | 1h |
| 2.3 | Adicionar `TeamSelector` ao `EditProfileScreen` | Web | `web/src/pages/profile/EditProfileScreen.tsx` | 1h |
| 2.4 | Criar componente `TeamPickerDialog` para Android (BottomSheet com search) | Android | `app/.../ui/components/team/TeamPickerDialog.kt` (novo) | 2h |
| 2.5 | Adicionar `TeamPicker` ao `EditProfileScreen` Android | Android | `app/.../ui/profile/EditProfileScreen.kt` | 1h |
| 2.6 | Adicionar `TeamPicker` ao `ProfileSetupScreen` Android (se existir onboarding mobile) | Android | `app/.../ui/onboarding/ProfileSetupScreen.kt` | 1h |

### Fase 3: Exibição — Onde o escudo aparece (Web)

| # | Task | Camada | Arquivos afetados | Estimativa |
|---|------|--------|-------------------|------------|
| 3.1 | Criar componente `TeamBadge` (escudo + tooltip opcional) | Web | `web/src/components/team/TeamBadge.tsx` (novo) | 1h |
| 3.2 | Adicionar `TeamBadge` ao `PlayerAvatar` (opcional, condicional) | Web | `web/src/components/common/GameCard.tsx` (PlayerAvatar) | 30min |
| 3.3 | Adicionar escudo ao `PlayerCard` (Figurinha) | Web | `web/src/components/player/PlayerCard.tsx` | 30min |
| 3.4 | Adicionar escudo ao `HomeTab` header | Web | `web/src/pages/home/tabs/HomeTab.tsx` | 15min |
| 3.5 | Adicionar escudo ao `ProfileTab` header | Web | `web/src/pages/home/tabs/ProfileTab.tsx` | 15min |
| 3.6 | Adicionar escudo ao `ProfileScreen` | Web | `web/src/pages/profile/ProfileScreen.tsx` | 15min |
| 3.7 | Adicionar escudo aos `RankingCard` no `RankingsTab` | Web | `web/src/pages/home/tabs/RankingsTab.tsx` | 15min |
| 3.8 | Adicionar escudo aos cards de `RankingScreen` | Web | `web/src/pages/ranking/RankingScreen.tsx` | 15min |
| 3.9 | Adicionar escudo aos cards de `LeagueScreen` | Web | `web/src/pages/league/LeagueScreen.tsx` | 15min |
| 3.10 | Adicionar escudo à lista de confirmados no `GameDetailScreen` | Web | `web/src/pages/game/GameDetailScreen.tsx` | 15min |
| 3.11 | Adicionar escudo à lista de membros no `GroupDetailScreen` | Web | `web/src/pages/group/GroupDetailScreen.tsx` | 15min |
| 3.12 | Adicionar escudo à lista de membros no `PlayersScreen` | Web | `web/src/pages/players/PlayersScreen.tsx` | 15min |
| 3.13 | Adicionar escudo aos candidatos no `MVPVoteScreen` | Web | `web/src/pages/game/MVPVoteScreen.tsx` | 15min |
| 3.14 | Adicionar escudo ao `StatisticsScreen` header | Web | `web/src/pages/statistics/StatisticsScreen.tsx` | 15min |

### Fase 4: Exibição — Onde o escudo aparece (Android)

| # | Task | Camada | Arquivos afetados | Estimativa |
|---|------|--------|-------------------|------------|
| 4.1 | Criar composable `TeamBadge` (imagem escudo + a11y) | Android | `app/.../ui/components/team/TeamBadge.kt` (novo) | 1h |
| 4.2 | Adicionar `TeamBadge` ao `CachedProfileImage` (parâmetro opcional) | Android | `app/.../ui/components/CachedAsyncImage.kt` | 30min |
| 4.3 | Adicionar escudo ao `PlayerCardContent` (Figurinha) | Android | `app/.../ui/players/ComposePlayersDialogs.kt` | 30min |
| 4.4 | Adicionar escudo ao `ExpressiveHubHeader` | Android | `app/.../ui/home/components/ExpressiveHubHeader.kt` | 15min |
| 4.5 | Adicionar escudo ao `ProfileScreen` | Android | `app/.../ui/profile/ProfileScreen.kt` | 15min |
| 4.6 | Adicionar escudo ao `UserCard` / `GroupMemberCard` | Android | `app/.../ui/components/cards/UserCard.kt` | 30min |
| 4.7 | Adicionar escudo ao `PlayersScreen` cards | Android | `app/.../ui/players/PlayersScreen.kt` | 15min |
| 4.8 | Adicionar escudo ao `RankingScreen` items | Android | `app/.../ui/statistics/RankingScreen.kt` | 15min |
| 4.9 | Adicionar escudo ao `LeagueScreen` items | Android | `app/.../ui/league/LeagueScreen.kt` | 15min |
| 4.10 | Adicionar escudo à lista de confirmados no `GameDetailScreen` | Android | `app/.../ui/games/GameDetailScreen.kt` | 15min |
| 4.11 | Adicionar escudo à lista de membros no `GroupDetailScreen` | Android | `app/.../ui/groups/GroupDetailScreen.kt` | 15min |
| 4.12 | Adicionar escudo aos candidatos no `MVPVoteScreen` | Android | `app/.../ui/game_experience/MVPVoteScreen.kt` | 15min |
| 4.13 | Adicionar escudo ao `TransferOwnershipDialog` | Android | `app/.../ui/games/components/TransferOwnershipDialog.kt` | 15min |
| 4.14 | Adicionar escudo ao `PostGameReportScreen` | Android | `app/.../ui/games/owner/PostGameReportScreen.kt` | 15min |
| 4.15 | Adicionar escudo ao `BlockedPlayersScreen` | Android | `app/.../ui/games/owner/BlockedPlayersScreen.kt` | 15min |

### Fase 5: Infra e Regras

| # | Task | Camada | Estimativa |
|---|------|--------|------------|
| 5.1 | Atualizar Firestore rules: `teams` read-only para authenticated users | Firestore | 30min |
| 5.2 | Atualizar Firestore rules: owner pode escrever `favorite_team` no próprio doc | Firestore | 15min |
| 5.3 | Adicionar `favorite_team` ao Firestore index (se necessário para queries futuras) | Firestore | 15min |

### Fase 6: Testes e Validação

| # | Task | Camada | Estimativa |
|---|------|--------|------------|
| 6.1 | Testes unitários: `useTeams` hook (web) | Web | 30min |
| 6.2 | Testes unitários: `TeamSelector` component (web) | Web | 30min |
| 6.3 | Testes unitários: `TeamsRepository` (Android) | Android | 30min |
| 6.4 | Testes de UI: `TeamPickerDialog` (Android) | Android | 30min |
| 6.5 | Verificação manual: fluxo completo onboarding → edit → exibição em todas as telas | Web + Android | 2h |

**Total estimado:** ~24h (3 dias de trabalho)

---

## 5. Implementation (a ser preenchido durante codificação)

> Preencher links de commits/PRs, notas de implementação, decisões tomadas durante o desenvolvimento.

---

## 6. Verification (Verificação)

### 6.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit (hooks/context web) | `useTeams`, `TeamSelector` | ⬜ |
| Unit (ViewModel Android) | `EditProfileViewModel`, `ProfileViewModel` | ⬜ |
| UI (Compose) | `TeamPickerDialog` | ⬜ |

### 6.2 Checklist de Revisão

- [ ] Build web passa (`npm run build`) sem erros
- [ ] Build Android passa (`./gradlew :app:compileDebugKotlin`) sem erros
- [ ] Lint web passa (`npm run lint`)
- [ ] Lint Android passa (`./gradlew lint detekt`)
- [ ] Nenhum hardcode de cor (usa `theme.palette.*` no web, `MaterialTheme.colorScheme.*` no Android)
- [ ] Nenhum hardcode de URL de escudo (vem do Firestore)
- [ ] Campo `favoriteTeam` é opcional — layouts não quebram com `null`
- [ ] Firestore rules atualizadas e testadas (emulator)
- [ ] Dark mode: escudos visíveis em fundo escuro (adicionar borda sutil se necessário)

---

## 7. Notas e Referências

- **Collection `teams` seed**: Lista inicial com ~30 times (Série A 2026 + principais da Série B + seleções). Ver Anexo A.
- **Escudos**: Usar URLs de CDN confiável (ex: img.bfmtv.com, ou upload próprio para Firebase Storage)
- **Decisão**: Campo é `string | null` (teamId), não objeto embedado — evita duplicação e permite atualizar escudo/time em um só lugar
- **Decisão**: `favoriteTeam` é nullable — time do coração é opcional, muitos usuários podem não querer declarar
- **Futuro**: Se houver necessidade de "segundo time" ou "time europeu", modelar como array `favorite_teams: string[]`

### Anexo A — Seed inicial da collection `teams`

Times da Série A 2026 (20 times) + principais da Série B + Seleção Brasileira:

```
teams/
  atletico-mg     → { name: "Atlético-MG", short_name: "CAM", badge_url: "...", category: "Série A", state: "MG" }
  athletico-pr    → { name: "Athletico-PR", short_name: "CAP", badge_url: "...", category: "Série A", state: "PR" }
  bahia           → { name: "Bahia", short_name: "BAH", badge_url: "...", category: "Série A", state: "BA" }
  botafogo        → { name: "Botafogo", short_name: "BOT", badge_url: "...", category: "Série A", state: "RJ" }
  ceara           → { name: "Ceará", short_name: "CEA", badge_url: "...", category: "Série A", state: "CE" }
  corinthians     → { name: "Corinthians", short_name: "COR", badge_url: "...", category: "Série A", state: "SP" }
  cruzeiro        → { name: "Cruzeiro", short_name: "CRU", badge_url: "...", category: "Série A", state: "MG" }
  flamengo        → { name: "Flamengo", short_name: "FLA", badge_url: "...", category: "Série A", state: "RJ" }
  fluminense      → { name: "Fluminense", short_name: "FLU", badge_url: "...", category: "Série A", state: "RJ" }
  fortaleza       → { name: "Fortaleza", short_name: "FOR", badge_url: "...", category: "Série A", state: "CE" }
  gremio          → { name: "Grêmio", short_name: "GRE", badge_url: "...", category: "Série A", state: "RS" }
  internacional   → { name: "Internacional", short_name: "INT", badge_url: "...", category: "Série A", state: "RS" }
  juventude       → { name: "Juventude", short_name: "JUV", badge_url: "...", category: "Série A", state: "RS" }
  mirassol        → { name: "Mirassol", short_name: "MIR", badge_url: "...", category: "Série A", state: "SP" }
  palmeiras       → { name: "Palmeiras", short_name: "PAL", badge_url: "...", category: "Série A", state: "SP" }
  santos          → { name: "Santos", short_name: "SAN", badge_url: "...", category: "Série A", state: "SP" }
  sao-paulo       → { name: "São Paulo", short_name: "SPO", badge_url: "...", category: "Série A", state: "SP" }
  sport           → { name: "Sport", short_name: "SPT", badge_url: "...", category: "Série A", state: "PE" }
  vasco           → { name: "Vasco", short_name: "VAS", badge_url: "...", category: "Série A", state: "RJ" }
  vitoria         → { name: "Vitória", short_name: "VIT", badge_url: "...", category: "Série A", state: "BA" }
  america-mg      → { name: "América-MG", short_name: "AME", badge_url: "...", category: "Série B", state: "MG" }
  avai            → { name: "Avaí", short_name: "AVA", badge_url: "...", category: "Série B", state: "SC" }
  coritiba        → { name: "Coritiba", short_name: "CTB", badge_url: "...", category: "Série B", state: "PR" }
  criciuma        → { name: "Criciúma", short_name: "CRI", badge_url: "...", category: "Série B", state: "SC" }
  cuiaba          → { name: "Cuiabá", short_name: "CUI", badge_url: "...", category: "Série B", state: "MT" }
  goias           → { name: "Goiás", short_name: "GOI", badge_url: "...", category: "Série B", state: "GO" }
  nao-torcedor    → { name: "Não torce para time nenhum", short_name: "—", badge_url: null, category: "Outros", state: null }
  outro           → { name: "Outro time", short_name: "?", badge_url: null, category: "Outros", state: null }
```

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-09 | Renan Locatiz Fernandes | Criação inicial — mapeamento completo e plano de implementação |
