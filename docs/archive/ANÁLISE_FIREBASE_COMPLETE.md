# Análise Completa do Projeto Futeba dos Parças - Firestore e Segurança

## 📊 SUMÁRIO EXECUTIVO

Esta análise detalha a estrutura de queries, segurança e banco de dados do projeto Futeba dos Parças. Foram identificadas múltiplas oportunidades de otimização de performance e segurança.

---

## 1. 🔥 FIREBASE QUERIES ANALISADAS

### Coleções Principais Encontradas:

| Coleção | Descrição | Queries Encontradas |
|---------|-----------|-------------------|
| games | Jogos e eventos | 20+ queries |
| groups | Grupos de pelada | 15+ queries |
| users | Perfis de usuários | 10+ queries |
| confirmations | Confirmações de jogadores | 8+ queries |
| statistics | Estatísticas de jogadores | 5+ queries |
| xp_logs | Histórico de XP | 3+ queries |
| locations | Locais de jogo | 6+ queries |
| cashbox | Controle financeiro | 10+ queries |
| notifications | Notificações | 8+ queries |
| user_badges | Badges de jogadores | 4+ queries |
| season_participation | Participação em ligas | 4+ queries |
| fields | Quadras/ Campos | 5+ queries |
| live_scores | Placar ao vivo | 3+ queries |
| game_events | Eventos do jogo | 4+ queries |
| live_player_stats | Stats ao vivo | 3+ queries |
| game_requests | Solicitações de jogos | 4+ queries |
| activities | Feed de atividades | 4+ queries |
| seasons | Temporadas | 2+ queries |
| user_streaks | Sequências | 2+ queries |
| ranking_deltas | Deltas de ranking | 4+ queries |
| challenges | Desafios | 1+ queries |
| challenge_progress | Progresso de desafios | 2+ queries |
| team_summons | Convites de times | 1+ queries |

### Principais Padrões de Query:

#### Games Collection
- .orderBy('dateTime', DESC)
- .limit(limit)
- .where('status', ASC)
- .where('location_id', ASC)
- .where('owner_id', ASC)
- .whereIn(FieldPath.documentId(), chunk) - Batch de até 10

#### Groups Collection
- .orderBy('created_at', DESC)
- .orderBy('name')
- .orderBy('reference_date', DESC)
- .orderBy('joined_at', DESC)

#### Users Collection
- .orderBy('name')
- .whereIn(FieldPath.documentId(), chunk) - Batch queries

---

## 2. 🛡️ SECURITY RULES ANALYSIS

### ✅ Pontos Fortes:
1. Funções bem definidas: isAdmin(), isOwner(), isGroupMember()
2. Matriz de permissões clara: Documentada no topo das regras
3. Validação de campos: onlyAllowedFields() e fieldUnchanged()
4. Subcoleções protegidas: members, cashbox dentro de groups

### ⚠️ Problemas de Segurança Encontrados:

#### **P1 - Exposição de Dados Sensíveis na Coleção 'users'**
- Linha 115: Permite leitura de qualquer usuário autenticado
- Risco: Dados pessoais podem ser acessados por qualquer usuário logado
- Recomendação: Restringir leitura ao próprio usuário ou dados públicos

#### **P2 - Atualização de XP via Client-Side**
- Linhas 138-157: Permite atualização de XP em certas condições
- Risco: Manipulação de pontos XP direta
- Recomendação: Forçar exclusivamente via Cloud Functions

#### **P3 - Validação de Documentos Relacionados**
- Linha 697: Valida documento de games sem verificar ownership
- Risco: Pode permitir acesso a jogos não pertencentes ao usuário
- Recomendação: Verificar isGameOwner(gameId)

---

## 3. 🗃️ DATABASE SCHEMA ANALYSIS

### Estrutura Hierárquica:
users/
├── groups/{groupId}
├── upcoming_games/{gameId}
└── game_templates/{templateId}

groups/
├── members/{memberId}
├── cashbox/{entryId}
└── cashbox_summary/{docId}

games/
├── teams/{teamId}
├── confirmations/{confirmationId}
├── live_events/{eventId}
└── player_stats/{statId}

locations/
└── fields/{fieldId}

seasons/
└── season_participation/{partId}

### Consistências:
✅ Nomes de coleções consistentes
✅ Hierarquia clara
✅ Subcoleções bem organizadas

### Inconsistências Encontradas:
❌ Mix de nomenclatura:
- dateTime vs date_time
- created_at vs createdAt
- user_id vs userId

❌ Coleções sem índice composto:
- activities sem índice para user_id + created_at
- player_stats sem índice para game_id + team_id
- notifications sem índice para user_id + type

---

## 4. 📋 INDEXES ANALYSIS

### ✅ Índices Existentes (firestore.indexes.json):
- Games: 19 índices compostos
- Cashbox: 8 índices
- Notifications: 4 índices
- Season_participation: 6 índices
- Ranking_deltas: 8 índices

### ❌ Índices Faltando:

| Coleção | Query | Índice Necessário |
|---------|-------|-------------------|
| users | .orderBy('name') | name ASCENDING |
| activities | .orderBy('created_at').limit(limit) | created_at DESCENDING |
| player_stats | .where('group_id').where('player_id') | group_id ASCENDING, player_id ASCENDING |
| notifications | .where('user_id').where('type') | user_id ASCENDING, type ASCENDING |
| live_scores | .limit(500) | __name__ DESCENDING |
| game_events | .where('game_id').where('minute') | game_id ASCENDING, minute ASCENDING |
| fields | .where('location_id').where('type') | location_id ASCENDING, type ASCENDING |

---

## 5. 📊 TABELA: QUERIES → ÍNDICES NECESSÁRIOS

| Coleção | Query Pattern | Índice Necessário | Prioridade |
|---------|---------------|-------------------|------------|
| games | status + dateTime DESC | ✅ Existe | Alta |
| games | location_id + dateTime DESC | ✅ Existe | Alta |
| games | owner_id + status + dateTime DESC | ✅ Existe | Alta |
| games | group_id + status + dateTime DESC | ❌ Faltando | Alta |
| groups | status + created_at DESC | ✅ Existe | Média |
| users | name ASCENDING | ❌ Faltando | Média |
| notifications | user_id + created_at DESC | ✅ Existe | Alta |
| notifications | user_id + type + created_at DESC | ❌ Faltando | Alta |
| cashbox | status + type + created_at DESC | ✅ Existe | Alta |
| xp_logs | user_id + created_at DESC | ✅ Existe | Alta |
| statistics | group_id + player_id | ❌ Faltando | Média |
| player_stats | game_id + team_id + user_id | ❌ Faltando | Média |
| fields | location_id + type ASC | ❌ Faltando | Média |
| activities | user_id + created_at DESC | ❌ Faltando | Média |
| season_participation | season_id + group_id + league_rating | ❌ Faltando | Média |
| live_scores | __name__ DESC | ❌ Faltando | Baixa |

---

## 6. 🔧 RECOMENDAÇÕES

### Performance (Prioridade Alta):
1. Adicionar índices faltando especialmente para queries com filtros compostos
2. Implementar cursor-based pagination para listas grandes
3. Otimizar queries com .limit(500) que carregam muitos dados
4. Unificar nomenclatura de campos (timestamp vs date_time)

### Segurança (Prioridade Alta):
1. Restringir leitura de users para apenas próprio usuário ou campos públicos
2. Forçar atualizações de XP exclusivamente via Cloud Functions
3. Adicionar validação de ownership em todas as queries relativas
4. Implementar rate limiting nas críticas create/update

### Consistência (Prioridade Média):
1. Padronizar nomenclatura de campos em todas as coleções
2. Documentar schema completo com diagramas
3. Criar testes de segurança para regras do Firestore
4. Implementar dry-run para Cloud Functions

---

## 7. 📈 CONCLUSÃO

O projeto tem uma arquitetura bem estruturada com:
✅ Segurança robusta com matrix de permissões
✅ Cloud Functions para lógica crítica
✅ Índices compostos para principais queries
⚠️ Necessidade de otimização performance
⚠️ Problemas de nomenclatura inconsistente
⚠️ Alguns riscos de segurança a serem endereçados

Próximos passos recomendados:
1. Implementar todos os índices faltantes
2. Corrigir vulnerabilidades de segurança identificadas
3. Padronizar nomes de campos
4. Implementar melhorias de performance
