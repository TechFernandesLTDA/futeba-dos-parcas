# SPEC: Mensagens diretas entre jogadores

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **Issue:** #3231
> **Epico:** #3240 (Rede social da pelada)

## Decisoes

- `chatId` deterministico: UIDs ordenados alfabeticamente unidos por `_`.
- Colecao raiz `chats/{chatId}` com `participants: [uidA, uidB]`.
- Subcolecao `chats/{chatId}/messages/{messageId}` para mensagens.
- Criacao de chat e server-only via callable `createDirectChat`.
- Anti-cold-DM: callable permite iniciar chat somente quando os usuarios
  compartilham ao menos um grupo ativo ou ao menos um jogo com presenca
  `CONFIRMED`.
- Bloqueio social proprio: `users/{uid}/blocked/{targetUid}`. O bloqueio de
  dono de jogo existente nao e reutilizado porque tem semantica diferente.
- Opt-out de DM fica documentado como follow-up de settings; o MVP usa
  anti-cold-DM como default privacy gate.
- FCM fica fora da primeira entrega tecnica; a estrutura de metadata
  (`unread_count`) prepara o proximo passo.

## Modelo

`chats/{chatId}`:

```ts
{
  participants: string[];
  participant_names: Record<string, string>;
  participant_photos: Record<string, string | null>;
  created_at: Timestamp;
  created_by: string;
  last_message: string | null;
  last_message_at: Timestamp | null;
  last_sender_id: string | null;
  unread_count: Record<string, number>;
}
```

`chats/{chatId}/messages/{messageId}`:

```ts
{
  sender_id: string;
  sender_name: string;
  sender_photo_url: string | null;
  text: string;
  created_at: Timestamp;
  deleted_by: string | null;
  deleted_at: Timestamp | null;
}
```

## Regras

- Chat doc: leitura apenas por participante; create/delete client-side negado.
- Metadata update por participante restrito a `last_message`, `last_message_at`,
  `last_sender_id`, `unread_count` e somente com `last_sender_id == uid`.
- Messages: leitura por participante; create por participante com
  `sender_id == uid`, texto 1..1000, `created_at == request.time`; hard delete
  negado; soft-delete por autor.
- Bloqueio social: usuario gerencia `users/{uid}/blocked/{targetUid}`; leitura
  propria/admin.

## UI

- Web: lista `/messages`, conversa `/messages/:chatId`, hook de lista e hook de
  conversa.
- Android: repository/ViewModel e telas equivalentes.
- Entrada primaria: inbox em Home/menu lateral web e botao "Mensagem" nos
  jogadores proximos, abrindo ou criando a conversa por callable.

## Validacao

- `cd functions && npm run build`
- `cd functions && npm run lint`
- `cd web && npm run build`
- `cd web && npm run lint`
- `firebase emulators:exec --only firestore --project futebadosparcas "cd firestore-rules-tests && npx vitest run src/direct-messages.test.ts"`
  - 8/8 testes passando, incluindo create client-side negado, leitura apenas
    por participantes, mensagem valida, autoria/backdate/texto longo negados,
    soft-delete, metadata de ultima mensagem e read receipt proprio.
- `./gradlew :app:compileDebugKotlin`
- `git diff --check`
