# E2E como gate obrigatório (#4192)

O Web E2E (Playwright contra emuladores Firebase, `web-e2e-ci.yml`) é pré-requisito
de merge para qualquer mudança que afete web, functions, rules ou configuração
compartilhada.

## Por que não é branch protection

A API de branch protection/rulesets responde HTTP 403 no plano free de repositório
privado da org. A obrigatoriedade é, portanto, **gate + convenção + verificação
pós-merge**:

1. **Gate (`.github/workflows/e2e-gate.yml`, check `E2E Gate`)**: em todo PR para
   `master`, classifica o escopo (`change-scope.yml`). Se houve mudança em
   web/functions/rules/config compartilhada, o job despacha `web-e2e-ci.yml` no
   branch do PR (`scripts/ci/e2e-gate.js`) e só passa se o run real terminar com
   `conclusion=success` **no mesmo SHA** do PR. PR sem impacto (docs etc.) passa sem
   disparar o E2E, para o check sempre reportar.
2. **Convenção**: não se faz merge de PR com `E2E Gate` vermelho, pendente ou
   ausente. Quem faz o merge confere `gh pr checks <n>`. `--admin` só com
   justificativa registrada no PR (por exemplo, falha idêntica já existente em
   master).
3. **Verificação pós-merge**: em todo push para `master` o mesmo gate roda no SHA
   resultante. Se falhar, o job `post-merge-issue` abre (ou comenta em) uma issue
   `E2E Gate falhou em master` (labels `area:ci`, `type:bug`) com o link do run.
   Issue aberta é regressão em master: corrigir a causa antes de novos merges.
   Além disso o `web-e2e-ci.yml` roda diariamente às 08:00 UTC.

## Veredictos do gate (`e2e-gate.js`)

| Situação | Exit | Resultado |
| --- | --- | --- |
| run `success` no SHA esperado | 0 | verde |
| `failure`/`cancelled`/`timed_out`/`skipped`... | 1 | vermelho (falha real) |
| run de outro SHA (PR andou) | 1 | `stale` |
| `startup_failure` ou nenhum run em 5 min | 2 | infra bloqueada |
| sem conclusão em 45 min | 3 | timeout (o E2E é cancelado) |

Nunca existe verde fabricado: o job falha quando o run real falha ou não executa.
Se o PR for atualizado, o gate anterior é cancelado e cancela também o E2E que
disparou, para não deixar run órfão ocupando a fila de emuladores.

## Limites conhecidos

- PRs do Dependabot recebem `GITHUB_TOKEN` somente leitura: o gate não consegue
  despachar e falha. Dispare manualmente `gh workflow run web-e2e-ci.yml --ref <branch>`
  e registre o link do run no PR antes do merge.
- Todos os jobs de emulador (`web-e2e-ci`, `test-harness-ci`,
  `functions-integration-ci`) compartilham o grupo de concurrency
  `firebase-emulator-integration-<repo>` porque os runners `tf-wsl-*` dividem o
  127.0.0.1 (portas 9099/8085/5001). Só um sobe por vez; o GitHub mantém apenas um
  run pendente por grupo, então um segundo pendente pode ser cancelado: reexecute o gate.
- Flaky no E2E é bug: corrija a causa. Não aumente `retries` do Playwright.

## Runners e custo

- Web E2E, Lighthouse, Android CI, Functions Integration, Realtime Load, Test
  Harness e o próprio gate rodam em `vars.RUNNER_LABELS_LINUX` (tf-wsl-*).
- Ficam no Mac (`vars.RUNNER_LABELS`): iOS/Xcode e o Android Macrobenchmark. O
  macrobenchmark usa emulador `arm64-v8a`, e os runners do WSL rodam como o usuário
  `ghrunner`, fora do grupo `kvm` (sem aceleração), então não dá para rodá-lo lá.

## Mutation testing (Stryker)

Web e Functions rodam Stryker **apenas** no cron noturno (03:00 e 04:00 UTC) e no
`workflow_dispatch` com `run_mutation=true`. Nunca em PR, push ou dispatch comum.
O threshold do web (`break: 60`) continua bloqueando o job; `concurrency: 4` evita
que o Stryker ocupe todos os núcleos do host compartilhado com o brazuka-v2.

## Merges em sequência (superseded)

No pós-merge (`push` em master), se o run do E2E ficar `stale` (o master avançou) ou for `cancelled` porque um commit mais novo entrou na fila, e o master já estiver em outro SHA, o gate reporta `superseded` (exit 0): quem cobre o código é o gate do commit mais novo. Falha real de teste (`conclusion=failure`) nunca é convertida.
