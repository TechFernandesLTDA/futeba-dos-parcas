# CMD-23: Ranking Calculation Audit

## Data da Auditoria: 2025-01-11

## Origem dos Dados de Ranking

### Fontes Primárias

1. **Estatísticas Globais** (`statistics/{userId}`)
   - Dados agregados de TODOS os jogos confirmados
   - Atualizado via `MatchFinalizationService.processGame()`
   - Contém: `totalGoals`, `totalAssists`, `totalSaves`, `totalGames`, `gamesWon`, `bestPlayerCount`

2. **Participação em Temporada** (`season_participation/{seasonId}/{userId}`)
   - Dados específicos da temporada ativa
   - Atualizado via `LeagueService.updateLeague()`
   - Contém: `points`, `goalsScored`, `assists`, `wins`, `leagueRating`, `division`

3. **Deltas de Período** (`ranking_deltas/{period}_{key}_{userId}`)
   - Acumuladores para cálculo de rankings temporais
   - Chaves: `week_YYYY-WXX_userId`, `month_YYYY-MM_userId`
   - Contém: `xp_added`, `goals_added`, `games_added`, `wins_added`, `mvp_added`

## Fluxo de Atualização em Tempo Real

```
┌─────────────────┐
│ Jogo Finalizado │
│ (status=FINISHED)│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ MatchFinalizationService       │
│ .processGame(gameId)           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Buscar confirmations CONFIRMED  │
│    (WHERE game_id=X AND status=    │
│     'CONFIRMED')                   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 2. Para cada confirmation:         │
│    - Calcular XP (XPCalculator)    │
│    - Atualizar statistics GLOBAL   │
│    - Atualizar season_participation│
│    - Criar ranking_deltas          │
│    - Criar xp_log                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 3. Batch commit (atomic)           │
│    - Todas as atualizações juntas  │
│    - Garante consistência          │
└─────────────────────────────────────┘
```

## Verificação de Consistência

### Pontuação de Ranking

O ranking é baseado em diferentes métricas dependendo da categoria:

| Categoria | Fonte de Dados | Campo |
|-----------|----------------|-------|
| GOALS | `statistics` | `totalGoals` |
| ASSISTS | `statistics` | `totalAssists` |
| SAVES | `statistics` | `totalSaves` |
| MVP | `statistics` | `bestPlayerCount` |
| XP | `users` | `experiencePoints` |
| GAMES | `statistics` | `totalGames` |
| WINS | `statistics` | `gamesWon` |

### Pontuação de Temporada (League)

A pontuação da temporada segue um sistema diferente:

- **Pontos**: 3 por vitória, 1 por empate (padrão futebol)
- **League Rating**: Calculado via `LeagueRatingCalculator`
  - XP por jogo (40%)
  - Win rate (30%)
  - Goal difference (20%)
  - MVP rate (10%)
- **Divisão**: Baseada no rating (0-100)

### Validação de Fonte

**Status**: ✅ **CONSISTENTE**

Todas as fontes de dados são atualizadas atomicamente via:
1. `MatchFinalizationService.processGame()` - jogos confirmados
2. `LeagueService.updateLeague()` - temporada
3. Transações Firestore para atomicidade

## Problemas Identificados e Soluções

### 1. Jogos não Confirmados
- **Problema**: Jogos criados mas não finalizados/confirmados não entram no ranking
- **Solução**: Status `FINISHED` é obrigatório para processamento
- **Validação**: Apenas confirmations com status `CONFIRMED` são contabilizadas

### 2. Race Condition em XP
- **Problema**: Múltiplas tentativas de processar o mesmo jogo
- **Solução**: Flag `xpProcessed` no documento do jogo com verificação atômica
- **Implementação**: Transação Firestore que marca `xp_processed=true` antes de processar

### 3. Cálculo de Goal Difference
- **Problema**: Saldo de gols calculado incorretamente em alguns casos
- **Solução**: `goalsConceded` é obtido corretamente do `liveScore`
- **Implementação**: `goalDiff = confirmation.goals - goalsConceded`

## Fórmulas de Cálculo

### XP Calculator
```kotlin
totalXP = participation + goals + assists + saves + result + mvp + streak + milestones + penalty

Onde:
- participation = 10 (base)
- goals = 10 * cappedGoals (max 15)
- assists = 7 * cappedAssists (max 10)
- saves = 5 * cappedSaves (max 30)
- result = 20 (win) ou 10 (draw)
- mvp = 30 (se for MVP)
- streak = 20/50/100 (3/7/10 jogos consecutivos)
- penalty = -10 (se for "Bola Murcha")
- milestones = variável (baseado em conquistas)
```

### League Rating Calculator
```kotlin
rating = (ppjScore * 0.4) + (winRate * 0.3) + (gdScore * 0.2) + (mvpScore * 0.1)

Onde:
- ppjScore = (avgXP / 200) * 100 (máx 100)
- winRate = (wins / games) * 100
- gdScore = ((avgGD + 3) / 6) * 100 (normalizado)
- mvpScore = (mvpRate / 0.5) * 100 (cap em 50%)
```

## Performance e Caching

### Estratégia de Cache
- **LRU Cache** para usuários (max 200 entries, 5min TTL)
- **Batching** paralelo com `async/awaitAll`
- **Firestore composite indexes** para queries complexas

### Otimizações Aplicadas
1. **Cancelamento de queries stale** - Jobs cancelados ao mudar de temporada
2. **Cache de confirmação** - TTL local para evitar re-fetch
3. **Image caching** - Coil com memória cache

## Conclusão da Auditoria

**Status**: ✅ **APROVADO**

O sistema de cálculo de ranking está:
1. **Consistente** - Todas as fontes são atualizadas atomicamente
2. **Correto** - Fórmulas validadas e testadas
3. **Performance** - Otimizado com cache e batching
4. **Seguro** - Protegido contra race conditions e XP duplicado

### Recomendações
1. Manter o sistema de validação de jogos confirmados
2. Continuar usando transações atômicas para atualizações
3. Monitorar performance do ranking em tempo real
4. Considerar agregação adicional para dashboards
