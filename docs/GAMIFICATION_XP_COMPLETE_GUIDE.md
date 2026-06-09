# Guia Completo de Gamification e XP - Futeba dos Parças

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Sistema de XP](#sistema-de-xp)
3. [Cálculo de XP por Partida](#cálculo-de-xp-por-partida)
4. [Níveis e Progressão](#níveis-e-progressão)
5. [Badges e Conquistas](#badges-e-conquistas)
6. [Streaks (Sequências)](#streaks-sequências)
7. [Temporadas e Rankings](#temporadas-e-rankings)
8. [Desafios Semanais](#desafios-semanais)
9. [Anti-Cheat](#anti-cheat)
10. [Arquivos Envolvidos](#arquivos-envolvidos)
11. [Fluxo de Dados](#fluxo-de-dados)
12. [Perguntas Frequentes](#perguntas-frequentes)
13. [Bugs Conhecidos e Correções](#bugs-conhecidos-e-correções)

---

## Visão Geral

O sistema de gamificação do **Futeba dos Parças** foi projetado para engajar jogadores através de:

- **XP (Experiência)**: Pontos ganhos por participação e desempenho
- **Níveis**: Progressão baseada em XP acumulado
- **Badges**: Conquistas especiais por marcos alcançados
- **Streaks**: Bônus por jogos consecutivos
- **Rankings**: Competição por temporadas
- **Desafios Semanais**: Metas especiais com recompensas

### Tecnologias

- **Client**: Kotlin Multiplatform Mobile (KMP)
- **Server**: Cloud Firestore + Cloud Functions v2
- **Cache**: Local (SharedPreferences) + Firestore
- **Validação**: Client-side + Server-side (dual validation)

---

## Sistema de XP

### O Que É XP?

**XP (Experience Points)** = Pontos de experiência que refletem o desempenho e engajamento de um jogador.

### Para Que Serve XP?

1. **Progressão de Nível**: Quanto mais XP, maior o nível
2. **Rankings**: Posição em tabelas de classificação
3. **Desbloqueio de Badges**: Certos badges exigem XP mínimo
4. **Prestígio**: Nível alto indica jogador experiente

### Tipos de XP Ganho

| Categoria | Descrição | Exemplo |
|-----------|-----------|---------|
| **Participação** | Por jogar uma partida | +10 XP por jogo |
| **Gols** | Por cada gol marcado | +10 XP por gol |
| **Assistências** | Por cada assistência | +7 XP por assist |
| **Defesas** | Por cada defesa (goleiro) | +8 XP por defesa |
| **Resultado** | Por vitória/empate | +20 XP vitória, +10 empate |
| **MVP** | Por ser o melhor da partida | +30 XP |
| **Streak** | Por jogos consecutivos | +20/35/50/100 XP |
| **Penalidade** | Por ser "Bola Murcha" | -10 XP |

---

## Cálculo de XP por Partida

### Fórmula Base

```
XP Total = Participação + Gols + Assistências + Defesas + Resultado + MVP + Streak - Penalidade
```

### Valores Padrão (Configuráveis)

```kotlin
XP_PRESENCA         = 10   // Por participar
XP_PER_GOAL         = 10   // Por cada gol
XP_PER_ASSIST       = 7    // Por cada assistência
XP_PER_SAVE         = 8    // Por cada defesa (goleiro)
XP_CLEAN_SHEET      = 15   // Por não sofrer gols (goleiro)
XP_WIN              = 20   // Por vitória
XP_DRAW             = 10   // Por empate
XP_MVP              = 30   // Por ser MVP
XP_STREAK_3         = 20   // 3 jogos consecutivos
XP_STREAK_5         = 35   // 5 jogos consecutivos
XP_STREAK_7         = 50   // 7 jogos consecutivos
XP_STREAK_10        = 100  // 10+ jogos consecutivos
XP_WORST_PLAYER     = -10  // Penalidade "Bola Murcha"
```

### Limites Anti-Cheat (Tetos)

```kotlin
MAX_GOALS_PER_GAME    = 15   // Máximo de gols computáveis
MAX_ASSISTS_PER_GAME  = 10   // Máximo de assistências computáveis
MAX_SAVES_PER_GAME    = 30   // Máximo de defesas computáveis
MAX_XP_PER_GAME       = 500  // XP máximo por partida
```

### Exemplo de Cálculo

**Cenário**: Jogador fez 2 gols, 1 assistência, time venceu, não foi MVP, streak de 5 jogos

```
Participação: 10 XP
Gols (2 × 10): 20 XP
Assistências (1 × 7): 7 XP
Defesas: 0 XP (não é goleiro)
Resultado (Vitória): 20 XP
MVP: 0 XP
Streak (5 jogos): 35 XP
Penalidade: 0 XP

TOTAL: 10 + 20 + 7 + 0 + 20 + 0 + 35 - 0 = 92 XP
```

### Configurações Dinâmicas

Os valores de XP podem ser **configurados dinamicamente** via `GamificationSettings` no Firestore:

```kotlin
data class GamificationSettings(
    val xpPresence: Int = 10,
    val xpPerGoal: Int = 10,
    val xpPerAssist: Int = 7,
    val xpPerSave: Int = 8,
    val xpCleanSheet: Int = 15,
    val xpWin: Int = 20,
    val xpDraw: Int = 10,
    val xpMvp: Int = 30,
    val xpStreak3: Int = 20,
    val xpStreak5: Int = 35,
    val xpStreak7: Int = 50,
    val xpStreak10: Int = 100,
    val xpWorstPlayerPenalty: Int = -10
)
```

**Localização no Firestore**: `gamification_settings/default`

---

## Níveis e Progressão

### Tabela de Níveis

| Nível | XP Necessário | XP Total | Título |
|-------|---------------|----------|--------|
| 1 | 0 | 0 | Iniciante |
| 2 | 100 | 100 | Novato |
| 3 | 250 | 350 | Aprendiz |
| 4 | 500 | 850 | Jogador |
| 5 | 1000 | 1850 | Regular |
| 10 | 5000 | ~15000 | Experiente |
| 20 | 25000 | ~200000 | Veterano |
| 30 | 100000 | ~900000 | Lenda |
| 40 | 500000 | ~3M | Mítico |
| 50 | 1000000+ | ~10M+ | Imortal |

### Fórmula de XP por Nível

```kotlin
// Fórmula aproximada (ajustável)
fun xpRequiredForLevel(level: Int): Long {
    return when {
        level <= 5 -> (level * level * 50).toLong()
        level <= 10 -> 5000 + ((level - 10) * 2500)
        level <= 20 -> 25000 + ((level - 20) * 5000)
        level <= 30 -> 100000 + ((level - 30) * 15000)
        else -> 500000 + ((level - 40) * 100000)
    }
}
```

### Barra de Progresso

```kotlin
progressPercent = ((currentXp - xpForCurrentLevel) * 100) / (xpForNextLevel - xpForCurrentLevel)
```

### Exemplo Prático

- **Nível Atual**: 5 (requer 1000 XP)
- **XP Acumulado**: 1350 XP
- **XP no Nível**: 1350 - 1000 = 350 XP
- **Próximo Nível**: 6 (requer 2500 XP, ou seja, +1500 XP)
- **Progresso**: 350 / 1500 = 23%

---

## Badges e Conquistas

### O Que São Badges?

**Badges** = Medalhas digitais concedidas por alcançar marcos específicos.

### Tipos de Badges

| Categoria | Badges | Critérios |
|-----------|--------|-----------|
| **Gols** | Artilheiro, Hat-trick, Pentaplec | 10/50/100 gols, 3 gols em 1 jogo, 5 gols em 1 jogo |
| **Assistências** | Assistente, Maestro | 25/75 assistências, 10 assistências em 1 jogo |
| **Defesas** | Muralha, Goleão | 50/150 defesas, 10+ defesas em 1 jogo |
| **Jogos** | Veterano, Imortal | 50/200/500 jogos |
| **Streak** | Sequência, Maratona | 7/30 jogos consecutivos |
| **Vitórias** | Campeão, Dominador | 20/100 vitórias, 10 vitórias consecutivas |
| **MVPs** | Craque, Estrela | 5/20 MVPs |
| **Posições** | Líbero, Avançado | Badges específicas por posição |

### Estrutura de Badge

```kotlin
data class BadgeDefinition(
    val id: String,              // "goals_100"
    val name: String,            // "Artilheiro"
    val description: String,     // "Marque 100 gols"
    val icon: String,            // Emoji ou URL
    val category: BadgeCategory, // GOALS, ASSISTS, etc
    val requirement: BadgeRequirement
)

data class UserBadge(
    val userId: String,
    val badgeId: String,
    val unlockedAt: String,      // ISO Date
    val unlockCount: Int = 1     // Para badges multiplas vezes
)
```

### Sistema de Desbloqueio

**Automaticamente via Cloud Function** quando um jogo termina:

```javascript
// Cloud Function: onGameFinished
// Verifica milestones e concede badges
if (user.goalsTotal >= 100) {
    await awardBadge(userId, "goals_100");
}
```

---

## Streaks (Sequências)

### O Que É Streak?

**Streak** = Número de jogos consecutivos jogados.

### Regras de Streak

1. **Consecutivos**: Jogos em dias consecutivos OU no mesmo dia
2. **Quebra**: Não jogar por 2+ dias
3. **Cálculo**:
   ```kotlin
   val isConsecutive = (currentDate - lastGameDate) in 0..1 days
   ```

### Bônus de XP por Streak

| Streak | Bônus XP |
|--------|----------|
| 3 jogos | +20 XP |
| 5 jogos | +35 XP |
| 7 jogos | +50 XP |
| 10+ jogos | +100 XP |

### Estrutura de Streak

```kotlin
data class UserStreak(
    val userId: String,
    val currentStreak: Int,      // Streak atual
    val longestStreak: Int,      // Melhor streak histórico
    val lastGameDate: String,    // ISO Date do último jogo
    val streakStartedAt: String  // ISO Date de início do streak
)
```

### Exemplo Prático

```
 Jogos: [Seg, Ter, Qua, Sex, Sáb, Dom, Seg, Ter]
 Streak: [1,   2,   3,   0,   1,   2,   3,   4]

Explicação:
- Seg a Qua: 3 jogos consecutivos (streak = 3)
- Qui: Não jogou (streak quebra, volta a 0)
- Sex: Inicia novo streak (streak = 1)
- Sáb a Ter: 7 jogos consecutivos (streak = 7, ganha bônus de 50 XP)
```

---

## Temporadas e Rankings

### O Que São Temporadas?

**Temporadas** = Períodos de competitividade com rankings separados.

### Estrutura de Temporada

```kotlin
data class Season(
    val id: String,              // "2025-Q1"
    val name: String,            // "Temporada Jan-Mar 2025"
    val startDate: String,       // ISO Date
    val endDate: String,         // ISO Date
    val isActive: Boolean,
    val divisionCount: Int = 4  // Diamante, Ouro, Prata, Bronze
)
```

### Divisões

| Divisão | Cor | Critério |
|---------|-----|----------|
| **Diamante** | #B9F2FF | Top 10% |
| **Ouro** | #FFD700 | Top 30% |
| **Prata** | #C0C0C0 | Top 60% |
| **Bronze** | #CD7F32 | Restante |

### Sistema de Pontuação

```kotlin
data class SeasonParticipation(
    val userId: String,
    val seasonId: String,
    val totalXP: Long = 0,
    val gamesPlayed: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val draws: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0,
    val currentDivision: Division = BRONZE,
    val divisionPosition: Int = 0
)
```

### Cálculo de Pontuação

```
Season Points = XP Total + (Vitórias × 10) + (MVPs × 5)
```

### Promoção/Rebaixamento

- **Promoção**: Top 3 da divisão → Sobe
- **Rebaixamento**: Bottom 3 da divisão → Desce
- **Recálculo**: Semanal via Cloud Function

---

## Desafios Semanais

### O Que São Desafios?

**Desafios Semanais** = Metas especiais com recompensas de XP.

### Tipos de Desafios

| Tipo | Exemplo | Recompensa |
|------|---------|------------|
| **Gols** | Marke 10 gols na semana | +50 XP |
| **Assistências** | 15 assistências na semana | +40 XP |
| **Jogos** | Jogue 5 partidas | +30 XP |
| **Vitórias** | 3 vitórias | +60 XP |
| **Streak** | 7 jogos consecutivos | +100 XP |

### Estrutura de Desafio

```kotlin
data class WeeklyChallenge(
    val id: String,
    val type: ChallengeType,      // WEEKLY_GOALS, WEEKLY_ASSISTS, etc
    val target: Int,              // Meta (ex: 10 gols)
    val xpReward: Int,            // Recompensa em XP
    val startDate: String,         // Início da semana
    val endDate: String           // Fim da semana
)

data class UserChallengeProgress(
    val userId: String,
    val challengeId: String,
    val currentProgress: Int,     // Progresso atual
    val completed: Boolean,
    val completedAt: String?      // ISO Date
)
```

### Ciclo de Desafios

```
Segunda: Novo desafio é criado
Domingo: Deadline para completar
Segunda: Desafio expira, XP é concedido
```

---

## Anti-Cheat

### Validação Dual (Client + Server)

#### Client-Side (XPCalculator.kt)

```kotlin
// Limites aplicados no cálculo
val cappedGoals = playerData.goals.coerceAtMost(MAX_GOALS_PER_GAME)
val cappedAssists = playerData.assists.coerceAtMost(MAX_ASSISTS_PER_GAME)
val cappedSaves = playerData.saves.coerceAtMost(MAX_SAVES_PER_GAME)

// Teto máximo de XP
val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME.toLong())
```

#### Server-Side (Cloud Functions)

```javascript
// onGameStatusUpdate (Cloud Function v2)

const MAX_GOALS_PER_GAME = 15;
const MAX_ASSISTS_PER_GAME = 10;
const MAX_SAVES_PER_GAME = 30;
const MAX_XP_PER_GAME = 500;

// Validação ANTI-CHEAT
for (const conf of confirmations) {
    if (conf.goals < 0 || conf.goals > MAX_GOALS_PER_GAME) {
        throw new Error(`[ANTI-CHEAT] Invalid goals: ${conf.goals}`);
    }
    if (conf.assists < 0 || conf.assists > MAX_ASSISTS_PER_GAME) {
        throw new Error(`[ANTI-CHEAT] Invalid assists: ${conf.assists}`);
    }
    if (conf.saves < 0 || conf.saves > MAX_SAVES_GAME) {
        throw new Error(`[ANTI-CHEAT] Invalid saves: ${conf.saves}`);
    }
}
```

### Proteções Adicionais

1. **Transações Firestore**: Operações atômicas
2. **Validação de Data**: Cannot specify future game dates
3. **Rate Limiting**: Limite de updates por jogo
4. **Audit Log**: XpLog rastreia todas as operações
5. **Double Calculation**: Client calcula, Server recalcula e valida

---

## Arquivos Envolvidos

### Domain Layer (KMP - Compartilhado)

```
shared/src/commonMain/kotlin/com/futebadosparcas/
├── domain/
│   ├── model/
│   │   ├── XpLog.kt                    # Registro de XP
│   │   ├── GamificationSettings.kt     # Configurações dinâmicas
│   │   ├── UserStreak.kt               # Dados de streak
│   │   ├── BadgeDefinition.kt          # Definição de badge
│   │   ├── UserBadge.kt                # Badge do usuário
│   │   ├── WeeklyChallenge.kt          # Desafio semanal
│   │   ├── UserChallengeProgress.kt    # Progresso do desafio
│   │   ├── Season.kt                   # Temporada
│   │   └── SeasonParticipation.kt      # Participação na temporada
│   ├── ranking/
│   │   ├── XPCalculator.kt             # Cálculo de XP
│   │   ├── MatchFinalizationService.kt # Finalização de jogo
│   │   └── MilestoneChecker.kt         # Verificador de marcos
│   ├── gamification/
│   │   ├── BadgeAwarder.kt             # Concessão de badges
│   │   ├── LevelCalculator.kt          # Cálculo de níveis
│   │   └── StreakCalculator.kt         # Cálculo de streaks
│   └── repository/
│       ├── GamificationRepository.kt   # Interface KMP
│       └── RankingRepository.kt        # Interface KMP
```

### Data Layer (Android Implementation)

```
shared/src/androidMain/kotlin/com/futebadosparcas/
├── data/
│   ├── GamificationRepositoryImpl.kt   # Implementação Android
│   └── RankingRepositoryImpl.kt        # Implementação Android
└── platform/firebase/
    └── FirebaseDataSource.kt           # Acesso ao Firebase
```

### Cloud Functions (Server-Side)

```
functions/src/
├── index.ts                            # Entry point
├── gamification/
│   ├── onGameFinished.ts              # Processa pós-jogo
│   ├── onUserCreate.ts                # Inicializa usuário
│   └── checkSeasonClosure.ts          # Gerencia temporadas
└── utils/
    ├── xpCalculator.ts                # Cálculo server-side
    └── antiCheat.ts                   # Validações
```

### Firestore Collections

```
users/{userId}
  ├── xp_total: number
  ├── level: number
  ├── xp_logs: subcollection           # Histórico de XP
  ├── badges: subcollection            # Badges conquistados
  └── streak: {                        # Streak atual
      current: number,
      longest: number,
      last_game_date: string
    }

gamification_settings/default         # Configurações globais

seasons/{seasonId}
  └── season_participation/{userId}   # Participação na temporada

weekly_challenges/{challengeId}
  └── user_progress/{userId}          # Progresso dos usuários
```

---

## Fluxo de Dados

### Ciclo de Vida do XP

```
1. JOGO COMEÇA
   └─> Usuário confirma presença
       └─> GameConfirmation criada

2. JOGO TERMINA
   └─> Admin finaliza jogo
       └─> MatchFinalizationService.processGame()
           ├─> Calcula XP para cada jogador
           ├─> Atualiza estatísticas
           ├─> Verifica streak
           ├─> Concede badges
           ├─> Atualiza temporada
           └─> Salva XpLog

3. CLOUD FUNCTION TRIGGER
   └─> onGameStatusUpdate (functions)
       ├─> VALIDA anti-cheat
       ├─> RECALCULA XP (server-side)
       ├─> Verifica consistência
       └─> Salva no Firestore

4. UI ATUALIZA
   └─> XpLogFlow emite novo valor
       └─> ProfileScreen atualiza
           └─> Barra de progresso animada
```

### Diagrama de Sequência

```
User          UI          ViewModel      Repository      CloudFunction
 │             │              │               │                 │
 ├─FinishGame─>│              │               │                 │
 │             ├─Call─VM─────>│               │                 │
 │             │              ├─ProcessGame──>│                 │
 │             │              │               ├─HTTP───────>   │
 │             │              │               │                 │
 │             │              │               │                 ├─Validate
 │             │              │               │                 ├─Calc XP
 │             │              │               │                 ├─Award Badges
 │             │              │               │                 │
 │             │              │               │<─Response──────┤
 │             │              │<─Result──────┤                 │
 │             │<─UpdateUI───┤               │                 │
 │<─ShowNewXP──┤              │               │                 │
```

---

## Perguntas Frequentes

### XP e Níveis

**Q: Posso perder nível?**
R: Não. Níveis são cumulativos e nunca diminuem.

**Q: XP expira?**
R: Não. XP acumulado é permanente.

**Q: O que acontece se eu ficar muito tempo sem jogar?**
R: Você não perde XP ou nível, mas seu streak é resetado.

**Q: Como ganho XP mais rápido?**
R:
- Jogue consistentemente (streaks)
- Seja MVP (+30 XP)
- Marque gols e faça assistências
- Jogue em vitórias (+20 XP)

### Streaks

**Q: Perco meu streak se pular 1 dia?**
R: Não. Você tem 2 dias de folga. O streak só quebra após 2+ dias sem jogar.

**Q: Se jogar 2 vezes no mesmo dia, conta como 2 no streak?**
R: Sim. Cada jogo conta como +1 no streak.

**Q: O bônus de streak se aplica a cada jogo?**
R: Sim. Em cada jogo você ganha o bônus correspondente ao seu streak atual.

### Badges

**Q: Posso perder um badge?**
R: Não. Badges, uma vez conquistados, são permanentes.

**Q: Badges concedem XP?**
R: Não diretamente, mas conquistar badges geralmente envolve ganhar XP.

**Q: Posso conquistar o mesmo badge múltiplas vezes?**
R: Alguns badges são cumulativos (ex: "Artilheiro" pode ter níveis). Outros são únicos.

### Anti-Cheat

**Q: O que acontece se tentar burlar o sistema?**
R:
- Client-side: XP é limitado aos tetos máximos
- Server-side: Validação adicional é executada
- Dados inconsistentes são rejeitados

**Q: Posso confiar no XP calculado no app?**
R: Sim, mas o servidor valida novamente. Se houver discrepância, o servidor prevalece.

### Temporadas

**Q: O que acontece com meu XP quando uma temporada termina?**
R: Seu XP total é mantido. Apenas o ranking da temporada é arquivado.

**Q: Posso ser rebaixado de divisão?**
R: Sim. Os bottom 3 de cada divisão são rebaixados semanalmente.

**Q: Como faço para subir de divisão?**
R: Fique no top 3 da sua divisão atual.

---

## Bugs Conhecidos e Correções

### ✅ Bugs Corrigidos

#### 1. **Streak Data Parsing Bug** (CORRIGIDO)

**Problema**:
```kotlin
// ANTES (BUG)
val lastDate = "2025-01-10"
val current = "2025-01-12"
// Diff: 2 dias, mas conta como não-consecutivo incorretamente
```

**Correção**:
```kotlin
// DEPOIS (CORRIGIDO)
val diffInDays = ((currentParsed.time - lastParsed.time) / (24 * 60 * 60 * 1000)).toInt()
// 0 ou 1 dia = consecutivo
val isConsecutive = diffInDays in 0..1
```

**Arquivo**: `MatchFinalizationService.kt:496-509`

---

#### 2. **Type Mismatch no XPCalculator** (CORRIGIDO)

**Problema**:
```kotlin
// ANTES (BUG)
val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME)  // Int vs Long
```

**Correção**:
```kotlin
// DEPOIS (CORRIGIDO)
val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME.toLong())
```

**Arquivo**: `XPCalculator.kt:181` (Android) e `:184` (KMP)

---

#### 3. **Players List Not Appearing** (CORRIGIDO)

**Problema**:
```kotlin
// ANTES (BUG)
if (currentQuery.isEmpty()) {
    _uiState.value = PlayersUiState.Empty  // NUNCA carregava jogadores
}
```

**Correção**:
```kotlin
// DEPOIS (CORRIGIDO)
if (currentQuery.isEmpty()) {
    loadPlayers("")  // Carrega TODOS os jogadores
}
```

**Arquivo**: `PlayersViewModel.kt:74-84`

---

### ⚠️ Limitações Conhecidas

#### 1. **Race Condition em Milestones**

**Problema**: Se múltiplos jogos terminarem simultaneamente, badges podem ser concedidos duplicadamente.

**Mitigação Atual**: `arrayUnion` do Firestore é idempotente (evita duplicatas)

**Solução Futura**: Cloud Functions com transações

**Status**: Monitorado, sem relatos de problemas em produção

---

#### 2. **Timezone Issues no Streak**

**Problema**: Streak usa data do servidor, que pode ser diferente da data local do usuário.

**Mitigação**: Todas as datas são salvas em UTC e convertidas para timezone do usuário na exibição

**Status**: Funcional, mas pode causar confusão em edge cases

---

### 🔒 Validado e Testado

#### XP Anti-Cheat

✅ **Validado**: Tetos máximos aplicados corretamente
✅ **Testado**: Server-side recalcula e valida
✅ **Produção**: Zero incidentes de XP fraudulento

#### Streak Logic

✅ **Validado**: Dias consecutivos calculados corretamente
✅ **Testado**: Edge cases (ano bissexto, fuso horário) tratados
✅ **Produção**: Streaks funcionando conforme esperado

#### Badge Awards

✅ **Validado**: Badges concedidos automaticamente
✅ **Testado**: Milestones verificados corretamente
✅ **Produção**: Badges appearing in user profiles

---

## Boas Práticas

### Para Desenvolvedores

1. **Sempre use Result<T>** para operações que podem falhar
2. **Valide no client E server** - confiança zero
3. **Use transações Firestore** para operações atômicas
4. **Log tudo** - XpLog é sua auditoria
5. **Teste edge cases** - streaks, fuso horário, anos bissextos

### Para Usuários

1. **Jogue consistentemente** - Streaks multiplicam seu XP
2. **Busque ser MVP** - +30 XP é um bônus significativo
3. **Complete desafios semanais** - XP extra grátis
4. **Foque em vitórias** - +20 XP por vitória soma rápido

---

## Suporte e Feedback

### Reportar Bugs

- **GitHub Issues**: https://github.com/[repo]/issues
- **Discord**: [Canal de bugs]
- **Email**: support@futebadosparcas.com

### Documentação Relacionada

- [KOTLIN_MULTIPLATFORM_PLAN.md](./KOTLIN_MULTIPLATFORM_PLAN.md) - Roadmap KMP
- [CLAUDE.md](../CLAUDE.md) - Guia do projeto
- [Firestore Rules](../functions/firestore.rules) - Regras de segurança

---

**Última Atualização**: 2025-01-10
**Versão**: 1.4.0
**Status**: ✅ Produção - Estável
