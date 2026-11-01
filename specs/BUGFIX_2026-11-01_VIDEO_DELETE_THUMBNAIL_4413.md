# BUGFIX: apagar vídeo de jogo deixa o card porque a exclusão da miniatura falha (#4413)

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude (autorizado pelo dono)
> **Data:** 2026-11-01
> **Issue:** #4413

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Em `GameVideosRepository.deleteVideo()` o Android apaga o arquivo do vídeo e depois espera o
`delete()` da miniatura em `games/{gameId}/video_thumbnails/`. As rules do Storage têm
`allow write: if false` nesse caminho (a miniatura é gerada pelo servidor em
`generate-video-thumbnails.ts`), então a chamada falha com `ERROR_NOT_AUTHORIZED`. A exceção aborta
o `runCatching` antes de apagar o documento em `game_videos`: o arquivo some, mas o card continua
na tela com a mensagem de erro.

Uma segunda tentativa também falha, agora no arquivo do vídeo, que já não existe
(`ERROR_OBJECT_NOT_FOUND`). Sem correção, o card fica preso para sempre.

### 1.2 Comportamento Esperado (Correto)

A exclusão do documento acontece sempre que o arquivo do vídeo foi apagado ou já não existe. A
falha da miniatura vira só um aviso de log.

### 1.3 Passos para Reproduzir

1. Num jogo FINISHED, enviar um vídeo e esperar a miniatura ser gerada (`thumbnail_path` preenchido).
2. Apagar o vídeo pelo app Android.
3. O card continua na lista e aparece o erro de exclusão.

---

## 2. Análise de Causa Raiz

### 2.1 Causa Raiz

A miniatura é só limpeza, mas foi tratada como passo obrigatório, antes do documento. O caminho
`video_thumbnails/` é escrito apenas pelo Admin SDK (`storage.rules`, bloco
"THUMBNAILS DE VÍDEOS DE JOGOS").

### 2.2 Web

Ao contrário do que a issue diz, o web (`web/src/pages/game/GameVideosTab.tsx`, `executeDelete`)
também relança qualquer erro da miniatura diferente de `storage/object-not-found`. Com a rule atual
ele recebe `storage/unauthorized` e cai no mesmo bug. Fica como follow-up, fora deste PR (escopo Android).

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/src/main/java/com/futebadosparcas/data/repository/GameVideosRepository.kt` | isola a exclusão da miniatura e tolera arquivo de vídeo já apagado |
| `app/src/test/java/com/futebadosparcas/data/repository/GameVideosRepositoryDeleteTest.kt` | regressão |

---

## 3. Solução Proposta

### 3.1 Abordagem

1. O arquivo do vídeo continua obrigatório. `StorageException.ERROR_OBJECT_NOT_FOUND` é tolerado,
   o que destrava os cards que já ficaram presos.
2. A miniatura vai para um `try/catch` próprio: falha vira `AppLogger.w`, sem Crashlytics. A
   `CancellationException` é relançada.
3. O documento em `game_videos` é apagado em seguida. As rules do Firestore já permitem isso ao
   autor, ao dono e aos co-organizadores do jogo.

### 3.2 Fora do escopo (follow-ups)

- A miniatura fica órfã no Storage. A solução definitiva é um trigger `onDocumentDeleted` em
  `game_videos` que apague `thumbnail_path` com o Admin SDK. Isso exige deploy de Functions e não
  entra agora.
- Corrigir o mesmo isolamento no web (`GameVideosTab.tsx`).

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Miniatura órfã no Storage | Já acontecia; trigger server-side como follow-up |
| Sem permissão no arquivo do vídeo apagar o documento | Não apaga: o erro do vídeo (exceto "não encontrado") continua abortando, coberto por teste |

---

## 4. Verificação

- [x] `GameVideosRepositoryDeleteTest` (4 casos): miniatura negada apaga o documento; arquivo já
      inexistente apaga o documento; vídeo negado não apaga o documento; sem miniatura não tenta apagá-la.
- [x] Com o `GameVideosRepository.kt` do master, os dois primeiros casos falham (conferido com `--rerun`).
- [x] `./gradlew :app:compileDebugKotlin`
- [x] `GameVideosViewModelTest`

## 5. Prevenção Futura

Toda limpeza de mídia que o cliente não tem permissão de fazer deve ser best effort ou ficar no servidor.
