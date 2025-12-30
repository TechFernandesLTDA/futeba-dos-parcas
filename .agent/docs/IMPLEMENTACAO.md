# 🚀 Guia de Implementação - Features Completas

Este documento descreve todas as features implementadas e os próximos passos para completar a integração.

---

## 🎯 Última Atualização: 26/12/2024

### Tarefas Concluídas Hoje

| Tarefa | Arquivos |
|--------|----------|
| ✅ Sistema de Locations e Fields | `Location.kt`, `LocationRepository.kt` |
| ✅ Sistema de Roles (Admin/FieldOwner/Player) | `User.kt`, `firestore.rules` |
| ✅ Dialog de Seleção de Local (Google Places) | `SelectLocationDialog.kt` |
| ✅ Dialog de Seleção de Quadra | `SelectFieldDialog.kt` |
| ✅ Dialog para Adicionar Local Manual | `dialog_add_location_manual.xml` |
| ✅ Regras Firestore para locations/fields | `firestore.rules` |
| ✅ Seed Data - Ginásio Apollo | `LocationRepository.seedGinasioApollo()` |
| ✅ Botão Seed nas Opções de Dev | `DeveloperViewModel.kt`, `fragment_developer.xml` |
| ✅ Configuração JAVA_HOME permanente | Environment Variable |

### Próximos Passos Imediatos

1. **Deploy das regras Firestore:**

   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Testar criação de jogo** com seleção de local/quadra

3. **UI para Field Owners** - tela de gerenciamento de locais

---

## ✅ O que foi Criado

### 1. Backend - Entidades (TypeORM)

Todas as entidades foram criadas em `backend/src/entities/`:

#### Gamificação

- ✅ `Season.ts` - Temporadas de liga
- ✅ `SeasonParticipation.ts` - Participação de jogadores em temporadas
- ✅ `Badge.ts` - Badges/conquistas disponíveis
- ✅ `UserBadge.ts` - Badges conquistados por usuários
- ✅ `UserStreak.ts` - Streaks de presença
- ✅ `WeeklyChallenge.ts` - Desafios semanais
- ✅ `UserChallengeProgress.ts` - Progresso em desafios
- ✅ `PlayerCard.ts` - Figurinhas de jogadores (estilo FIFA)
- ✅ `HeadToHead.ts` - Confrontos diretos entre jogadores

#### Pagamentos

- ✅ `Payment.ts` - Pagamentos (mensalistas/avulsos)
- ✅ `Crowdfunding.ts` - Vaquinhas
- ✅ `CrowdfundingContribution.ts` - Contribuições em vaquinhas

#### Experiência de Jogo

- ✅ `MVPVote.ts` - Votação de MVP/Bola Murcha/Melhor Goleiro
- ✅ `LiveScore.ts` - Placar ao vivo com eventos
- ✅ `TacticalBoard.ts` - Prancheta tática

### 2. Android - Models (Kotlin)

Todos os models foram criados em `app/src/main/java/com/futebadosparcas/data/model/`:

- ✅ `Gamification.kt` - Ligas, badges, streaks, desafios, player cards, freguesia
- ✅ `Payment.kt` - Pagamentos e vaquinhas
- ✅ `GameExperience.kt` - Votação MVP, placar ao vivo, prancheta tática

### 3. Serviços Backend

- ✅ `TeamBalancerService.ts` - Algoritmo de sorteio inteligente de times
  - Snake Draft algorithm
  - Genetic Algorithm (opcional para maior precisão)
  - Cálculo de ratings baseado em stats ou Player Cards

### 4. Documentação

- ✅ `README.md` - Documentação completa do projeto
- ✅ `backend/.env.example` - Template de variáveis de ambiente
- ✅ `CLAUDE.md` - Guia para Claude Code
- ✅ `IMPLEMENTACAO.md` - Este arquivo

## 📋 Próximos Passos - Backend

### 1. Criar Migrações de Banco de Dados

```bash
cd backend

# Gerar migração com todas as novas entidades
npm run migration:generate -- src/migrations/AddGamificationFeatures

# Revisar o arquivo gerado em src/migrations/
# Executar migração
npm run migration:run
```

### 2. Criar Services

Crie os seguintes services em `backend/src/services/`:

#### GamificationService.ts

```typescript
- checkAndAwardBadges(userId, gameId) // Verificar conquistas
- updateStreak(userId, gameId) // Atualizar streak
- updateSeasonParticipation(userId, gameResult) // Atualizar liga
- checkWeeklyChallenges(userId) // Verificar desafios
- updatePlayerCard(userId, gameStats) // Atualizar figurinha
```

#### PaymentService.ts

```typescript
- createPayment(userId, amount, type) // Criar cobrança
- processPixPayment(paymentId, pixData) // Processar PIX
- sendPaymentReminder(paymentId) // Cobrador automático
- generatePixQRCode(amount, key) // Gerar QR Code PIX
```

#### CrowdfundingService.ts

```typescript
- createCrowdfunding(data) // Criar vaquinha
- contribute(crowdfundingId, userId, amount) // Contribuir
- checkGoalReached(crowdfundingId) // Verificar meta
```

#### MVPVotingService.ts

```typescript
- submitVote(gameId, voterId, votedPlayerId, category)
- getVoteResults(gameId, category)
- closVoting(gameId) // Encerrar votação
```

### 3. Criar Controllers

Crie os seguintes controllers em `backend/src/controllers/`:

- `GamificationController.ts`
- `PaymentController.ts`
- `CrowdfundingController.ts`
- `MVPVoteController.ts`
- `LiveScoreController.ts`
- `TacticalBoardController.ts`

### 4. Criar Rotas

Adicione em `backend/src/routes/index.ts`:

```typescript
router.use('/api/seasons', seasonRoutes);
router.use('/api/badges', badgeRoutes);
router.use('/api/challenges', challengeRoutes);
router.use('/api/player-cards', playerCardRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/crowdfunding', crowdfundingRoutes);
router.use('/api/mvp-votes', mvpVoteRoutes);
router.use('/api/live-score', liveScoreRoutes);
router.use('/api/tactical-board', tacticalBoardRoutes);
```

### 5. Atualizar GameService

Adicionar no `GameService.ts`:

```typescript
async finishGame(gameId: string) {
  // 1. Fechar votação MVP
  // 2. Processar badges automáticos (hat-trick, clean sheet, etc)
  // 3. Atualizar streaks
  // 4. Atualizar temporadas
  // 5. Atualizar player cards
  // 6. Atualizar head-to-head
  // 7. Gerar card instagramável
}
```

## 📋 Próximos Passos - Android

### 1. Criar Repositories

Crie em `app/src/main/java/com/futebadosparcas/data/repository/`:

#### GamificationRepository.kt

```kotlin
- getActiveSeason()
- getMySeasonParticipation()
- getLeagueRanking()
- getMyBadges()
- getWeeklyChallenges()
- getChallengeProgress(challengeId)
- getMyPlayerCard()
- getHeadToHead(player1Id, player2Id)
```

#### PaymentRepository.kt

```kotlin
- getMyPayments()
- createPayment()
- submitPaymentProof()
- getPaymentHistory()
```

#### CrowdfundingRepository.kt

```kotlin
- getActiveCrowdfundings()
- createCrowdfunding()
- contribute()
- getContributions(crowdfundingId)
```

### 2. Criar ViewModels

Crie em `app/src/main/java/com/futebadosparcas/ui/`:

- `gamification/SeasonViewModel.kt`
- `gamification/BadgesViewModel.kt`
- `gamification/ChallengesViewModel.kt`
- `gamification/PlayerCardViewModel.kt`
- `payments/PaymentsViewModel.kt`
- `crowdfunding/CrowdfundingViewModel.kt`
- `games/MVPVoteViewModel.kt`
- `games/LiveScoreViewModel.kt`

### 3. Criar Fragments e Layouts

#### Gamificação

- `SeasonLeagueFragment.kt` + `fragment_season_league.xml`
- `BadgesFragment.kt` + `fragment_badges.xml`
- `ChallengesFragment.kt` + `fragment_challenges.xml`
- `PlayerCardFragment.kt` + `fragment_player_card.xml`
- `PlayerCardDetailFragment.kt` + `fragment_player_card_detail.xml`

#### Pagamentos

- `PaymentsFragment.kt` + `fragment_payments.xml`
- `PaymentDetailFragment.kt` + `fragment_payment_detail.xml`
- `PixPaymentBottomSheet.kt` + `bottom_sheet_pix_payment.xml`

#### Vaquinhas

- `CrowdfundingListFragment.kt` + `fragment_crowdfunding_list.xml`
- `CrowdfundingDetailFragment.kt` + `fragment_crowdfunding_detail.xml`
- `CreateCrowdfundingFragment.kt` + `fragment_create_crowdfunding.xml`

#### Experiência de Jogo

- `MVPVoteBottomSheet.kt` + `bottom_sheet_mvp_vote.xml` (estilo Tinder)
- `LiveScoreFragment.kt` + `fragment_live_score.xml`
- `TacticalBoardFragment.kt` + `fragment_tactical_board.xml`

### 4. Adicionar na Navegação

Atualizar `nav_graph.xml`:

```xml
<fragment
    android:id="@+id/seasonLeagueFragment"
    android:name="com.futebadosparcas.ui.gamification.SeasonLeagueFragment" />

<fragment
    android:id="@+id/badgesFragment"
    android:name="com.futebadosparcas.ui.gamification.BadgesFragment" />

<!-- etc... -->
```

### 5. Atualizar Menu Principal

Adicionar em `menu/bottom_nav_menu.xml`:

```xml
<item
    android:id="@+id/navigation_league"
    android:icon="@drawable/ic_trophy"
    android:title="@string/title_league" />

<item
    android:id="@+id/navigation_payments"
    android:icon="@drawable/ic_payment"
    android:title="@string/title_payments" />
```

## 🎨 Layouts Essenciais a Criar

### Cards de Jogador (Player Card)

Crie `item_player_card.xml` estilo FIFA:

- Foto do jogador
- Nome
- Overall rating (grande)
- Mini-gráfico com Attack, Defense, Physical, Technique
- Raridade (cor do card)
- Trait especial

### Badge Item

Crie `item_badge.xml`:

- Ícone do badge
- Nome
- Descrição
- Contador (quantas vezes conquistou)
- Indicador de raridade

### Desafio Semanal

Crie `item_weekly_challenge.xml`:

- Ícone do desafio
- Nome e descrição
- Barra de progresso (X/Y)
- XP reward
- Status (completo/em progresso)

### Ranking da Liga

Crie `item_league_ranking.xml`:

- Posição
- Foto e nome do jogador
- Pontos
- Jogos/Vitórias/Derrotas
- Divisão (badge)

### Pagamento

Crie `item_payment.xml`:

- Tipo (mensalista/avulso)
- Valor
- Status (pago/pendente/atrasado)
- Data de vencimento
- Botão "Pagar com PIX"

## 🔥 Features Críticas para Implementar

### 1. Sistema de Streak (Prioridade ALTA)

No `GameRepository.kt`, após confirmação:

```kotlin
suspend fun confirmPresence(gameId: String) {
    // ... confirmar presença

    // Atualizar streak
    updateStreak(userId, gameId, gameDate)
}

private suspend fun updateStreak(userId: String, gameId: String, gameDate: String) {
    val streak = firestore.collection("user_streaks")
        .whereEqualTo("user_id", userId)
        .get()
        .await()

    // Lógica de streak
    // Se jogou ontem -> streak++
    // Se pulou um dia -> streak = 1
}
```

### 2. Auto-Award de Badges

No `GameService.ts` (backend), após finalizar jogo:

```typescript
// Verificar hat-trick
if (playerStats.goals >= 3) {
  await awardBadge(userId, BadgeType.HAT_TRICK);
}

// Verificar clean sheet
if (playerStats.saves > 0 && teamGoalsConceded === 0) {
  await awardBadge(userId, BadgeType.PAREDAO);
}

// Verificar 100% presença no mês
const monthAttendance = await checkMonthlyAttendance(userId);
if (monthAttendance === 1.0) {
  await awardBadge(userId, BadgeType.FOMINHA);
}
```

### 3. Gerador de Cards Instagramáveis

Crie `SocialCardGenerator.kt`:

```kotlin
class SocialCardGenerator {
    fun generateGameResultCard(game: Game, teams: List<Team>, mvp: User): Bitmap {
        // Criar bitmap 1080x1920 (Instagram Stories)
        // Fundo com gradiente das cores dos times
        // Placar grande no centro
        // Foto do MVP
        // Lista de artilheiros
        // Logo do app
        return bitmap
    }
}
```

### 4. Votação MVP Estilo Tinder

`MVPVoteBottomSheet.kt`:

```kotlin
- Exibir fotos dos jogadores em cards
- Swipe right = voto positivo
- Swipe left = próximo
- Categorias: MVP, Bola Murcha, Melhor Goleiro
- Animação ao votar
```

### 5. Cobrador Automático

Crie `PaymentReminderService.ts` (backend):

```typescript
cron.schedule('0 9 * * *', async () => {
  // Todo dia às 9h
  const overduePayments = await getOverduePayments();

  for (const payment of overduePayments) {
    await sendFunnyReminder(payment.userId, payment.amount);
  }
});

function sendFunnyReminder(userId: string, amount: number) {
  const messages = [
    `O boleto venceu, mas a caneta do adversário não... Pague R$ ${amount} já! 💸`,
    `Seu PIX tá mais devagar que zagueiro lento! Contribua com R$ ${amount} 🐌`,
    `Tá igual goleiro em bola alta: sem pagar nada! R$ ${amount} aguardando... 🧤`
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  // Enviar push notification
}
```

## 📊 Queries Importantes para Implementar

### Ranking da Temporada

```typescript
// Backend
const ranking = await dataSource
  .getRepository(SeasonParticipation)
  .createQueryBuilder('sp')
  .leftJoinAndSelect('sp.user', 'user')
  .where('sp.season_id = :seasonId', { seasonId })
  .orderBy('sp.points', 'DESC')
  .addOrderBy('sp.wins', 'DESC')
  .limit(100)
  .getMany();
```

### Top Artilheiros do Mês

```kotlin
// Android
val topScorers = firestore.collection("player_stats")
    .whereGreaterThan("goals", 0)
    .orderBy("goals", Query.Direction.DESCENDING)
    .limit(10)
    .get()
    .await()
```

## 🎯 Checklist Final de Implementação

### Backend

- [ ] Executar migrações de banco
- [ ] Criar todos os services
- [ ] Criar todos os controllers
- [ ] Adicionar rotas
- [ ] Implementar WebSocket para placar ao vivo
- [ ] Configurar PIX integration
- [ ] Criar cron job de cobrança
- [ ] Testar endpoints com Postman

### Android

- [ ] Criar repositories
- [ ] Criar ViewModels
- [ ] Criar Fragments
- [ ] Criar layouts XML
- [ ] Adicionar navegação
- [ ] Adicionar no menu principal
- [ ] Implementar streak indicator
- [ ] Implementar badge notifications
- [ ] Criar social card generator
- [ ] Testar no dispositivo

### Integração

- [ ] Configurar .env no backend
- [ ] Configurar Firebase no Android
- [ ] Testar fluxo completo de jogo
- [ ] Testar votação MVP
- [ ] Testar pagamento PIX
- [ ] Testar sorteio inteligente
- [ ] Testar atualização de stats
- [ ] Testar push notifications

## 💡 Dicas de Implementação

1. **Comece pelo Backend**: Implemente entities → services → controllers → rotas
2. **Teste Incrementalmente**: Teste cada endpoint antes de partir para o próximo
3. **UI por Último**: A UI vem depois da lógica funcionar
4. **Use Firebase primeiro**: Para MVP, use Firebase direto no Android
5. **Migre para Backend depois**: Quando escalar, migre para o backend Node.js

## 🚨 Pontos de Atenção

1. **Performance**: Player Cards podem ficar pesados com muitas imagens. Use cache (Coil)
2. **Sincronização**: Streaks precisam ser calculados com timezone correto
3. **Segurança**: Validar todos os votes para evitar fraude
4. **Custos**: Limitar geração de QR Codes PIX (cobrar por SDK de pagamento)

---

**Todas as bases estão criadas! Agora é implementar as telas e conectar tudo.** 🚀
