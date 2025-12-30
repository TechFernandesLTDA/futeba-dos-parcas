# 📊 ÍNDICES COMPOSTOS PARA FIRESTORE

## Projeto: futebadosparcas

Este documento contém todos os índices compostos necessários para otimizar as queries do Firestore.

---

## 🔍 COMO CRIAR OS ÍNDICES

### **Opção 1: Via Firebase Console (Recomendado)**

1. Acesse: <https://console.firebase.google.com/>
2. Selecione o projeto: **futebadosparcas**
3. Vá em **Firestore Database** → **Indexes** → **Composite**
4. Clique em **Create Index**
5. Configure conforme abaixo

### **Opção 2: Via CLI (Automático)**

```bash
firebase deploy --only firestore:indexes
```

---

## 📋 ÍNDICES NECESSÁRIOS

### 1. **Collection: `fields`**

#### Índice 1: Busca de quadras por local e tipo

```
Collection ID: fields
Fields indexed:
  - location_id (Ascending)
  - type (Ascending)
  - __name__ (Ascending)

Query scope: Collection

Uso: Buscar quadras de um local específico filtradas por tipo
```

**Comando CLI:**

```json
{
  "collectionGroup": "fields",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "location_id", "order": "ASCENDING" },
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "__name__", "order": "ASCENDING" }
  ]
}
```

---

#### Índice 2: Quadras ativas por local

```
Collection ID: fields
Fields indexed:
  - location_id (Ascending)
  - is_active (Ascending)
  - __name__ (Ascending)

Query scope: Collection

Uso: Buscar apenas quadras ativas de um local
```

**Comando CLI:**

```json
{
  "collectionGroup": "fields",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "location_id", "order": "ASCENDING" },
    { "fieldPath": "is_active", "order": "ASCENDING" },
    { "fieldPath": "__name__", "order": "ASCENDING" }
  ]
}
```

---

### 2. **Collection: `games`**

#### Índice 3: Jogos por status e data

```
Collection ID: games
Fields indexed:
  - status (Ascending)
  - date_time (Descending)
  - __name__ (Descending)

Query scope: Collection

Uso: Listar jogos por status ordenados por data (mais recentes primeiro)
```

**Comando CLI:**

```json
{
  "collectionGroup": "games",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "date_time", "order": "DESCENDING" },
    { "fieldPath": "__name__", "order": "DESCENDING" }
  ]
}
```

---

#### Índice 4: Jogos por local e data

```
Collection ID: games
Fields indexed:
  - location_id (Ascending)
  - date_time (Descending)
  - __name__ (Descending)

Query scope: Collection

Uso: Listar jogos de um local específico ordenados por data
```

**Comando CLI:**

```json
{
  "collectionGroup": "games",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "location_id", "order": "ASCENDING" },
    { "fieldPath": "date_time", "order": "DESCENDING" },
    { "fieldPath": "__name__", "order": "DESCENDING" }
  ]
}
```

---

#### Índice 5: Jogos por dono e status

```
Collection ID: games
Fields indexed:
  - owner_id (Ascending)
  - status (Ascending)
  - date_time (Descending)

Query scope: Collection

Uso: Listar jogos de um organizador por status
```

**Comando CLI:**

```json
{
  "collectionGroup": "games",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "owner_id", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "date_time", "order": "DESCENDING" }
  ]
}
```

---

### 3. **Collection: `confirmations`**

#### Índice 6: Confirmações por jogo e usuário (ÚNICO)

```
Collection ID: confirmations
Fields indexed:
  - game_id (Ascending)
  - user_id (Ascending)

Query scope: Collection
Unique: YES

Uso: Garantir que um usuário só pode confirmar uma vez por jogo
```

**Comando CLI:**

```json
{
  "collectionGroup": "confirmations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "game_id", "order": "ASCENDING" },
    { "fieldPath": "user_id", "order": "ASCENDING" }
  ]
}
```

---

#### Índice 7: Confirmações por jogo e status

```
Collection ID: confirmations
Fields indexed:
  - game_id (Ascending)
  - status (Ascending)
  - created_at (Descending)

Query scope: Collection

Uso: Listar confirmações de um jogo por status
```

**Comando CLI:**

```json
{
  "collectionGroup": "confirmations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "game_id", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
}
```

---

### 4. **Collection: `locations`**

#### Índice 8: Locais ativos por bairro

```
Collection ID: locations
Fields indexed:
  - is_active (Ascending)
  - neighborhood (Ascending)
  - name (Ascending)

Query scope: Collection

Uso: Buscar locais ativos em um bairro específico
```

**Comando CLI:**

```json
{
  "collectionGroup": "locations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "is_active", "order": "ASCENDING" },
    { "fieldPath": "neighborhood", "order": "ASCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
}
```

---

#### Índice 9: Locais por dono

```
Collection ID: locations
Fields indexed:
  - owner_id (Ascending)
  - is_active (Ascending)
  - name (Ascending)

Query scope: Collection

Uso: Listar locais de um proprietário
```

**Comando CLI:**

```json
{
  "collectionGroup": "locations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "owner_id", "order": "ASCENDING" },
    { "fieldPath": "is_active", "order": "ASCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
}
```

---

### 5. **Collection: `notifications`**

#### Índice 10: Notificações não lidas por usuário

```
Collection ID: notifications
Fields indexed:
  - user_id (Ascending)
  - read (Ascending)
  - created_at (Descending)

Query scope: Collection

Uso: Listar notificações não lidas de um usuário
```

**Comando CLI:**

```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "user_id", "order": "ASCENDING" },
    { "fieldPath": "read", "order": "ASCENDING" },
    { "fieldPath": "created_at", "order": "DESCENDING" }
  ]
}
```

---

### 6. **Collection: `player_stats`**

#### Índice 11: Estatísticas por jogo

```
Collection ID: player_stats
Fields indexed:
  - game_id (Ascending)
  - team_id (Ascending)
  - user_id (Ascending)

Query scope: Collection

Uso: Buscar estatísticas de um jogo específico
```

**Comando CLI:**

```json
{
  "collectionGroup": "player_stats",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "game_id", "order": "ASCENDING" },
    { "fieldPath": "team_id", "order": "ASCENDING" },
    { "fieldPath": "user_id", "order": "ASCENDING" }
  ]
}
```

---

## 📝 ARQUIVO firestore.indexes.json

Crie este arquivo na raiz do projeto para deploy automático:

```json
{
  "indexes": [
    {
      "collectionGroup": "fields",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location_id", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "__name__", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "fields",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location_id", "order": "ASCENDING" },
        { "fieldPath": "is_active", "order": "ASCENDING" },
        { "fieldPath": "__name__", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "games",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date_time", "order": "DESCENDING" },
        { "fieldPath": "__name__", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "games",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location_id", "order": "ASCENDING" },
        { "fieldPath": "date_time", "order": "DESCENDING" },
        { "fieldPath": "__name__", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "games",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "owner_id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date_time", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "confirmations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "game_id", "order": "ASCENDING" },
        { "fieldPath": "user_id", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "confirmations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "game_id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "locations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "is_active", "order": "ASCENDING" },
        { "fieldPath": "neighborhood", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "locations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "owner_id", "order": "ASCENDING" },
        { "fieldPath": "is_active", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "player_stats",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "game_id", "order": "ASCENDING" },
        { "fieldPath": "team_id", "order": "ASCENDING" },
        { "fieldPath": "user_id", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 🚀 DEPLOY DOS ÍNDICES

### Via Firebase CLI

```bash
# 1. Instalar Firebase CLI (se não tiver)
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Inicializar projeto (se não tiver)
firebase init firestore

# 4. Deploy dos índices
firebase deploy --only firestore:indexes
```

---

## ✅ VERIFICAÇÃO

Após criar os índices, verifique no Firebase Console:

1. Acesse: <https://console.firebase.google.com/project/futebadosparcas/firestore/indexes>
2. Aguarde todos os índices ficarem com status **Enabled** (verde)
3. Tempo estimado: 5-15 minutos

---

## 📊 IMPACTO ESPERADO

Com os índices criados:

- ✅ **Queries 10-100x mais rápidas**
- ✅ **Sem erros de "missing index"**
- ✅ **Melhor experiência do usuário**
- ✅ **Menor consumo de recursos**

---

**Última atualização**: 27/12/2024
**Total de índices**: 11
