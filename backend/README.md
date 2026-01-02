# 🚀 Futeba dos Parças - Backend API

API REST + WebSocket para o Futeba dos Parças. Backend em Express.js + TypeORM + PostgreSQL.

**Version:** 1.0.0 | **Node:** 18+ | **Status:** Production-ready

## 📋 Índice

- [Requisitos](#requisitos)
- [Quick Start](#quick-start)
- [Estrutura](#estrutura)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Configuração](#configuração)
- [API Endpoints](#api-endpoints)
- [Healthcheck](#healthcheck)
- [Troubleshooting](#troubleshooting)
- [Veja Também](#veja-também)

## ✅ Requisitos

- **Node.js** v18+ (LTS v20 recomendado)
- **PostgreSQL** v15+
- **npm** ou **yarn**
- **Firebase Admin SDK** (credenciais de produção)

## 🚀 Quick Start (5 minutos)

### 1. Instalar Dependências

```bash
npm install
# ou
yarn install
```

### 2. Configurar Banco de Dados

```bash
# Criar database
createdb futeba_db
# ou com psql
psql -U postgres -c "CREATE DATABASE futeba_db;"

# Ou com Docker
docker run -d --name postgres-futeba \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=futeba_db \
  -p 5432:5432 \
  postgres:15
```

### 3. Copiar e Configurar .env

```bash
cp .env.example .env
# Editar .env com suas configurações
```

### 4. Executar Migrações

```bash
npm run migration:run
```

### 5. Rodar Backend

```bash
# Desenvolvimento (hot reload)
npm run dev

# Resultado esperado:
# ✓ Server running at http://localhost:3000
# ✓ Health check: GET http://localhost:3000/health
```

### 6. Testar Conectividade

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2024-01-01T00:00:00Z"}
```

## 📂 Estrutura

```
src/
├── config/
│   ├── database.ts              # TypeORM PostgreSQL setup
│   ├── firebase.ts              # Firebase Admin initialization
│   └── index.ts                 # App configuration from env vars
├── entities/                    # TypeORM entities (models)
│   ├── User.ts, Location.ts, Field.ts
│   ├── Schedule.ts, Game.ts
│   ├── GameConfirmation.ts, Team.ts
│   ├── GameStats.ts
│   ├── Badge.ts, UserBadge.ts
│   ├── Payment.ts, Crowdfunding.ts
│   └── index.ts                 # Re-exports
├── controllers/                 # HTTP handlers
│   ├── AuthController.ts        # Auth routes
│   ├── GameController.ts        # Game routes
│   ├── UserController.ts        # User routes
│   ├── StatisticsController.ts  # Stats routes
│   └── ...mais controllers
├── services/                    # Business logic
│   ├── GameGeneratorService.ts  # Auto-generates games
│   ├── StatisticsService.ts     # Calculates statistics
│   ├── NotificationService.ts   # Push notifications
│   └── TeamBalancerService.ts   # AI team balancing
├── repositories/                # Data access (TypeORM)
│   ├── GameRepository.ts
│   ├── UserRepository.ts
│   └── ...mais repos
├── routes/                      # Route definitions
│   ├── auth.routes.ts
│   ├── game.routes.ts
│   ├── user.routes.ts
│   └── index.ts                 # Aggregator
├── middlewares/                 # Express middlewares
│   ├── auth.middleware.ts       # JWT verification
│   ├── error.middleware.ts      # Error handling
│   └── validation.middleware.ts # Input validation
├── dto/                         # Data Transfer Objects
├── cron/                        # Scheduled jobs
│   ├── gameGenerator.cron.ts    # Daily game generation
│   └── confirmationCloser.cron.ts
├── utils/                       # Helper functions
│   ├── jwt.util.ts
│   ├── hash.util.ts
│   └── logger.ts
├── app.ts                       # Express app setup
└── server.ts                    # Entry point
```

## 📝 Scripts Disponíveis

```bash
# Development
npm run dev                      # Start with hot reload (ts-node-dev)

# Build & Production
npm run build                    # Compile TypeScript to JavaScript
npm start                        # Run compiled dist/server.js

# Database Migrations
npm run migration:generate -- -n MigrationName  # Create migration
npm run migration:run            # Run all pending migrations
npm run migration:revert         # Revert last migration

# Database Seeding (optional)
npm run seed                     # Populate test data

# Testing
npm run test                     # Run unit tests
npm run test:watch              # Run tests in watch mode

# Linting
npm run lint                     # Check code style
npm run lint:fix                # Fix code style issues
```

## ⚙️ Configuração

### Arquivo .env

```env
# Node Environment
NODE_ENV=development|production
PORT=3000
HOST=localhost

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=futeba_db

# JWT Authentication
JWT_SECRET=sua-chave-secreta-min-32-caracteres-mude-em-producao
JWT_EXPIRATION=7d

# Firebase Admin (credenciais de produção)
FIREBASE_PROJECT_ID=futebadosparcas
FIREBASE_PRIVATE_KEY=<paste-private-key-from-json>
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_DATABASE_URL=https://...

# CORS Origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Cron Jobs
GAME_GENERATION_DAYS_AHEAD=30
AUTO_CLOSE_CONFIRMATIONS_HOURS=2

# Logging
LOG_LEVEL=debug|info|warn|error
```

### Variáveis Críticas

| Variável | Descrição | Exemplo |
|----------|----------|---------|
| `DB_*` | Conexão PostgreSQL | localhost:5432 |
| `JWT_SECRET` | Chave de assinatura JWT | mín. 32 chars |
| `FIREBASE_*` | Credenciais Firebase Admin | (de Service Account) |
| `ALLOWED_ORIGINS` | URLs permitidas por CORS | http://localhost:3000 |

## 🔌 API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login (retorna JWT)
- `POST /api/auth/refresh` - Refresh token

### Usuários
- `GET /api/users/me` - Perfil do usuário atual
- `PUT /api/users/me` - Atualizar perfil
- `GET /api/users/search?q=nome` - Buscar jogadores

### Locais & Quadras
- `GET /api/locations` - Listar locais
- `POST /api/locations` - Criar local (Admin)
- `GET /api/fields` - Listar quadras
- `POST /api/fields` - Criar quadra

### Horários
- `GET /api/schedules` - Listar horários
- `POST /api/schedules` - Criar horário
- `POST /api/schedules/:id/request-membership` - Solicitar participação

### Jogos
- `GET /api/games/upcoming` - Próximos jogos
- `GET /api/games/:id` - Detalhes do jogo
- `POST /api/games/:id/confirm` - Confirmar presença
- `DELETE /api/games/:id/confirm` - Cancelar confirmação
- `POST /api/games/:id/teams` - Gerar times
- `POST /api/games/:id/stats` - Adicionar estatísticas

### Estatísticas
- `GET /api/statistics/me` - Minhas estatísticas
- `GET /api/statistics/user/:userId` - Stats de usuário
- `GET /api/statistics/schedule/:scheduleId/rankings` - Ranking

### Notificações
- `GET /api/notifications` - Listar notificações
- `PUT /api/notifications/:id/read` - Marcar como lida

**Documentação completa:** [API_REFERENCE.md](../API_REFERENCE.md)

## 🏥 Healthcheck

### Verificar saúde do backend

```bash
# Health check básico
curl http://localhost:3000/health

# Resultado:
# {"status":"ok","timestamp":"2024-01-01T00:00:00Z"}
```

### Verificar banco de dados

```bash
# List tables
psql -h localhost -U postgres -d futeba_db -c "\dt"

# Count records
psql -h localhost -U postgres -d futeba_db -c "SELECT COUNT(*) FROM games;"
```

## 🔧 Troubleshooting

### Erro: "Cannot find module 'express'"
```bash
npm install
```

### Erro: "Port 3000 already in use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Ou mudar porta: PORT=3001 npm run dev
```

### Erro: "Connection refused" ao banco de dados
```bash
# Verificar se PostgreSQL está rodando
psql -U postgres

# Se não, iniciar (Windows)
net start postgresql-x64-15

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### Erro: "TypeORM migration failed"
```bash
# Verificar status
npm run migration:run -- --query

# Revert última
npm run migration:revert

# Re-create
npm run migration:generate -- -n FreshStart
npm run migration:run
```

## 📚 Veja Também

- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Setup completo (Android + Backend)
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Arquitetura geral
- [backend/ARCHITECTURE.md](./ARCHITECTURE.md) - Detalhes de backend
- [API_REFERENCE.md](../API_REFERENCE.md) - Endpoints documentados
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Schema do banco

---

**Última atualização:** Dezembro 2025
**Mantido por:** Time de desenvolvimento
**Issues:** [GitHub Issues](https://github.com/seu-repo/issues)

## Endpoints da API

### Autenticacao
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Login

### Usuarios
- `GET /api/users/me` - Perfil do usuario
- `PUT /api/users/me` - Atualizar perfil
- `GET /api/users/search` - Buscar jogadores

### Locais
- `GET /api/locations` - Listar locais
- `POST /api/locations` - Criar local
- `GET /api/locations/:id` - Detalhes do local
- `PUT /api/locations/:id` - Atualizar local
- `DELETE /api/locations/:id` - Remover local

### Quadras
- `GET /api/fields` - Listar quadras
- `POST /api/fields` - Criar quadra
- `GET /api/fields/:id` - Detalhes da quadra
- `PUT /api/fields/:id` - Atualizar quadra
- `DELETE /api/fields/:id` - Remover quadra

### Horarios
- `GET /api/schedules` - Listar horarios
- `POST /api/schedules` - Criar horario
- `GET /api/schedules/:id` - Detalhes do horario
- `PUT /api/schedules/:id` - Atualizar horario
- `DELETE /api/schedules/:id` - Remover horario
- `POST /api/schedules/:id/request-membership` - Solicitar participacao

### Jogos
- `GET /api/games/upcoming` - Proximos jogos
- `GET /api/games/:id` - Detalhes do jogo
- `POST /api/games/:id/confirm` - Confirmar presenca
- `DELETE /api/games/:id/confirm` - Cancelar confirmacao
- `POST /api/games/:id/close-confirmations` - Fechar lista
- `POST /api/games/:id/teams` - Definir times
- `POST /api/games/:id/stats` - Lancar estatisticas

### Convites
- `POST /api/invites` - Enviar convite
- `GET /api/invites/received` - Convites recebidos
- `GET /api/invites/sent` - Convites enviados
- `POST /api/invites/:id/accept` - Aceitar convite
- `POST /api/invites/:id/decline` - Recusar convite

### Estatisticas
- `GET /api/statistics/me` - Minhas estatisticas
- `GET /api/statistics/user/:userId` - Estatisticas de usuario
- `GET /api/statistics/schedule/:scheduleId` - Estatisticas do horario
- `GET /api/statistics/schedule/:scheduleId/rankings` - Rankings

### Notificacoes
- `GET /api/notifications` - Listar notificacoes
- `PUT /api/notifications/:id/read` - Marcar como lida
- `PUT /api/notifications/read-all` - Marcar todas como lidas

## Estrutura do Projeto

```
src/
├── config/          # Configuracoes (database, etc)
├── controllers/     # Controllers das rotas
├── cron/           # Jobs agendados
├── dto/            # Data Transfer Objects
├── entities/       # Modelos do TypeORM
├── middlewares/    # Middlewares Express
├── migrations/     # Migracoes do banco
├── routes/         # Definicao de rotas
├── services/       # Logica de negocio
├── utils/          # Utilitarios
├── websocket/      # WebSocket handlers
├── app.ts          # Configuracao Express
└── server.ts       # Entrada da aplicacao
```
