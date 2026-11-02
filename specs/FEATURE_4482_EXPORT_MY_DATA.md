# SPEC: Exportação dos dados do titular (`exportMyData`) — web + Cloud Functions

> **Status:** `APPROVED` (dono autorizou autonomia ampla; aprovado em 2026-11-01)
> **Autor:** Claude Code (sessão agente) para Renan Locatiz Fernandes
> **Data:** 2026-11-01
> **Issue:** #4482 (filha de #4398). Paridade Android/iOS: #4483
> **PR:** #4486
> **Base adaptada:** `_TEMPLATE_FEATURE_MOBILE.md`, sem as seções de Compose (a entrega é web + Functions)

---

## 1. Requirements

### 1.1 Problema

A LGPD, art. 18, V, garante ao titular a portabilidade dos dados pessoais. O app tem exclusão de conta (#4391), mas nenhuma forma de o usuário obter uma cópia dos próprios dados. O épico de lançamento #4398 registra a ausência de `exportMyData`.

A exportação e a exclusão resolvem o mesmo problema pelos dois lados: enumerar tudo que identifica um uid. A memória do projeto registra que, quando dois arquivos irmãos mantêm listas próprias, cada um vira o ponto cego do outro (#4112/#4113). Por isso a exportação nasce presa à mesma lista canônica (`functions/src/auth/uid-owned-collections.ts`) e a um teste que compara as duas.

### 1.2 Casos de uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|--------------------|
| UC1 | Jogador logado (web) | Configurações → "Baixar meus dados" | Navegador baixa `futeba-dos-parcas-meus-dados-AAAA-MM-DD.json` |
| UC2 | Jogador que já exportou 3 vezes no dia | Clica de novo | Mensagem de limite diário, sem download |
| UC3 | Jogador com dados num caminho cujo índice falta em produção | Exporta | Download acontece; o arquivo e a tela avisam que a exportação saiu parcial e quais seções faltaram |
| UC4 | Titular que depois exclui a conta | Excluir conta | O registro de auditoria da exportação também é apagado pela cascata (`actor_user_id`) |

### 1.3 Critérios de aceite

- [x] CA1: callable `exportMyData` com `secureCallable` (App Check, login obrigatório, limite de 3 chamadas por 24 h por usuário via `rate-limiter.ts`).
- [x] CA2: JSON único, datas em ISO 8601 UTC (`Timestamp` → string ISO; `GeoPoint` → `{latitude, longitude}`; `DocumentReference` → caminho; bytes → base64).
- [x] CA3: toda coleção de `UID_OWNED_COLLECTIONS` é exportada, consultando TODOS os campos de uid declarados ali (incluindo formas legadas `userId`, `ownerId`, `invitedUserId`) e lendo pelo ID quando o esquema é `{uid}`.
- [x] CA4: toda coleção tocada por `onUserDeleted`, `account-deletion-cascade.ts` e `account-merge.ts` está na exportação ou numa lista de exclusões com motivo. Coleção nova sem decisão quebra o teste.
- [x] CA5: documentos compartilhados (jogos, grupos, caixa, avaliações, votos, notificações, convites, mensagens) passam por projeção por **allowlist**; nenhum nome, foto ou uid de terceiro sai no arquivo. Votos MVP e avaliações recebidos não revelam quem votou/avaliou.
- [x] CA6: credenciais técnicas (`fcm_token`, tokens push, hashes de índice) não saem no arquivo; tokens push saem só como metadados (plataforma e datas).
- [x] CA7: falha de uma fonte não derruba a exportação nem é engolida: a fonte entra em `incomplete_sources` com o motivo, e `complete` fica `false`.
- [x] CA8: botão "Baixar meus dados" em Configurações (web), com estados carregando, erro e sucesso, `useToast`, strings em pt-BR/en/es e teste Vitest.
- [x] CA9: sem PII nos logs (uid só como hash SHA-256 nos logs da função).

### 1.4 Fora de escopo

- Android e iOS (#4483). A versão Android está em revisão na Play.
- Bytes de arquivos do Storage (fotos de perfil, mídia de jogo). O arquivo lista nome, tipo, tamanho e datas; o próprio app já mostra as mídias ao titular.
- Formatos além de JSON (CSV, ZIP).
- Exportação assíncrona por e-mail ou fila.
- Corrigir lacunas da exclusão encontradas no caminho (ver §6). Ficam registradas, não alteradas.

---

## 2. UX/UI

### 2.1 Fluxo

```
[Configurações] --clica "Baixar meus dados"--> [botão em loading, desabilitado]
     --sucesso completo--> download do .json + toast de sucesso
     --sucesso parcial---> download do .json + toast de aviso ("algumas seções não puderam ser lidas")
     --limite diário-----> toast de erro "você já baixou seus dados 3 vezes hoje" + Alert inline
     --outro erro--------> toast de erro + Alert inline; o botão volta a ficar ativo para tentar de novo
```

### 2.2 Estados

| Estado | Comportamento |
|--------|---------------|
| idle | Botão "Baixar meus dados" (ícone Download), texto de apoio dizendo o que vai no arquivo (JSON com dados pessoais, jogos, estatísticas e publicações) |
| loading | Botão desabilitado com `CircularProgress` pequeno (ação, não lista) e texto "Gerando arquivo..." |
| error | `Alert severity="error"` abaixo do botão com a mensagem; toast de erro; botão volta a ficar ativo. Mensagens próprias para limite diário (`resource-exhausted`) e arquivo acima do teto (`resource-exhausted` + `details.reason` `export-too-large`) |
| success | Download disparado; toast de sucesso (ou de aviso quando parcial) |

Não há estado "empty": o perfil sempre existe para um usuário logado.

### 2.3 Responsividade

Botão `fullWidth` logo abaixo do card de opções e acima do botão de exclusão, no mesmo padrão dele; altura mínima 48 px. Funciona em phone portrait/landscape e desktop (`PageContainer maxWidth="form"`).

### 2.4 Acessibilidade

- Nome acessível = texto visível do botão, com `aria-describedby` apontando para a descrição; `aria-busy` e `disabled` durante o carregamento.
- `Alert` com `role="alert"`.
- Alvo de toque ≥ 48 px.

---

## 3. Technical Design

### 3.1 Arquitetura

```
web SettingsScreen
  └─ useExportMyData (hook: status/erro, chama a callable, monta o Blob)
       └─ services/cloudFunctions.exportMyData (httpsCallable, timeout 180 s)
            └─ functions/src/auth/export-my-data.ts (secureCallable)
                 ├─ EXPORT_SOURCES (declarativo; campos importados de uid-owned-collections.ts)
                 ├─ leitores paginados (cursor startAfter, sem orderBy)
                 ├─ projeções allowlist (terceiros fora)
                 └─ serializador (Timestamp/GeoPoint/Ref/bytes → JSON)
```

### 3.2 Formato do arquivo (`schema_version: 1`)

```json
{
  "schema_version": 1,
  "format": "futeba-dos-parcas/export-my-data",
  "generated_at": "2026-11-01T12:00:00.000Z",
  "user_id": "<uid do titular>",
  "complete": true,
  "incomplete_sources": [{"source": "location_reviews", "reason": "FAILED_PRECONDITION"}],
  "truncated_sources": [],
  "counts": {"confirmations": 42, "...": 0},
  "data": {
    "profile": {},
    "private_profile": {},
    "confirmations": [{"id": "...", "path": "confirmations/...", "...": "..."}]
  }
}
```

Cada item de lista leva `document_id` e `document_path` (o caminho no Firestore), útil para o titular pedir correção (art. 18, III).

Exceção (#4489): documentos compartilhados lidos por allowlist levam só `document_ref`, um HMAC do caminho com chave aleatória gerada a cada exportação e nunca devolvida (um hash sem segredo seria reversível por dicionário, já que o titular conhece o próprio uid, os jogos e os colegas de grupo). Ids e caminhos desses documentos podem embutir o uid de terceiros (ex.: `mvp_votes/{gameId}_{voterId}_{categoria}`, chats de DM formados pelos uids dos participantes), o que desfaria o anonimato de quem votou ou avaliou. Jogos e grupos do titular mantêm o id real (id automático da entidade). Mensagens levam `chat_ref` opaco em vez de `chat_id`. A referência é estável só dentro de um arquivo (agrupa mensagens do mesmo chat); para pedir correção de um documento compartilhado, o titular descreve o item (jogo, data, categoria).

### 3.3 Fontes exportadas

Campos e esquemas vêm de `uid-owned-collections.ts` (verificados contra os escritores reais). "Própria" = documento do titular, exportado inteiro menos credenciais. "Allowlist" = só os campos listados no código.

| Chave no JSON | Origem | Consulta | Projeção |
|---|---|---|---|
| `profile` | `users/{uid}` | pelo ID | própria, sem `fcm_token*` |
| `private_profile` | `users_private/{uid}` | pelo ID | própria, sem `*Hash` e tokens |
| `user_subcollections` | `users/{uid}/*` via `listCollections()` (espelho do `recursiveDelete`) | todas | própria; `followers`/`following` só contagem |
| `confirmations` | `confirmations` | `user_id` + `userId` | própria (é o registro de presença do titular) |
| `notifications` | `notifications` | `user_id` | allowlist (sem `sender_*`/`created_by`) |
| `game_summons` | `game_summons` | `user_id` | allowlist (sem `summoned_by*`) |
| `group_invites_received` / `_sent` | `group_invites` | `invited_user_id` + `invitedUserId` / `invited_by_id` | allowlist (sem o outro lado) |
| `owned_groups` | `groups` | `owner_id` + `ownerId` | allowlist (sem `members`) |
| `group_memberships` | `groups/{g}/members/{uid}` | grupos via `users/{uid}/groups` + `collectionGroup("members").user_id` | própria |
| `statistics` | `statistics` | ID `{uid}` + `user_id` legado | própria |
| `xp_logs`, `user_badges`, `season_participation`, `activities` | idem | `user_id` | própria |
| `user_streaks` | `user_streaks` | ID `{uid}` + `user_id` | própria |
| `mvp_votes_cast` / `_received` | `mvp_votes` | `voter_id` / `voted_player_id` | allowlist: jogo, categoria, datas (nem em quem votou, nem quem votou nele) |
| `audit_logs` | `audit_logs` | os 5 campos de uid do mapa + `userId` do wrapper | allowlist: ação/tipo, status, data e o papel do titular |
| `cashbox_entries` | `groups/{g}/cashbox` | `created_by` (collectionGroup) e, por grupo, `created_by` + `player_id` | allowlist (sem `*_name`, sem `receipt_url`), com o papel |
| `monthly_finance_payers` | `groups/{g}/monthly_finance_periods/{p}/payers/{uid}` | por grupo, pelo ID | própria |
| `location_reviews` | `locations/{l}/reviews` | `collectionGroup("reviews").user_id` | própria |
| `reputation_given` / `_received` | `post_game_reputation` | `reviewer_id` / `target_user_id` | allowlist; recebidas só com notas (sem avaliador e sem comentário) |
| `games` | `games` | `owner_id` + `co_organizers` (array-contains) | allowlist (sem `players`, `co_organizers`) + papel |
| `locations` | `locations` | `owner_id` + `managers` (array-contains) | allowlist (sem `managers`) + papel |
| `schedules` | `schedules` | `owner_id` (irmão merge) | allowlist |
| `game_waitlist` | `games/{id}/waitlist/{uid}` | jogos dos grupos do titular, pelo ID | própria |
| `direct_messages_sent` | `chats/{c}/messages` | chats `participants` array-contains + `sender_id` | allowlist: texto e datas |
| `game_media` | `game_photos`, `game_videos` | `uploaded_by` | allowlist (metadados) |
| `push_devices` | `push_tokens`, `push_token_devices` | `userId` | allowlist: plataforma e datas (sem token) |
| `notification_settings`, `user_location`, `session` | `notification_settings/{uid}`, `user_locations/{uid}`, `sessions/{uid}` | pelo ID | própria |
| `storage_files` | Storage `users/{uid}/`, `profile_photos/{uid}.`, `profile_photos/thumbnails/{uid}_thumb` | `getFiles({prefix})` | nome, tipo, tamanho, datas |

### 3.4 Exclusões deliberadas (testadas)

| Coleção | Motivo |
|---|---|
| `cpf_index`, `phone_index` | Índice derivado (chave = hash); o dado fornecido está em `private_profile` |
| `rate_limits` | Contador operacional efêmero, não é dado fornecido pelo titular |
| `verification_failures` | Registro antifraude da verificação; mantido para prevenção à fraude (LGPD art. 11, II, "g") |
| `live_games`, `live_scores` | Estado efêmero de partida ao vivo; o resultado consolidado sai em `games`/`confirmations` |
| `account_aliases`, `account_merge_requests` | Registro técnico da união de contas; só contém uids do próprio titular |

### 3.5 Entrega: retorno direto na callable (decisão)

Opções avaliadas:

1. **Arquivo no Storage + URL assinada curta.** `getSignedUrl` depende de `iam.serviceAccounts.signBlob`, que o #4083 tirou do projeto (as mídias passaram para download token do Firebase). Reintroduzir exige mexer em IAM de produção. O download token do Firebase não expira, então não serve como "URL de curta duração". Além disso deixaria uma cópia persistida que precisaria de TTL e de regra de Storage.
2. **Retorno direto (escolhida).** A resposta é o próprio JSON. Não cria cópia persistida, não precisa de `storage.rules` nem de limpeza, e o navegador salva o arquivo com `Blob` + `URL.createObjectURL` (a URL é revogada 1 s depois do clique; revogar no mesmo tick cancela o download no Firefox/Safari).

Limites e mitigações:

- Resposta de callable (Cloud Run functions, 2ª geração): limite de 32 MiB por resposta HTTP. A função corta em **8 MiB** serializados; acima disso reduz as maiores listas pela metade até caber e as marca em `truncated_sources` (o arquivo e a tela avisam). Cada fonte também tem teto de 5.000 documentos.
- Timeout: `timeoutSeconds: 180` na função e `timeout: 180000` no `httpsCallable` da web (o padrão do SDK é 70 s). As fontes são lidas em paralelo.
- Se `truncated_sources` aparecer em produção, o próximo passo é a entrega assíncrona pelo Storage (fora desta spec).

### 3.6 Segurança

- `secureCallable`: App Check exigido (default de produção), `consumeAppCheckToken: false` (leitura; o cliente pode repetir a chamada), `enableAuditLog: false` (o audit do wrapper grava `userId` cru e IP num campo que a exclusão não alcança).
- Rate limit `{maxRequests: 3, windowMs: 24h, keyPrefix: "export_my_data"}`.
- O uid vem só de `request.auth.uid`; a callable não aceita parâmetro de uid.
- Auditoria própria em `audit_logs`: `{action: "DATA_EXPORTED", actor_user_id, target_user_id, complete, source_count, created_at}`. Os campos `actor_user_id`/`target_user_id` são apagados pelo `onUserDeleted`.
- Logs da função: uid como SHA-256 (`hashUid` de `delete-account.ts`).
- **Nenhuma alteração em `firestore.rules` ou `storage.rules`**: toda leitura é pelo Admin SDK dentro da função.

### 3.7 Índices

Só igualdade/array-contains, sem `orderBy` (índices single-field automáticos). As três consultas de `collectionGroup` dependem de `fieldOverrides` já versionados em `firestore.indexes.json` (`members.user_id`, `cashbox.created_by`, `reviews.user_id`), que o #4398 aponta como **fora de produção**. Sem eles a fonte correspondente sai em `incomplete_sources` com `FAILED_PRECONDITION`; grupos e caixa têm caminho alternativo por `users/{uid}/groups` em escopo COLLECTION. **Pré-requisito de deploy:** `firebase deploy --only firestore:indexes` antes de `functions:exportMyData`.

### 3.8 Observabilidade

Log `[EXPORT_MY_DATA]` com `uidHash`, contagens por fonte, `incomplete_sources`, `truncated_sources` e bytes. Fonte com erro gera `logger.error` com o código, sem conteúdo de documento.

---

## 4. Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Issues #4482 e #4483 | ✅ |
| 2 | Spec (este arquivo) | ✅ |
| 3 | `functions/src/auth/export-my-data.ts` + export em `index.ts` | ✅ |
| 4 | Jest: cobertura vs mapa e vs irmãos, projeções, serializador, wrapper | ✅ |
| 5 | Web: `exportMyData` em `cloudFunctions.ts`, hook `useExportMyData`, botão em `SettingsScreen`, i18n pt-BR/en/es | ✅ |
| 6 | Vitest do hook e da tela | ✅ |
| 7 | build/lint/testes de functions e web | ✅ |

---

## 5. Verify

- `functions/`: `npm run build`, `npm run lint`, `npx jest --no-coverage`.
- `web/`: `npm run lint`, Vitest dos arquivos tocados, typecheck, `npm run build`.
- Produção (fecha a #4482, regra do #4398): deploy de índices, `functions:exportMyData` e hosting; download real de uma conta de teste anexado ao fechamento.

### Mobile/Web DoD

- [x] Responsividade: botão fullWidth, 48 px, `PageContainer` do card existente
- [x] Acessibilidade: `aria-describedby`, `aria-busy`, `role="alert"`
- [x] Performance: leituras paralelas, paginação de 500, sem listener
- [x] Offline/Erros: erro com mensagem e nova tentativa; exportação parcial avisada

---

## 6. Lacunas da exclusão encontradas (não corrigidas aqui)

- `audit_logs.userId`: o `secureCallable` grava o uid cru (e IP) nesse campo; o `onUserDeleted` não consultava `userId`. Corrigido no #4487 (o campo entrou em `AUDIT_LOGS.otherUidFields`).
