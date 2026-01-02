# 🗄️ Database Schema - Futeba dos Parças

## Índice
- [Diagrama ER](#diagrama-er)
- [Tabelas Principais](#tabelas-principais)
- [Tabelas de Relacionamento](#tabelas-de-relacionamento)
- [Tabelas de Gamificação](#tabelas-de-gamificação)
- [Índices Importantes](#índices-importantes)
- [Migrations](#migrations)
- [Veja Também](#veja-também)

---

## Diagrama ER

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │    USERS     │         │  LOCATIONS   │                     │
│  ├──────────────┤         ├──────────────┤                     │
│  │ id (PK)      │         │ id (PK)      │                     │
│  │ email        │         │ name         │                     │
│  │ name         │         │ address      │                     │
│  │ level        │         │ city, state  │                     │
│  │ xp           │         │ latitude     │                     │
│  │ phone        │         │ longitude    │                     │
│  │ fcm_token    │         │ created_at   │                     │
│  └──────┬───────┘         └───────┬──────┘                     │
│         │                         │                            │
│         │                    1:N  │                            │
│         │                         ▼                            │
│         │         ┌─────────────────────────┐                 │
│         │         │  FIELDS (Quadras)       │                 │
│         │         ├─────────────────────────┤                 │
│         │         │ id (PK)                 │                 │
│         │         │ location_id (FK)        │                 │
│         │         │ name                    │                 │
│         │         │ type (SOCIETY/CAMPO)    │                 │
│         │         └──────────┬──────────────┘                 │
│         │                    │                                │
│         │               1:N  │                                │
│         │                    ▼                                │
│         │         ┌─────────────────────────┐                 │
│         │         │  SCHEDULES (Horários)   │                 │
│         │         ├─────────────────────────┤                 │
│         │         │ id (PK)                 │                 │
│         │         │ field_id (FK)           │                 │
│         │    1:N  │ owner_id (FK) → USERS   │                 │
│         ├────────►│ recurrence_type         │                 │
│         │         │ time, duration          │                 │
│         │         │ max_players             │                 │
│         │         │ daily_price             │                 │
│         │         └──────────┬──────────────┘                 │
│         │                    │                                │
│         │               1:N  │                                │
│         │                    ▼                                │
│         │         ┌─────────────────────────┐                 │
│         │         │  GAMES (Partidas)       │                 │
│         │         ├─────────────────────────┤                 │
│         │         │ id (PK)                 │                 │
│         │         │ schedule_id (FK)        │                 │
│         │         │ date, time              │                 │
│         │         │ status (SCHEDULED/...) │                 │
│         │         │ max_players             │                 │
│         │         └──────────┬──────────────┘                 │
│         │                    │                                │
│         │          1:N ┌─────┴─────────┐                      │
│         │             │               │                      │
│         │             ▼               ▼                      │
│         │    ┌─────────────────┐ ┌──────────────────┐       │
│         │    │ GAME_CONFIRM.   │ │ TEAMS            │       │
│         │    ├─────────────────┤ ├──────────────────┤       │
│         │    │ id (PK)         │ │ id (PK)          │       │
│         ├───►│ user_id (FK)    │ │ game_id (FK)     │       │
│         │    │ game_id (FK)    │ │ name, color      │       │
│         │    │ position        │ └────────┬─────────┘       │
│         │    │ status          │          │                 │
│         │    │ confirmed_at    │     1:N  │                 │
│         │    └─────────────────┘          │                 │
│         │                                 ▼                 │
│         │                    ┌──────────────────────────┐   │
│         │                    │ TEAM_PLAYERS             │   │
│         │                    ├──────────────────────────┤   │
│         │                    │ id (PK)                  │   │
│         │                    │ team_id (FK)             │   │
│         ├───────────────────►│ user_id (FK)             │   │
│         │                    │ position                 │   │
│         │                    └──────────────────────────┘   │
│         │                                                   │
│         │         ┌─────────────────────────┐              │
│         │         │  GAME_STATS             │              │
│         │         ├─────────────────────────┤              │
│         └────────►│ user_id (FK) → USERS    │              │
│                   │ game_id (FK) → GAMES    │              │
│                   │ goals, assists, saves   │              │
│                   │ is_mvp, best_goal       │              │
│                   └─────────────────────────┘              │
│                                                             │
│  ┌──────────────────────────┐                             │
│  │  USER_STATISTICS         │                             │
│  ├──────────────────────────┤                             │
│  │ id (PK)                  │                             │
│  │ user_id (FK)             │                             │
│  │ schedule_id (FK)         │                             │
│  │ total_games              │                             │
│  │ total_goals, saves       │                             │
│  │ best_player_count        │                             │
│  │ presence_rate            │                             │
│  └──────────────────────────┘                             │
│                                                             │
│  ┌──────────────────────────┐                             │
│  │  BADGES                  │                             │
│  ├──────────────────────────┤                             │
│  │ id (PK)                  │                             │
│  │ type (HAT_TRICK, etc)    │                             │
│  │ name, description        │                             │
│  │ icon_url                 │                             │
│  │ xp_reward                │                             │
│  └──────────────────────────┘                             │
│           ▲                                                 │
│      1:N  │                                                 │
│           │                                                 │
│  ┌────────┴─────────────┐                                 │
│  │  USER_BADGES         │                                 │
│  ├──────────────────────┤                                 │
│  │ id (PK)              │                                 │
│  │ user_id (FK)         │                                 │
│  │ badge_id (FK)        │                                 │
│  │ unlocked_at          │                                 │
│  └──────────────────────┘                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tabelas Principais

### USERS (Usuários)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    photo_url TEXT,
    preferred_field_type ENUM('SOCIETY', 'CAMPO', 'FUTEBOL') DEFAULT 'SOCIETY',
    is_searchable BOOLEAN DEFAULT true,
    fcm_token VARCHAR(255),
    level INT DEFAULT 1,
    xp INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

**Descrição:**
- Armazena dados de usuários/jogadores
- `level`: Nível calculado a partir de XP
- `xp`: Pontos de experiência acumulados
- `fcm_token`: Token Firebase para push notifications

---

### LOCATIONS (Locais)

```sql
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_locations_city_state ON locations(city, state);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude);
```

**Descrição:**
- Armazena endereços de campos/locais
- `latitude`, `longitude`: Para busca por geolocalização
- Um local pode ter múltiplas quadras

---

### FIELDS (Quadras)

```sql
CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type ENUM('SOCIETY', 'CAMPO', 'FUTEBOL') NOT NULL,
    description TEXT,
    photo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fields_location_id ON fields(location_id);
CREATE INDEX idx_fields_type ON fields(type);
```

**Descrição:**
- Representa quadras individuais dentro de um local
- `type`: Tipo de campo (society, campo, futebol)
- Múltiplas quadras podem estar no mesmo local

---

### SCHEDULES (Horários Recorrentes)

```sql
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    recurrence_type ENUM('DAILY', 'WEEKLY', 'CUSTOM') NOT NULL,
    recurrence_config JSONB NOT NULL, -- {"days": ["MONDAY", "WEDNESDAY"], "interval": 1}
    time TIME NOT NULL,
    duration INT NOT NULL, -- em minutos
    is_public BOOLEAN DEFAULT false,
    max_players INT,
    daily_price DECIMAL(10, 2),
    monthly_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_field_id ON schedules(field_id);
CREATE INDEX idx_schedules_owner_id ON schedules(owner_id);
CREATE INDEX idx_schedules_created_at ON schedules(created_at DESC);
```

**Descrição:**
- Define horários recorrentes de jogos
- `recurrence_config`: JSON com configuração de recorrência
- GameGeneratorService usa isto para criar Games automaticamente
- Owner é quem criou o horário (geralmente dono da quadra)

---

### GAMES (Partidas)

```sql
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    status ENUM('SCHEDULED', 'CONFIRMED', 'FINISHED', 'CANCELLED') DEFAULT 'SCHEDULED',
    max_players INT,
    daily_price DECIMAL(10, 2),
    confirmation_closes_at TIMESTAMP,
    number_of_teams INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_date_time ON games(date DESC, time DESC);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
```

**Descrição:**
- Representa partidas individuais
- `status`: Fluxo: SCHEDULED → CONFIRMED → FINISHED
- `confirmation_closes_at`: Quando as confirmações são fechadas
- GameGeneratorService cria automaticamente a partir de SCHEDULES

---

### GAME_CONFIRMATIONS (Confirmações de Jogadores)

```sql
CREATE TABLE game_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position ENUM('FIELD', 'GOALKEEPER') NOT NULL,
    status ENUM('CONFIRMED', 'CANCELLED', 'PENDING', 'WAITLIST') DEFAULT 'CONFIRMED',
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_confirmation UNIQUE(game_id, user_id)
);

CREATE INDEX idx_game_confirmations_game_id ON game_confirmations(game_id);
CREATE INDEX idx_game_confirmations_user_id ON game_confirmations(user_id);
CREATE INDEX idx_game_confirmations_status ON game_confirmations(status);
```

**Descrição:**
- Registra confirmações de jogadores em jogos
- `position`: Campo ou goleiro
- `status`: Confirmado, pendente, na lista de espera, cancelado
- UNIQUE garante um jogador por jogo

---

### TEAMS (Times)

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7), -- Hex color code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teams_game_id ON teams(game_id);
```

**Descrição:**
- Representa times para uma partida
- Criado automaticamente quando confirmações são fechadas
- TeamBalancerService gera times usando algoritmo AI

---

### TEAM_PLAYERS (Jogadores do Time)

```sql
CREATE TABLE team_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position ENUM('FIELD', 'GOALKEEPER') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_team_player UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_players_team_id ON team_players(team_id);
CREATE INDEX idx_team_players_user_id ON team_players(user_id);
```

**Descrição:**
- Mapeia jogadores para times
- UNIQUE garante um jogador por time

---

### GAME_STATS (Estatísticas de Jogo)

```sql
CREATE TABLE game_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goals INT DEFAULT 0,
    assists INT DEFAULT 0,
    saves INT DEFAULT 0,
    cards INT DEFAULT 0,
    is_mvp BOOLEAN DEFAULT false,
    best_goal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_stat UNIQUE(game_id, user_id)
);

CREATE INDEX idx_game_stats_game_id ON game_stats(game_id);
CREATE INDEX idx_game_stats_user_id ON game_stats(user_id);
CREATE INDEX idx_game_stats_is_mvp ON game_stats(is_mvp);
```

**Descrição:**
- Armazena estatísticas de um jogador em um jogo
- Salvo após o jogo ser finalizado
- Cloud Functions processa isto para calcular XP

---

### USER_STATISTICS (Estatísticas Agregadas)

```sql
CREATE TABLE user_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    total_games INT DEFAULT 0,
    total_goals INT DEFAULT 0,
    total_saves INT DEFAULT 0,
    best_player_count INT DEFAULT 0,
    worst_player_count INT DEFAULT 0,
    best_goal_count INT DEFAULT 0,
    presence_rate DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_schedule UNIQUE(user_id, schedule_id)
);

CREATE INDEX idx_user_stats_user_id ON user_statistics(user_id);
CREATE INDEX idx_user_stats_schedule_id ON user_statistics(schedule_id);
```

**Descrição:**
- Cache pré-calculado de estatísticas de jogador
- Atualizado por StatisticsService após cada jogo
- Suporta stats globais (schedule_id = NULL) e por-schedule

---

## Tabelas de Gamificação

### BADGES (Conquistas)

```sql
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) UNIQUE NOT NULL, -- HAT_TRICK, PAREDAO, etc
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url TEXT,
    xp_reward INT DEFAULT 0,
    rarity ENUM('comum', 'raro', 'epico', 'lendario') DEFAULT 'comum',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Badges Disponíveis:**
- `HAT_TRICK`: 3 gols em um jogo
- `PAREDAO`: Clean sheet como goleiro
- `ARTILHEIRO_MES`: Mais gols no mês
- `FOMINHA`: 100% de presença no mês
- `STREAK_7`: 7 jogos consecutivos
- `STREAK_30`: 30 jogos consecutivos

---

### USER_BADGES (Badges Desbloqueadas)

```sql
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_badge UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
```

---

## Índices Importantes

### Índices de Performance Crítica

```sql
-- Listar próximos jogos (query mais comum)
CREATE INDEX idx_games_upcoming ON games(status, date, time DESC)
WHERE status IN ('SCHEDULED', 'CONFIRMED');

-- Contar confirmações por jogo
CREATE INDEX idx_confirmations_game_status ON game_confirmations(game_id, status);

-- Buscar stats de usuário por schedule
CREATE INDEX idx_user_stats_lookup ON user_statistics(user_id, schedule_id);

-- Ranking por schedule
CREATE INDEX idx_user_stats_ranking ON user_statistics(schedule_id, total_games DESC, xp DESC);
```

---

## Migrations

### Executar Migrações

```bash
cd backend

# Gerar migração (após mudanças em entities)
npm run migration:generate -- -n NameOfMigration

# Executar todas as migrations pendentes
npm run migration:run

# Revert última migration
npm run migration:revert

# Ver status
npm run migration:run -- --query

# Revert todas (CUIDADO!)
npm run migration:revert -- --all
```

### Estrutura de Migrations

Migrations estão em: `backend/src/migrations/`

Formato:
```typescript
// Exemplo: 1234567890000-CreateUsersTable.ts
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1234567890000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'users',
            columns: [
                // ... colunas
            ]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('users');
    }
}
```

---

## Veja Também

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Setup do banco de dados
- [API_REFERENCE.md](./API_REFERENCE.md) - Como os dados são acessados
- [backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md) - Camada de dados
- [docs/BUSINESS_RULES.md](./docs/BUSINESS_RULES.md) - Regras de cálculos

---

**Última atualização:** Dezembro 2025
**Versão do Schema:** 1.0.0
**Database:** PostgreSQL 15+
