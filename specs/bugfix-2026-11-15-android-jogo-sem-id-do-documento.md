# BUGFIX: Android lê o jogo sem o ID do documento (jogos sem o campo `id`)

> **Status:** `APPROVED` → `FIXED`
> **Severidade:** `HIGH`
> **Autor:** Claude Code (issue #4576, aberta pela bateria de testes)
> **Data:** 2026-11-15
> **PR:** #4579

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

No Android, o jogo chega com `id` vazio quando o documento de `games` não tem o campo `id` gravado:

- detalhe do jogo (`getGameDetails`, `getGameDetailConsolidated`, `getGameDetailsFlow`);
- lista de próximos jogos da Home e da aba Jogos (`getLiveAndUpcomingGamesFlow`);
- histórico em tempo real (`getHistoryGamesFlow`).

Na lista, quem não é administrador vê jogos diferentes juntados num só, porque a lista remove duplicados pelo
`id` e todos vêm com `id` vazio.

### 1.2 Comportamento Esperado (Correto)

Todo jogo lido no Android traz o ID do documento, tenha ou não o campo `id` gravado.

### 1.3 Passos para Reproduzir

1. `scripts/bateria/rodar.sh android` (o seed cria os jogos no formato do web, sem o campo `id`).
2. `getGameDetails("bat-jogo-agendado")` devolve `Game(id = "")`.

Na mão: criar um jogo pelo web e abrir a Home ou o detalhe dele no Android.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.43.4 (89) e `master` |
| Frequência | Sempre, para jogo sem o campo `id` |
| Impacto em produção | Os 8 jogos de `games` (medido em 15/11/2026, só leitura) não têm o campo `id` |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

- O modelo `Game` do Android (`data/model/Game.kt`) não usa `@DocumentId`. O `id` só é preenchido pelo mapper
  se o documento tiver o campo `id`. Não é o conflito de `@DocumentId` do #4569: a leitura tolerante não entra
  em ação aqui, porque não há exceção, só um campo que fica com o valor padrão.
- O web cria o jogo com `addDoc`, sem `id`. Em produção nenhum dos 8 jogos tem esse campo.
- A maioria das consultas de `GameQueryRepositoryImpl` já copiava o ID (`?.apply { id = doc.id }`). Sete pontos não:
  - `getGameDetails`, `getGameDetailConsolidated` e `getGameDetailsFlow` não copiavam nada;
  - `createSnapshotFlow` (próximos jogos) e os três listeners de `getHistoryGamesFlow` tinham
    `it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id`, que procura o documento pelo próprio
    `id` do jogo: com `id` vazio não acha nada e deixa como está.

### 2.2 Causa Raiz

Leitura de `games` sem copiar o ID do documento, num modelo que depende de um campo redundante que o web não grava.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/src/main/java/com/futebadosparcas/data/repository/GameQueryRepositoryImpl.kt` | Os sete pontos de leitura |
| `app/src/test/java/com/futebadosparcas/data/repository/GameSnapshotMappingTest.kt` | Regressão com o mapper real |
| `app/src/androidTest/java/com/futebadosparcas/bateria/GruposEJogosBateriaTest.kt` | Falha esperada vira teste normal; detalhe em tempo real e lista |
| `app/src/androidTest/java/com/futebadosparcas/bateria/PendenciasBateria.kt` | Sai a pendência #4576 |

---

## 3. Solução Proposta

### 3.1 Abordagem

Três funções em `GameQueryRepositoryImpl.kt`, usadas nos sete pontos:

| Função | Onde | Comportamento |
|--------|------|---------------|
| `DocumentSnapshot.toAndroidGame()` | Fora de listener | Converte e copia o ID do documento. Falha de conversão é relançada |
| `DocumentSnapshot.toAndroidGameOrNull()` | Dentro de listener | Igual, mas nunca lança |
| `QuerySnapshot.toAndroidGames()` | Listas em listener | Converte documento a documento, com o ID de cada um; o ilegível fica de fora |

O ID do documento prevalece sobre o campo `id` gravado.

### 3.2 Código Antes/Depois

```kotlin
// ANTES: não acha nada quando o id vem vazio
val androidGames = snap?.toObjectsTolerant(AndroidGame::class.java)?.onEach {
    it.id = snap.documents.find { d -> d.id == it.id }?.id ?: it.id
} ?: emptyList()

// DEPOIS
val androidGames = snap?.toAndroidGames() ?: emptyList()
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Jogo com campo `id` gravado diferente do ID do documento passa a usar o do documento | É o valor certo: todas as escritas e rotas usam o ID do documento |
| Outro ponto do app lendo `games` sem copiar o ID | Conferido por busca: as demais leituras do modelo Android `Game` (o resto de `GameQueryRepositoryImpl`, 21 pontos) já copiam; `GamesPagingSource`, `CachedGamesPagingSource` e `PublicGamesMapViewModel` também. Fica de fora o `FirebaseDataSourceImpl` do `:app`, que lê o `Game` de domínio sem copiar o ID (ver 5.2) |

---

## 4. Verificação

### 4.1 Testes Adicionados

- [x] `GameSnapshotMappingTest` (7 casos, mapper real do Firestore): jogo sem `id`, `id` gravado diferente, listener, lista com dois jogos, documento ilegível.
- [x] Bateria Android: `jogoDeCadaEstadoEhLidoPeloRepositorio` sem falha esperada; `detalheEmTempoRealTrazOIdDoDocumento`; `proximosJogosTrazemOIdDoDocumentoSemJuntarJogosDiferentes`.

### 4.2 Testes de Regressão

- [x] `./gradlew :app:testDebugUnitTest`
- [x] `scripts/bateria/rodar.sh android`: 10 testes verdes.
- [x] A mesma bateria com o `GameQueryRepositoryImpl.kt` da `master`: 3 dos 10 falham (`jogoDeCadaEstadoEhLidoPeloRepositorio`, `detalheEmTempoRealTrazOIdDoDocumento`, `proximosJogosTrazemOIdDoDocumentoSemJuntarJogosDiferentes`), todos com `id` vazio.

### 4.3 Checklist

- [x] Build passa
- [x] Testes passam
- [ ] Conferido no aparelho contra produção (não feito)

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

Não havia teste que lesse um jogo no formato do web pelo repositório do Android. A bateria (#4577) passou a fazer isso.

### 5.2 Ações para evitar bugs similares

- [x] Regra em `specs/DECISIONS.md`: jogo é lido sempre com o ID do documento.
- [ ] `GameConfirmation`, `Team`, `PlayerStats`, `LocationReview`, `AndroidGameWaitlist` e `DraftPlayer` também têm `id` sem `@DocumentId`. Conferir as leituras deles da mesma forma (fora deste PR).
- [ ] `data/datasource/FirebaseDataSourceImpl.kt` (do `:app`) lê o `Game` de domínio em 7 pontos sem copiar o ID. O único consumidor achado é o `GetUpcomingGamesUseCase`, registrado no Koin e sem uso em tela; não foi conferido além da busca (fora deste PR).
- [ ] Web: o escritor de jogos não grava `id`. Não precisa mudar; o campo é redundante.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-11-15 | Bateria de testes | Issue #4576 |
| 2026-11-15 | Claude Code | Causa, correção nos sete pontos e testes |
