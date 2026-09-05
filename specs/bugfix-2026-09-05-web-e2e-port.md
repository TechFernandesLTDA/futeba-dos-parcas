# BUGFIX: Porta ocupada bloqueia Web E2E

> Status: APPROVED
> Data: 2026-09-05
> Escopo autorizado: validacao e conclusao de pendencias do projeto nesta sessao.

## Requisitos e evidencia

O run 33963440088 encerrou antes dos testes porque 127.0.0.1:5173 estava ocupado.
O CI deve selecionar uma porta local livre sem interromper processos de outros jobs
e sem reutilizar um servidor cujo bundle e configuracao nao pertencem ao teste.

## UX/UI

Sem alteracao na interface do produto ou na versao publicada.

## Desenho tecnico

Antes do Playwright, um utilitario pede ao sistema operacional uma porta efemera
em 127.0.0.1 e publica E2E_PORT no GITHUB_ENV. A configuracao usa essa mesma porta
no comando, no health check e no baseURL. O padrao local continua 5173.
strictPort e reuseExistingServer=false no CI continuam protegendo contra uma
eventual disputa pela porta entre a selecao e a inicializacao do preview.

## Tarefas e verificacao

- Implementar utilitario e configurar workflow/Playwright.
- Testar com 5173 ocupada e validar contratos existentes de CI.
- Executar validacao de tipos, testes e build web; acompanhar CI do PR.
