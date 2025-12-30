# 📊 ESTRUTURA ESPERADA DO FIRESTORE

## Projeto: futebadosparcas

**ID do Projeto**: `futebadosparcas`
**Storage**: `futebadosparcas.firebasestorage.app`

---

## 🔥 ACESSO DA LLM

**IMPORTANTE**: A LLM tem acesso COMPLETO ao Firestore via Service Account:

- ✅ Leitura/escrita em todas as collections
- ✅ Execução de scripts Python/JavaScript
- ✅ Análise via `python scripts/analyze_simple.py`
- ✅ Verificação de duplicatas via `python scripts/check_dupes_simple.py`
- ✅ Enriquecimento de dados via scripts

**Credenciais**: `scripts/serviceAccountKey.json` (FULL ADMIN ACCESS)

---

## 🗂️ COLLECTIONS PRINCIPAIS

### 1. **users** (Usuários)

**Campos Obrigatórios:**

- `id` (string) - ID único do usuário
- `name` (string) - Nome completo
- `email` (string) - Email
- `role` (string) - "PLAYER" | "FIELD_OWNER" | "ADMIN"
- `created_at` (timestamp) - Data de criação

**Campos Opcionais:**

- `photo_url` (string) - URL da foto de perfil
- `phone` (string) - Telefone
- `preferred_positions` (array) - Posições preferidas
- `preferred_field_types` (array) - Tipos de campo preferidos
- `striker_rating` (number) - Avaliação como atacante (0-5)
- `mid_rating` (number) - Avaliação como meio-campo (0-5)
- `defender_rating` (number) - Avaliação como defensor (0-5)
- `gk_rating` (number) - Avaliação como goleiro (0-5)
- `isMock` (boolean) - Se é usuário de teste

**Índices Necessários:**

- `email` (único)
- `role`

---

### 2. **locations** (Locais/Estabelecimentos)

**Campos Obrigatórios:**

- `id` (string) - ID único do local
- `name` (string) - Nome do estabelecimento
- `address` (string) - Endereço completo
- `owner_id` (string) - ID do proprietário
- `created_at` (timestamp) - Data de criação

**Campos Opcionais:**

- `city` (string) - Cidade
- `state` (string) - Estado
- `neighborhood` (string) - Bairro
- `region` (string) - Região (Sul, Norte, etc)
- `latitude` (number) - Coordenada
- `longitude` (number) - Coordenada
- `place_id` (string) - ID do Google Places
- `is_verified` (boolean) - Se está verificado
- `is_active` (boolean) - Se está ativo
- `rating` (number) - Avaliação média (0-5)
- `rating_count` (number) - Quantidade de avaliações
- `description` (string) - Descrição
- `photo_url` (string) - URL da foto principal
- `amenities` (array) - Comodidades ["estacionamento", "vestiario", etc]
- `phone` (string) - Telefone
- `website` (string) - Site
- `instagram` (string) - Instagram
- `opening_time` (string) - Horário de abertura
- `closing_time` (string) - Horário de fechamento
- `operating_days` (array) - Dias de funcionamento [1,2,3,4,5,6,7]
- `min_game_duration_minutes` (number) - Duração mínima do jogo

**Índices Necessários:**

- `owner_id`
- `is_active`
- Composto: `is_active + neighborhood`

---

### 3. **fields** (Quadras/Campos)

**Campos Obrigatórios:**

- `id` (string) - ID único da quadra
- `location_id` (string) - ID do local pai
- `name` (string) - Nome da quadra
- `type` (string) - "SOCIETY" | "FUTSAL" | "CAMPO" | "AREIA" | "OUTROS"
- `hourly_price` (number) - Preço por hora

**Campos Opcionais:**

- `description` (string) - Descrição
- `photo_url` (string) - URL da foto principal
- `photos` (array) - Array de URLs de fotos
- `is_active` (boolean) - Se está ativa
- `surface` (string) - Tipo de superfície
- `is_covered` (boolean) - Se é coberta
- `dimensions` (string) - Dimensões (ex: "40x20m")

**Índices Necessários:**

- `location_id`
- Composto: `location_id + type`

**⚠️ PROBLEMA IDENTIFICADO:**

- Muitos locais têm **0 quadras** cadastradas
- Solução: Usar botão "⚽ Popular Quadras" no Developer Menu

---

### 4. **games** (Jogos)

**Campos Obrigatórios:**

- `id` (string) - ID único do jogo
- `location_id` (string) - ID do local
- `field_id` (string) - ID da quadra
- `owner_id` (string) - ID do organizador
- `date_time` (timestamp) - Data e hora do jogo
- `status` (string) - "SCHEDULED" | "CONFIRMED" | "LIVE" | "FINISHED" | "CANCELLED"
- `max_players` (number) - Máximo de jogadores
- `max_goalkeepers` (number) - Máximo de goleiros

**Campos Opcionais:**

- `description` (string) - Descrição
- `price_per_player` (number) - Preço por jogador
- `confirmation_count` (number) - Quantidade de confirmações
- `goalkeeper_count` (number) - Quantidade de goleiros confirmados
- `is_private` (boolean) - Se é privado
- `game_type` (string) - Tipo do jogo

**Índices Necessários:**

- `owner_id`
- `location_id`
- `status`
- Composto: `status + date_time`
- Composto: `location_id + date_time`

---

### 5. **confirmations** (Confirmações de Presença)

**Campos Obrigatórios:**

- `game_id` (string) - ID do jogo
- `user_id` (string) - ID do usuário
- `status` (string) - "CONFIRMED" | "MAYBE" | "DECLINED"
- `created_at` (timestamp) - Data de confirmação

**Campos Opcionais:**

- `is_goalkeeper` (boolean) - Se confirmou como goleiro
- `updated_at` (timestamp) - Última atualização

**Índices Necessários:**

- `game_id`
- `user_id`
- Composto: `game_id + user_id` (único)

---

### 6. **teams** (Times Sorteados)

**Campos Obrigatórios:**

- `game_id` (string) - ID do jogo
- `team_number` (number) - Número do time (1 ou 2)
- `players` (array) - Array de IDs de jogadores

**Campos Opcionais:**

- `created_at` (timestamp) - Data de criação
- `created_by` (string) - ID de quem criou

**Índices Necessários:**

- `game_id`

---

### 7. **statistics** (Estatísticas Globais)

**Campos Obrigatórios:**

- `user_id` (string) - ID do usuário (usado como document ID)
- `total_games` (number) - Total de jogos

**Campos Opcionais:**

- `total_goals` (number) - Total de gols
- `total_assists` (number) - Total de assistências
- `total_saves` (number) - Total de defesas
- `total_cards` (number) - Total de cartões
- `games_won` (number) - Jogos vencidos
- `games_lost` (number) - Jogos perdidos
- `games_drawn` (number) - Jogos empatados
- `updated_at` (timestamp) - Última atualização

**Índices Necessários:**

- Nenhum (user_id é o document ID)

---

### 8. **player_stats** (Estatísticas por Jogo)

**Campos Obrigatórios:**

- `game_id` (string) - ID do jogo
- `user_id` (string) - ID do usuário
- `team_number` (number) - Número do time

**Campos Opcionais:**

- `goals` (number) - Gols marcados
- `assists` (number) - Assistências
- `saves` (number) - Defesas (goleiro)
- `yellow_cards` (number) - Cartões amarelos
- `red_cards` (number) - Cartões vermelhos
- `mvp_votes` (number) - Votos para MVP

**Índices Necessários:**

- `game_id`
- `user_id`
- Composto: `game_id + user_id`

---

### 9. **live_games** (Jogos ao Vivo)

**Campos Obrigatórios:**

- `game_id` (string) - ID do jogo (usado como document ID)
- `status` (string) - "WAITING" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "FINISHED"
- `team1_score` (number) - Placar do time 1
- `team2_score` (number) - Placar do time 2

**Campos Opcionais:**

- `current_half` (number) - Tempo atual (1 ou 2)
- `started_at` (timestamp) - Início do jogo
- `finished_at` (timestamp) - Fim do jogo

**Sub-collection: events**

- `type` (string) - "GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION"
- `team_number` (number) - Time do evento
- `player_id` (string) - ID do jogador
- `minute` (number) - Minuto do evento
- `created_at` (timestamp) - Timestamp do evento

**Índices Necessários:**

- Nenhum (game_id é o document ID)

---

### 10. **notifications** (Notificações)

**Campos Obrigatórios:**

- `user_id` (string) - ID do usuário destinatário
- `type` (string) - Tipo da notificação
- `title` (string) - Título
- `message` (string) - Mensagem
- `created_at` (timestamp) - Data de criação

**Campos Opcionais:**

- `read` (boolean) - Se foi lida
- `read_at` (timestamp) - Quando foi lida
- `data` (map) - Dados adicionais
- `action_url` (string) - URL de ação

**Índices Necessários:**

- `user_id`
- Composto: `user_id + read`

---

## 🔐 REGRAS DE SEGURANÇA (firestore.rules)

### ✅ Validações Implementadas

1. **Autenticação obrigatória** para todas as operações
2. **Role-based access control**:
   - ADMIN: Acesso total
   - FIELD_OWNER: Gerencia seus locais e quadras
   - PLAYER: Acesso básico

3. **Proteção de campos**:
   - `owner_id` não pode ser alterado
   - `created_at` não pode ser alterado
   - `role` só pode ser alterado por ADMIN

4. **Validações específicas**:
   - Usuário só pode criar seu próprio perfil
   - Usuário só pode confirmar presença em seu nome
   - Apenas dono do jogo pode modificá-lo
   - Apenas dono do local pode criar/editar quadras

---

## 📈 ESTATÍSTICAS ESPERADAS

### Estrutura Saudável

```
✅ users: 10-50 documentos
✅ locations: 20-40 documentos
✅ fields: 40-120 documentos (2-4 por local)
✅ games: 50-200 documentos
✅ confirmations: 200-1000 documentos
✅ teams: 50-200 documentos
✅ statistics: 10-50 documentos
✅ player_stats: 200-1000 documentos
```

### ⚠️ Problemas Comuns

- **0 quadras**: Locais sem quadras cadastradas
- **Campos vazios**: Documentos sem campos obrigatórios
- **IDs vazios**: Documentos com ID em branco
- **Dados mock**: Muitos usuários/jogos de teste

---

## 🛠️ FERRAMENTAS DE ANÁLISE

### No App (Developer Menu)

1. **🔍 Analisar Estrutura do Firestore**
   - Gera relatório completo
   - Mostra estatísticas por collection
   - Identifica campos faltando
   - Detecta problemas

2. **⚽ Popular Quadras nos Locais**
   - Adiciona quadras de exemplo
   - Resolve problema de "0 quadras"
   - Cria 2-4 quadras por local

3. **Gerar Dados Históricos**
   - Cria usuários mock
   - Cria jogos passados
   - Gera estatísticas

---

## 📝 COMO USAR A ANÁLISE

1. Abra o app
2. Ative Developer Mode (7 taps no avatar)
3. Entre em "🔧 Developer Tools"
4. Clique em "🔍 Analisar Estrutura do Firestore"
5. Aguarde a mensagem de sucesso
6. Abra o **Logcat** no Android Studio
7. Filtre por tag: `FirestoreAnalysis`
8. Veja o relatório completo!

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Todas as 10 collections existem?
- [ ] Cada collection tem documentos?
- [ ] Campos obrigatórios estão presentes?
- [ ] Índices compostos estão criados?
- [ ] Regras de segurança estão ativas?
- [ ] Locais têm quadras cadastradas?
- [ ] Não há muitos dados mock?
- [ ] Timestamps estão corretos?
- [ ] IDs não estão vazios?
- [ ] Relacionamentos estão íntegros?

---

**Última atualização**: 27/12/2024
**Versão do Schema**: 1.0
