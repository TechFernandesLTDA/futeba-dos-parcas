# SPEC: Feed social agregado cross-grupo

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3236
> **Épico:** #3240 (Rede social da pelada)
> **Depende:** #3235 (grafo de seguir)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O mural por grupo já existe, mas a Home não tem uma visão social agregada. O
jogador precisa abrir grupo por grupo para ver resenhas, fotos e provocações.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | Abre feed social | Vê posts recentes dos grupos em que participa |
| UC2 | Jogador | Tem mais de 10 grupos | Feed consulta em chunks de 10 IDs |
| UC3 | Não-membro | Tenta listar posts de grupo alheio | Rules negam leitura |
| UC4 | Jogador | Clica em post | Navega para o grupo de origem |
| UC5 | Jogador | Reage a post no feed | Reusa `ReactionBar` do mural |

### 1.3 Critérios de Aceite

- [x] CA1: Feed agrega `wall_posts` dos grupos do usuário via collection group e chunks de 10.
- [x] CA2: Reusa `WallPostCard` sem fork de UI.
- [x] CA3: Rules testam membro, não-membro, anon e LIST de collection group.
- [x] CA4: Índice `wall_posts(group_id ASC, created_at DESC)` registrado.
- [x] CA5: Estados loading/empty/error/success.
- [x] CA6: Deep link mínimo para post/grupo funciona no web.
- [x] CA7: Reportar/ocultar post fica implementado ou explicitamente fatiado.

### 1.4 Fora de Escopo

- Coleção global `posts`.
- Fan-out server-side.
- Ranking por engajamento.
- XP por post.
- Feed completo Android, se o corte inicial ficar no web por validação de rules.

---

## 2. Technical Design

### 2.1 Decisão

Implementar a Opção A da issue: feed client-side baseado em
`collectionGroup('wall_posts')` filtrado por `group_id in chunk`, ordenado por
`created_at desc` e mesclado no cliente.

### 2.2 Dados

Reusa `groups/{groupId}/wall_posts/{postId}`. O campo `group_id` é obrigatório
desde o mural e viabiliza filtro/index.

### 2.3 Segurança

Adicionar match de collection group:

```rules
match /{path=**}/wall_posts/{postId} {
  allow read: if isAuthenticated() && (isAdmin() || isGroupMember(resource.data.group_id));
  allow write: if false;
}
```

Writes continuam no caminho canônico do grupo.

---

## 3. Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Spec + decisão ADR | ✅ |
| 2 | Rules + index + rules-tests | ✅ |
| 3 | Web hook `useSocialFeed` | ✅ |
| 4 | Web FeedScreen/entrada na Home | ✅ |
| 5 | Deep link web mínimo | ✅ |
| 6 | Android feed | ✅ |
| 7 | Reportar/ocultar post no feed | ✅ |

---

## 4. Verification

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Rules | Collection group membro/não-membro/list | ✅ `group-wall.test.ts` |
| Web build/lint | TS + ESLint | ✅ |
| Android compile | `:app:compileDebugKotlin` | ✅ |

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-04 | Codex | Spec inicial da Opção A |
| 2026-07-04 | Codex | Rules/index e feed web inicial com deep link de grupo/post |
| 2026-07-04 | Codex | Feed Android inicial com Home entry, rota, card e reações |
| 2026-07-04 | Codex | Reportar/ocultar post no feed com rules e testes |
