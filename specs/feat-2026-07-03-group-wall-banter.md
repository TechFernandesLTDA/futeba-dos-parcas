# SPEC: Mural de provocações (banter wall) do grupo

> **Status:** `APPROVED`
> **Autor:** Renan (via opencode)
> **Data:** 2026-07-03
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3232
> **Épico:** #3240 (Rede social da pelada)
> **Integra com:** #3233 (reações genéricas) — o mural deve consumir `<ReactionBar />` quando #3233 mergear.

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O `RecentActivityFeed` (web `web/src/pages/home/tabs/RecentActivityFeed.tsx`; Android `app/.../ui/home/components/ActivityFeedSection.kt`) só mostra **eventos automáticos do sistema** (`CHALLENGE_COMPLETED`, `FRIENDS` label, `ADMIN_MESSAGE`, etc. — ver `shared/.../domain/model/Activity.kt`). **Não há** mural/wall/posts criados pelo usuário — nenhuma coleção `posts`/`wall_posts`/`user_posts` em `firestore.rules`.

O "Futeba dos Parças" vive de zoeira. Falta um espaço social no grupo pra provocar o Bola Murcha da semana, comentar golaços, expor o sumido. É o viral loop que falta — hoje o app é organizador, não rede social da pelada.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Membro do grupo | Posta provocação no mural | Post aparece no feed do grupo, visível a todos os membros |
| UC2 | Membro do grupo | Vê mural do grupo | Feed paginado por `createdAt` desc, posts + autor + reações |
| UC3 | Autor do post | Edita próprio post | Texto atualizado, `editedAt` setado |
| UC4 | Autor do post | Deleta próprio post | Post removido (soft-delete), mídia em Storage limpa |
| UC5 | Owner / admin do grupo | Deleta qualquer post (moderação) | Post removido, ação registrada |
| UC6 | Owner do grupo | Fixa (pin) um post no topo | Post fixado aparece primeiro, acima do feed cronológico |
| UC7 | Membro do grupo | Recebe notif "novo post no grupo X" | Notificação respeita toggle em NotificationSettings |
| UC8 | Membro | Clica "postar no mural" a partir de um highlight pós-jogo | Composer pré-preenchido com link ao highlight |

### 1.3 Critérios de Aceite

- [ ] CA1: Só membros do grupo leem/escrevem no mural (regra testada em `firestore-rules-tests`).
- [ ] CA2: Owner/admins podem deletar qualquer post + fixar (pin); autor deleta o próprio.
- [ ] CA3: Compose valida input não-vazio, não-whitespace, máx 500 chars (regra AGENTS.md).
- [ ] CA4: `serverTimestamp()` em todas as escritas (nunca `Timestamp.now()` / `new Date()`).
- [ ] CA5: Upload de mídia (até 1 foto opcional) em `writeBatch` com cleanup de Storage no delete.
- [ ] CA6: Feed paginado por cursor (`limit(20)` + `startAfter`), `orderBy('created_at','desc')`.
- [ ] CA7: Posts fixados (pin) aparecem no topo, separados do feed cronológico.
- [ ] CA8: Toggle `groupWall` em `useNotificationSettings` (default ON).
- [ ] CA9: Estados Loading (ShimmerLoading) / Empty ("seja o primeiro a provocar") / Error (Alert + retry) / Success.
- [ ] CA10: Dark mode + `theme.palette.*` / `MaterialTheme.colorScheme.*` (sem hardcoded).
- [ ] CA11: Botões de ação com `disabled={loading}` + `CircularProgress` (regra AGENTS.md).
- [ ] CA12: Rate-limit por usuário (ex: 5 posts/dia/grupo) enforced em rules.
- [ ] CA13: Integração com highlights: botão "postar no mural" em `PostGameHighlightsPanel.tsx`.

### 1.4 Fora de Escopo

- Reações/emojis no post — handled pela issue #3233 (sistema unificado de reações); o mural apenas **consome** `<ReactionBar />` quando disponível. Se #3233 ainda não mergear, o mural launcha sem reações (campo `reactions` vazio reservado).
- Comentários aninhados no post — a issue #3234 trata comentários em jogos; comentários em mural sai para versão futura se houver demanda.
- Feed global cross-grupo — issue #3236 (feed UGC); o mural é escopo de grupo.
- Moderação automatizada por IA — começar com denúncia + remoção manual.
- Posts com vídeo — futuro (vídeos curtos na issue #3238).
- iOS (CMP) — Fase 3.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[GroupDetailScreen]
   └── [GroupWallScreen] (nova tab/seção)
         ├── Loading  → Shimmer de 5 cards
         ├── Empty    → "Seja o primeiro a provocar 🎤" + CTA composer
         ├── Error    → Alert com retry
         └── Success  → [Pinned post(s) no topo] + [Feed cronológico] + FAB compose
                          └── [WallPostComposer] (dialog/bottomsheet)
                                ├── texto (500 chars) + attach foto (opcional)
                                └── submit → success → fecha + scroll top
```

Integração highlight:
```
[PostGameHighlightsPanel] --botão "postar no mural"--> [WallPostComposer pré-preenchido com highlightRef]
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| GroupWallScreen | Loading | Skeleton de 5 cards (ShimmerLoading) |
| GroupWallScreen | Empty | Ícone 🎤 + "Seja o primeiro a provocar" + botão "Criar post" |
| GroupWallScreen | Error | `<Alert severity="error">` + "Tentar novamente" |
| GroupWallScreen | Success | Pinned posts (chip "Fixado") + feed cronológico + FAB |
| WallPostCard | Success | Avatar + nome + tempo + texto + (foto) + (ReactionBar se #3233) + menu (editar/deletar/pin se owner) |
| WallPostComposer | Open | Bottomsheet: TextField 500 chars + attach foto + botão "Postar" (disabled loading) |
| WallPostComposer | Error | Toast `showError()` + mantém texto digitado |
| NotificationSettings | Success | Novo toggle "Posts do grupo" |

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Web mobile (≤768px) | Lista full-width, composer em bottomsheet |
| Web desktop (≥1024px) | Lista centrada max-width (seguir padrão `games-groups-maxwidth`), composer em modal centrado |
| Android phone portrait | `LazyColumn` com `key` por postId, FAB compose |
| Android phone landscape | FAB permanece, composer em dialog full-screen |
| Android tablet (sw600dp+) | Lista em painel esquerdo, composer em painel direito (ListDetailPaneScaffold) |

### 2.4 Acessibilidade

- [ ] `contentDescription`/`aria-label` em cada post: "Post de {nome} às {tempo}".
- [ ] FAB com `contentDescription="Criar post"`.
- [ ] Menu de ações (editar/deletar/pin) com `aria-label` por ação.
- [ ] Touch targets ≥ 48dp / 44px.
- [ ] Contraste ≥ 4.5:1.
- [ ] Ordem de foco lógica no composer: TextField → attach → submit.
- [ ] Suporte a TalkBack / leitor de tela.

### 2.5 Animações e Micro-interações

- Novo post entra no topo com fade-in + slide-down (≤ 200ms).
- Pin com transição suave para a seção fixada.
- Delete com swipe-to-dismiss (Android) ou botão com confirmação (web).
- Composer attach foto com ripple + preview thumbnail.

---

## 3. Technical Design

### 3.1 Arquitetura

```
[UI: GroupWallScreen.tsx (web) / GroupWallScreen.kt (Android)]
    ↓ eventos (create/edit/delete/pin)
[Hook: useGroupWall.ts (web) / GroupWallViewModel.kt]
    ↓ useQuery (lista paginada) + addDoc/updateDoc/deleteDoc + Storage upload
[Firestore: groups/{groupId}/wall_posts/{postId}]
    ↓ regras em firestore.rules (só membros)
[Storage: groups/{groupId}/wall_media/{postId}.jpg]
[Cloud Functions: FCM "novo post" (opcional) + cron de limpeza (opcional)]
```

Web segue padrão de `useGroupPolls.ts` (TanStack Query + `addDoc` + invalidação).

### 3.2 Modelos de Dados (Firestore)

Nova subcoleção `groups/{groupId}/wall_posts/{postId}`:

```typescript
// snake_case no Firestore
{
  author_id: string,          // uid do autor
  author_name: string,        // snapshot no momento do post (denormalizado)
  author_photo_url: string | null,
  text: string,               // 1..500 chars, trim-validated
  media_ref: string | null,   // path no Storage se houver foto
  media_thumb_ref: string | null, // thumbnail gerada por generate-thumbnails.ts
  highlight_ref: { game_id: string, highlight_id: string } | null, // se veio de highlight
  pinned: boolean,            // false por default; true se fixado
  pinned_by: string | null,
  pinned_at: Timestamp | null,
  created_at: Timestamp,      // serverTimestamp()
  edited_at: Timestamp | null,
  deleted_by: string | null,  // soft-delete p/ auditoria
  deleted_at: Timestamp | null,
  reactions: map | null,      // reservado p/ #3233: { '🔥': [uid,...], ... }
  comments_count: number      // 0 (reservado p/ futuro)
}
```

**Decisões ADR-lite (registrar em `DECISIONS.md`):**
- Denormalização de `author_name`/`author_photo_url` — evita N reads de perfil ao renderizar o feed.
- Soft-delete (`deleted_by`/`deleted_at`) — preserva auditoria e contagem; UI filtra `deleted_at == null`.
- `reactions` reservado como mapa vazio — preenche quando #3233 mergear (não bloquear esta spec).
- `pinned` como campo no doc (não subcoleção) — simplifica query; máximo 3 pins por grupo enforced em rules.

### 3.3 API / Firestore

| Operação | Collection/Endpoint | Método | Payload |
|----------|---------------------|--------|---------|
| Listar posts | `groups/{groupId}/wall_posts` | `getDocs` query `where('deleted_at','==',null) orderBy('created_at','desc') limit(20)` | cursor `startAfter` |
| Criar post | `groups/{groupId}/wall_posts` | `addDoc` | `{author_id, author_name, author_photo_url, text, media_ref, created_at: serverTimestamp(), pinned: false, ...}` |
| Editar post | `groups/{groupId}/wall_posts/{id}` | `updateDoc` | `{text, edited_at: serverTimestamp()}` |
| Deletar post (soft) | `groups/{groupId}/wall_posts/{id}` | `updateDoc` | `{deleted_by, deleted_at: serverTimestamp()}` |
| Pin/unpin | `groups/{groupId}/wall_posts/{id}` | `updateDoc` | `{pinned, pinned_by, pinned_at: serverTimestamp()}` |
| Upload mídia | Storage `groups/{groupId}/wall_media/{postId}.jpg` | `uploadBytes` | file |
| Delete mídia | Storage path | `deleteObject` | — (em `writeBatch` com soft-delete do post) |

### 3.4 Regras Firestore (firestore.rules)

Adicionar dentro de `match /groups/{groupId} { ... }` (após `members`):

```
match /wall_posts/{postId} {
  // Leitura: só membros do grupo (+ admin)
  allow read: if isAuthenticated() &&
    (isAdmin() || isGroupMember(groupId));

  // Create: só membro; valida campos; rate-limit (max 5/dia por autor)
  allow create: if isAuthenticated() &&
    (isAdmin() || isGroupMember(groupId)) &&
    request.resource.data.author_id == userId() &&
    request.resource.data.text is string &&
    request.resource.data.text.size() >= 1 &&
    request.resource.data.text.size() <= 500 &&
    request.resource.data.created_at == request.time &&
    request.resource.data.pinned == false &&
    request.resource.data.deleted_at == null &&
    // rate-limit: query posts do autor nas últimas 24h, max 5
    // (helper novo: isWithinRateLimit(groupId, userId, 5, 24h))
    isWithinWallRateLimit(groupId);

  // Update: autor (edita texto), ou owner/admin (pin OU soft-delete)
  allow update: if isAuthenticated() && (
    // autor edita próprio texto
    (resource.data.author_id == userId() &&
     onlyAllowedFields(['text', 'edited_at']) &&
     request.resource.data.text is string &&
     request.resource.data.text.size() >= 1 &&
     request.resource.data.text.size() <= 500 &&
     request.resource.data.edited_at == request.time) ||
    // owner/admin pin/unpin
    ((isGroupOwner(groupId) || isGroupAdmin(groupId)) &&
     onlyAllowedFields(['pinned', 'pinned_by', 'pinned_at']) &&
     request.resource.data.pinned_at == request.time) ||
    // autor OU owner/admin soft-delete
    ((resource.data.author_id == userId() || isGroupOwner(groupId) || isGroupAdmin(groupId)) &&
     onlyAllowedFields(['deleted_by', 'deleted_at']) &&
     request.resource.data.deleted_at == request.time &&
     request.resource.data.deleted_by == userId())
  );

  // Hard delete: nunca (preserva auditoria). Soft-delete via update.
  allow delete: if false;
}
```

> Helper `isWithinWallRateLimit(groupId)`: query `wall_posts` where `author_id == userId() && created_at > now - 24h`, contar, ≤ 5. Em rules, usar `getAfter`/list query limitada. Se inviável em rules puro, mover validação para callable (tradeoff: perde write direto).

### 3.5 Cloud Functions

**MVP: nenhuma callable obrigatória.** Opcionais:

1. **Trigger `onWallPostCreate`** → FCM "novo post no grupo {nome}" para membros (exceto autor), respeitando `notification_settings/{uid}.groupWall`. Reusar `functions/src/notifications/helpers.ts` + `batch-sender.ts`.
2. **Cron de limpeza** (opcional, futuro) → hard-delete posts com `deleted_at < now - 90d` + limpa Storage. Não bloquear MVP.

Adicionar toggle `groupWall` ao modelo `notification_settings` (`useNotificationSettings.ts:12`) com default `true`.

### 3.6 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| Sem internet ao abrir mural | TanStack Query mostra cache stale + refetch em background |
| Perda de conexão durante post | `addDoc` pendente no SDK; reenvia ao reconectar |
| Upload de mídia offline | Fila local + retry (considerar `uploadBytesResumable` com retry) |
| Erro de Storage no delete | Manter soft-delete do doc + logar cleanup pendente (job futuro) |

### 3.7 Segurança

- [ ] Nenhum token/secret hardcoded.
- [ ] `author_id` validado como `userId()` (não forjar autoria).
- [ ] `created_at` forçado como `request.time` (sem backdate).
- [ ] Texto validado server-side (1..500 chars).
- [ ] Soft-delete preserva auditoria (`deleted_by`).
- [ ] Rate-limit anti-spam (5/dia/autor/grupo).
- [ ] Máx 3 pins por grupo (enforced em rules ou callable).
- [ ] Storage path isolado por `groupId` (regra de Storage).

### 3.8 Performance

- [ ] `limit(20)` + `startAfter` cursor para paginar.
- [ ] `LazyColumn`/`<List>` com `key={post.id}` (regra AGENTS.md).
- [ ] Denormalização de `author_name`/`author_photo_url` evita N reads.
- [ ] Imagens com thumbnail (`generate-thumbnails.ts` já existe para fotos).
- [ ] Query composta `where('deleted_at','==',null) + orderBy('created_at','desc')` precisa de composite index — adicionar em `firestore.indexes.json`.

### 3.9 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `group_wall_opened` | Abre mural | `group_id` |
| `group_wall_post_created` | Cria post | `group_id`, `has_media: bool`, `from_highlight: bool` |
| `group_wall_post_edited` | Edita post | `group_id` |
| `group_wall_post_deleted` | Deleta post | `group_id`, `deleted_by_role: 'self'|'owner'|'admin'` |
| `group_wall_post_pinned` | Fixa post | `group_id` |

**Logs:** nível `DEBUG` via `createLogger('useGroupWall')`, sem PII (não logar texto do post).

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Status |
|---|------|------------|--------|
| 1 | Firestore: subcoleção `groups/{groupId}/wall_posts` + regras + helpers + index | 4h | ⬜ |
| 2 | Storage rules: path `groups/{groupId}/wall_media/{postId}.jpg` | 1h | ⬜ |
| 3 | Web: `useGroupWall.ts` (list paginada + create/edit/delete/pin + Storage upload) | 5h | ⬜ |
| 4 | Web: `GroupWallScreen.tsx` + `WallPostCard.tsx` + estados L/E/E/S | 4h | ⬜ |
| 5 | Web: `WallPostComposer.tsx` (bottomsheet + attach foto) | 3h | ⬜ |
| 6 | Web: integrar em `GroupDetailScreen.tsx` (nova tab/seção) | 1h | ⬜ |
| 7 | Web: toggle `groupWall` em `useNotificationSettings` + `NotificationSettingsScreen` | 1h | ⬜ |
| 8 | Web: botão "postar no mural" em `PostGameHighlightsPanel.tsx` | 2h | ⬜ |
| 9 | Android: `GroupWallRepository` (KMP) + `GroupWallViewModel.kt` + StateFlow | 5h | ⬜ |
| 10 | Android: `GroupWallScreen.kt` (Compose) + `WallPostCard.kt` + composer + estados + a11y | 5h | ⬜ |
| 11 | Android: integrar em `GroupDetailScreen.kt` + highlights | 2h | ⬜ |
| 12 | Cloud Functions: trigger FCM `onWallPostCreate` (opcional) | 3h | ⬜ |
| 13 | Testes rules (`firestore-rules-tests/src/group-wall.test.ts`) | 3h | ⬜ |
| 14 | Testes hook (Vitest) + ViewModel (JUnit/MockK) | 3h | ⬜ |
| 15 | Strings i18n (web `locales/` + Android `strings.xml`) | 1h | ⬜ |

**Total estimado:** ~43h (candidato a 4 PRs: [rules+storage+web-hook] / [web-ui] / [android] / [highlights-integration+FCM])

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Rules (emulator) | create só membro + rate-limit + texto 1..500; update autor/owner/admin; pin só owner/admin; soft-delete; não-membro bloqueado | ⬜ |
| Web (Vitest) | hook list/create/edit/delete/pin, upload mídia, estados, error | ⬜ |
| Android (JUnit) | ViewModel states, create/delete/pin, rate-limit | ⬜ |
| Android (Compose) | fluxo crítico postar + aparecer + pin | ⬜ |
| Storage rules | path isolado por grupo, só membro escreve | ⬜ |

### 5.2 Checklist de Revisão

- [ ] `npm run build` (web) verde
- [ ] `npm run lint` (web) verde
- [ ] `./gradlew :app:compileDebugKotlin` verde
- [ ] `./gradlew :app:testDebugUnitTest` verde
- [ ] `npx jest` (functions) verde
- [ ] `npx firebase emulators:exec --only firestore 'npm run test:rules'` verde
- [ ] Testado em light/dark theme (web + Android)
- [ ] Testado em phone portrait/landscape + tablet
- [ ] Sem regressões em `RecentActivityFeed` (coexiste; mural é UGC separado)
- [ ] Strings em `strings.xml` / `locales/` (sem hardcode)
- [ ] Cores via `theme.palette.*` / `MaterialTheme.colorScheme.*`
- [ ] Analytics implementado
- [ ] Thumbnail de mídia gerada por `generate-thumbnails.ts`

### 5.3 Demo

- [ ] Demo gravada: postar com foto + ver em segundo dispositivo + pin como owner + delete.
- [ ] Feedback incorporado.

---

## 6. Notas e Referências

- Issue: #3232
- Épico: #3240
- Integra com: #3233 (reações) — consumir `<ReactionBar />` quando disponível; campo `reactions` reservado.
- Feed automático atual: `web/src/pages/home/tabs/RecentActivityFeed.tsx`, `app/.../ui/home/components/ActivityFeedSection.kt`
- Modelo de Activity (eventos automáticos): `shared/.../domain/model/Activity.kt`
- Padrão de hook de grupo a espelhar: `web/src/hooks/useGroupPolls.ts` (TanStack Query + addDoc + invalidação)
- Padrão de upload de foto: `web/src/pages/game/GamePhotosTab.tsx`
- Thumbnail: `functions/src/storage/generate-thumbnails.ts`
- Toggles de notif: `web/src/hooks/useNotificationSettings.ts:12`
- Rules de groups: `firestore.rules:1700` (`isGroupMember`, `isGroupOwner`, `isGroupAdmin`)
- Highlights: `web/src/pages/game/PostGameHighlightsPanel.tsx`
- Decisões relacionadas: registrar ADRs (denormalização, soft-delete, rate-limit, reactions reservado) em `/specs/DECISIONS.md`

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-03 | opencode | Criação inicial (DRAFT) |
| 2026-07-03 | Renan | Aprovação → APPROVED |
