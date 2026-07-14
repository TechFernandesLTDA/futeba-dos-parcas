# BUGFIX: saída do modal de posição e recuperação do check-in QR

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Data:** 2026-07-13
> **Issues:** #3610, #3612

## Problema

No mobile, o diálogo em tela cheia para escolher a posição não oferece uma
ação visível para desistir da confirmação de presença. No check-in por QR, uma
falha transitória de geolocalização ou do callable leva a uma tela de erro sem
nova tentativa, obrigando o usuário a ler o QR novamente.

## Invariantes

- Fechar o diálogo de posição nunca confirma presença nem escreve no Firestore.
- O check-in continua sendo validado e persistido exclusivamente pelo callable
  `checkInToGame`; a validação cliente do token é apenas feedback antecipado.
- Uma falha de tentativa preserva o token já validado, mas não dispara o
  callable novamente até uma nova ação explícita do usuário.
- Enquanto uma tentativa estiver em andamento, ações concorrentes ficam
  bloqueadas para impedir check-in duplicado.
- Links inválidos, tokens expirados, jogos inexistentes ou indisponíveis não
  oferecem retry operacional com dados que falharam na validação inicial.

## Solução aprovada

1. Adicionar `DialogActions` com botão `Cancelar` ao diálogo de posição,
   desabilitado enquanto a confirmação estiver em andamento.
2. Distinguir erros da validação inicial de erros de uma tentativa de check-in.
3. Para erro de tentativa, exibir `Tentar novamente` como ação primária; ela
   volta ao estado de confirmação sem reexecutar geolocalização nem callable.
4. Manter `Voltar ao início` como ação secundária e feedback pelo ToastProvider.
5. Usar uma trava síncrona por referência, além do estado de loading, para
   rejeitar cliques concorrentes antes do próximo render.
6. Cobrir i18n PT-BR, inglês e espanhol, acessibilidade por nomes de botão e
   testes positivos/negativos.

## Critérios de aceitação

- O modal de posição pode ser fechado por um botão visível em viewport mobile.
- Cancelar não chama `confirmPresence`.
- Falha de GPS/callable exibe o erro, toast e as ações de retry/home.
- Retry retorna à confirmação mantendo o jogo/token e não chama o backend.
- Uma nova confirmação após retry executa exatamente uma chamada.
- Erro de validação inicial não oferece retry.
- Durante a tentativa o botão mostra progresso, fica desabilitado e cliques
  concorrentes não duplicam a chamada.

## Verificação

- `cd web && npm run test -- QrCheckInScreen.test.tsx PositionChoiceDialog.test.tsx`
- `cd web && npm run typecheck:test`
- `cd web && npm run build`
- `cd web && npm run lint`
- `git diff --check`

## Risco e release

Mudança apenas Web, sem alteração de schema, Rules ou Functions. O risco é
baixo porque o retry não reutiliza resultado parcial nem escreve diretamente;
cada tentativa completa volta a passar pelas validações server-side existentes.
Deve entrar nas próximas release notes e no próximo deploy consolidado da Web.
