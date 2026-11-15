# BUGFIX: App Android fecha ao tocar em "Encontrar Grupo" (campo `id` gravado no espelho do grupo)

> **Status:** `APPROVED` → `FIXED`
> **Severidade:** `CRITICAL`
> **Autor:** Claude Code (pedido do Renan em 15/11/2026)
> **Data:** 2026-11-15
> **PR:** a definir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Na Home, ao tocar em "Encontrar Grupo" (cartão de primeiros passos), o app fecha. Acontece toda vez para a
conta afetada, logo depois do login.

### 1.2 Comportamento Esperado (Correto)

A lista de grupos abre. Um documento fora do formato esperado nunca fecha o app: no pior caso, aquele grupo
fica fora da lista e o erro vai para o Crashlytics como não fatal.

### 1.3 Passos para Reproduzir

1. Entrar no app Android com uma conta cujo documento `users/{uid}/groups/{groupId}` tenha o campo `id` gravado.
2. Tocar em "Encontrar Grupo" (ou abrir qualquer tela que observe os grupos do usuário).
3. O app fecha.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.43.2 (build 86), teste interno. O código é o mesmo na `master` (1.44.0) e na 1.43.1 de produção |
| Dispositivo | Xiaomi 23013PC75G |
| Android version | 15 |
| Frequência | Sempre, para a conta afetada |
| Impacto em usuários | 1 conta em produção (1 de 11 documentos em `users/*/groups` tem o campo `id`) |

### 1.5 Screenshots / Logs

Crashlytics, evento fatal de 15/11/2026 22:13:45Z (e outro às 22:21:40Z, visto pelo adb):

```
java.lang.RuntimeException: 'id' was found from document users/<uid>/groups/<groupId>,
  cannot apply @DocumentId on this property for class com.futebadosparcas.data.model.UserGroup
    at com.google.firebase.firestore.util.CustomClassMapper$BeanMapper.populateDocumentIdProperties
    ...
    at com.google.firebase.firestore.QuerySnapshot.toObjects
    at com.futebadosparcas.data.repository.GroupRepository$getMyGroupsFlow$1.invokeSuspend$lambda$0$0 (GroupRepository.kt:245)
```

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

- `UserGroup` (`app/.../data/model/Group.kt`) tem `@DocumentId` na propriedade `id`.
- O mapper do Firestore para Android (`CustomClassMapper`) lança `RuntimeException` quando o documento tem um
  campo com o mesmo nome da propriedade anotada com `@DocumentId`.
- `GroupRepository.getMyGroupsFlow()` chamava `snapshot.toObjects(UserGroup::class.java)` dentro do callback do
  `addSnapshotListener`, que roda na thread principal. A exceção não tinha quem a tratasse.
- `GroupRepository.getMyGroups()` usava o mesmo `toObjects`, mas dentro de `try/catch`: não fechava o app,
  devolvia falha (lista de grupos vazia em Jogadores e na criação de jogo).
- Em produção (leitura do Firestore em 15/11/2026): dos 11 documentos em `users/*/groups`, 1 tem o campo `id`,
  igual ao ID do documento. Foi criado em 08/07/2026. Nenhum escritor atual (Android, web, Functions) grava
  esse campo; a origem é uma gravação antiga, não identificada.
- A mudança da 1.43.2 no login (#4563) não tem relação: o documento é de julho.

### 2.2 Causa Raiz

Leitura por reflexão (`toObjects`) de um modelo com `@DocumentId` dentro de um listener sem tratamento de
erro, somada a um documento legado com o campo `id` gravado.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/src/main/java/com/futebadosparcas/data/repository/GroupRepository.kt` | `getMyGroupsFlow()` e `getMyGroups()` usavam `toObjects(UserGroup::class.java)` |
| `app/src/main/java/com/futebadosparcas/data/util/FirestoreSafeMapping.kt` | Novo: conversão por documento que nunca lança |

---

## 3. Solução Proposta

### 3.1 Abordagem

1. `userGroupFromFirestore(docId, data)`: monta o `UserGroup` a partir do mapa de campos, sem reflexão. O ID
   vem do ID do documento; um campo `id` gravado é ignorado; campo ausente ou de tipo inesperado cai no padrão.
2. `mapDocumentsSafely`: converte documento a documento; o que falhar é registrado (`AppLogger.e`, não fatal no
   Crashlytics, só com o ID do documento) e fica fora da lista.
3. `getMyGroupsFlow()` e `getMyGroups()` passam a usar `activeUserGroupsFrom(...)`, que junta os dois.
4. O `@DocumentId` continua no modelo. Tirar faria o Android gravar `id` nesses documentos, e as versões já
   instaladas (1.43.1 em produção, 1.43.2 no teste interno) fechariam ao ler.

### 3.2 Código Antes/Depois

```kotlin
// ANTES: lança dentro do listener se o documento tiver o campo `id`
val groups = snapshot?.toObjects(UserGroup::class.java)
    ?.filter { it.groupStatus == GroupStatus.ACTIVE.name }
    ?: emptyList()
trySend(groups)

// DEPOIS: nunca lança
trySend(activeUserGroupsFrom(snapshot?.documents.orEmpty(), TAG))
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| O mapeamento manual divergir do modelo quando entrar campo novo em `UserGroup` | Teste cobre todos os campos atuais; o mapper fica ao lado de `buildOwnerGroupMirror`, que grava o mesmo documento |
| `group_id` ausente passava como `""` e agora vira o ID do documento | É o mesmo valor por definição (o ID do documento é o `groupId`) |
| Documento ilegível some da lista em vez de avisar o usuário | Fica registrado no Crashlytics como não fatal; antes fechava o app |

---

## 4. Verificação

### 4.1 Testes Adicionados

- [x] `UserGroupFirestoreMappingTest`: documento com `id` gravado, campos ausentes, tipos inesperados, `Long`/`Double`/`Timestamp`, filtro de ativos, documento que lança ao ser lido, documento sem dados.

### 4.2 Testes de Regressão

- [x] `GroupCreationMemberCountTest` (espelho do dono) continua passando.
- [x] `:app:testDebugUnitTest` completo.

### 4.3 Checklist

- [x] Build passa (`:app:compileDebugKotlin`)
- [x] Testes passam
- [x] Detekt sem achado novo
- [ ] Conferido no aparelho com a conta afetada (depende de uma versão instalada; não feito)

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

Os testes de repositório não cobriam a leitura do espelho de grupos e nenhum documento de teste tinha o campo
`id`. O Android CI de PR não roda os testes unitários (só no push para a `master`).

### 5.2 Ações para evitar bugs similares

- [x] Teste automatizado do cenário.
- [ ] Remover o campo `id` do documento legado em produção (1 documento). Corrige também as versões já
      instaladas, sem publicar nada. Depende de autorização do Renan.
- [ ] Levantamento dos outros modelos com `@DocumentId` lidos por `toObject(s)` dentro de listeners: são 40
      modelos. Nas coleções de topo de produção que têm o campo `id` gravado (`confirmations`, `game_events`,
      `live_player_stats`, `notifications`, `users`), a leitura no Android usa modelos sem `@DocumentId`. As
      subcoleções não foram todas medidas.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-11-15 | Renan | Bug reportado ("ao clicar em Encontrar grupo o aplicativo fechou") |
| 2026-11-15 | Claude Code | Pilha no Crashlytics e no adb, causa raiz, correção e teste |
