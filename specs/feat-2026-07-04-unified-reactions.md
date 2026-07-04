# SPEC: Reações unificadas em conteúdo social

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3233
> **Épico:** #3240 (Rede social da pelada)
> **Destrava:** #3239 (reações no MVP/Bola Murcha)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O mural de provocações já reserva `reactions`, mas ainda não existe regra,
hook, componente ou UI para reagir. Sem isso, posts, fotos, highlights e
resultados seguem sem interação leve, empurrando a zoeira para fora do app.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Membro do grupo | Reage a post do mural | Emoji aparece com contador atualizado |
| UC2 | Participante do jogo | Reage a foto/highlight | Reação fica persistida no conteúdo |
| UC3 | Jogador | Toca no mesmo emoji novamente | Sua reação é removida atomicamente |
| UC4 | Jogador | Troca de emoji | Emoji anterior remove seu uid e novo emoji adiciona |
| UC5 | Não participante/não membro | Tenta reagir | Firestore rules negam a escrita |

### 1.3 Critérios de Aceite

- [x] CA1: Toggle add/remove usa `arrayUnion`/`arrayRemove`, sem read-modify-write.
- [x] CA2: Usuário pode ter no máximo 1 reação ativa por conteúdo.
- [x] CA3: Emojis permitidos: `🔥`, `😂`, `👏`, `😡`, `💀`, `🤡`, `👑`, `⚽`.
- [x] CA4: UI exibe top 3 emojis + total e destaca a reação do usuário.
- [x] CA5: Firestore rules permitem alterar somente `reactions` nos ramos de reação.
- [x] CA6: Rules-tests cobrem permitido, não membro/participante e alteração de campo extra.
- [x] CA7: Web tem `useReactions`/`ReactionBar` acessíveis e com rollback em erro.
- [x] CA8: Android tem `ReactionBar` Compose com touch target >= 48dp.
- [ ] CA9: Integrado em `wall_posts`, `game_photos`, `post_game_highlights` (Web completo; Android fotos/highlights pendente).
- [ ] CA10: Resultado MVP/Bola Murcha fica fora desta entrega e consome o sistema em #3239.

### 1.4 Fora de Escopo

- Notificação push por reação.
- Feed global de reações.
- Subcoleção `reactions/{uid}`; só migrar se documentos passarem de ~100 reações.
- iOS/CMP.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[Conteúdo social]
   └── [ReactionBar]
         ├── top 3 emojis + total visível
         ├── tap emoji existente → toggle
         └── botão "+" → menu de emojis permitidos
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| WallPostCard | Success | `ReactionBar` abaixo do texto/mídia |
| GamePhotosTab | Success | `ReactionBar` em cada foto |
| PostGameHighlightsPanel | Success | `ReactionBar` em cada highlight |
| ReactionBar | Updating | Atualização otimista, rollback se Firestore falhar |
| ReactionBar | Error | Toast/snackbar amigável e estado anterior restaurado |

### 2.3 Acessibilidade

- [ ] Cada emoji tem `aria-label` / `contentDescription` com ação e contagem.
- [ ] Botões com alvo mínimo 44px web / 48dp Android.
- [ ] Estado selecionado anunciado para leitor de tela.
- [ ] Sem dependência exclusiva de cor para indicar seleção.

---

## 3. Technical Design

### 3.1 Modelo de Dados

O campo é embutido no documento alvo:

```typescript
{
  reactions: {
    "🔥": ["uid1", "uid2"],
    "😂": ["uid3"]
  }
}
```

Decisões:
- `reactions` é mapa de emoji para lista de UIDs, compatível com o campo já
  reservado em `wall_posts`.
- 1 reação ativa por usuário por conteúdo. Para trocar, remover o UID de todos
  os emojis permitidos e adicionar ao emoji novo.
- Escritas usam `arrayUnion`/`arrayRemove` em paths `reactions.<emoji>`.

### 3.2 Alvos

| Alvo | Path | Acesso |
|------|------|--------|
| Mural | `groups/{groupId}/wall_posts/{postId}` | Membros do grupo |
| Fotos do jogo | `game_photos/{photoId}` | Participante confirmado, gestor do jogo ou admin |
| Highlights | `post_game_highlights/{gameId}` | Participante confirmado, gestor do jogo ou admin |

> Path confirmado em 2026-07-04: fotos usam coleção top-level `game_photos`.
> Highlights continuam derivados em runtime; `post_game_highlights/{gameId}`
> guarda apenas estado social persistente (`game_id`, `reactions`, `updated_at`).

### 3.3 Web

- Criar `web/src/constants/reactions.ts` com emojis e helpers puros.
- Criar `web/src/hooks/useReactions.ts` genérico recebendo doc ref/path,
  mapa atual e callback opcional de erro.
- Criar `web/src/components/reactions/ReactionBar.tsx`.
- Integrar primeiro no mural e depois nos demais alvos, mantendo API genérica.
- Strings novas nos 3 locales.

### 3.4 Android

- Criar helper/modelo de reações onde couber no app Android.
- Criar `ReactionBar.kt` genérico para Compose.
- Adicionar método de toggle nos repositories dos alvos.
- Strings novas nos 3 `strings.xml`.

### 3.5 Firestore Rules

- `wall_posts`: adicionar ramo de update que permite alterar somente
  `reactions` para membro do grupo.
- Fotos/highlights: adicionar `reactions` ao schema se houver `hasOnly` e ramo
  de update equivalente.
- Não permitir junto com texto, pin ou soft-delete no mesmo update.

### 3.6 Performance

- Renderizar no máximo top 3 emojis + total.
- Não fazer reads extras de `users`.
- Migration para subcoleção se conteúdo frequentemente exceder ~100 reações.

---

## 4. Tasks (Breakdown)

| # | Task | Status |
|---|------|--------|
| 1 | Criar spec + decisão ADR | ✅ |
| 2 | Helpers/constants compartilháveis no web | ✅ |
| 3 | Rules + rules-tests para mural | ✅ |
| 4 | `ReactionBar` web + integração no mural | ✅ |
| 5 | Integração web em fotos/highlights | ✅ |
| 6 | `ReactionBar` Android + repository methods | ✅ Mural |
| 7 | Integração Android em mural/fotos/highlights | 🟡 Mural ✅; app Android sem superfície atual de fotos/highlights para integrar |
| 8 | Validação web/functions/rules/android | 🟡 Build/lint web, rules e compile Android executados; QA manual e Android fotos/highlights pendentes |

---

## 5. Verification (Verificação)

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Rules | Toggle permitido/negado e campo extra negado | ✅ `game-photos.test.ts` + `group-wall.test.ts` |
| Web build/lint | TS + ESLint | ✅ `npm run build`, `npm run lint` |
| Android compile | `:app:compileDebugKotlin` | ✅ |
| Manual QA | Mural em light/dark + mobile/desktop | ⬜ |

---

## 6. Notas e Referências

- Issue: #3233
- Épico: #3240
- Specs relacionadas: `specs/feat-2026-07-03-group-wall-banter.md`,
  `specs/feat-2026-07-03-game-chat-realtime.md`
- Decisões: `specs/DECISIONS.md`
- Auditoria Android 2026-07-04: não há tela/repository atual equivalente a
  `game_photos` ou `PostGameHighlightsPanel`; Android tem mural e resultado de
  votação, sendo resultado tratado por #3239 após #3234.

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-04 | Codex | Criação inicial aprovada |
| 2026-07-04 | Codex | Implementação parcial: mural Web/Android, fotos Web, rules-tests e validações automatizadas |
