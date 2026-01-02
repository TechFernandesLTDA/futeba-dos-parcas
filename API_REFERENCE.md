# 📡 API Reference - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [Autenticação](#autenticação)
- [Base URL](#base-url)
- [Endpoints](#endpoints)
- [Códigos de Erro](#códigos-de-erro)
- [Exemplos Práticos](#exemplos-práticos)
- [Rate Limiting](#rate-limiting)

---

## Visão Geral

API REST para gerenciar jogos de futebol amador, jogadores, estatísticas e gamificação.

**Ambiente:**
- **Desenvolvimento:** `http://localhost:3000/api`
- **Produção:** `https://api.futebadosparcas.com/api`

**Formato:** JSON | **Encoding:** UTF-8

---

## Autenticação

### Método: JWT (Bearer Token)

```bash
Authorization: Bearer <your-jwt-token>
```

### Login (POST /auth/login)

**Request:**
```json
{
  "email": "jogador@example.com",
  "password": "senhaSegura123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-123",
    "email": "jogador@example.com",
    "name": "João Silva",
    "level": 5,
    "xp": 2500
  }
}
```

### Register (POST /auth/register)

**Request:**
```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "senhaSegura123",
  "phone": "11987654321",
  "preferredFieldType": "SOCIETY"
}
```

**Response (201):**
```json
{
  "message": "Usuário criado com sucesso",
  "userId": "uuid-123"
}
```

### Refresh Token (POST /auth/refresh)

**Request:**
```json
{
  "token": "current-expired-token"
}
```

**Response (200):**
```json
{
  "token": "new-jwt-token"
}
```

---

## Base URL

```
https://api.futebadosparcas.com/api
```

Todos os exemplos assumem este prefixo.

---

## Endpoints

### USUÁRIOS

#### Get Perfil Atual
```
GET /users/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "user-uuid-123",
  "name": "João Silva",
  "email": "joao@example.com",
  "phone": "11987654321",
  "level": 5,
  "xp": 2500,
  "photoUrl": "https://storage.../profile.jpg",
  "preferredFieldType": "SOCIETY",
  "isSearchable": true,
  "createdAt": "2024-01-01T10:00:00Z",
  "stats": {
    "totalGames": 42,
    "totalGoals": 15,
    "presenceRate": 0.85
  }
}
```

#### Atualizar Perfil
```
PUT /users/me
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "João Silva Santos",
  "phone": "11999999999",
  "photoUrl": "https://..."
}
```

**Response (200):**
```json
{
  "message": "Perfil atualizado com sucesso"
}
```

#### Buscar Jogadores
```
GET /users/search?q=joão&limit=10&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` (string): Termo de busca (nome ou email)
- `limit` (number): Máximo de resultados (default: 10, max: 100)
- `offset` (number): Paginação (default: 0)

**Response (200):**
```json
{
  "total": 5,
  "users": [
    {
      "id": "uuid-123",
      "name": "João Silva",
      "email": "joao@example.com",
      "level": 5,
      "xp": 2500,
      "stats": {
        "totalGames": 42,
        "presenceRate": 0.85
      }
    }
  ]
}
```

---

### JOGOS

#### Listar Próximos Jogos
```
GET /games/upcoming?days=7&location=uuid&status=CONFIRMED
Authorization: Bearer <token>
```

**Query Parameters:**
- `days` (number): Próximos N dias (default: 7)
- `location` (uuid): Filtrar por local (optional)
- `status` (string): SCHEDULED, CONFIRMED, FINISHED (default: todos)
- `limit` (number): Default: 20
- `offset` (number): Default: 0

**Response (200):**
```json
{
  "total": 25,
  "games": [
    {
      "id": "game-uuid-123",
      "scheduleId": "schedule-uuid",
      "date": "2024-01-15",
      "time": "19:00",
      "status": "CONFIRMED",
      "location": {
        "id": "loc-uuid",
        "name": "Parque da Mooca",
        "address": "Rua X, 123",
        "latitude": -23.5505,
        "longitude": -46.6333
      },
      "field": {
        "id": "field-uuid",
        "name": "Quadra 3",
        "type": "SOCIETY"
      },
      "confirmations": {
        "total": 12,
        "confirmed": 11,
        "positions": {
          "FIELD": 10,
          "GOALKEEPER": 1
        }
      },
      "maxPlayers": 12,
      "dailyPrice": 150.00,
      "createdAt": "2024-01-10T10:00:00Z"
    }
  ]
}
```

#### Get Detalhes do Jogo
```
GET /games/:gameId
Authorization: Bearer <token>
```

**Path Parameters:**
- `gameId` (uuid): ID do jogo

**Response (200):**
```json
{
  "id": "game-uuid-123",
  "date": "2024-01-15",
  "time": "19:00",
  "status": "CONFIRMED",
  "location": { ... },
  "field": { ... },
  "confirmations": [
    {
      "userId": "user-uuid",
      "name": "João Silva",
      "position": "FIELD",
      "status": "CONFIRMED",
      "confirmedAt": "2024-01-10T15:30:00Z"
    },
    {
      "userId": "user-uuid-2",
      "name": "Pedro Santos",
      "position": "GOALKEEPER",
      "status": "CONFIRMED",
      "confirmedAt": "2024-01-10T16:00:00Z"
    }
  ],
  "teams": null,
  "stats": null,
  "closesAt": "2024-01-15T18:30:00Z"
}
```

#### Confirmar Presença
```
POST /games/:gameId/confirm
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "position": "FIELD"
}
```

**Posições válidas:** `FIELD`, `GOALKEEPER`

**Response (200):**
```json
{
  "message": "Presença confirmada com sucesso",
  "confirmation": {
    "gameId": "game-uuid",
    "userId": "user-uuid",
    "position": "FIELD",
    "status": "CONFIRMED",
    "confirmedAt": "2024-01-10T15:30:00Z"
  }
}
```

**Response (409 - Conflict):**
```json
{
  "error": "USER_ALREADY_CONFIRMED",
  "message": "Você já confirmou presença neste jogo"
}
```

#### Cancelar Presença
```
DELETE /games/:gameId/confirm
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Presença cancelada com sucesso"
}
```

#### Fechar Confirmações
```
POST /games/:gameId/close-confirmations
Authorization: Bearer <token>
```

**Requer:** Ser o organizador do jogo

**Response (200):**
```json
{
  "message": "Confirmações fechadas com sucesso",
  "confirmations": {
    "total": 11,
    "FIELD": 10,
    "GOALKEEPER": 1
  }
}
```

#### Gerar Times
```
POST /games/:gameId/teams
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "numberOfTeams": 2,
  "balanceTeams": true
}
```

**Response (200):**
```json
{
  "message": "Times gerados com sucesso",
  "teams": [
    {
      "id": "team-uuid-1",
      "name": "Time A",
      "color": "#FF0000",
      "players": [
        {
          "userId": "user-uuid-1",
          "name": "João Silva",
          "position": "FIELD",
          "level": 5,
          "xp": 2500
        },
        {
          "userId": "user-uuid-2",
          "name": "Pedro Santos",
          "position": "GOALKEEPER",
          "level": 3,
          "xp": 1200
        }
      ]
    },
    {
      "id": "team-uuid-2",
      "name": "Time B",
      "color": "#0000FF",
      "players": [ ... ]
    }
  ]
}
```

#### Registrar Estatísticas
```
POST /games/:gameId/stats
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "stats": [
    {
      "userId": "user-uuid-1",
      "goals": 2,
      "assists": 1,
      "saves": 0,
      "cards": 0,
      "isMvp": false
    },
    {
      "userId": "user-uuid-2",
      "goals": 0,
      "assists": 0,
      "saves": 5,
      "cards": 0,
      "isMvp": true
    }
  ],
  "winningTeamId": "team-uuid-1"
}
```

**Response (200):**
```json
{
  "message": "Estatísticas registradas com sucesso",
  "xpAwarded": {
    "user-uuid-1": {
      "presence": 10,
      "goals": 10,
      "assists": 5,
      "mvpBonus": 0,
      "total": 25
    },
    "user-uuid-2": {
      "presence": 10,
      "goals": 0,
      "assists": 0,
      "mvpBonus": 50,
      "total": 60
    }
  }
}
```

---

### LOCAIS E QUADRAS

#### Listar Locais
```
GET /locations?search=mooca&limit=20&offset=0
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "total": 5,
  "locations": [
    {
      "id": "loc-uuid-1",
      "name": "Parque da Mooca",
      "address": "Rua X, 123",
      "city": "São Paulo",
      "state": "SP",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "fields": [
        {
          "id": "field-uuid-1",
          "name": "Quadra 1",
          "type": "SOCIETY",
          "description": "Quadra coberta"
        }
      ]
    }
  ]
}
```

#### Get Detalhes do Local
```
GET /locations/:locationId
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": "loc-uuid",
  "name": "Parque da Mooca",
  "address": "Rua X, 123",
  "city": "São Paulo",
  "state": "SP",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "fields": [ ... ],
  "schedules": [ ... ]
}
```

#### Criar Local (Admin)
```
POST /locations
Authorization: Bearer <token>
Content-Type: application/json
```

**Requer:** Role ADMIN ou FIELD_OWNER

**Request:**
```json
{
  "name": "Novo Parque",
  "address": "Rua Y, 456",
  "city": "São Paulo",
  "state": "SP",
  "latitude": -23.5505,
  "longitude": -46.6333
}
```

**Response (201):**
```json
{
  "id": "loc-uuid-new",
  "message": "Local criado com sucesso"
}
```

---

### HORÁRIOS

#### Listar Horários
```
GET /schedules?locationId=uuid&status=ACTIVE
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "total": 3,
  "schedules": [
    {
      "id": "schedule-uuid-1",
      "location": { ... },
      "field": { ... },
      "owner": {
        "id": "user-uuid",
        "name": "João"
      },
      "name": "Futsal Segunda 19h",
      "recurrenceType": "WEEKLY",
      "recurrenceConfig": {
        "days": ["MONDAY", "WEDNESDAY"],
        "interval": 1
      },
      "time": "19:00",
      "duration": 60,
      "maxPlayers": 12,
      "dailyPrice": 150.00,
      "monthlyPrice": 600.00,
      "members": 8,
      "isPublic": true
    }
  ]
}
```

#### Criar Horário
```
POST /schedules
Authorization: Bearer <token>
Content-Type: application/json
```

**Requer:** Ser FIELD_OWNER

**Request:**
```json
{
  "fieldId": "field-uuid",
  "name": "Futsal Segunda 19h",
  "recurrenceType": "WEEKLY",
  "recurrenceConfig": {
    "days": ["MONDAY", "WEDNESDAY"],
    "interval": 1
  },
  "time": "19:00",
  "duration": 60,
  "maxPlayers": 12,
  "dailyPrice": 150.00,
  "monthlyPrice": 600.00,
  "isPublic": true
}
```

**Response (201):**
```json
{
  "id": "schedule-uuid-new",
  "message": "Horário criado com sucesso"
}
```

#### Solicitar Participação
```
POST /schedules/:scheduleId/request-membership
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Solicitação enviada com sucesso",
  "status": "PENDING"
}
```

---

### ESTATÍSTICAS

#### Minhas Estatísticas
```
GET /statistics/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "userId": "user-uuid",
  "level": 5,
  "xp": 2500,
  "nextLevelXp": 3000,
  "stats": {
    "totalGames": 42,
    "totalGoals": 15,
    "totalAssists": 8,
    "totalSaves": 0,
    "bestPlayerCount": 5,
    "worstPlayerCount": 1,
    "presenceRate": 0.85
  },
  "badges": [
    {
      "id": "badge-uuid",
      "type": "HAT_TRICK",
      "name": "Hat-trick",
      "unlockedAt": "2024-01-10T19:30:00Z"
    }
  ],
  "schedules": [
    {
      "scheduleId": "schedule-uuid",
      "scheduleName": "Futsal Segunda",
      "totalGames": 15,
      "totalGoals": 8,
      "presenceRate": 0.90
    }
  ]
}
```

#### Estatísticas de Usuário
```
GET /statistics/user/:userId
Authorization: Bearer <token>
```

**Response:** Similar a `/statistics/me`

#### Ranking de Horário
```
GET /statistics/schedule/:scheduleId/rankings?limit=10&offset=0
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "scheduleId": "schedule-uuid",
  "scheduleName": "Futsal Segunda",
  "total": 25,
  "rankings": [
    {
      "position": 1,
      "userId": "user-uuid-1",
      "name": "João Silva",
      "level": 8,
      "xp": 5200,
      "points": 45,
      "games": 18,
      "goals": 25,
      "presenceRate": 1.0
    },
    {
      "position": 2,
      "userId": "user-uuid-2",
      "name": "Pedro Santos",
      "level": 6,
      "xp": 3800,
      "points": 40,
      "games": 15,
      "goals": 12,
      "presenceRate": 0.93
    }
  ]
}
```

---

### NOTIFICAÇÕES

#### Listar Notificações
```
GET /notifications?unreadOnly=false&limit=20
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "total": 5,
  "notifications": [
    {
      "id": "notif-uuid-1",
      "type": "GAME_INVITE",
      "title": "Novo jogo criado",
      "message": "João criou um novo jogo para segunda",
      "data": {
        "gameId": "game-uuid",
        "date": "2024-01-15",
        "time": "19:00"
      },
      "read": false,
      "createdAt": "2024-01-10T10:00:00Z"
    }
  ]
}
```

#### Marcar como Lida
```
PUT /notifications/:notificationId/read
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Notificação marcada como lida"
}
```

#### Marcar Todas como Lidas
```
PUT /notifications/read-all
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Todas as notificações marcadas como lidas"
}
```

---

## Códigos de Erro

| Código | Erro | Descrição |
|--------|------|-----------|
| 200 | OK | Sucesso |
| 201 | Created | Recurso criado com sucesso |
| 204 | No Content | Sucesso sem conteúdo |
| 400 | Bad Request | Requisição inválida |
| 401 | Unauthorized | Token ausente ou inválido |
| 403 | Forbidden | Sem permissão |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: já confirmado) |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Server Error | Erro interno do servidor |

### Exemplo de Erro

```json
{
  "error": "GAME_NOT_FOUND",
  "message": "Jogo com ID xyz não encontrado",
  "statusCode": 404
}
```

---

## Exemplos Práticos

### Fluxo Completo: Criar e Participar de um Jogo

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@example.com",
    "password": "senha123"
  }'

# Resposta contém TOKEN

# 2. Listar próximos jogos
curl -X GET "http://localhost:3000/api/games/upcoming?days=7" \
  -H "Authorization: Bearer TOKEN"

# 3. Confirmar presença em jogo
curl -X POST http://localhost:3000/api/games/game-uuid-123/confirm \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"position": "FIELD"}'

# 4. Ver ranking
curl -X GET "http://localhost:3000/api/statistics/schedule/schedule-uuid/rankings" \
  -H "Authorization: Bearer TOKEN"
```

---

## Rate Limiting

**Limites padrão:**
- 1000 requisições por hora por token
- 10 requisições por segundo

**Headers da resposta:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1234567890
```

---

## Veja Também

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Setup e troubleshooting
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Estrutura do banco
- [backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md) - Detalhes de backend

---

**Última atualização:** Dezembro 2025
**Versão da API:** 1.0.0
