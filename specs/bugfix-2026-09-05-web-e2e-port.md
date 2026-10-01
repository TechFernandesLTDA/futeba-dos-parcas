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

## Validacao ampliada em Windows e Linux

- Dois contratos Web falharam apenas por separadores de caminho Windows e CRLF.
  Normalizar a entrada de comparacao, mantendo as mesmas assercoes e allowlist.
- O job 101368181957 falhou em `docker info` no Mac sem daemon Docker.
  Executar o gate de FFmpeg Linux em ubuntu-latest, preservando a imagem fixada,
  hashes do binario e testes de seguranca. Nenhuma verificacao sera ignorada.
- A tentativa E2E 33988865005 passou da disputa de porta, mas o processo de
  emuladores recebeu SIGKILL (exit 137) no Mac compartilhado. Isolar esse job em
  ubuntu-latest evita competir com o build iOS e fornece ambiente limpo por run.
- Dois contratos de recursos Android assumiam cwd no repositorio, enquanto o
  Gradle configura C:/TEMP no Windows. Fornecer futeba.repoRoot aos testes e usar
  esse caminho antes do fallback local, preservando o workaround de encoding.
- O job 101372805251 encontrou FFmpeg Homebrew ligado a uma dylib x265 ausente.
  Executar os testes Functions no Ubuntu com o runtime verificado existente.
- O snapshot E2E 33990197521 mostrou o login em ingles (Sign In), enquanto os
  seletores da suite usam portugues. Fixar locale pt-BR no contexto Playwright,
  preservando o comportamento de idioma do produto e as assercoes dos testes.
