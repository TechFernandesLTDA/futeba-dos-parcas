# Correção: Erro de Índice Firestore na Tela de Jogadores

**Data**: 27/12/2024  
**Erro**: `The query requires an index`  
**Tela Afetada**: Jogadores (PlayersFragment)

## 🔍 Problema Identificado

A query no `UserRepository.searchUsers()` estava falhando porque combinava:

- `whereEqualTo("is_searchable", true)`
- `orderBy("name")`

O Firestore **requer um índice composto** quando você combina filtros `where` com `orderBy` em campos diferentes.

## ✅ Solução Implementada

### 1. Adicionado Índice Composto

Arquivo: `firestore.indexes.json`

```json
{
  "collectionGroup": "users",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "is_searchable",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "name",
      "order": "ASCENDING"
    }
  ]
}
```

### 2. Deploy do Índice

```bash
firebase deploy --only firestore:indexes
```

## 📝 Arquivos Modificados

- ✅ `firestore.indexes.json` - Adicionado índice composto para `users`

## 🎯 Query Beneficiada

**Arquivo**: `app/src/main/java/com/futebadosparcas/data/repository/UserRepository.kt`  
**Função**: `searchUsers(query: String)`  
**Linhas**: 118-120

```kotlin
val baseQuery = usersCollection
    .whereEqualTo("is_searchable", true)
    .orderBy("name")
```

## ✨ Resultado Esperado

Após o deploy do índice (leva alguns minutos para o Firestore criar):

- ✅ Tela de Jogadores carrega sem erro
- ✅ Busca de usuários funciona corretamente
- ✅ Filtros e ordenação funcionam perfeitamente

## 🔄 Tempo de Criação do Índice

⏱️ **Estimativa**: 2-5 minutos  
📊 **Status**: Verificar no [Firebase Console](https://console.firebase.google.com/project/futebadosparcas/firestore/indexes)

## 📚 Referências

- [Firestore Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- Projeto: `GEMINI.md` - Seção Firebase
