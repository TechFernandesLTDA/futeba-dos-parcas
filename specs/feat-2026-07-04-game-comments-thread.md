# SPEC: Comentários livres em jogos

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3234
> **Épico:** #3240 (Rede social da pelada)
> **Depende:** #3233 para reações em comentários; destrava #3239

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O app já tem chat em tempo real por jogo e recado pós-jogo 1-por-usuário, mas
não existe uma thread persistente para comentários livres sobre a partida. A
feature cria uma memória social do jogo sem reaproveitar indevidamente o chat
efêmero nem migrar os recados existentes.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Participante confirmado | Comenta no jogo | Comentário aparece em tempo real |
| UC2 | Participante confirmado | Responde um comentário raiz | Resposta fica aninhada em 1 nível |
| UC3 | Autor | Edita o próprio comentário | Texto muda com `edited_at` |
| UC4 | Autor/organizador/admin | Remove comentário | Comentário recebe soft-delete |
| UC5 | Não participante | Tenta comentar | Firestore rules negam a escrita |

### 1.3 Critérios de Aceite

- [x] CA1: Subcoleção `games/{gameId}/comments` com campos snake_case.
- [x] CA2: Leitura segue o mesmo gate do jogo/chat.
- [x] CA3: Escrita restrita a confirmado, dono do jogo, admin do grupo ou admin global.
- [x] CA4: Texto validado 1..500 caracteres no client e nas rules.
- [x] CA5: `created_at`, `edited_at`, `deleted_at` usam `serverTimestamp()`/`request.time`.
- [x] CA6: Edição só pelo autor; soft-delete por autor, dono/admin do grupo/admin global.
- [x] CA7: Hard-delete bloqueado.
- [x] CA8: Web tem hook realtime com loading/error/empty/success, paginação e error callback.
- [x] CA9: UI Web integra no detalhe do jogo sem remover `post_game_messages`.
- [x] CA10: Android tem repository/ViewModel/tela ou follow-up explícito se não houver rota segura nesta fatia.

### 1.4 Fora de Escopo

- Migrar `post_game_messages`.
- Notificação push por comentário.
- Comentários em posts do mural.
- Ranking/top comentários.
- Resultado MVP/Bola Murcha; #3239 consome esta base.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[Detalhe do jogo]
   └── [Comentários]
         ├── lista raiz por created_at desc
         ├── responder comentário raiz
         ├── editar próprio comentário
         └── remover via soft-delete
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| GameCommentsPanel | Loading | Spinner compacto |
| GameCommentsPanel | Error | Alert com mensagem do Firestore |
| GameCommentsPanel | Empty | EmptyState convidando comentário |
| GameCommentsPanel | Success | Lista + composer se usuário pode escrever |

### 2.3 Acessibilidade

- Botões têm `aria-label`/tooltip.
- Composer usa helper de contagem de caracteres.
- Ação de envio desabilita durante loading.
- Conteúdo deletado não é renderizado na v1.

---

## 3. Technical Design

### 3.1 Modelo de Dados

```typescript
{
  author_id: string,
  author_name: string,
  author_photo_url: string | null,
  text: string,
  parent_id: string | null,
  created_at: Timestamp,
  edited_at: Timestamp | null,
  deleted_at: Timestamp | null,
  deleted_by: string | null,
  reactions: {}
}
```

Decisões:
- `post_game_messages` permanece como recado destacado 1-por-usuário.
- `games/{gameId}/comments` é a thread livre.
- Aninhamento limitado a 1 nível: `parent_id` aponta para comentário raiz.
- `reactions` fica reservado para consumo posterior de #3233/#3239.

### 3.2 Firestore Rules

- `allow read`: mesmo gate de `games/{gameId}/chat`.
- `allow create`: confirmado, dono, admin de grupo ou admin global.
- `allow update`: ramos separados para edição de texto e soft-delete.
- `allow delete`: `false`.

### 3.3 Web

- Criar `web/src/hooks/useGameComments.ts`.
- Criar `web/src/pages/game/GameCommentsPanel.tsx`.
- Integrar em `GameDetailScreen.tsx` após chat/highlights.
- Strings nos 3 locales.

### 3.4 Android

- Reaproveitar padrão `GameChatRepository`/`GameChatViewModel`.
- Integrar somente após confirmar rota segura no detalhe do jogo.

---

## 4. Tasks (Breakdown)

| # | Task | Status |
|---|------|--------|
| 1 | Criar spec + decisão ADR | ✅ |
| 2 | Rules + rules-tests para `games/{gameId}/comments` | ✅ |
| 3 | Hook Web realtime/paginação/CRUD | ✅ |
| 4 | UI Web + integração no detalhe do jogo | ✅ |
| 5 | Strings Web pt/en/es | ✅ |
| 6 | Android repository/ViewModel/tela | ✅ |
| 7 | Validação Web/rules/Android | 🟡 Web/rules/compile Android ✅; QA manual pendente |

---

## 5. Verification (Verificação)

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Rules | create/edit/delete permitido e negado | ✅ `game-comments.test.ts`; combinado social 81/81 |
| Web build/lint | TS + ESLint | ✅ |
| Android compile | `:app:compileDebugKotlin` | ✅ |
| Manual QA | Desktop/mobile, light/dark | ⬜ |

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-04 | Codex | Criação inicial aprovada |
| 2026-07-04 | Codex | Implementação Web + Firestore Rules + rules-tests |
| 2026-07-04 | Codex | Implementação Android + compile Kotlin |
