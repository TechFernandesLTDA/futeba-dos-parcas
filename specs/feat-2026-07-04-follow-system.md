# SPEC: Sistema de seguir jogadores

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3235
> **Épico:** #3240 (Rede social da pelada)
> **Destrava:** #3236 (feed social com posts/atividade de quem sigo)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O app não possui grafo social. Jogadores podem ver perfis, rankings e quem joga
junto, mas não conseguem seguir parças para alimentar um feed futuro. A feature
cria um sistema assimétrico de seguir, mais leve que amizade bidirecional.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | Segue outro jogador | Relação aparece em `following` e `followers` |
| UC2 | Jogador | Deixa de seguir | Relação espelhada é removida |
| UC3 | Jogador | Abre perfil público | Vê botão seguir/deixar de seguir e contadores |
| UC4 | Jogador | Tenta seguir a si mesmo | Operação é bloqueada |
| UC5 | Usuário não logado | Tenta seguir | Callable exige autenticação |

### 1.3 Critérios de Aceite

- [x] CA1: Modelo `users/{uid}/following/{targetUid}` e `users/{targetUid}/followers/{uid}`.
- [x] CA2: Contadores `following_count` e `followers_count` são mantidos transacionalmente.
- [x] CA3: Operação follow/unfollow é idempotente e não duplica contadores em retry.
- [x] CA4: Usuário não pode seguir a si mesmo.
- [x] CA5: Cliente não escreve diretamente no grafo; usa callable Cloud Function.
- [x] CA6: Firestore rules permitem leitura autenticada e bloqueiam writes client-side.
- [x] CA7: Web tem hook/botão no perfil público.
- [x] CA8: Android tem botão no `PlayerCardBottomSheet` ou follow-up explícito.
- [x] CA9: Feed de quem sigo fica fora desta issue e consome o grafo em #3236.

### 1.4 Fora de Escopo

- Amizade bidirecional com aceite.
- Bloqueio social.
- Sugestões avançadas.
- Feed global/atividade de quem sigo.
- Notificações push de novo seguidor.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[Perfil público]
   ├── [Seguir] -> callable toggleFollow(targetUserId, true)
   └── [Seguindo] -> callable toggleFollow(targetUserId, false)
```

### 2.2 Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| ProfileScreen | Loading | Perfil/hook carregando |
| ProfileScreen | Success | Mostra contadores e botão quando não é o próprio perfil |
| FollowButton | Updating | Botão desabilitado com spinner |
| FollowButton | Error | Toast amigável |

---

## 3. Technical Design

### 3.1 Modelo de Dados

```typescript
users/{uid}/following/{targetUid} {
  target_user_id: string,
  since: Timestamp
}

users/{targetUid}/followers/{uid} {
  follower_user_id: string,
  since: Timestamp
}

users/{uid} {
  following_count: number,
  followers_count: number
}
```

### 3.2 Decisão: callable transacional

A escrita do grafo será feita por callable `toggleFollowUser` em Cloud
Functions, usando Admin SDK e transaction. O cliente não escreve diretamente nas
subcoleções nem nos contadores.

Motivo:
- Batch client-side com `FieldValue.increment` é frágil em retries e pode
  duplicar contadores.
- Rules para permitir contador do outro usuário ficam largas e difíceis de
  provar.
- Callable permite idempotência: só incrementa/decrementa quando o doc de
  relação realmente muda.

### 3.3 Segurança

- `toggleFollowUser` exige `request.auth`.
- `targetUserId` precisa existir e ser diferente do caller.
- Firestore rules:
  - `following`/`followers` read: autenticados.
  - create/update/delete: `false` para clientes.
  - contadores em `users` continuam server-only via Admin SDK.

---

## 4. Tasks (Breakdown)

| # | Task | Status |
|---|------|--------|
| 1 | Criar spec + decisão ADR | ✅ |
| 2 | Callable `toggleFollowUser` + testes unitários | ✅ |
| 3 | Firestore rules + rules-tests read/write | ✅ |
| 4 | Web hook + botão no perfil público | ✅ |
| 5 | Android hook/repository + botão | ✅ |
| 6 | Validação functions/web/rules/android | ✅ |

---

## 5. Verification (Verificação)

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Functions | Follow/unfollow/idempotência/self-follow | ✅ unit: decisão idempotente; build TS |
| Rules | Read permitido e write negado ao cliente | ✅ `follow-system.test.ts` |
| Web build/lint | TS + ESLint | ✅ |
| Android compile | `:app:compileDebugKotlin` | ✅ |
| Manual QA | Perfil público desktop/mobile | ⬜ |

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-04 | Codex | Criação inicial aprovada |
| 2026-07-04 | Codex | Implementação Functions + Rules + Web |
| 2026-07-04 | Codex | Implementação Android no PlayerCard com callable transacional |
