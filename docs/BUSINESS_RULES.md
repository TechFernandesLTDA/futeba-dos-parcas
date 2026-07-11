# 📋 Business Rules & Functional Logic - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [Sistema de Gamificação](#sistema-de-gamificação)
- [XP e Pontos](#xp-e-pontos)
- [Apadrinhamento e Primeiro Acesso](#apadrinhamento-e-primeiro-acesso)
- [Badges e Conquistas](#badges-e-conquistas)
- [Rankings e Ligas](#rankings-e-ligas)
- [Ciclo de Vida do Jogo](#ciclo-de-vida-do-jogo)
- [Funções e Permissões](#funções-e-permissões)
- [Dinâmica de Grupos](#dinâmica-de-grupos)
- [Restrições Críticas](#restrições-críticas)
- [Exemplos de Cálculos](#exemplos-de-cálculos)

---

## Visão Geral

**Futeba dos Parças** é uma plataforma de gamificação para gerenciar jogos de futsal/pelada com foco em:
- **Engajamento via XP**: Jogadores ganham experiência baseada em performance
- **Competição Saudável**: Rankings mensais/sazonais que resetam para manter equilíbrio
- **Comunidade**: Grupos de jogadores organizam jogos recorrentes
- **Transparência**: Votação pós-jogo para MVP e estatísticas

---

## Sistema de Gamificação

### Pilares da Gamificação

```
┌─────────────────────────────────────────┐
│     FUTEBA DOS PARÇAS GAMIFICATION      │
├─────────────────────────────────────────┤
│                                         │
│  XP System → Levels/Progress            │
│       ↓                                  │
│  Badges → Achievements Unlocked         │
│       ↓                                  │
│  Rankings → Seasonal Competition        │
│       ↓                                  │
│  Streaks → Consistency Rewards          │
│                                         │
└─────────────────────────────────────────┘
```

---

## XP e Pontos

### 1. Cálculo de XP por Jogo

Cada jogador ganha XP de múltiplas fontes durante um jogo:

| Componente | Valor | Condição | Código |
|------------|-------|----------|--------|
| **Presença Básica** | +10 XP | Sempre (por comparecer) | `functions/src/index.ts:calculateXP()` |
| **Gol** | +10 XP | Por gol marcado | `calculateXP()` |
| **Assistência** | +7 XP | Por assist registrado | `calculateXP()` |
| **Defesa/Bloqueio** | +8 XP | Por save (goleiro) | `calculateXP()` |
| **Clean Sheet** | +15 XP | Goleiro não leva gol | `calculateXP()` |
| **MVP** | +30 XP | Votado como melhor jogador | `calculateXP()` |
| **Bola Murcha** | −10 XP | Votado como pior jogador | `calculateXP()` |
| **Vitória do Time** | +20 XP | Se o time ganhou | `calculateXP()` |
| **Empate** | +10 XP | Resultado empatado | `calculateXP()` |
| **Streak 3** | +20 XP | Exatos 3 jogos consecutivos | `calculateXP()` |
| **Streak 5** | +35 XP | Exatos 5 jogos consecutivos | `calculateXP()` |
| **Streak 7** | +50 XP | Exatos 7 jogos consecutivos | `calculateXP()` |
| **Streak 10** | +100 XP | 10+ jogos consecutivos | `calculateXP()` |
| **Apadrinhamento** | +50 XP | Novo membro aceita convite e conclui cadastro | `functions/src/auth/invite-code.ts:onUserCreatedProcessInvite` |

> **Anti-cheat caps por jogo:** Gols ≤ 15, Assists ≤ 10, Saves ≤ 30, XP total máx +500 / mín −100. Apenas o tier de streak mais alto é aplicado. Fonte canônica: `shared/xp-constants.json`.

### 2. Exemplo Completo de Cálculo

**Cenário:** João Silva joga futsal em segundo lugar, marca 2 gols, faz 1 assist, seu time ganha 5-3, e ele é votado MVP. É seu 8º jogo consecutivo.

```
Base:           +10 XP  (presença)
2 gols:         +20 XP  (2 × 10)
1 assist:       +7  XP  (1 × 7)
MVP:            +30 XP  (votação)
Vitória:        +20 XP  (time ganhou)
Streak 7:       +50 XP  (tier de 7 consecutivos; é o mais alto aplicável)
────────────────────
TOTAL:          +137 XP
```

**Referência de Código:**
- `functions/src/index.ts:calculateXP()` - Implementação da função
- `functions/FUNCTIONS.md:Cálculo de XP` - Documentação detalhada

### 3. Regras de Streak

Um streak é uma sequência de jogos em que o jogador compareceu consecutivamente:

```
Jogo 1 ✓  → Streak = 1  (sem bônus)
Jogo 2 ✓  → Streak = 2  (sem bônus)
Jogo 3 ✓  → Streak = 3  (+20 XP bônus)  ⭐
Jogo 4 ✓  → Streak = 4  (+20 XP bônus)
Jogo 5 ✓  → Streak = 5  (+35 XP bônus)  ⭐⭐
Jogo 6 ✓  → Streak = 6  (+35 XP bônus)
Jogo 7 ✓  → Streak = 7  (+50 XP bônus)  ⭐⭐⭐
Jogo 8 ✓  → Streak = 8  (+50 XP bônus)
Jogo 9 ✗  → Streak = 0  (resetou)        ❌
Jogo 10 ✓ → Streak = 1  (recomeça)
```

> **Regra:** apenas o tier mais alto é aplicado por jogo. Ex.: streak = 10 → +100 XP (não soma os tiers anteriores).

**Ações que resetam o streak:**
- Não confirmar presença antes do jogo
- Não comparecer no jogo
- Rejeitar convite (se já tinha streak)

**Referência:** `backend/SERVICES.md:StatisticsService` - atualiza streaks

---

## Apadrinhamento e Primeiro Acesso

O primeiro acesso ao Futeba dos Parças é **somente por convite de outro membro**.

### Regras

- Todo novo perfil `users/{uid}` deve ser criado com `invited_by_code` válido.
- O código deve existir em `invite_codes/{code}`, estar ativo e pertencer a outro usuário.
- A validação pública do código é feita pela Cloud Function `validateInviteCode`, com rate limit por IP.
- O aceite é processado por `onUserCreatedProcessInvite`, que resolve o padrinho pelo `invite_code`.
- O padrinho recebe +50 XP e `invite_count +1` de forma server-side.
- O aceite fica registrado em `app_invite_redemptions/{uid}` com `invite_code`, `inviter_id`, `invited_user_id`, `accepted_at`, `xp_awarded` e `xp_log_id`.
- O bônus gera log imutável em `xp_logs/app_invite_<inviter>_<invited>`.

### Restrições de segurança

- Cliente não pode editar `invite_code`, `invite_count`, `invited_by`, `invited_by_code`, `invite_accepted_at` ou `invite_source`.
- Cadastro via Google sem convite é permitido apenas para usuários que já têm perfil; primeiro acesso sem convite encerra a sessão.
- Códigos legados em `users/{uid}.invite_code` são sincronizados para `invite_codes/{code}` quando validados ou quando o usuário abre a tela de convite.

---

## Badges e Conquistas

### Sistema de Badges

Badges são desbloqueados automaticamente quando certas condições são atingidas. Ao desbloquear, o jogador ganha XP extra + notificação.

| Badge | Nome | Condição | XP Reward | Categoria |
|-------|------|----------|-----------|-----------|
| `HAT_TRICK` | Hat Trick | 3+ gols em um único jogo | +50 XP | Performance |
| `PAREDAO` | Paredão | Clean sheet (0 gols levados) como goleiro | +40 XP | Defesa |
| `ARTILHEIRO_MES` | Artilheiro do Mês | Mais gols no mês que qualquer outro jogador | +100 XP | Mensal |
| `FOMINHA` | Fominha | 100% presença em um mês (5+ jogos) | +75 XP | Consistência |
| `STREAK_7` | Consistente | 7 jogos consecutivos | +60 XP | Streaks |
| `STREAK_30` | Lenda | 30 jogos consecutivos | +200 XP | Streaks |
| `MITO` | Mito | 500+ jogos all-time | +150 XP | Milestones |
| `MVP_5` | Astro | 5+ MVPs em um mês | +80 XP | Liderança |
| `TIME_PERFEITO` | Time Perfeito | Todos os 5 players do time com 2+ gols | +120 XP | Coletivo |
| `COMEBACK` | Virada | Time estava 3+ gols atrás e ganhou | +90 XP | Drama |

### Unlock Logic Flow

```
Jogo finalizado (status = FINISHED)
    ↓
Cloud Function onGameComplete triggered
    ↓
Calcular XP + validar badges
    ↓
Para cada badge desdesbloqueável:
    ├─ HAT_TRICK? (goals >= 3)
    ├─ PAREDAO? (position == GK && goals_against == 0)
    ├─ ARTILHEIRO_MES? (goals > prev_highest_month)
    ├─ ... (outros checks)
    ↓
Se novo badge:
    ├─ Criar doc em users/{userId}/badges
    ├─ Add XP reward
    ├─ Enviar notificação FCM
    ├─ Log analytics
    └─ Update UI em tempo real
```

**Referência de Código:**
- `functions/src/index.ts:checkBadges()` - Lógica de unlock
- `functions/FUNCTIONS.md:Verificação de Badges` - Documentação completa
- `app/MODULES.md:Badges Module` - Interface de badges na app

---

## Rankings e Ligas

### 1. Estrutura de Rankings

O sistema mantém 3 tipos de ranking simultaneamente:

```
┌─ GLOBAL RANKING ──────────────────────┐
│  All-time XP acumulado de cada jogador│
│  Pode aumentar indefinidamente        │
│  Usado para: Hall of fame, histórico  │
└───────────────────────────────────────┘
         ↓
┌─ SEASONAL RANKING ────────────────────┐
│  XP ganho naquela season (mês)        │
│  Reseta todo mês no primeiro dia      │
│  Usado para: Competição atual         │
├───────────────────────────────────────┤
│  Prêmios para Top 10:                 │
│  1º: 1000 XP extra   🥇               │
│  2º: 750 XP extra    🥈               │
│  3º: 500 XP extra    🥉               │
│  4-10º: 100-200 XP   ⭐               │
└───────────────────────────────────────┘
         ↓
┌─ SCHEDULE RANKING ────────────────────┐
│  Por cada horário recorrente           │
│  Ex: "Futsal Segunda 19h"              │
│  Reseta junto com season              │
│  Usado para: Competição local         │
└───────────────────────────────────────┘
```

### 2. Cálculo de Nível

O level é calculado baseado no XP total acumulado (global):

```
Level = f(XP Total)

Nível 1: 0 - 1.000 XP       (1.000 XP needed)
Nível 2: 1.000 - 3.000 XP   (2.000 XP needed)
Nível 3: 3.000 - 6.000 XP   (3.000 XP needed)
Nível 4: 6.000 - 10.000 XP  (4.000 XP needed)
Nível 5: 10.000 - 15.000 XP (5.000 XP needed)
...
Padrão: nível N requer (N × 1.000 XP) acumulativo

Fórmula: Cada nível requer +1000 XP a mais que o anterior
```

**Exemplo:**
```
João tem 8.500 XP total
├─ Level 1: precisa 1.000    (restante: 7.500)
├─ Level 2: precisa 2.000    (restante: 5.500)
├─ Level 3: precisa 3.000    (restante: 2.500)
└─ Level atual: 3 (com 2.500/4.000 XP para o próximo)
```

**Referência:** `functions/FUNCTIONS.md:Atualizar Ranking` - função `calculateLevel()`

### 3. Season e Ranking Reset

Uma **Season** dura exatamente um mês calendário:

| Propriedade | Valor | Detalhes |
|------------|-------|----------|
| **Duração** | 1 mês | De 1º a último dia do mês |
| **Frequência** | Mensal | Reseta no 1º de cada mês |
| **Timezone** | America/Sao_Paulo | Midnight TZ |
| **Horário Exato** | 00:00 (meia-noite) | 1º do mês |
| **Dados Resetados** | Season XP + Ranking | Global XP mantém |
| **Recompensas** | Top 10 | Distribuem-se automaticamente |

**Ciclo Automático (Cloud Function Scheduled):**

```
todo 1º de cada mês às 00:00 (America/Sao_Paulo)
    ↓
[onSeasonEnd function dispara]
    ↓
1. Buscar top 10 jogadores da season anterior
2. Distribuir recompensas (1º-10º lugar)
3. Criar novo documento Season
4. Resetar seasonal_xp para todos os jogadores
5. Notificar Top 10 dos prêmios
6. Log em analytics
```

**Referência:** `functions/src/index.ts:onSeasonEnd` - Implementação

---

## Ciclo de Vida do Jogo

### Estados do Jogo

Um jogo passa pelos seguintes estados até a finalização:

```
SCHEDULED → CONFIRMED → LIVE → FINISHED
```

| Estado | Descrição |
|--------|-----------|
| **SCHEDULED** | Jogo criado, aguardando confirmações de presença |
| **CONFIRMED** | Lista fechada, times gerados e balanceados |
| **LIVE** | Jogo em andamento; eventos registrados (gols, assists, saves, cards) |
| **FINISHED** | Placar final registrado, votação de MVP concluída, XP processado |

> **Nota:** O processamento de XP, badges e rankings ocorre automaticamente (via Cloud Function `onGameFinished`) quando o jogo entra em `FINISHED`. Não há estado `PROCESSED` separado no modelo canônico.

### Transições de Estado Detalhadas

```
┌─ SCHEDULED ───────────────────────────┐
│ trigger:                               │
│  - user.createGame(gameData)           │
│ validations:                           │
│  - date >= now + 2 hours?              │
│  - location exists?                    │
│  - max_players > current_players?      │
└──────────────┬──────────────────────────┘
               │
               ↓
    [Times gerados via IA]
               ↓
┌─ CONFIRMED ───────────────────────────┐
│ trigger:                               │
│  - organizer calls generateTeams()     │
│ data updated:                          │
│  - teams[]: [Team A, Team B]           │
│  - field_assignment: "Society #3"      │
└──────────────┬──────────────────────────┘
               │
               ↓
   [Jogo começa no horário agendado]
               ↓
┌─ LIVE ────────────────────────────────┐
│ trigger:                               │
│  - organizer calls startGame()         │
│ eventos registrados:                   │
│  - goals, assists, saves, red cards    │
│  - real-time score updates             │
│  - scorekeeper entries                 │
└──────────────┬──────────────────────────┘
               │
               ↓
    [Jogo termina, MVP votado]
               ↓
┌─ FINISHED ────────────────────────────┐
│ trigger:                               │
│  - organizer calls finalizeGame()      │
│ data required:                         │
│  - final_score: {team_a: X, team_b: Y}│
│  - stats[]: full game statistics       │
│  - mvp_votes: voting results           │
│ precondition:                          │
│  - status == LIVE                      │
│  - score is valid                      │
│  - all players confirmed present       │
│ auto-triggered:                        │
│  - onGameFinished() Cloud Function     │
│  - calculateXP() for each player       │
│  - checkBadges() for unlocks           │
│  - updateRanking() for leaderboard     │
│ result:                                │
│  - XP distributed ✓                    │
│  - Badges notified ✓                   │
│  - Stats finalized ✓                   │
│  - Ranking updated ✓                   │
└───────────────────────────────────────┘
```

**Referência de Código:**
- `functions/src/index.ts:onGameFinished` - processamento automático pós-jogo
- `app/MODULES.md:Games Module` - UI para cada estado

### Regras de Validação por Estado

| Estado | Pode Confirmar? | Pode Gerar Times? | Pode Iniciar? | Pode Finalizar? |
|--------|---|---|---|---|
| SCHEDULED | ✅ Sim | ❌ Não | ❌ Não | ❌ Não |
| CONFIRMED | ❌ Não | ❌ Não | ✅ Sim | ❌ Não |
| LIVE | ❌ Não | ❌ Não | ❌ Não | ✅ Sim |
| FINISHED | ❌ Não | ❌ Não | ❌ Não | ❌ Não |

---

## Funções e Permissões

### Tipos de Usuários

```
┌─ ADMIN (Desenvolvedor/Operador) ──────┐
│ Pode:                                  │
│  ✓ Criar/editar qualquer jogo          │
│  ✓ Ban permanente de jogadores         │
│  ✓ Modificar XP/badges manualmente     │
│  ✓ Reset de rankings                   │
│  ✓ Acessar logs de sistema             │
└────────────────────────────────────────┘

┌─ ORGANIZER (Dono do jogo/grupo) ──────┐
│ Pode (sobre o jogo/grupo que criou):   │
│  ✓ Criar jogos recorrentes             │
│  ✓ Editar detalhes (horário, local)    │
│  ✓ Gerar times automaticamente         │
│  ✓ Finalizar jogo e registrar score    │
│  ✓ Remover players específicos         │
│  ✓ Gerenciar convites                  │
│ Não pode:                              │
│  ✗ Ver dados de outro jogo             │
│  ✗ Modificar XP diretamente            │
│  ✗ Ban permanente (apenas remover)     │
└────────────────────────────────────────┘

┌─ PLAYER (Jogador regular) ─────────────┐
│ Pode:                                  │
│  ✓ Confirmar presença                  │
│  ✓ Ver próprios stats                  │
│  ✓ Votar no MVP                        │
│  ✓ Criar grupos/jogos                  │
│  ✓ Ver rankings públicos               │
│ Não pode:                              │
│  ✗ Editar jogo alheio                  │
│  ✗ Ver dados privados de outros        │
│  ✗ Ban permanente                      │
└────────────────────────────────────────┘
```

### Matriz de Permissões

| Ação | Admin | Organizador | Jogador |
|------|-------|----------|---------|
| Criar jogo | ✅ | ✅ (seu) | ✅ (seu) |
| Editar jogo | ✅ (qualquer) | ✅ (seu) | ❌ |
| Finalizar jogo | ✅ (qualquer) | ✅ (seu) | ❌ |
| Gerar times | ✅ (qualquer) | ✅ (seu) | ❌ |
| Confirmar presença | ✅ | ✅ | ✅ |
| Votar MVP | ✅ | ✅ | ✅ |
| Ver stats próprios | ✅ | ✅ | ✅ |
| Ver stats alheios | ✅ | ✅ | ✅ (público) |
| Modificar XP | ✅ | ❌ | ❌ |
| Ban permanente | ✅ | ❌ | ❌ |
| Remover de jogo | ✅ | ✅ (seu) | ❌ |
| Criar grupo | ✅ | ✅ | ✅ |
| Gerenciar grupo | ✅ | ✅ (seu) | ❌ |

**Referência:** `backend/CONTROLLERS.md` - todos os endpoints validam permissões

---

## Dinâmica de Grupos

### O que é um Grupo?

Um **Grupo** é um conjunto de jogadores que se organizam para jogar junto regularmente (ex: "Pelada de Segunda").

```
┌──────────────────────────────────┐
│ Futsal Segunda 19h (GRUPO)        │
├──────────────────────────────────┤
│ Owner: João Silva                │
│ Members: 12 jogadores            │
│ Localização padrão: Parque Mooca │
│ Frequência: Todo segundo         │
├──────────────────────────────────┤
│ Jogos Organizados: 47            │
│ Jogadores ativos: 8              │
│ Caixa do grupo: R$ 425           │
└──────────────────────────────────┘
```

### Ciclo de Vida do Grupo

```
1. CREATION
   ├─ Owner cria grupo
   ├─ Define nome, local padrão, frequência
   └─ Pode convidar jogadores iniciais

2. ACTIVE
   ├─ Owner organiza jogos
   ├─ Membros confirmam/desconfirmam
   ├─ Owner/admin gerencia caixa, mensalistas e baixas
   └─ Rankings específicos do grupo

3. INACTIVE (ou ARCHIVED)
   ├─ Sem jogos por 60+ dias
   ├─ Notificação para revigorar
   └─ Pode ser reativado

4. DELETED (raro)
   ├─ Owner deleta grupo
   ├─ Dados mantidos para histórico
   └─ Não pode criar novos jogos
```

### Convites e Acesso

| Tipo | Como Funciona | Quem Controla |
|------|---|---|
| **Convite Direto** | Owner adiciona player específico | Owner |
| **Link de Convite** | Qualquer link gerado pode entrar | Owner gera links |
| **Pedido de Acesso** | Player pede, Owner aprova | Owner |
| **Público** | Qualquer usuário pode entrar | Sistema (sim/não) |

### Caixa do Grupo (Cashbox)

O caixa é um ledger realizado de receitas e despesas. Somente owner/admin ativo
movimenta ou estorna; o cliente usa Cloud Functions e nunca escreve diretamente
em `cashbox` ou `cashbox_summary`. Cada operação valida a intenção completa,
usa valor inteiro em centavos e atualiza entrada, resumo e marcador idempotente
na mesma transação.

O financeiro mensal é um domínio complementar:

- o owner/admin escolhe um subconjunto dos membros ativos como mensalistas;
- o custo pode ser um contrato mensal fixo ou a soma das ocorrências;
- meses com três, quatro ou cinco jogos e exceções de feriado usam um snapshot
  explícito da agenda;
- o rateio distribui todos os centavos sem perda e não inclui jogadores avulsos;
- uma baixa cria a receita correspondente no caixa e fecha o snapshot contra
  alterações retroativas;
- o estorno reabre pagador e período junto com o ledger.

Contrato, estados e fluxo operacional: [`MONTHLY_FINANCE.md`](MONTHLY_FINANCE.md).

---

## Restrições Críticas

### 1. Integridade de Dados

```yaml
Match Results:
  - ✅ Imutável após status = FINISHED
  - Não pode: deletar, editar stats
  - Pode: Revisar em caso de erro administrativo (admin only)
  - Log completo mantido para auditoria

User Data:
  - XP: Apenas pode aumentar (via Cloud Functions)
  - Stats: Aggregate calculado a partir de matches finalizados
  - Badges: Unlock é permanente (nunca remove)
```

### 2. Validações de Jogo

Antes de permitir qualquer transição, validar:

```javascript
// Ao criar jogo
validate: {
  date: date >= now + 2 hours,          // Mínimo 2h de antecedência
  location_id: exists in locations,     // Local válido
  field_id: exists in location.fields,  // Campo existe
  max_players: > 4 && < 100,            // Limite sensato
  price_per_player: >= 0,               // Não pode ser negativo
}

// Ao gerar times
validate: {
  confirmed_count: >= min_players,      // Mínimo 5 para futsal
  all_present: marked as checked-in,    // Todos confirmaram
  levels_exist: all players have nivel  // Dados de nível
}

// Ao finalizar jogo
validate: {
  final_score: {
    team_a: number >= 0,
    team_b: number >= 0,
    either: >= 0 goals               // Ambos válidos
  },
  stats_complete: all players have stats,
  mvp_voted: votes received,
  time_limit: <= 4 hours since LIVE,    // Não pode finalizar depois
}
```

### 3. Regras de Consistência

| Regra | Enforcement | Nível |
|------|---|---|
| Um player não pode estar em 2 times no mesmo jogo | Database unique constraint | CRÍTICA |
| MVP deve ser um player que jogou | Cloud Function validation | CRÍTICA |
| XP total não é modificado diretamente pelo cliente | Cloud Function invariant | CRÍTICA |
| Badges nunca são removidas | Firestore rule | CRÍTICA |
| Season XP reseta todo mês | Cloud Scheduled Function | ALTA |
| Streak reseta se faltar um jogo | Batch update weekly | ALTA |
| Ranking é read-only (calculado) | Firestore rule | ALTA |

### 4. Offline-First (Quando Aplicável)

```
Jogo CRIADO:
  - Tenta sync com backend
  - Se falhar: salva localmente, retry automático
  - Pode confirmar presença offline

Jogo FINALIZADO:
  - DEVE syncronizar com backend
  - Não pode finalizar sem conexão
  - Dados salvos em buffer até sync
  - Se falhar: permanecer em LIVE, retry periódico
```

---

## Exemplos de Cálculos

### Exemplo 1: Jogo Casual de Segunda (5v5)

**Contexto:**
- Jogo: Futsal Segunda 19h
- Duração: 40 minutos
- Placar: Time A 4 - 2 Time B
- 10 jogadores, 1 árbitro (sem contar)

**Lineup:**

```
TIME A (Ganhou)          | TIME B (Perdeu)
───────────────────────────────────────────
João (GK) - 0 goals     | Pedro (GK) - 0 goals
| 0 saves, 2 goals_vs  | | 3 saves, 4 goals_vs
─                        ─
Ana - 2 goals            | Carlos - 1 goal
| 0 assists             | | 1 assist
─                        ─
Marco - 1 goal           | Lucia - 1 goal
| 1 assist              | | 0 assists
─                        ─
Lucas - 1 goal           | Felipe - 0 goals
| 1 assist              | | 0 assists
─                        ─
Renata - 0 goals         | Nina - 0 goals
| 0 assists             | | 0 assists
─                        ─

MVP Votado: Ana (2 gols, jogou bem)
```

**Cálculo de XP:**

```
JOÃO (GK, Time A vencedor, Streak=15)
  Base:       +10  (presença)
  Saves:      +24  (3 saves × 8)
  Defesa:     +0   (não clean sheet — levou 2)
  Vitória:    +20  (time ganhou)
  Streak 10+: +100 (tier mais alto: streak >= 10)
  ──────
  TOTAL:      +154 XP

ANA (Atacante, MVP, Time A, Streak=5)
  Base:       +10  (presença)
  Gols:       +20  (2 gols × 10)
  Assists:    +0
  MVP:        +30  (votado)
  Vitória:    +20  (time ganhou)
  Streak 5:   +35  (tier de 5 consecutivos)
  Badges:     +0   HAT_TRICK (não — só 2 gols; requer 3)
  ──────
  TOTAL:      +115 XP

CARLOS (Atacante, Time B, Streak=2)
  Base:       +10  (presença)
  Gols:       +10  (1 gol × 10)
  Assists:    +7   (1 assist × 7)
  MVP:        +0   (não votado)
  Vitória:    +0   (perdeu)
  Streak 2:   +0   (sem bônus)
  ──────
  TOTAL:      +27 XP

PEDRO (GK, Time B, Streak=1)
  Base:       +10  (presença)
  Saves:      +24  (3 saves × 8)
  Defesa:     +0   (não clean sheet — levou 4)
  Vitória:    +0   (perdeu)
  Streak 1:   +0
  ──────
  TOTAL:      +34 XP

[Outros 6 jogadores: média +20-35 XP cada]
```

**Badges Desbloqueadas:**
- João: `PAREDAO`? Não (2 goals against)
- Ana: `HAT_TRICK`? Não (2 goals)
- Carlos: nenhum
- Total badges: 0

**Atualização de Rankings Após Jogo:**

```
GLOBAL XP (all-time):
  João:  1245 → 1399 XP (+154)
  Ana:   3890 → 4005 XP (+115)
  Carlos: 524 → 551 XP (+27)
  Pedro:  892 → 926 XP (+34)

SEASONAL XP (dezembro):
  João:  128 → 282 XP (+154)
  Ana:   425 → 540 XP (+115)
  Carlos: 180 → 207 XP (+27)
  Pedro:  75 → 109 XP (+34)
```

### Exemplo 2: Season End - Distribuição de Prêmios

**Contexto:**
- Season: Dezembro 2025
- Últimos 30 dias completados
- 47 jogos foram finalizados
- 32 jogadores participaram

**Top 10 Rankings (Seasonal XP - Dezembro):**

```
#  Nome          XP Dec   Gols   MVPs   Presença  Prêmio
──────────────────────────────────────────────────────────
1  Ana Silva     2450     28     8      95%      +1000 XP 🥇
2  João Santos   2180     22     5      88%      +750 XP 🥈
3  Marco Costa   1950     19     4      91%      +500 XP 🥉
4  Lucia Alves   1820     16     3      85%      +200 XP
5  Carlos Souza  1750     14     2      82%      +200 XP
6  Pedro Gomes   1620     12     1      78%      +150 XP
7  Nina Oliveira 1510     10     0      75%      +150 XP
8  Renata Lima   1420     8      0      72%      +100 XP
9  Felipe Dias   1380     7      0      68%      +100 XP
10 Patricia Reis 1250     5      0      65%      +100 XP
```

**O que acontece automaticamente (Cloud Function onSeasonEnd):**

```
1. Buscar TOP 10 de dezembro de 2025
2. Para cada jogador:
   ├─ Adicionar prêmio ao XP global
   ├─ Criar badge "CHAMPION_DEC_2025"
   ├─ Enviar notificação FCM
   └─ Log em analytics

3. Criar novo documento:
   seasons/2026_janeiro = {
     startDate: 2026-01-01,
     endDate: 2026-01-31,
     active: true
   }

4. Para TODOS os jogadores:
   ├─ Resetar seasonal_xp → 0
   ├─ Resetar seasonal_stats → {}
   └─ Manter global_xp (nunca reseta)

5. Notificar admin
```

**Resultado Após Season End:**

```
ANA SILVA (1º lugar):
  XP Global: 15450 + 1000 = 16450 XP
  XP Seasonal (Jan): 0 (reset)
  Level: 3 → 4 (precisa 10000)
  Badges: +CHAMPION_DEC_2025
  Notificação: "🏆 Parabéns! Você ficou em 1º lugar em dezembro!"

JOÃO SANTOS (2º lugar):
  XP Global: 13820 + 750 = 14570 XP
  Level: mantém 3 (precisa 15000)
  Badges: +CHAMPION_DEC_2025
```

---

## Veja Também

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Design patterns e data flows
- [API_REFERENCE.md](./API_REFERENCE.md) - Endpoints que implementam essas regras
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Estruturas que armazenam esses dados
- [backend/SERVICES.md](../backend/SERVICES.md) - Implementação das regras de negócio
- [functions/FUNCTIONS.md](../functions/FUNCTIONS.md) - Cloud Functions que processam XP/badges
- [app/MODULES.md](../app/MODULES.md) - UI que reflete essas regras

---

**Última atualização:** Junho 2026
**Versão:** 2.1 (XP canônico corrigido: Gol +10, Assist +7, Save +8, MVP +30; streaks 3/5/7/10; 4 estados de jogo)
