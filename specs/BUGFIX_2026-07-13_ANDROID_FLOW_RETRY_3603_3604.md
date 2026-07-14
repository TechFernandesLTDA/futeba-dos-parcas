# BUGFIX: erros de Flow e retry nas telas de videos e conversa

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3603, #3604

## 1. Requisitos

- Uma falha emitida por `GameVideosRepository.observeVideos` deve virar
  `GameVideosUiState.Error`, sem escapar da coroutine.
- O retry de uma conversa deve reiniciar os listeners do mesmo `chatId`.
- Reiniciar a conversa deve cancelar a observacao anterior inteira antes de criar
  novos collectors, evitando listeners duplicados.
- Repositorios, regras Firebase e contratos de dados permanecem inalterados.

## 2. Causa raiz

`GameVideosViewModel` coleta o Flow sem `catch`. `ConversationViewModel` guarda o
`chatId` observado, mas nao guarda/cancela os jobs; por isso uma nova chamada com
o mesmo id e descartada inclusive quando e um retry explicito.

## 3. Solucao tecnica

- Adicionar `catch` ao Flow de videos e mapear a excecao para o estado de erro.
- Agrupar os dois collectors da conversa em um unico job pai.
- Manter `observe(chatId)` idempotente para recomposicoes e expor `retry(chatId)`
  para cancelar o job pai, resetar Loading/erro e iniciar os dois collectors.
- Alterar somente o callback do botao de retry na tela.

## 4. Verificacao

- Teste unitario: erro do Flow de videos produz `GameVideosUiState.Error`.
- Teste unitario: segunda observacao ativa do mesmo video nao duplica collector.
- Teste unitario: observacao repetida da conversa permanece idempotente.
- Teste unitario: retry da mesma conversa cancela os collectors anteriores e
  inicia exatamente um novo par.
- `./gradlew :app:compileDebugKotlin`
- Testes focados dos dois ViewModels via `:app:testDebugUnitTest`.

Resultado em 2026-07-13:

- `GameVideosViewModelTest` e `ConversationViewModelTest`: PASS (4 testes).
- `./gradlew :app:compileDebugKotlin`: PASS.

## 5. Riscos e release

Mudanca isolada ao estado e ciclo de vida de listeners Android. Nao altera dados,
permissoes ou APIs. E uma correcao visivel ao usuario e deve entrar nas notas da
proxima release Android; versionamento/deploy ficam no fluxo de release agregado.
