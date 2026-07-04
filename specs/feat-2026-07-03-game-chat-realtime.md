# SPEC: Chat em tempo real por jogo (pré/pós-partida)

> **Status:** `DRAFT`
> **Autor:** Renan (via opencode)
> **Data:** 2026-07-03
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3230
> **Épico:** #3240 (Rede social da pelada)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

A única interação textual por jogo hoje é o `post_game_messages` — um **recado único** de até 240 chars por usuário (`web/src/hooks/usePostGameMessages.ts:60-68`, doc ID `${gameId}_${uid}`, `setDoc merge:true`). Não é conversa em tempo real: cada um deixa UM recado depois do jogo, sem contexto de diálogo.

A coordenação real da pelada ("alguém leva bola?", "cheguei na quadra", "tô atrasado 10min", "cancelou, choveu") acontece fora do app (WhatsApp). Isso fragmenta o contexto, prejudica retenção e impede o app de ser o hub único da pelada.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador confirmado | Envia mensagem no chat do jogo | Mensagem aparece em tempo real para todos os participantes |
| UC2 | Jogador confirmado | Lê mensagens enquanto outros digitam | Atualização em tempo real sem refresh |
| UC3 | Jogador NÃO confirmado | Tenta enviar mensagem | Bloqueado (apenas leitura se o jogo for visível a ele) |
| UC4 | Dono do jogo / admin do grupo | Deleta mensagem ofensiva | Mensagem removida para todos; ação registrada |
| UC5 | Jogador | Recebe notificação push "nova msg no jogo X" | Notificação respeita toggle em NotificationSettings |
| UC6 | Jogador | Abre chat de jogo já finalizado há >7 dias | Chat em modo só-leitura (arquivado) |

### 1.3 Critérios de Aceite

- [ ] CA1: Mensagens aparecem em tempo real via `onSnapshot` com callback de erro (regra AGENTS.md).
- [ ] CA2: Apenas jogadores confirmados + dono do jogo + admins do grupo dono podem **escrever**.
- [ ] CA3: Leitura permitida a quem já pode ver o jogo (reuses a read-rule de `games/{gameId}`).
- [ ] CA4: `serverTimestamp()` em todas as escritas (nunca `Timestamp.now()` / `new Date()`).
- [ ] CA5: Compose valida input não-vazio, não-whitespace, máx 500 chars (regra AGENTS.md).
- [ ] CA6: Botão enviar com `disabled={loading}` + `CircularProgress` (regra AGENTS.md).
- [ ] CA7: Estados Loading / Empty / Error / Success conforme AGENTS.md.
- [ ] CA8: Toggle `gameChat` em `useNotificationSettings` (default ON).
- [ ] CA9: Regras validadas em `firestore-rules-tests` (escrita só de participantes, delete só autor/admin).
- [ ] CA10: Dark mode + `theme.palette.*` (sem `'white'`/`'#fff'`/hex hardcoded).
- [ ] CA11: Arquivamento automático: após `game.date_time + 7d` o chat vira só-leitura (regra por timestamp).
- [ ] CA12: Paginação por cursor (`limit(50)` + `startAfter`) para jogos com muitas mensagens.

### 1.4 Fora de Escopo

- Mensagens diretas (DM 1:1) — issue separada #3231.
- Mídia anexada (fotos/vídeos no chat) — futuro; vídeos curtos na issue #3238.
- Indicador "digitando..." — futuro (subcoleção `presence` leve).
- Edição de mensagem — só delete nesta versão.
- Respostas aninhadas (threads) — chat linear nesta versão; threads na issue #3234.
- Moderação automatizada por IA — começar com denúncia + remoção manual.
- iOS (CMP) — Fase 3; esta spec cobre web + Android.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[GameDetailScreen]
   └── [GameChatPanel] (nova seção ao lado de GamePhotosTab/Highlights)
         ├── Loading  → Shimmer/skeleton de bolhas
         ├── Empty    → "Seja o primeiro a mandar algo no jogo"
         ├── Error    → Alert com retry
         └── Success  → Lista de mensagens (realtime) + composer
                          ├── composer disabled se arquivado (badge "Chat arquivado")
                          └── composer disabled se não-confirmado (hint "confirme presença pra falar")
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| GameChatPanel | Loading | Skeleton de 5 bolhas de chat (ShimmerLoading) |
| GameChatPanel | Empty | Ícone + "Nenhuma mensagem ainda. Manda a primeira!" |
| GameChatPanel | Error | `<Alert severity="error">` com botão "Tentar novamente" |
| GameChatPanel | Success (escrita) | Lista bolhas (autor=à direita, outros=à esquerda) + TextField + IconButton enviar |
| GameChatPanel | Success (só leitura - não confirmado) | Lista bolhas sem composer; banner informativo |
| GameChatPanel | Success (arquivado) | Lista bolhas + chip "Chat arquivado" no topo, sem composer |
| NotificationSettings | Success | Novo toggle "Mensagens do jogo" |

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Web mobile (≤768px) | Panel full-width abaixo das infos do jogo |
| Web desktop (≥1024px) | Panel em coluna à direita ou em tab dedicada |
| Android phone portrait | Lista `LazyColumn` com `key` por messageId, composer fixo no bottom |
| Android phone landscape | Composer permanece visível, lista ganha altura |
| Android tablet (sw600dp+) | Panel em painel lateral (ListDetailPaneScaffold), sem reducer |

### 2.4 Acessibilidade

- [ ] `contentDescription`/`aria-label` em cada bolha: "Mensagem de {nome} às {hora}: {texto}".
- [ ] IconButton enviar com `aria-label="Enviar mensagem"`.
- [ ] Touch targets ≥ 48dp (Android) / 44px (web).
- [ ] Ordem de foco lógica: composer → botão enviar → lista.
- [ ] Contraste ≥ 4.5:1 nas bolhas (verificar com `ContrastHelper`).
- [ ] Suporte a TalkBack / leitor de tela (anúncio de nova mensagem opcional).

### 2.5 Animações e Micro-interações

- Nova mensagem entra com fade-in + slide-up suave (≤ 200ms).
- Auto-scroll para bottom quando nova mensagem chega (somente se já estava no bottom — não interrompe leitura histórica).
- Botão enviar com ripple + disabled state durante envio.

---

## 3. Technical Design

### 3.1 Arquitetura

```
[UI: GameChatPanel.tsx (web) / GameChatScreen.kt (Android)]
    ↓ eventos (enviar/deletar)
[Hook: useGameChat.ts (web) / GameChatViewModel.kt]
    ↓ onSnapshot realtime + addDoc/deleteDoc
[Firestore: games/{gameId}/chat/{messageId}]
    ↓ regras em firestore.rules
[Cloud Functions: FCM "nova msg" (opcional nesta fase)]
```

Web segue o padrão realtime de `useNotifications.ts:54` (`onSnapshot` com callback de erro + cleanup no `return () => unsubscribe()`).

### 3.2 Modelos de Dados (Firestore)

Nova subcoleção `games/{gameId}/chat/{messageId}`:

```typescript
// snake_case no Firestore (convenção do projeto)
{
  sender_id: string,        // uid do autor
  sender_name: string,      // snapshot no momento do envio (denormalizado)
  sender_photo_url: string | null,
  text: string,             // 1..500 chars, trim-validated
  created_at: Timestamp,    // serverTimestamp() sempre
  deleted_by: string | null,// uid de quem deletou (soft-delete p/ auditoria)
  deleted_at: Timestamp | null
}
```

**Decisão ADR-lite (registrar em `DECISIONS.md`):**
- Snapshot de `sender_name`/`sender_photo_url` no momento do envio (denormalizado) — evita N reads de perfil ao renderizar; aceita staleness se o usuário edita foto/nome depois.
- Soft-delete (`deleted_by`/`deleted_at`) em vez de hard-delete — preserva auditoria e contagem; UI filtra `deleted_at == null`.

Não há mudança no doc raiz `games/{gameId}` (chat é self-contained na subcoleção).

### 3.3 API / Firestore

| Operação | Collection/Endpoint | Método | Payload |
|----------|---------------------|--------|---------|
| Escutar mensagens | `games/{gameId}/chat` | `onSnapshot` query `orderBy('created_at','asc') limit(50)` | — |
| Paginar mais antigas | `games/{gameId}/chat` | `getDocs` `startAfter(lastDoc)` `limit(50)` | cursor |
| Enviar mensagem | `games/{gameId}/chat` | `addDoc` | `{sender_id, sender_name, sender_photo_url, text, created_at: serverTimestamp()}` |
| Deletar mensagem | `games/{gameId}/chat/{id}` | `updateDoc` | `{deleted_by: uid, deleted_at: serverTimestamp()}` |
| Marcar notif lida | `notifications/{id}` | `updateDoc` | `{read: true}` (reuso existente) |

### 3.4 Regras Firestore (firestore.rules)

Adicionar dentro de `match /games/{gameId} { ... }` (após a subcoleção `confirmations`):

```
match /chat/{messageId} {
  // Leitura: quem já pode ler o jogo (reuses a gate de visibility do pai)
  allow read: if isAuthenticated() &&
    (resource == null || /* list query */ true) &&
    // acesso ao pai validado por get()
    get(/databases/$(database)/documents/games/$(gameId)).data.visibility != 'GROUP_ONLY'
      ? true
      : isGroupMember(get(/databases/$(database)/documents/games/$(gameId)).data.group_id);

  // Escrita (create): só confirmados, dono, ou admin do grupo dono
  // + validação de campos + texto 1..500 + arquivamento (game.date_time + 7d)
  allow create: if isAuthenticated() &&
    request.resource.data.sender_id == userId() &&
    request.resource.data.text is string &&
    request.resource.data.text.size() >= 1 &&
    request.resource.data.text.size() <= 500 &&
    request.resource.data.created_at == request.time &&
    (isConfirmedPlayer(gameId) || isGameOwner(gameId) || isGroupAdmin(get(...).group_id)) &&
    // arquivamento: não permite escrever se game.date_time + 7d < now
    timestamp.value(game.date_time + 7*24*60*60) > request.time;

  // Delete (soft): autor, dono do jogo, ou admin do grupo
  allow update: if isAuthenticated() &&
    (resource.data.sender_id == userId() ||
     isGameOwner(gameId) ||
     isGroupAdmin(get(...).group_id)) &&
    onlyAllowedFields(['deleted_by', 'deleted_at']) &&
    request.resource.data.deleted_at == request.time;
}
```

> Nota: a expressão exata de arquivamento e o helper `isGroupAdmin` precisam ser validados contra os helpers existentes em `firestore.rules` (já há `isGameOwner`, `isConfirmedPlayer`, `isGroupMember`, `isGroupAdmin`). Escrever testes em `firestore-rules-tests/src/game-chat.test.ts`.

### 3.5 Cloud Functions

**Nesta fase (MVP): nenhuma callable obrigatória.** Writes validados por rules. Opcional:

- Trigger `onChatMessageCreate` (firestore document create em `games/{gameId}/chat`) → envia FCM para confirmados exceto o remetente, respeitando `notification_settings/{uid}.gameChat`. Reusar `functions/src/notifications/helpers.ts` e `batch-sender.ts`.

Se o trigger for incluído, adicionar toggle `gameChat` ao modelo de `notification_settings` (ver `useNotificationSettings.ts:12`) com default `true`.

### 3.6 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| Sem internet ao abrir chat | Firestore SDK usa cache local automaticamente; banner "offline" opcional |
| Perda de conexão durante envio | `addDoc` fica pendente no SDK; reenvia ao reconectar (não precisa fila custom) |
| Listener cai | callback de erro do `onSnapshot` seta estado Error + retry manual |

### 3.7 Segurança

- [ ] Nenhum token/secret hardcoded.
- [ ] `sender_id` validado como `userId()` (não pode forjar autoria).
- [ ] `created_at` forçado como `request.time` (não pode backdate).
- [ ] Texto validado server-side (1..500 chars).
- [ ] Arquivamento enforced em rules (não só client).
- [ ] Soft-delete preserva auditoria (`deleted_by`).

### 3.8 Performance

- [ ] `limit(50)` + `startAfter` cursor para paginar mensagens antigas.
- [ ] `LazyColumn`/`<List>` com `key={message.id}` (regra AGENTS.md).
- [ ] `onSnapshot` unsubscribe rigoroso no cleanup do `useEffect` (evita listener órfão).
- [ ] Denormalização de `sender_name`/`sender_photo_url` evita N reads de perfil.
- [ ] Auto-scroll inteligente (só se já no bottom) para não jank em listas grandes.

### 3.9 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `game_chat_opened` | Abre panel | `game_id`, `is_confirmed: bool` |
| `game_chat_message_sent` | Envia mensagem | `game_id`, `length: int` |
| `game_chat_message_deleted` | Deleta mensagem | `game_id`, `deleted_by_role: 'self'|'owner'|'admin'` |

**Logs:** nível `DEBUG` via `createLogger('useGameChat')`, sem PII (não logar texto da mensagem).

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Status |
|---|------|------------|--------|
| 1 | Firestore: nova subcoleção `games/{gameId}/chat` + regras + helpers | 3h | ⬜ |
| 2 | Web: `useGameChat.ts` (onSnapshot + paginação + send/delete) | 4h | ⬜ |
| 3 | Web: `GameChatPanel.tsx` + composer + estados L/E/E/S | 4h | ⬜ |
| 4 | Web: integrar panel em `GameDetailScreen.tsx` (ao lado de GamePhotosTab) | 1h | ⬜ |
| 5 | Web: toggle `gameChat` em `useNotificationSettings.ts` + `NotificationSettingsScreen.tsx` | 1h | ⬜ |
| 6 | Android: `GameChatRepository` (KMP) + `GameChatViewModel.kt` + StateFlow | 4h | ⬜ |
| 7 | Android: `GameChatScreen.kt` (Compose) + estados + a11y | 4h | ⬜ |
| 8 | Android: integrar em `GameDetailScreen.kt` | 1h | ⬜ |
| 9 | Cloud Functions: trigger FCM `onChatMessageCreate` (opcional) | 3h | ⬜ |
| 10 | Testes rules (`firestore-rules-tests/src/game-chat.test.ts`) | 3h | ⬜ |
| 11 | Testes hook (Vitest) + ViewModel (JUnit/MockK) | 3h | ⬜ |
| 12 | Strings i18n (web `locales/` + Android `strings.xml`) | 1h | ⬜ |

**Total estimado:** ~32h (candidato a 3 PRs: [rules+web] / [android] / [FCM trigger])

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Rules (emulator) | create só confirmado/owner/admin; update só autor/owner/admin; arquivamento; texto 1..500; sender_id == uid | ⬜ |
| Web (Vitest) | hook realtime, paginação, send/delete, estados, error callback | ⬜ |
| Android (JUnit) | ViewModel states, send/delete, arquivamento | ⬜ |
| Android (Compose) | fluxo crítico enviar + aparecer | ⬜ |

### 5.2 Checklist de Revisão

- [ ] `npm run build` (web) verde
- [ ] `npm run lint` (web) verde
- [ ] `./gradlew :app:compileDebugKotlin` verde
- [ ] `./gradlew :app:testDebugUnitTest` verde
- [ ] `npx jest` (functions) verde
- [ ] `npx firebase emulators:exec --only firestore 'npm run test:rules'` verde
- [ ] Testado em light/dark theme (web + Android)
- [ ] Testado em phone portrait/landscape + tablet
- [ ] Sem regressões em `post_game_messages` (coexiste; não substitui nesta versão)
- [ ] Strings em `strings.xml` / `locales/` (sem hardcode)
- [ ] Cores via `theme.palette.*` / `MaterialTheme.colorScheme.*`
- [ ] Analytics implementado

### 5.3 Demo

- [ ] Demo gravada: dois dispositivos mostrando realtime + bloqueio de não-confirmado + arquivamento.
- [ ] Feedback incorporado.

---

## 6. Notas e Referências

- Issue: #3230
- Épico: #3240
- Hook atual (recado único): `web/src/hooks/usePostGameMessages.ts`
- Padrão realtime a espelhar: `web/src/hooks/useNotifications.ts:54` (onSnapshot + error callback + cleanup)
- Padrão de painel no detalhe: `web/src/pages/game/GamePhotosTab.tsx` (renderizado em `GameDetailScreen.tsx:739,795`)
- Toggles de notif: `web/src/hooks/useNotificationSettings.ts:12`
- Helpers de rules: `firestore.rules` (`isGameOwner`, `isConfirmedPlayer`, `isGroupMember`, `isGroupAdmin`)
- Decisões relacionadas: registrar ADR de denormalização de `sender_name` em `/specs/DECISIONS.md`

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-03 | opencode | Criação inicial (DRAFT) |
