# Solução: Correção de "0 Quadras" nos Locais

**Data**: 27/12/2024
**Status**: Resolvido
**Contexto**: Usuário relatou que locais existentes (ex: JB Esportes, Brasil Soccer) exibiam "0 quadras", apesar dos dados existirem no banco de dados.

## 🔎 Diagnóstico

Os dados existiam no Firestore, mas não eram retornados para a aplicação.

**Causa Raiz**: A query utilizada no `LocationRepository` (método `getLocationWithFields` e similares) aplicava filtros compostos (`whereEqualTo("location_id", id).whereEqualTo("is_active", true)`).
Firestore exige índices compostos específicos para essas queries. Se o índice faltar ou falhar, a query retorna vazio (lista vazia), resultando na exibição de "0 quadras".

## ✅ Solução Aplicada

Alteramos a estratégia de busca para ser **fail-safe**:

1. **Alteração**: `app/src/main/java/com/futebadosparcas/data/repository/LocationRepository.kt`
2. **Método**: Busca simplificada apenas pelo ID do local (`location_id`), que não requer índice composto.
3. **Filtragem**: A verificação de `is_active` foi movida para o código Kotlin (`.filter { it.isActive }`).

```kotlin
// ANTES (Falhava sem índice)
fieldsCollection.whereEqualTo("location_id", id).whereEqualTo("is_active", true).get()

// DEPOIS (Funciona sempre)
fieldsCollection.whereEqualTo("location_id", id).get().await()
    .toObjects(Field::class.java)
    .filter { it.isActive }
```

## 🏁 Resultado

Os dados existentes no banco agora são carregados corretamente e exibidos na aplicação, sem necessidade de recriação de dados ou intervenção manual.
