# BUGFIX: leitura de game_photos, game_videos e waitlist aberta a qualquer conta

> **Status:** `APPROVED` (autorizado pelo dono) → `FIXED` (aguarda merge + deploy de rules)
> **Severidade:** `HIGH`
> **Autor:** Renan Locatiz Fernandes (com Claude)
> **Data:** 2026-10-31
> **Issue:** #4393
> **PR:** a definir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`firestore.rules` (origin/master `966ab168`):

- `match /game_photos/{photoId} { allow read: if isAuthenticated(); }`
- `match /game_videos/{videoId} { allow read: if isAuthenticated(); }`
- `match /games/{gameId}/waitlist/{waitlistId} { allow read: if isAuthenticated(); }`

`allow read` cobre `get` **e** `list`. Qualquer conta autenticada roda
`getDocs(collection(db, 'game_photos'))` e recebe a mídia de todos os jogos,
inclusive `GROUP_ONLY` de grupos dos quais não participa. Cada documento traz
`url` com token de download do Storage, então a pessoa baixa a mídia. A fila
de espera expõe `user_name` e `user_photo` de qualquer jogo.

No Storage, `games/{gameId}/photos/**` e `games/{gameId}/videos/**` liberavam
leitura (inclusive `list`) para qualquer autenticado, desde que o jogo existisse.

### 1.2 Comportamento Esperado (Correto)

Só lê a mídia e a fila quem pode ver o jogo, com a mesma condição para `get` e
`list`:

- admin (custom claim);
- qualquer autenticado se o jogo é `PUBLIC_OPEN`/`PUBLIC_CLOSED`;
- se o jogo não está soft-deleted: dono, coorganizador, membro ativo do grupo
  do jogo ou participante (confirmação própria `PENDING`, `CONFIRMED`,
  `ON_THE_WAY` ou `CHECKED_IN`).

Na fila, além disso, cada um lê sempre a própria entrada.

### 1.3 Passos para Reproduzir

1. Logar com uma conta sem vínculo com o grupo X.
2. No console do web: `getDocs(collection(db, 'game_photos'))`.
3. Observar fotos de jogos `GROUP_ONLY` do grupo X com URL tokenizada.

Reproduzido no emulador: os testes novos rodados contra as regras antigas
falham em 19 casos (`Expected request to fail, but it succeeded`).

---

## 2. Análise de Causa Raiz

### 2.1 Causa Raiz

As três coleções foram criadas com o atalho `allow read: if isAuthenticated()`
herdado de quando a mídia era considerada pública. As regras de `games` já
tinham sido endurecidas (#4126), mas os recursos derivados do jogo não.

### 2.2 Call sites (queries que a nova regra precisa satisfazer)

| Arquivo:linha | Query | Resultado com a nova regra |
|---|---|---|
| `web/src/pages/game/GamePhotosTab.tsx:123` | `game_photos` `where game_id ==` + `orderBy created_at desc` (onSnapshot) | Passa para quem vê o jogo (teste de controle) |
| `web/src/pages/game/GamePhotosTab.tsx:274` | `deleteDoc(game_photos/{id})` | Regra de delete inalterada |
| `web/src/pages/group/GroupDetailScreen.tsx:242` | `game_photos` `where game_id in [≤10]` + `limit 60` | Passa no emulador (10 jogos do grupo), com risco em produção pelo teto de 10 `get()` (ver 3.3). Negada por inteiro se algum id do chunk for invisível |
| `web/src/pages/game/GameVideosTab.tsx:142` | `game_videos` `where game_id ==` + `orderBy created_at desc` | Passa (controle) |
| `web/src/pages/game/GameVideosTab.tsx:364` | `deleteDoc(game_videos/{id})` | Inalterada |
| `app/.../data/repository/GameVideosRepository.kt:41` | `game_videos` `whereEqualTo game_id` + `orderBy created_at desc` | Passa (controle) |
| `app/.../data/repository/GameVideosRepository.kt:110,131` | delete / update de reações | Inalteradas |
| `web/src/hooks/useWaitlist.ts:91` | `games/{id}/waitlist` `orderBy queue_position asc` + `limit 50` | Passa para quem vê o jogo (controle) |
| `web/src/hooks/useWaitlist.ts:166` | delete da própria entrada | Inalterada |
| `app/.../WaitlistRepositoryImpl.kt:101,124,194` | `whereIn status [WAITING,NOTIFIED]` + `orderBy queue_position` + `limit 50` | Passa para quem vê o jogo (controle) |
| `app/.../WaitlistRepositoryImpl.kt:74,150,174` | `whereEqualTo user_id == self` (+ `whereIn status`) + `limit` | Passa sempre (própria entrada) |
| `web/src/pages/game/GameVideosTab.tsx:201` | Storage `getDownloadURL(thumbnail_path)` | Antes negado (sem match); agora passa para quem vê o jogo |
| `web/src/pages/game/GameVideosTab.tsx:312` | Storage `getDownloadURL(storage_path)` (recuperação) | Passa para quem vê o jogo (limite de 2 leituras, ver 3.3) |
| `functions/src/**` (index, reminders, waitlist, storage, social/reports, account-cleanup) | Admin SDK | Não passa por rules |

`composeApp/`, `shared/` e `iosApp/` não leem essas coleções.

---

## 3. Solução

### 3.1 Abordagem

- `firestore.rules`: helpers novos `isOwnGameParticipant(gameId)` e
  `canViewGameById(gameId)`. O segundo espelha o `allow get` de `games`
  (público; ou não soft-deleted e dono/coorganizador/membro/participante) com
  `isAdmin()` antes do `get(games/...)`, para o admin continuar lendo mídia
  órfã e conseguir limpá-la (#4049).
- `game_photos` e `game_videos`: `allow read: if isAdmin() || (isAuthenticated()
  && resource.data.game_id is string && canViewGameById(resource.data.game_id))`.
  O acesso a `resource.data.game_id` é direto, sem default: em `list` o engine só
  aprova se a query filtrar `game_id` (vetor #4126). `list` sem filtro é negada.
- `games/{gameId}/waitlist`: `allow read: if isAuthenticated() &&
  (resource.data.user_id == userId() || canViewGameById(gameId))`. O `gameId`
  vem do path, então a listagem da subcoleção não depende de filtro.
- `storage.rules`: helper `canViewGameMedia(gameId)` nos três matches de mídia
  (`photos/{file}`, `photos/{uid}/{file}`, `videos/{uid}/{file}`) e match novo,
  só leitura, para `games/{gameId}/video_thumbnails/{file}` (escrito por
  `generate-video-thumbnails.ts:333`; antes caía no deny-all).

### 3.2 Decisões

Registradas em `specs/DECISIONS.md` (2026-10-31, #4393): sem gate de
`isVerifiedOrGrace` na mídia, conjunto de status de participante, desenho do
Storage dentro do limite de 2 leituras e thumbnails com leitura.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| URLs tokenizadas já coletadas continuam válidas: Storage Rules não se aplicam a download por token | Fora do alcance de rules. Follow-up de operação: revogar/rotacionar tokens dos objetos de jogos privados se houver suspeita de coleta |
| `in` do `GroupDetailScreen.tsx:242` é tudo-ou-nada: um id invisível no chunk nega a galeria inteira | Os ids vêm de `useGames` com `deleted_at == null` e `group_id == groupId`; quem abre a página é membro, então todos ficam visíveis. Teste cobre o caso feliz (10 ids) e o misto (negado) |
| Limite de 10 `get()` por query no `in` com 10 jogos (10 jogos + 1 membro = 11) | Passou no emulador, mas uma calibração com 20 leituras distintas também passou: o emulador não aplica o teto aqui, então o resultado não vale como prova para produção. Mudança preventiva no cliente: chunk de 9 em `GroupDetailScreen.tsx:236-240` (9 jogos + 1 membro em cache = 10) antes do deploy das rules |
| Storage permite só 2 `firestore.get()` distintos por requisição | `canViewGameMedia` usa jogo + (membro do grupo se o jogo tem grupo, senão confirmação). Convidado não-membro de jogo de grupo privado perde só o `getDownloadURL` de recuperação; a URL do doc continua valendo |
| Jogador fora da lista que dependia da leitura aberta | Própria entrada da fila sempre legível; jogos públicos continuam abertos |

---

## 4. Verificação

### 4.1 Testes adicionados

- `firestore-rules-tests/src/game-media-read-scope.test.ts` (26 casos):
  controles com o shape exato de cada cliente, negativas em `get` e `list`,
  `list` sem filtro, membro `REMOVED`, confirmação `CANCELLED`, soft-deleted,
  mídia órfã (admin), `in` de 10 jogos e `in` misto.
- `firestore-rules-tests/src/game-media-storage.test.ts` (11 casos): leitura
  por membro/dono/participante/admin/jogo público, negativas para estranho e
  anônimo, `listAll` negado, thumbnails, e upload existente sem regressão.

### 4.2 Teste existente invertido de propósito

`waitlist.test.ts` › "Qualquer usuario autenticado pode ler entradas da
waitlist" virou "Usuario sem acesso ao jogo NAO pode ler entradas alheias da
waitlist (#4393)" com `assertFails`. É a própria correção, não regressão.

### 4.3 Checklist

- [x] Testes novos falham contra as regras antigas (19 falhas) e passam com as novas
- [x] Suíte completa de rules verde
- [ ] Deploy de `firestore:rules` e `storage` (após merge, pelo dono)

---

## 5. Prevenção Futura

Toda coleção derivada de jogo/grupo deve autorizar leitura pelo recurso pai
(`canViewGameById`) e nunca por `isAuthenticated()` puro. Revisão de rules:
procurar `allow read: if isAuthenticated();` em coleções com dado privado.

---

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-10-31 | Renan / Claude | Bug reportado (#4393), spec aprovada, fix e testes |
