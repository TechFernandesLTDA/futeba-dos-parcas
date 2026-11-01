# BUGFIX: Exclusão de vídeo no web aborta quando a miniatura falha

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude (autonomia ampla autorizada pelo dono para bugfixes)
> **Data:** 2026-11-01
> **PR:** a definir (issue #4480; paridade com o PR #4472 do Android)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
`GameVideosTab.executeDelete` relança qualquer erro da exclusão da miniatura no Storage (as rules negam escrita do cliente em `video_thumbnails/`, ou a miniatura já não existe). O documento em `game_videos` nunca é apagado e o card fica preso na tela.

### 1.2 Comportamento Esperado (Correto)
A miniatura é apenas limpeza: falha vira aviso (`logger.warn`) e a exclusão continua. Só erro ao apagar o vídeo principal (exceto `storage/object-not-found`) ou o documento interrompe o fluxo e mostra o erro ao usuário.

### 1.3 Passos para Reproduzir
1. Abrir um jogo finalizado com um vídeo que tenha miniatura.
2. Excluir o vídeo e confirmar.
3. A exclusão da miniatura falha; o vídeo permanece na lista com toast de erro.

---

## 2. Análise de Causa Raiz

### 2.1 Causa Raiz
O `.catch` da miniatura relança qualquer erro diferente de `object-not-found`, abortando antes do `deleteDoc`. Mesmo bug do Android, corrigido no #4472.

### 2.2 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/game/GameVideosTab.tsx` | Tolerar falha da miniatura |
| `web/src/pages/game/GameVideosTab.delete.test.tsx` | Testes de regressão |

---

## 3. Solução Proposta

Envolver a exclusão da miniatura em `try/catch` que apenas registra `logger.warn`; manter a tolerância a `object-not-found` do vídeo principal; manter `logger.error` + `showError` para falha do vídeo principal ou do documento.

## 4. Plano de Testes

- Miniatura falha: vídeo e documento ainda são apagados, sucesso mostrado.
- Vídeo principal falha: documento NÃO é apagado, erro mostrado.

## 5. Verificação

`npm run lint`, `vitest run`, `tsc --noEmit`, `npm run build` em `web/`.
