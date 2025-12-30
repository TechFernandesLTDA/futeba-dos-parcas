# Futeba dos Parcas - Backend API

API REST para o aplicativo Futeba dos Parcas.

## Requisitos

- Node.js 18+
- PostgreSQL 15+
- npm ou yarn

## Instalacao

```bash
# Instalar dependencias
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Editar .env com suas configuracoes de banco de dados
```

## Configuracao do Banco de Dados

1. Criar banco de dados PostgreSQL:

```sql
CREATE DATABASE futeba_db;
```

2. Configurar variaveis no `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=sua_senha
DB_DATABASE=futeba_db
```

## Executar

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Build para producao
npm run build

# Executar build
npm start
```

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
