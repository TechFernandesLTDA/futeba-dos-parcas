# ESSÊNCIA do Futeba dos Parças

> Fase 1 da missão "modernizar sem mudar a essência". Documento só de leitura: **nenhum código foi alterado**.
> Gerado em 04/11/2026 a partir da leitura do repositório (`master` em `ebefdaf0` + branch de release `8b6a09ef`).
> Status: **AGUARDANDO VALIDAÇÃO DO RENAN**. Nada da Fase 2 começa antes disso.

## Como ler este documento

- Cada regra cita o arquivo de origem (`arquivo:linha`).
- Cada exemplo tem uma etiqueta:
  - **[teste]**: o exemplo existe como caso de teste real no repositório (arquivo › nome do caso). É verdade comprovada.
  - **[derivado]**: o exemplo foi calculado lendo o código, sem teste que o comprove. **A confirmar** antes de virar teste de aceitação do app novo.
- "Existe, não ligado" marca código que existe mas não chega ao usuário. Não é funcionalidade e também não é candidato a apagar sem você decidir.
- Onde plataformas divergem, eu **não escolhi** qual é a regra certa. Está tudo na seção 9, "Decisões que preciso de você".

---

## 1. Propósito

**O que é, em 3 linhas:**
1. App para organizar peladas (futebol amador) de grupos fixos de amigos: marcar jogo, confirmar presença, montar times equilibrados e registrar o jogo ao vivo.
2. Transforma a pelada num campeonato contínuo: XP, níveis, badges, MVP e "Bola Murcha" votados, liga mensal com divisões e rankings.
3. Cuida da parte chata: caixa do grupo, mensalidade, lista de espera, locais e quadras, check-in por GPS.

**Público-alvo:**
- Jogador de pelada brasileiro, adulto, que joga toda semana com a mesma turma.
- O "Dono do Jogo" ou organizador do grupo, que hoje usa grupo de WhatsApp e planilha.
- Dono de quadra (papel FIELD_OWNER), que cadastra locais e acompanha a ocupação.

**Plataformas e versões atuais** (fonte: `versions.json`, `app/build.gradle.kts:55-56`, `iosApp/iosApp/Info.plist:22-24`):

| Plataforma | Versão | Estado |
|---|---|---|
| Web (futebadosparcas.com.br) | 1.61.1 (release #4498 em andamento) | Completa, a mais rica em funcionalidades |
| Android (Play Store) | 1.42.0 (vc 83), em revisão no Play | Completa |
| iOS (composeApp + casca SwiftUI) | 1.8.0 (build 24) | Bem incompleta (ver 2.2) |
| Cloud Functions | 1.15.1 | Onde moram quase todas as regras de negócio |

---

## 2. Funcionalidades, tela por tela

### 2.1 Android (Jetpack Compose)

Atividades: `SplashActivityCompose`, `LoginActivityCompose`, `RegisterActivityCompose`, `MainActivityCompose` (`AndroidManifest.xml:88-140`).
Rotas: `sealed class Screen` em `app/src/main/java/com/futebadosparcas/ui/navigation/AppNavGraph.kt:116-207`.

**Abas principais** (`AppNavGraph.kt:107-111`): Home · Jogos · Jogadores · Liga · Perfil.

| Área | Telas | O que faz |
|---|---|---|
| Entrada | Splash, Login, Register, AntiBotGate, ProfileGate, OnboardingFlow | Login Google ou e-mail, biometria, verificação de telefone (SMS) e CPF, perfil obrigatório |
| Jogos | PublicGames, GameDetail (com "Gerar Times"), CreateGame, LiveGame, MVPVote, TacticalBoard | Jogos abertos, detalhe e confirmação, criação, sorteio de times, súmula ao vivo, votação, prancheta tática |
| Grupos | Groups, DiscoverGroups, GroupDetail, CreateGroup, InvitePlayers, Cashbox, GroupWall | Grupos, descoberta, convites, caixa (com texto de Pix), mural de fotos e vídeos |
| Estatística e gamificação | Statistics, Ranking, WeeklyRanking, Evolution, Badges, LevelJourney, PostGameDialog | Números do jogador, rankings, evolução de XP, conquistas, trilha de níveis, resumo pós-jogo |
| Social | SocialFeed, NearbyPlayers, DirectMessages, DirectConversation | Feed, jogadores por perto, chat 1:1 com mensagem de voz |
| Locais | LocationsMap, LocationDetail, ManageLocations, FieldOwnerDashboard | Mapa de quadras, detalhe, gestão, painel do dono de quadra |
| Configurações | EditProfile, Preferences, ThemeSettings, GamificationSettings, ConnectedAccounts, Developer | Perfil, tema, regras de XP do grupo, contas vinculadas |
| Outras | About (excluir conta, exportar dados LGPD, sair), WhatsNew, Schedules, Notifications, UserManagement (admin) | |
| Fora do app | Widget `NextGameWidget`, Android Auto `FutebaAutoService` | (`AndroidManifest.xml:201-227`) |

**Existe, não ligado:**
- Rotas `InviteFriend`, `DreamTeam` e `GroupChallenges` estão declaradas, mas não têm tela no NavHost.
- **12 telas prontas que nenhuma rota abre** (cerca de 10,9 mil linhas): TeamFormation (formação de times com sorteio equilibrado), LocationSelector, AvatarCustomizer, WeeklyRecap, VoteResult, PostGameReport, GlobalSearch, LocationMetrics, GameFinancialDashboard, OwnerStats, PublicGamesMap, BlockedPlayers.
- Tocar num jogador no WeeklyRanking não faz nada (`AppNavGraph.kt:1145`).

### 2.2 iOS (`composeApp/` é a interface real; `iosApp/` é só a casca)

Rotas: `composeApp/src/commonMain/kotlin/com/futebadosparcas/compose/navigation/AppRoutes.kt:11-71`. NavHost em `compose/App.kt`.

| Funciona | Parcial ou provisório | Ainda não existe |
|---|---|---|
| Welcome, onboarding de permissões, login por e-mail, cadastro e perfil, Home, lista e detalhe de jogos, Novidades, tema, excluir conta (dupla confirmação), jogadores bloqueados (lista local) | Grupos, detalhe de grupo e Perfil são hubs de atalhos (`App.kt:564-695`); Ranking, Badges, Locais e Caixa são embrulhos `RouteScreen` | Criar grupo, criar jogo ("Criar jogo" só leva à aba Grupos, `App.kt:419`), jogo ao vivo, votação de MVP e estatísticas do dono (`UnavailableRouteScreen`, `App.kt:473-511`) |

**Existe, não ligado:**
- O botão "Entrar com Google" do iOS não faz login de verdade: só chama `onGoogleSignInSuccess()` (`App.kt:345`).
- "Esqueci a senha" no iOS não faz nada (`LoginViewModel.kt:92-95`).

### 2.3 Web (React + MUI, rotas em `web/src/App.tsx:509-659`)

| Área | Rotas |
|---|---|
| Entrada | `/splash`, `/welcome`, `/onboarding/phone`, `/onboarding/cpf`, `/profile/setup`, `/guide`, `/login`, `/register`, `/forgot-password` |
| Públicas (SEO) | `/` (LaunchPage para visitante), `/organizar-pelada`, `/ranking-futebol-amador`, `/gestao-de-pelada`, `/como-funciona`, `/parcerias`, `/game/:id` (página pública do jogo) |
| Jogos | `/game/create`, `/game/:id/{live,vote,results,teams,report,blocked,stats,events}`, `/public-games`, `/map/games`, `/tactical/:gameId` |
| Grupos | `/group/create` (só FIELD_OWNER ou ADMIN, `App.tsx:562`), `/group/:id` e sub-rotas `edit, settings, cashbox, players, schedules, invite, league, challenges`, `/group/:id/post/:postId`, `/groups/discover` |
| Jogador | `/profile/edit`, `/profile/:userId`, `/level-journey`, `/players/nearby`, `/statistics`, `/weekly-recap`, `/evolution`, `/head-to-head`, `/league`, `/badges`, `/weekly-ranking`, `/dream-team`, `/invite-friend` |
| Locais | `/locations`, `/location/create`, `/location/:id(/edit)`, `/map/locations`, `/owner/dashboard`, `/owner/onboarding` |
| Social | `/feed`, `/notifications`, `/messages(/:chatId)`, `/search` |
| Configurações | `/settings`, `/settings/{theme,notifications,gamification,feedbacks}`, `/about`, `/whats-new` |
| Admin | `/admin/users`, `/admin/feedback`, `/admin/game-reviews`, `/dev` |
| Deep links | `/checkin/:gameId/:token`, `/join/:code`, `/invite/:code` |

Guardas de rota: ProtectedRoute, VerifiedRoute (claim `verified`), AdminRoute, FieldOwnerOrAdminRoute, GroupMemberRoute, PublicRoute, ProfileGate.

### 2.4 Paridade entre plataformas

| Funcionalidade | Android | iOS | Web |
|---|---|---|---|
| Login e-mail / Google | ✅ / ✅ | ✅ / ⚠️ falso | ✅ / ✅ |
| Login Apple | ❌ | ❌ | ❌ |
| Verificação telefone + CPF | ✅ | não verificado | ✅ |
| Criar grupo / criar jogo | ✅ / ✅ | ❌ / ❌ | ✅ / ✅ |
| Jogo ao vivo / votação MVP | ✅ / ✅ | ❌ / ❌ | ✅ / ✅ |
| Ranking, badges, locais, caixa | ✅ | ⚠️ embrulhos | ✅ |
| Excluir conta | ✅ | ✅ | ✅ (tela não confirmada) |
| Exportar dados (LGPD) | ✅ (About) | não verificado | não verificado |
| **Só na web** | | | SEO, head-to-head, weekly-recap, busca, filas de admin, check-in por QR, onboarding do dono de quadra, página pública do jogo |
| **Só no Android** | Widget, Android Auto, biometria, mensagem de voz | | |

---

## 3. Regras de negócio

> Quase todas as regras vivem no servidor (Cloud Functions + `firestore.rules`). Os clientes só exibem.
> Os valores de XP vêm de `shared/xp-constants.json`. As functions usam uma cópia em `functions/src/_constants/xp-constants.json`, e o teste `functions/test/xp-constants-sync.test.ts` garante que as duas são iguais. Cada grupo pode sobrescrever os valores em `app_settings/gamification` (`functions/src/xp/bonus-rules.ts:269-366`).

### 3.1 XP por jogo (`functions/src/index.ts`, trigger `onGameStatusUpdate`)

**Quando roda** (`index.ts:482-500`): o jogo vira `FINISHED`, ou um admin libera um jogo `HELD_FOR_REVIEW` com decisão `APPROVED`.

**Bloqueios antes de calcular:**
- Revisão obrigatória: se a validação devolve `REVIEW_REQUIRED`, o jogo fica `HELD_FOR_REVIEW` e ninguém ganha XP (`index.ts:706-796`).
- Mínimo de **6 jogadores elegíveis**; abaixo disso não paga XP (`index.ts:936-950`). [derivado] 5 elegíveis → `xp_processed=true`, 0 XP para todos.
- Fica fora quem tem uid inválido, está em outro jogo no mesmo horário (`suspiciousOverlap`), não está `CONFIRMED` ou, havendo sinal de presença, não tem check-in (`index.ts:800-866`, `functions/src/game/helpers.ts:109-119`).

**Anti-cheat** (`functions/src/constants.ts:281-323`): até 15 gols, 10 assistências e 30 defesas por jogo. Valor negativo ou não numérico conta como 0.
- [derivado] 20 gols informados → 15 contados.

**Resultado** (`helpers.ts:319-381`): funciona com N times. Maior placar = vitória, menor = derrota, intermediário ou todos iguais = empate. Placar limitado a 0-100. Jogador sem time conta como empate.

**Fórmula base** (`index.ts:1143-1197`), com os valores do JSON:

| Ação | XP |
|---|---|
| Presença | +10 |
| Gol | +25 cada |
| Assistência | +20 cada |
| Defesa (goleiro) | +15 cada |
| Vitória / empate / derrota | +30 / +10 / 0 |
| MVP (`mvp_id` do jogo) | +50 |
| Clean sheet (goleiro, adversário 0) | +15 |
| Bola Murcha (`worst_player_id`) | −10 (fixo em `functions/src/xp/pipeline.ts:88`, não lê o JSON) |

Exemplos [derivado]:

| Caso | Conta | XP |
|---|---|---|
| Jogador de linha: 2 gols, 1 assistência, vitória, MVP | 10+50+20+30+50 | 160 |
| Goleiro: 3 defesas, empate, clean sheet | 10+45+10+15 | 80 |
| Derrota, sem estatísticas, Bola Murcha | 10−10 | 0 |

**Streak de presença** (`index.ts:44`, `:269-374`):
- Continua se o jogo anterior foi há no máximo 8 dias. Jogo no mesmo dia não soma. Fora disso, volta para 1.
- Paga só a faixa mais alta: ≥3 → +20, ≥5 → +35, ≥7 → +50, ≥10 → +100.
- [derivado] Intervalo de 8 dias com streak 3 → streak 4 → +20. Intervalo de 9 dias → streak 1 → 0.

**Bônus extras** (`bonus-rules.ts:436-803`), todos [derivado]:

| Tipo | Bônus |
|---|---|
| Desempenho | Hat-trick (≥3 gols) +30 · artilheiro do jogo +15 (empate premia todos) · primeiro gol +5 · gol de goleiro +20 · fair play (sem cartões) +5 · anotador `min(20, eventos×2)` com ≥3 eventos |
| Comportamento | Confirmou ≥48h antes +5 · check-in até 10 min após o início +5 · "salvou a pelada" +15 · veio da lista de espera +10 |
| Retenção (fuso São Paulo) | Primeiro jogo do mês +15 · volta depois de ≥14 dias +10, ≥30 dias +20 (1 vez por mês) · 3/6/12 meses seguidos +50/+100/+250 |

[derivado] Anotador: 5 eventos → +10, 2 eventos → 0, 15 eventos → +20.

**Milestones** (`pipeline.ts:126-379`):
- Por total acumulado: jogos 10/25/50/100/250/500 → 50…2500; gols 10…250; assistências 10…100; defesas 25…250; MVPs 5/10/25/50 → 100/300/750/1500; vitórias 10…100.
- Só entram se couberem no teto do jogo. As que não cabem continuam disponíveis em jogos futuros.

**Total** (`index.ts:1200+`): `XP do jogo = max(−100, min(base + streak + bônus + milestones, 500))`.
- **O XP acumulado do jogador não tem piso 0** e pode ficar negativo.

**Idempotência** (`index.ts:502-564`, `:965-1044`):
- Trava `xp_processing` de 4 minutos.
- Log com ID fixo `xp_logs/game_{gameId}_user_{uid}`: se o trigger roda de novo, o jogador não recebe outra vez.
- MVP e Bola Murcha nunca são pagos duas vezes entre o jogo e a votação (#3940). [teste] `mvp-voting.test.ts` › "não duplica Bola Murcha quando o trigger principal já aplicou a penalidade".

### 3.2 Níveis

- **Tabela** (`shared/xp-constants.json:100-126`), em XP acumulado: 0, 100, 350, 850, 1850, 3850, 7350, 12850, 20850, 32850, 52850 (nível 10 "Imortal"), depois até 528500 (nível 20 "Pelé"). Nível máximo: 20.
- O nível é o maior com `xp ≥ xpRequired` (`pipeline.ts:111-116`; web `web/src/types/gamification.ts:433-495`; KMP `LevelTable.kt:65-92`).
- [derivado] `getLevelForXp(349)=1`, `(350)=2`, `(52850)=10`, `(528500)=20`, `(−50)=0`. Na web, faltam 50 XP com 300 acumulados.

### 3.3 Votação: MVP, melhor goleiro e Bola Murcha (`functions/src/voting/mvp-voting.ts`)

- **Categorias:** MVP, BEST_GOALKEEPER e WORST. MVP e WORST são obrigatórias na cédula.
- **Quem vota:** só jogador elegível do jogo `FINISHED`, e ninguém vota em si mesmo. Não pode escolher a mesma pessoa para MVP e Bola Murcha. Pode escolher o mesmo goleiro como MVP e melhor goleiro.
- **Prazo:** início + duração (90 min por padrão) + 24h. [derivado] Jogo às 19:00 sem duração → prazo no dia seguinte às 20:30.
- **Encerramento:** dono, co-organizador ou ADMIN. **Sem quórum mínimo**, 1 voto basta.
- **Desempate:** no MVP, pelo `playerId` em ordem alfabética. Na Bola Murcha, empate = ninguém é Bola Murcha.
- **XP:** MVP +50, **pago acima do teto de 500** (FIX #726); Bola Murcha −10; o XP total nunca fica abaixo de −100. A badge `mvp_streak_3` sai com 3 MVPs seguidos.

Exemplos [teste], de `functions/test/mvp-voting.test.ts`:

| Caso | Entrada → saída |
|---|---|
| "deve eleger corretamente o MVP com mais votos" | 3×A, 1×B → A |
| "deve resolver empate pelo playerId alfabético" | zebra × alpha → alpha |
| "empate em WORST conclui sem vencedor, flag ou penalidade" | `worst_player_id` null |
| "mantém 3 MVPs consecutivos e zera quem perde o jogo seguinte" | A,A,A,B → A {3,0,3}, B {1,1,1}, badge no 3º jogo |
| "atribui milestone de MVP na temporada do jogo…" | `bestPlayerCount` 10 → 450 XP (50 + 100 + 300) |
| "deve rejeitar quando janela de votação expirou (>24h)" | jogo há 30h → expirado |
| "deve rejeitar voto em si mesmo" / "deve rejeitar voto duplicado" / "…votante não confirmado" | rejeitado |

### 3.4 Liga mensal, divisões e temporada

**Rating** (`functions/src/league.ts:265-313`), calculado sobre os últimos 10 jogos `FINISHED`:
```
rating = 0,4·min(XPmédio/500,1)·100 + 0,3·%vitórias + 0,2·clamp((saldoMédio+3)/6,0,1)·100 + 0,1·min((MVPs/jogos)/0,5,1)·100
```
- [teste] `functions/test/league.test.ts`:
  - jogo perfeito → 100;
  - pior jogo → 0;
  - (250 XP, vitória, saldo +2) + (250 XP, derrota, saldo −2) → ≈45.
- [derivado] XP médio 100, 5 vitórias em 10, saldo médio 0 e 1 MVP → 35 → Prata.

**Divisões** (`league.ts:323-330`): Bronze 0-29, Prata 30-49, Ouro 50-69, Diamante 70-100.
- [teste] `getDivisionForRating`: 29 → BRONZE, 30 → PRATA, 50 → OURO, 70 → DIAMANTE.

**Promoção e rebaixamento** (`league.ts:127-244`):
- Três jogos seguidos acima do limite sobem de divisão; três jogos seguidos abaixo descem.
- Depois de subir ou descer, o jogador ganha **5 jogos de proteção**, em que não há progresso de promoção.
- Ficar dentro da faixa zera os dois contadores.

Exemplos [teste], de `functions/test/league.test.ts`:
- "promotes after 3 consecutive games above threshold" (35, 40, 32 → PRATA, proteção 5);
- "protection prevents promotion progress";
- "relegates after 3 consecutive games below threshold" (OURO → PRATA);
- "BRONZE cannot be relegated" e "DIAMANTE cannot be promoted further".

**Pontos da temporada** (`helpers.ts:727-799`): vitória 3, empate 1, derrota 0.

**Fechamento mensal** (`functions/src/season/index.ts:144-578`):
- Roda todo dia às 03:00 BRT e congela a classificação final em `season_final_standings`.
- Cria a temporada `monthly_YYYY_MM`. A nova começa todo mundo em Bronze, com rating 0.
- **Não zeram:** XP global, estatísticas, streaks e milestones.
- [derivado] Jogo finalizado entre 00:00 e 03:00 do dia 1 ainda conta na temporada anterior.

**Liga do grupo** (`functions/src/group-league.ts`, `functions/src/growth/season-cycle.ts`):
- Pontua 3/1/0 sobre todas as confirmações `CONFIRMED`, sem filtro de presença.
- Arquivamento às 23:59 do fim do ciclo: o 1º colocado vira "MVP da liga", com a badge `mvp_liga_{YYYY-MM}`, e o último vira "lanterninha".

### 3.5 Rankings

| Ranking | Fonte | Critério | Desempate |
|---|---|---|---|
| "Mito da Rodada" semanal (domingo 23:57 BRT) | `functions/src/growth/weekly-ranking.ts` | presença 3, gol 5, assistência 3, MVP 8, Bola Murcha −3, vitória +2, empate +1; só quem tem `was_present`; top 100; o 1º ganha a badge `mito_rodada_*` por 7 dias | nenhum |
| Scout (dream team) | `weekly-ranking.ts` | soma de votos no `dream_team`, top 50 | nenhum |
| Deltas semanal e mensal | `helpers.ts:627-687` (`ranking_deltas`) | acumula gols, assistências, defesas, XP, jogos, vitórias, MVP | não verificado (cache de leaderboard não lido) |
| Liga do grupo | `season-cycle.ts` | pontos | nenhum |

[derivado] Mito da Rodada para quem esteve presente, fez 2 gols e 1 assistência, venceu e foi MVP: 3+10+3+2+8 = **26**.

### 3.6 Badges

São dois sistemas que se sobrepõem.

**A) `user_badges/{uid}_{badge}`** (`functions/src/badges/badge-helper.ts`): têm contador, se repetem por jogo e **não pagam XP** pelo que o código mostra.
- Streak: `streak_7`/`iron_man`/`streak_30` (≥7/≥10/≥30).
- Gols no jogo: `hat_trick`/`poker`/`manita` (3/4/5 gols).
- Outras: `playmaker` (≥3 assistências), `balanced_player` (≥2 gols e ≥2 assistências), `veteran_50`/`veteran_100`, `level_5`/`level_10`, `clean_sheet`/`paredao`/`defensive_wall`, `winner_25`/`winner_50`, `mesa_oficial_10/25/50`.

Exemplos [teste], de `functions/test/badge-helper.test.ts`:
- streak 30 → `streak_30`; streak 10 → `iron_man`; streak 6 → nenhuma;
- 5 gols → 3 badges; 4 → 2; 3 → `hat_trick`;
- `calculateMvpStreak(2,true)=3`.

**B) `users/{uid}/badges/{id}`** (`functions/src/badges/game-badges.ts:592-604`): pagam XP **fora do teto de 500**.

| Badge | XP |
|---|---|
| `streak_7` | 100 |
| `mvp_1` / `mvp_10` | 100 / 300 |
| `goals_10` | 50 |
| `assists_50` | 50 |
| `wins_10` / `wins_50` | 100 / 400 |
| `games_100` | 500 |
| `onipresente` (≥3 locais) | 100 |
| `rei_das_quartas` (≥10 jogos na quarta) | 150 |
| `carrasco` (5ª vitória sobre o mesmo adversário) | 200 |

Não verificado: `ambassador_*` (`badges/ambassador-badge.ts` não foi lido).

### 3.7 Sorteio e divisão de times

São **cinco algoritmos**, e cada plataforma usa um diferente (ver decisão D1).

| Algoritmo | Onde | Rating usado | Times |
|---|---|---|---|
| Sorteio por embaralhamento (`GameTeamRepositoryImpl`) | KMP, **o único em uso no Android** (botão "Gerar Times") | nenhum: goleiros em rodízio e linha embaralhada | N |
| `BalancedDrawAlgorithm` | KMP `shared/.../domain/ai/BalancedDrawAlgorithm.kt`; só a tela órfã TeamFormation o usa | média de ataque, meio e defesa; goleiro usa `goalkeeperSkill` | N |
| `GreedyTeamBalancer` | KMP `TeamBalancer.kt:77-109`, sem consumidor | idem | 2 |
| `GeminiTeamBalancer` | Android `data/ai/GeminiTeamBalancer.kt` (**não chama IA**, apesar do nome); está registrado no Koin, mas nada o injeta | rating×10 + level; rating ≤0 vira 3.0 | N |
| `EnhancedTeamBalancer` | Android `domain/ai/EnhancedTeamBalancer.kt` ("auto draft", com "duplas"); só a tela órfã TeamFormation o usa | rating geral, piso 1.0, padrões 3.0/4.0/2.0 | 2 |
| `balancedDraw` (port TS) | Web `web/src/utils/balancedDraw.ts`, **em uso** na formação de times da web | **level derivado do XP** | 2 na tela |

**Regras comuns do `BalancedDraw`** (KMP e web):
- Goleiros são distribuídos primeiro, em rodízio.
- Jogadores de linha em snake draft (0,1,1,0…).
- Otimização por trocas, até 100 iterações. Score = desvio-padrão/média × 100; o resultado conta como equilibrado se o score < 5.
- Todos os jogadores entram em algum time, e os tamanhos diferem em no máximo 1.

Exemplos [teste], de `shared/src/commonTest/.../BalancedDrawAlgorithmTest.kt`:
- "goleirosSaoDistribuidos": 2 goleiros + 4 de linha → 1 goleiro por time;
- "numeroImparDeJogadores": 7 jogadores → diferença ≤1;
- "tresTimesDistribuemJogadores": 9 → 3×3;
- "isBalancedRetornaTrueParaTimesEquilibrados": 4×70 → true;
- "listaVaziaRetornaTimesVazios".

Na web [teste], de `web/src/utils/balancedDraw.test.ts`:
- "handles 14 players typical soccer match": 2 goleiros → 1 por time.

**Botão "Gerar Times" do detalhe do jogo no Android** (`GameDetailScreen.kt:407` → `GameDetailViewModel.kt:711-722` → `shared/src/nativeAndAndroidMain/.../data/GameTeamRepositoryImpl.kt:28-109`): **não balanceia**.
- Os goleiros entram em rodízio na ordem da lista, os jogadores de linha são embaralhados (`shuffled()`), e o parâmetro `balanceTeams` é ignorado.
- A lista vem de `getGameConfirmations` sem filtro de status (`FirebaseDataSource.kt:230-236`), então confirmações PENDING podem entrar nos times.
- **Não existe sorteio equilibrado acessível no Android.** O `EnhancedTeamBalancer` e o `BalancedDrawAlgorithm` só são usados pela tela TeamFormation, que nenhuma rota abre.

**Na tela web** [derivado]: só o **owner** forma times. "Embaralhar" usa Fisher-Yates, e o time A fica com ceil(n/2): com 7 jogadores, A=4 e B=3.

**Rules**: o cliente só escreve em `teams` se for admin, ou owner com o jogo fora de LIVE/FINISHED (`firestore.rules:282-288`).

### 3.8 Ciclo de vida do jogo

```
SCHEDULED → CONFIRMED → LIVE → FINISHED
SCHEDULED/CONFIRMED → CANCELLED
```
- **Pelo cliente** (`firestore.rules:636-650`): só SCHEDULED→CONFIRMED e →CANCELLED. CONFIRMED→LIVE e LIVE→FINISHED são **exclusivos do servidor**.
- **Criar jogo** (`firestore.rules:1172-1212`):
  - perfil completo, grupo próprio ativo com **≥5 membros**, status inicial SCHEDULED;
  - data futura (tolera 1h no passado);
  - `max_players` 2-50, `max_goalkeepers` 0-10, `number_of_teams` 2-4, recorrência 2-52, preço 0-10000, gênero MALE/FEMALE/MIXED;
  - local e quadra ativos, verificados e com assinatura TRIAL ou ACTIVE.
- **Gestor do jogo**: owner ou co-organizador (rules `:298-301`; callables `functions/src/games/lifecycle.ts:56-70`).
- **Iniciar** (`lifecycle.ts:149-280`): exige CONFIRMED e ≥2 times. Cria o placar ao vivo com todos os times zerados. [teste] `game-lifecycle.test.ts`:
  - "startGameLifecycle move jogo CONFIRMED para LIVE e cria live_score";
  - "#3942 … (3 times)" → {teamA:0, teamB:0, teamC:0};
  - com 1 time → failed-precondition.
- **Finalizar** (`lifecycle.ts:282-516`): trava de 5 min. Agrega os eventos, e a assistência sai do campo `assisted_by_id` do gol. Grava FINISHED e abre a votação. [teste]:
  - "finishGameLifecycle agrega eventos e finaliza jogo": gol de p1 com assistência de p2 + defesa de p2, placar 2×1 → p1 {gols 1}, p2 {assist 1, defesas 1};
  - "…não sobrescreve finalização concorrente ativa";
  - "…libera o lock quando o limite de eventos é excedido".
- **Fechamento automático** (`functions/src/games/auto-close-past-games.ts`): jogo atrasado mais de 2 dias vira **sempre CANCELLED** (`auto_expired`), nunca FINISHED inferido. Fica marcado para revisão se houver evidência de que aconteceu. [teste]:
  - "expira jogo LIVE sem marcar como realizado";
  - "marca revisão quando há evidência suficiente…".
- **Lembretes**: 24h e 2h antes (`functions/src/reminders.ts`).
- **Excluir jogo**: gestor ou admin, e nunca se FINISHED (`firestore.rules:1287-1288`).

### 3.9 Confirmação de presença, lotação e lista de espera

- **Caminho canônico**: callable `confirmGamePresence`; para jogo público, `joinPublicGame` (`functions/src/games/join-public-game.ts`).
- **Quem pode entrar**: membro ativo, convidado, owner ou qualquer um em jogo público aberto. O jogo precisa estar SCHEDULED ou CONFIRMED e ainda não ter começado. Depois do período de carência, exige conta verificada.
  - [teste] "aplica a mesma verificação ao ingresso público após o grace period" → permission-denied.
- **Lotado** (`:411-428`): ocupação acima de `max_players` → "Este jogo já está lotado.". Também respeita o teto de goleiros.
- **O que ocupa vaga** (`:228-242`): em jogo público recorrente, só CONFIRMED; nos demais, CONFIRMED + PENDING. [teste] "conta somente CONFIRMED em jogo publico recorrente".
- **Valor por pessoa** (`:152-171`): `total_cost / max_players`, arredondado a centavos; senão, `daily_price`. [derivado] 300 / 14 → R$ 21,43.
- **Modos de entrada**: não existe campo próprio, o modo vem da visibilidade (`functions/src/games/public-game-page.ts:243`).
  - `GROUP_ONLY`: só membros, convidados e o dono veem o jogo.
  - `PUBLIC_OPEN` ("Aberto para novos jogadores"): o único modo em que quem não é do grupo entra sozinho ou vai para a fila.
  - `PUBLIC_CLOSED` ("Entrada com aprovação do organizador"): o jogo aparece, mas `joinPublicGame` recusa. **O fluxo de aprovação (`game_requests`) existe nas rules e num repositório, mas não está ligado**: nenhuma tela ou function o usa.
- **Convocação**: o owner cria uma confirmação PENDING para outro jogador (`firestore.rules:1719-1739`). O gestor pode confirmar alguém (`confirm-player-as-manager.ts`).
- **Lista de espera** (`functions/src/waitlist/join-game-waitlist.ts`): até 200 pessoas por jogo, posição = maior + 1, idempotente. [teste]:
  - "atribui a próxima posição dentro da transação": [2,7] → 8;
  - "aplica o teto de fila por jogo";
  - "nega entrada na fila de jogo FINISHED".
- **Promoção da lista de espera NÃO confirma automaticamente** (`functions/src/notifications/game-notifications.ts:568-858`): quando abre vaga, o 1º da fila vira NOTIFIED e tem **30 min** para confirmar. Com menos de 3 na fila, até 20 membros do grupo também são avisados. [derivado] max 14, 13 confirmados, fila [A, B] → A NOTIFIED, B continua esperando.

### 3.10 Jogo ao vivo

- **Eventos** (`functions/src/games/live-events.ts`): GOAL, SAVE, YELLOW_CARD e RED_CARD. **A assistência é um campo dentro do gol**, não um evento próprio. Minuto 0-300, até 500 eventos, sem autoassistência.
- **Quem registra**: gestor **ou qualquer jogador CONFIRMED** do jogo. O jogador precisa estar no elenco do time.
- **Placar**: o gol soma no placar do time. Se o placar não bate com os eventos, só gera aviso na finalização.

Exemplos [teste], de `live-events.test.ts`:
- "submitLiveGameEvent rejeita autoassistência";
- "…rejeita quando jogo não está LIVE";
- "…rejeita evento durante finalização".

### 3.11 Grupos

- **Papéis**: OWNER, ADMIN e MEMBER. Admin de grupo = OWNER ou ADMIN com status ACTIVE (`firestore.rules:394-409`).
- **Criar**: nome com 3-50 caracteres, descrição até 500 (`:2503-2518`). Na web, só FIELD_OWNER ou ADMIN global criam grupo (`web/src/App.tsx:562`).
- **Papéis e remoção** (`:2591-2706`):
  - o owner promove e rebaixa;
  - o ADMIN só mexe em MEMBER;
  - ninguém se autoeleva;
  - o owner não sai sem antes transferir o grupo;
  - membro banido não consegue sair para fugir do ban.
- **Transferência de posse** (`:2525-2580`): só num batch atômico, com o grupo, o novo OWNER e o antigo OWNER juntos.

Exemplos [teste], de `firestore-rules-tests/src/groups.test.ts`:
- "OWNER pode promover MEMBER para ADMIN";
- "MEMBER NÃO pode se autoelevar para ADMIN";
- "ADMIN não-owner … NÃO pode remover o OWNER";
- "transfere ownership apenas com grupo, novo OWNER e antigo OWNER no mesmo batch";
- "usuário BANNED NÃO pode apagar o vínculo…";
- "usuário em blocked_players NÃO pode recriar membership em grupo público".

**Convites:**
- **Gerar** (`functions/src/groups/generate-invite-code.ts`): só OWNER ou ADMIN ativo. Código de 6 caracteres, válido por 7 dias, até 20 por hora.
- **Usar** (`invite-redeemed.ts`): o servidor cria a membership.
- **Cadastro na web exige convite**: "Para criar sua conta, abra um convite de outro membro do Futeba dos Parças." (`web/src/contexts/AuthContext.tsx:40`).

### 3.12 Financeiro: caixa e mensalidade

- **Quem lança no caixa** (`functions/src/cashbox/callable.ts`): owner ou admin do grupo, com conta verificada. O cliente nunca escreve direto (`firestore.rules:2753-2812`).
- **Lançamento**: entrada ou saída, valor em centavos > 0 e ≤ R$ 100.000. Saída maior que o saldo → "Saldo insuficiente". Repetir o mesmo `requestId` é idempotente.
- **Estorno**: só uma vez, e reverte o sinal do lançamento.

Exemplos [teste] do caixa, de `functions/test/cashbox-callable.test.ts`:
- saída de 0,1+0,2 → 30 centavos, saldo 1000 → 970;
- "estorna uma única vez…": 800 → 1000;
- "estorna mensalidade no caixa, pagador, período e settlement juntos": 1001 → 601, pagador PARTIAL.

**Mensalidade** (`functions/src/cashbox/monthly.ts`):
- Modos FIXED_MONTHLY ou PER_GAME.
- Até 200 mensalistas e 100 jogos por período, no fuso de São Paulo.
- O rateio não perde centavos: o resto vai para os primeiros uids em ordem.

Exemplos [teste], de `functions/test/monthly-finance.test.ts`:
- "rateia o resto em centavos por UIDs ordenados": 100 entre [c,a,b] → a=34, b=33, c=33;
- "FIXED_MONTHLY mantém o total…": 120001 → 40001/40000/40000;
- "usa a competência civil de São Paulo na virada UTC": 2026-08-01T01:30Z → "2026-07";
- "PER_GAME exclui cancelado e exceção explícita…";
- "calcula baixa parcial e depois quitação integral": 1001 com baixa de 400 → PARTIAL com 601 em aberto; pagar 602 depois → erro.

**Pix:**
- O organizador informa no jogo a chave, o tipo e o beneficiário (enum `PixKeyType`: CPF, CNPJ, EMAIL, PHONE, RANDOM; `app/.../data/model/Game.kt:708`, `web/src/types/game.ts:25`).
- A web mostra só o texto "Pix: {chave}" no detalhe do jogo (`GameInfoPanel.tsx:96-98`). Não há QR, copia-e-cola nem integração com banco ou PSP.
- **Existe, não ligado** no Android: `PaymentBottomSheet` com QR e copia-e-cola, mas o código Pix é **simulado** (telefone fixo no código, CRC aleatório, `PaymentRepositoryImpl.kt:51-62`), e a imagem do QR viria de `api.qrserver.com`. Nada abre essa tela.

### 3.13 Locais, quadras e check-in

- **Locais** (`firestore.rules:2045-2079`): só FIELD_OWNER ou ADMIN criam, e o local nasce PENDING_REVIEW. Fica público só se estiver ativo, verificado, PUBLISHED e com assinatura TRIAL ou ACTIVE.
- **Avaliações** (`:2333-2369`): uma por usuário, nota 1-5, com intervalo mínimo de 60s entre edições.
- **Disponibilidade da quadra** (`functions/src/games/field-availability.ts`):
  - janela de até 60 dias;
  - jogo sem horário de fim conta como 60 min;
  - jogo que cruza a meia-noite é tratado corretamente;
  - a resposta não expõe dados de outros grupos.

  Exemplos [teste], de `field-availability.test.ts`:
  - "normaliza duração padrão e jogo que cruza meia-noite": 23:30-00:30 → 1410/1470 min;
  - "retorna PUBLIC e GROUP_ONLY como slots indistinguíveis e sem metadados".
- **Check-in por GPS** (`functions/src/voting/check-in.ts`):
  - raio de 200 m (configurável até 2000 m), precisão mínima de 100 m;
  - abre 30 min antes do início;
  - com QR, o raio é de 500 m e o token vale 24h;
  - gera alerta para deslocamento impossível ou check-in muito tarde.

  [derivado] A 350 m do campo com raio 200 → "Você está a 350m do campo (limite 200m)". **Sem teste.**

### 3.14 Conta, verificação e LGPD

- **Verificação anti-robô** (Android `MainActivityCompose.kt:236-387`; web `/onboarding/*`):
  1. telefone por SMS, com limite de envios (`canSendSmsOtp`);
  2. CPF, guardado só como hash com salt e versão mascarada, até 5 tentativas por hora (`functions/src/verification.ts:208-305`);
  3. claim `verified`.
- **Excluir conta** (`functions/src/auth/delete-account.ts`):
  - exige login nos últimos 10 min e no máximo 3 tentativas por hora;
  - dono de grupo com outros membros ativos é **bloqueado antes de qualquer escrita**;
  - grupo sem outros membros sofre soft delete;
  - o login no Firebase Auth é apagado por último e dispara a cascata;
  - a auditoria guarda só o hash do uid.

  Exemplos [teste], de `functions/test/auth/delete-account.test.ts`:
  - "dono único de grupo com outros membros ativos: bloqueia antes de qualquer escrita";
  - "token sem auth_time é tratado como login antigo";
  - "falha no soft delete do grupo: não exclui o Auth…".
- **Exportar meus dados** (`functions/src/auth/export-my-data.ts`): até 3 por dia, no máximo 8 MiB. Não revela quem votou nem quem avaliou.

---

## 4. Fluxos críticos, passo a passo

1. **Primeiro acesso**
   1. Na web, o usuário abre um convite (`/invite/:code` ou `/join/:code`).
   2. Cria a conta com Google ou e-mail.
   3. A function `onUserCreated` cria o perfil e a claim de papel.
   4. Verifica telefone e CPF.
   5. Preenche o perfil (nome, apelido, posição, tipos de campo).
   6. Chega à Home.
2. **Organizar um jogo**
   1. Owner ou admin de um grupo com ≥5 membros cria o jogo, escolhendo local, quadra livre, data, vagas, preço e visibilidade.
   2. Os jogadores recebem notificação e lembretes de 24h e 2h.
3. **Confirmar presença**
   1. O jogador confirma, ou entra na lista de espera se estiver lotado.
   2. O valor por pessoa é calculado.
   3. Se alguém cancela, o 1º da fila é notificado e tem 30 min para confirmar.
4. **Montar os times**
   1. Na web, o owner usa o sorteio equilibrado (nível de XP) ou embaralha, e pode ajustar à mão. No Android, o "Gerar Times" só embaralha.
   2. Os times são gravados e o jogo vira CONFIRMED.
5. **Jogo ao vivo**
   1. O gestor inicia (CONFIRMED → LIVE).
   2. O gestor ou os jogadores confirmados registram gols (com assistência), defesas e cartões.
   3. Os jogadores fazem check-in por GPS ou QR.
6. **Encerrar**
   1. O gestor finaliza (LIVE → FINISHED): os eventos são agregados e a votação abre.
   2. O servidor processa o XP: base, streak, bônus e milestones, com teto de 500.
   3. Saem as badges, a liga e os rankings são atualizados, e o Android mostra o resumo pós-jogo.
7. **Votação**
   1. Até 24h depois do fim, cada jogador vota em MVP, melhor goleiro e Bola Murcha.
   2. O gestor encerra a votação.
   3. MVP ganha +50 XP e a Bola Murcha perde 10, sem pagar em dobro.
8. **Fechamento do mês**
   1. Às 03:00 do dia 1, a classificação é congelada.
   2. Nova temporada: todos voltam para Bronze. O XP global continua.
9. **Dinheiro do grupo**
   1. O admin registra entradas e saídas.
   2. No modo mensalidade, o período é gerado (fixo ou por jogo), o valor é rateado sem perder centavos, e as baixas são parciais ou totais.
10. **Sair do app**
    1. O usuário pede a exclusão da conta, que exige login recente.
    2. Se for dono de grupo com outros membros, precisa transferir o grupo antes.
    3. A conta é apagada, e o usuário pode exportar os dados antes.

---

## 5. Identidade

| Item | Valor | Fonte |
|---|---|---|
| Nome | **Futeba dos Parças** (nome curto "Futeba"; no iOS o nome exibido é "Futeba") | `app/src/main/res/values/strings.xml:3`, `web/public/manifest.json:2-11`, `iosApp/iosApp/Info.plist:9-10` |
| Slogan e título | "Futeba dos Parças \| Organize sua pelada"; "Organize suas peladas com estilo" | `web/index.html:110`, `strings.xml:179` |
| Cor primária | **#00852A "Futeba Green"** (no tema escuro, #4ADE80) | `shared/.../ThemeConfig.kt:36-74`, `shared/design-tokens.json:6-39`, `web/src/theme/index.ts:36-58` |
| Secundária / terciária | #005FCC (azul) / #FF6D00 (laranja) | idem |
| Cores de gamificação | Ouro #FFD700, Prata #E0E0E0, Bronze #CD7F32, Diamante #B9F2FF, Platina #00E676, Campeão #E91E63, XP #9C27B0, Nível #00BCD4, Sequência #FF5722 | `Color.kt:21-90` |
| Temas do Android | verde (padrão), azul, laranja, roxo, vermelho, azul-marinho, cor dinâmica, alto contraste | |
| Fonte | **Poppins** no Android e na web (hospedada no próprio site); fonte do sistema (SF) no iOS | `Typography.kt:11-23`, `web/index.html:89-108` |
| Tom de voz | Informal, gíria de pelada, emoji: "⚽ BOLA ROLANDO", "Bora pro jogo ganhar mais XP!", "O Brabo", "Pereba", "Resenha, fotos e avisos dos parças", "Elite do fut", "VOCÊ É UMA LENDA IMORTAL!" | `strings.xml:173-1246` |
| Ícone e logo | Android `@mipmap/ic_launcher` (também é o logo do login); web `favicon.svg`, ícones 192/512 maskable, `og-futeba-dos-parcas.jpg`, `logo.png` | `LoginScreen.kt:162-186` |

**Selo "by TECHFERNANDES": não existe no app hoje** (busca em app/, composeApp/, iosApp/ e web/). O que existe de marca:
- **Web, visível:**
  - tela Sobre: "Um produto da Tech Fernandes", com link (`web/src/pages/about/AboutScreen.tsx:225-232`);
  - página inicial: "© … Tech Fernandes LTDA" (`LaunchPage.tsx:538-545,606`);
  - páginas de divulgação: `GrowthFooter.tsx:63,145`, com CNPJ;
  - páginas legais em `web/public`.
- **Web, só nos metadados:** og, twitter e JSON-LD `parentOrganization` "Tech Fernandes LTDA" (`web/index.html:62,74,113`).
- **Android:** a splash mostra "Desenvolvido por Renan Locatiz Fernandes" (`SplashScreen.kt:146`, `strings.xml:853`). O texto do login com o nome existe, mas não é usado (`strings.xml:184`).
- **iOS:** as strings existem (`composeApp/.../strings.xml:145,814`), mas nenhuma tela as mostra.
- A pergunta sobre o selo está na decisão D9.

**Inconsistência de tom**: os status de jogo aparecem em inglês (SCHEDULED…, `strings.xml:1080-1087`).

---

## 6. Integrações

| Serviço | Uso |
|---|---|
| Firebase Auth | E-mail e Google; claims `role`, `verified`, `profileComplete` |
| Firestore | Banco principal, com cache offline (IndexedDB na web) |
| Cloud Functions v2 | Região southamerica-east1, até 10 instâncias (`functions/src/index.ts:53-61`); todas as regras de dinheiro, XP, ciclo do jogo e votação |
| Storage | Fotos de perfil, logos, comprovantes, mural (imagem até 10 MB, vídeo MP4 até 25 MB e 30 s), fotos e vídeos de jogo, com miniaturas geradas no servidor |
| FCM / APNs | Push; canal Android `futeba_notifications` |
| App Check | Play Integrity (Android), App Attest/DeviceCheck (iOS), reCAPTCHA Enterprise (web); obrigatório em `deleteAccount` e `setUserVerified` |
| Crashlytics, Analytics, Performance, Remote Config | Android e iOS (uso do Remote Config não verificado) |
| Google Maps, Places, Location | Mapa de quadras e check-in (`MAPS_API_KEY`) |
| Credential Manager / GoogleSignIn | Login Google |
| Android Auto, App Links (futebadosparcas.web.app e futebadosparcas.com.br) | |
| Hosting | Firebase Hosting com PWA, mais as páginas legais (privacidade, termos, exclusão de conta, segurança infantil) |

---

## 7. Dados que o app guarda

**Firestore (coleções):**

| Grupo | Coleções |
|---|---|
| Núcleo | `users`, `users_private` (PII), `games`, `groups` (+ `members`), `confirmations`, `teams`, `game_events`, `live_scores`, `live_games`, `mvp_votes`, `games/{id}/waitlist`, `schedules`, `locations` (+ `fields`, `reviews`) |
| Gamificação | `statistics`, `xp_logs`, `user_badges`, `users/{uid}/badges`, `user_streaks`, `seasons`, `season_participation`, `season_final_standings`, `ranking_deltas`, `league_matches` |
| Social | `activities`, `notifications`, `game_summons`, `invites`, `chats/{id}/messages`, `wall_posts`, seguidores |
| Financeiro | `groups/{gid}/cashbox`, `cashbox_summary`, `monthly_finance_periods/{p}/payers` |
| Mídia | `game_photos`, `game_videos` |
| Segurança e controle | `cpf_index`, `phone_index`, `rate_limits`, `verification_failures`, `account_aliases`, `account_merge_requests`, `audit_logs`, `sessions`, `system_config`, `app_settings` |
| Push e localização | `push_tokens`, `push_token_devices` (só o servidor acessa), `notification_settings`, `user_locations` |

**PII:**
- E-mail, token de push, data de nascimento, altura, peso, gênero e telefone ficam em `users_private` (`pii-migration.ts:35-50`).
- CPF: **só hash e versão mascarada**.
- Telefone: número, hash e data de verificação.
- Localização: `user_locations`.

**Local no aparelho:**

| Plataforma | O que guarda |
|---|---|
| Android | Room v6 (`AppDatabase.kt:17-30`): cache de `games` (em uso), fila offline de locais `location_sync_queue` (em uso); `users`, `groups`, `search_history` e `popular_searches` existem sem consumidor real. Também DataStore, EncryptedSharedPreferences e cache do Firestore |
| Web | IndexedDB (Firestore). `localStorage`: tema, idioma, token de push, rascunhos de jogo, fila offline cifrada, favoritos, histórico de busca, posições anteriores do ranking, aviso do PWA e log de erros. `sessionStorage`: convite pendente, verificação de telefone, merge de conta |
| iOS | NSUserDefaults (tema e bloqueados) |

---

## 8. O que parece estar errado ou desatualizado (registro, sem correção nesta fase)

- **`CLAUDE.md`:**
  - A tabela de XP está **errada**: diz gol 10, assistência 7, defesa 8, vitória 20, MVP 30. O código paga 25/20/15/30/50.
  - As versões estão defasadas (AGP 9.0.1, Compose BOM 2024.09, targetSdk 35, Vite 5, Router 6, Firebase 10.7, versões dos apps).
  - Cita `NavDestinations.kt` e `routes/AppRoutes.kt`, que não existem.
  - Diz que o produto é "Android + Web", esquecendo o iOS.
- **`.claude/skills/futeba-xp-validate/SKILL.md`:** valores de XP antigos (gol 5…) e testes que não existem.
- **`docs/BUSINESS_RULES.md`:** diverge do código em criação de jogo, limites de `max_players`, "times via IA" e no diagrama de estados.
- **Comentários no código:** `applyVotingXpDelta` diz "MVP +30". `LeagueDivision.kt:15` diz "PPJ máx 200" (o servidor usa 500).
- **Teste com dados velhos:** `mvp-voting.test.ts` usa um mock de `LEVEL_TABLE` antigo e `MAX_XP_PER_GAME: 100`.
- **Regras sem nenhum teste encontrado:** fórmula do pipeline de XP, streak, milestones e os balanceadores do Android (Gemini, Enhanced, `CalculateTeamBalanceUseCase`). `bonus-rules`, check-in e ranking semanal têm teste.
- **Nomes de nível na notificação:** `functions/src/notifications/achievement-notifications.ts:99-103` só tem 11 nomes (Novato…Imortal). Quem sobe para os níveis 11 a 20 recebe "Nivel N" em vez do nome.
- **iOS, detalhe do grupo:** a rota `GROUP_DETAIL` não é alcançável por nenhum botão e, se fosse, passaria `selectedGameId` como `groupId` (`composeApp/.../App.kt:616`).
- **Existe, não ligado:**
  - rotas mortas no Android;
  - Google falso e "esqueci a senha" sem ação no iOS;
  - `badges/streak_7` lê `users.current_streak`, mas o streak vive em `user_streaks`, então provavelmente nunca dispara.
- **Resíduos de Windows** (nada quebra no Mac):
  - `app/build.gradle.kts:146,158-164`: `C:/TEMP` atrás de um guard `os.name win`, código morto no Mac;
  - `gradle.properties:56-57`: `android.overridePathCheck=true`, que só existia por causa do "ç" no caminho do Windows;
  - documentação de runner WSL obsoleta: `CLAUDE.md:153`, `docs/ci/wsl2-self-hosted-runner.md`, `docs/CI_RUNNERS.md:131-193`, `scripts/SELF_HOSTED_RUNNER.md`, `AGENTS.md:136-137`;
  - no sentido inverso, `firestore-rules-tests/package.json:8,10` fixa o `JAVA_HOME` do Homebrew do Mac.
  - Nenhum workflow roda em Windows.

---

## 9. Decisões que preciso de você

Pela REGRA ZERO, não escolhi nenhum destes pontos. Cada um muda *o que* o app faz.

| # | Pergunta | O que o código faz hoje |
|---|---|---|
| D1 | **Qual é o sorteio de times "oficial"?** | Na prática, a web equilibra pelo nível de XP, e o Android só embaralha (pode incluir PENDING). Existem mais 4 algoritmos equilibrados no código que nenhuma tela alcança |
| D2 | **O MVP entra ou não no teto de 500 XP por jogo?** | O servidor paga por fora (até 550); a calculadora KMP coloca dentro |
| D3 | **Qual é o catálogo de badges certo?** | A web mostra XP e regras diferentes das functions: onipresente 350 vs 100; rei_das_quartas 200 vs 150; balanced_player "1+1" vs "≥2+≥2"; carrasco "gols decisivos" vs "5 vitórias sobre o mesmo adversário". Há dois sistemas de badge e `veteran_100`/`games_100` repetem a mesma regra |
| D4 | **O XP total pode ficar negativo?** | O pipeline não tem piso; a votação usa piso −100; `processing.ts` usa piso 0 |
| D5 | **O ranking semanal deve respeitar o anti-cheat?** | Ele usa gols e assistências brutos, sem o limite de 15/10 |
| D6 | **A liga do grupo deve exigir presença?** | Conta todo CONFIRMED, mesmo sem check-in |
| D7 | **Qual é o desempate nos rankings?** | O leaderboard da temporada desempata por `user_id` (alfabético, `leaderboard-cache.ts:1596-1601`); a lista da liga, por XP → pontos → nome; o "Mito da Rodada" e a liga do grupo não desempatam |
| D8 | **O que um co-organizador pode fazer?** | Rules e callables deixam gerenciar; o Android não deixa finalizar, excluir nem gerenciar confirmações; a web não deixa formar times |
| D9 | **O selo "by TECHFERNANDES" deve existir?** Onde e com que texto? | Não existe; há "Um produto da Tech Fernandes" (web, metadados) e "Desenvolvido por Renan Locatiz Fernandes" (Android) |
| D10 | **A lista de espera deve confirmar sozinha?** | Hoje só notifica o 1º da fila e dá 30 min para ele confirmar |
| D11 | **Qualquer jogador confirmado pode registrar gols ao vivo?** | Sim, hoje pode, não só o gestor |
| D12 | **Só dono de quadra ou admin cria grupo na web?** | Sim na web (`App.tsx:562`); no Android qualquer usuário com perfil completo cria |
| D13 | **Avaliação de local só para quem jogou lá?** | O comentário das rules diz que sim, mas o código não verifica |
| D14 | **Status de jogo em inglês na interface** | Traduzir para o tom do app ou manter? |

---

## Apêndice A: stack atual e a pergunta da missão sobre Expo

**Stack atual (lida dos arquivos de build):**

| Camada | Tecnologia |
|---|---|
| Android | Kotlin 2.4.21, Jetpack Compose (BOM 2025.09.01), AGP 9.4.1, Gradle 9.8.0, compileSdk 37, minSdk 24, targetSdk 36, Koin 4.1.1, Room 2.8.5 |
| Compartilhado | Kotlin Multiplatform (`:shared`, GitLive Firebase 2.7.0, SQLDelight 2.2.1) |
| iOS | Compose Multiplatform 1.10.3 (`:composeApp`) com casca SwiftUI, iOS 15 |
| Web | React 18.3, MUI 5.18, Vite 8.3, TypeScript 5.9, TanStack Query 5.105, React Router 7.18.5, Firebase JS 12.19, ESLint 8.57 (fora de suporte); versões instaladas, o `package.json` declara pisos mais antigos |
| Backend | Cloud Functions Node 22, firebase-functions 7.4, firebase-admin 13.10, TS 5.9, Jest 30 |

A missão diz: "se já estiver em stack multiplataforma madura, não migre só por migrar; mostre prós e contras". KMP com Compose Multiplatform se encaixa nisso. Os números abaixo são opinião técnica, não decisão.

| | Manter e modernizar (KMP + Compose + React + Firebase) | Reescrever em Expo + React Native + TS |
|---|---|---|
| Regras de negócio | Já moram nas Cloud Functions e nas rules, **e continuariam lá em qualquer caso**. Nada a portar | Também ficam nas Functions. O app novo só refaz a interface |
| Android | App completo, publicado, em revisão no Play. Nada a refazer | Refazer ~50 telas, widget e biometria |
| iOS | O ponto fraco: falta criar jogo e grupo, jogo ao vivo e votação. É preciso terminar a migração do composeApp | Ganharia paridade com o Android "de graça" ao refazer tudo |
| Web | React + TS já compartilha a linguagem com Expo | Daria para dividir componentes e lógica com a web (React Native Web), mas a web atual usa MUI, que não roda em RN |
| Risco | Baixo: evolução incremental, um passo por branch | Alto: duas bases em paralelo por meses, migração de usuários das lojas (mesmo package id), recertificação no Play e na App Store |
| Custo | Menor | Muito maior; o ganho principal é o iOS |

**Minha leitura (para você decidir):**
- Manter a stack.
- Concentrar a modernização em quatro frentes:
  1. terminar o iOS no composeApp;
  2. unificar as regras divergentes (seção 9);
  3. cobrir com testes as regras que não têm teste (seção 8);
  4. atualizar a web (MUI 5 → 6/7, ESLint 9, TS 5.x).
- Também cabe aqui "construir o app novo em paralelo", só que num formato diferente: em vez de um repositório novo, o iOS novo e as telas novas entram atrás de feature flags no mesmo monorepo, e nada do antigo é apagado.

**Migração de dados** (item 4 do contexto da missão): se as regras ficarem no Firebase, não há migração de banco. Se alguma decisão da seção 9 mudar o formato dos dados (por exemplo, unificar as duas coleções de badges), o plano da Fase 3 inclui antes um backup (export do Firestore) e um script de migração testado no emulador.

---

## Lacunas desta leitura

Atualizado em 05/11/2026, depois que a busca voltou a funcionar.

**Fechadas:**
- marca;
- Pix;
- "Gerar Times";
- modos de entrada;
- Room e localStorage;
- `leaderboard-cache`: ordena por pontos e desempata por `user_id`. No ranking da liga, o desempate é XP, depois pontos, nome e UID.
- `parallel-processing` e `processing.ts`: código morto ou só de teste. O pipeline real é o de `index.ts`.
- `ambassador-badge`: Bronze/Prata/Ouro/Lenda com 3/10/30/100 convites convertidos, sem XP.

**Continuam sem leitura:** `recurrence-engine.ts`, `member-counter.ts`, `join-requests.ts`, `summary-recompute.ts` e a lista completa de `match` do `firestore.rules`.
