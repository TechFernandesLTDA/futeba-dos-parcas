# CI: runners, workflows e como reativar

> Atualizado em 31/10/2026 (#4394). Este documento é a fonte de verdade da topologia de CI.
> `scripts/SELF_HOSTED_RUNNER.md` e `docs/ci/wsl2-self-hosted-runner.md` descrevem a instalação
> de runners; a tabela de workflows de `SELF_HOSTED_RUNNER.md` está desatualizada.

## Estado atual (importante)

- **Actions voltou a funcionar (07/10/2026)**: o billing lock da organização (issue #4203) foi
  resolvido ao regularizar o cartão. O GHAS pago foi desligado nos repos privados — ver
  "Custos e GitHub Advanced Security" abaixo.
- Validação local (lint, typecheck, testes, build, `actionlint` e os contratos de workflow:
  `node --test scripts/*.test.js scripts/ci/*.test.js`) continua útil antes de abrir PR.

## Topologia de runners

> Desde 31/10/2026 o CI roda no Mac do Renan e na VM `tf-atendimento-prod-01` (OCI, E5.Flex).
> Os runners WSL do PC (`tf-wsl-*`) não existem mais.

| Runner (repo) | Labels | Papel | Variável |
| --- | --- | --- | --- |
| `mac-futeba-1` (`~/actions-runner-2`) | `futeba`, `futeba-general`, `futeba-emulators`, `futeba-linux` | Único runner pesado: Gradle (Android, KMP), emuladores Firebase, Lighthouse, docker (Colima), deploys com segredo, iOS | `RUNNER_LABELS_HEAVY`, `RUNNER_LABELS_EMULATORS` e parte do pool leve |
| `oci-prod01-futeba` (prod-01, usuário `gha-futeba`) | `Linux`, `X64`, `futeba-linux` | Pool leve: Functions (build, lint, testes), Web (shards e gate), Semgrep, gitleaks, padrões, automações | `RUNNER_LABELS_LINUX` (junto com o Mac) |
| `mac-futeba-poller-1/2` | `futeba-poller` | Polling do E2E Gate, issue pós-merge, classificação de escopo | `RUNNER_LABELS_POLLER` |
| `futeba-windows-local`, `tf-desktop-runner` | `self-hosted, Windows, X64` | Standby, offline; nenhum workflow usa | — |

Valores das variáveis do repositório:

| Variável | Valor | Runners |
| --- | --- | --- |
| `RUNNER_LABELS_HEAVY` | `["self-hosted","futeba-general"]` | Mac |
| `RUNNER_LABELS_EMULATORS` | `["self-hosted","futeba-emulators"]` | Mac |
| `RUNNER_LABELS_LINUX` | `["self-hosted","futeba-linux"]` | Mac e prod-01 |
| `RUNNER_LABELS_POLLER` | `["self-hosted","futeba-poller"]` | pollers do Mac |

### Isolamento do runner da prod-01

A prod-01 também roda o runtime de produção da TF. O runner é um convidado e não pode enxergá-lo:

- Usuário próprio `gha-futeba`, sem `sudo`, fora do grupo `docker`, home `0750`. As pastas do
  runtime (`/run/tf*`, `/etc/tf-studio`, `/usr/local/lib/tf`) são `root` 0700/0750.
- Rede (`/usr/local/sbin/gha-futeba-egress` + `gha-futeba-egress.service`): regra `owner` no
  `OUTPUT` bloqueia metadados da OCI (169.254.0.0/16, token de instance principal), VCN, WireGuard,
  bridges dos containers e serviços locais. No loopback só passam DNS e portas efêmeras (≥32768),
  onde os próprios testes do job sobem servidores.
- systemd (`actions.runner...oci-prod01-futeba.service.d/10-limites.conf`): `MemoryMax=6G` sem
  swap, `CPUQuota=200%` (2 das 4 vCPUs), pesos de CPU e IO baixos, `Nice=10`, `NoNewPrivileges`,
  `ProtectSystem=full`, `PrivateTmp`.
- Por isso nada de Gradle, docker ou segredo de deploy na prod-01: esses jobs usam `RUNNER_LABELS_HEAVY`.
- Não ampliar CPU nem memória da VM sem autorização do Renan.

### Como cada workflow escolhe o runner

Todo `runs-on` segue o contrato de `scripts/ci/runner-selector.js`, verificado por
`scripts/ci/runner-selector-workflow-contract.test.js`:

```yaml
runs-on: ${{ fromJSON(<EVENTO_CONFIAVEL> && (vars.RUNNER_LABELS_X || '["ubuntu-24.04"]') || '"ubuntu-24.04"') }}
```

- **Evento confiável** = `push`, `schedule`, `workflow_dispatch` ou `pull_request` de branch do
  próprio repositório que não seja do Dependabot. Só quem tem escrita no repo gera esses eventos.
- **Todo o resto** (PR de fork, Dependabot, `issues`, `issue_comment`, reviews, `workflow_run`)
  vai para o runner hospedado `ubuntu-24.04`. Com o repositório público, os runners hospedados
  padrão (Linux e macOS) são gratuitos e descartáveis; código de fora nunca toca o Mac nem a prod-01.
- Jobs iOS (`ios-build`) usam o Mac próprio em evento confiável e `macos-15` hospedado no resto.
  `ios-testflight` é só `workflow_dispatch` e continua fixo no Mac.
- Se a variável sumir, o fallback é o hospedado.
- **O filtro é defesa em profundidade, não a barreira.** Num PR de fork o YAML vem do fork, que
  pode reescrever o `runs-on`. A barreira é a configuração do repositório *Require approval for all
  external contributors* (`actions/permissions/fork-pr-contributor-approval` =
  `all_external_contributors`). **Antes de aprovar um run de fork, leia o diff de `.github/`** e de
  qualquer script que o workflow execute; se o PR mexe em workflow, não aprove.
- `pr-review-to-issues` só cria issue para comentário de `OWNER`/`MEMBER`/`COLLABORATOR` ou do
  `github-actions[bot]`; `issue-automation` só rotula e comenta, com `GITHUB_TOKEN`.

## Regras de workflow (aplicadas e auditadas por `actionlint`)

- **`concurrency`** em todo workflow acionável: `cancel-in-progress: true` em PR/branch para
  descartar runs obsoletos; **`false`** em `deploy-beta`, `deploy-production` e `release`
  (um deploy ou release nunca é cancelado no meio; runs do mesmo ref entram em fila).
- **`timeout-minutes`** em todo job (hoje: 5 a 60 min).
- **Permissões mínimas**: todo workflow declara `permissions: contents: read` no topo; jobs
  que precisam de mais (`release`: `contents: write`; `version-bump`; `sync-labels`: `issues: write`) declaram no próprio job. O default
  do repositório também é `read`.
- **Escopo por mudança**: `change-scope.yml` + `.github/ci/change-scopes-v1.json` classificam os
  arquivos alterados (`web`, `functions`, `android`, `ios`, `rules`...). Os jobs de Web, Functions,
  Android (`android-ci`, `pr-check`) e Lighthouse (em PR) só executam quando o escopo muda (job
  pulado conta como sucesso para checks obrigatórios). `ios-build`, `firestore-rules-ci`,
  `semgrep` e `realtime-load-ci` usam filtros `paths`. Assim, mudança só em `web/**` não dispara
  Android nem iOS; docs/markdown são ignorados.
- **Cache**: `setup-node` com `cache: npm` (e `cache-dependency-path` por subprojeto) e
  `gradle/actions/setup-gradle` nos jobs Gradle.
- **Dependabot** (`.github/dependabot.yml`): agrupado por ecossistema, mensal, majors de
  toolchain (Kotlin/Compose/AGP, React, MUI, firebase-admin/functions) ignorados e tratados em
  issues próprias.
- `claude-code-review` não roda em PRs do Dependabot (não recebem secrets).
- `sync-labels` usa `prune: false`: o manifesto `.github/labels.yml` cria/atualiza labels mas
  nunca apaga as que não estão nele.

## Custos e GitHub Advanced Security (GHAS)

A organização está no plano **Free** e o GHAS (Code Security + Secret Protection, ~US$ 49/mês)
foi desligado em todos os repositórios privados. Consequências e substitutos gratuitos:

| Antes (pago em repo privado) | Agora (gratuito) |
| --- | --- |
| CodeQL (`codeql.yml`) — removido | `semgrep.yml` (SAST TypeScript) falhando em achados **ERROR** |
| `github/codeql-action/upload-sarif` (Semgrep, Detekt) — falha com "Advanced Security must be enabled" | Relatório como **artifact** (`semgrep-report`, `detekt-report`) + Job Summary; sem SARIF, sem `security-events: write` |
| Secret Protection / push protection | `secret-scan.yml`: **binário CLI** do gitleaks (a `gitleaks-action` v2 exige licença paga em org), `--redact`, config em `.gitleaks.toml` |

Regras para novos workflows neste repo:

- **Não** usar `github/codeql-action/*` nem `security-events: write` (falha ou cobra GHAS).
- Ferramentas de segurança devem gerar JSON/texto, subir como artifact e **falhar o job** em
  achados de severidade alta (o gate mora no workflow, não na aba Security).
- Falso positivo do gitleaks: ajustar a allowlist em `.gitleaks.toml` com a menor abrangência
  possível (regra + caminho/regex) e comentar o motivo.
- CodeQL só volta se o repositório for **público** (gratuito): condicionar o job a
  `github.event.repository.private == false`.

### Minutos de Actions (limite de 2.000 min/mês no Free)

- Os budgets de Actions/Packages/LFS/Codespaces da org são US$ 0 **com bloqueio**: nunca há
  cobrança, mas os jobs **hospedados** param ao estourar os minutos incluídos.
- Minutos de runner **self-hosted não contam**. Hosted Linux (`ubuntu-24.04`) conta 1x;
  **macOS hospedado conta 10x** — por isso todo job macOS usa o Mac self-hosted (`futeba`).
- Hosted hoje (só o que exige Linux): `firestore-rules-ci`, `web-lighthouse-ci`, `web-e2e-ci`,
  `pr-check` (job `android`), `functions-ci` (`test`, `firestore-query-perf`,
  `media-runtime-linux`), `ios-build` (`ios_app_scope`, `kmp-shared-tests`) e `secret-scan`
  (~1 min por execução). Os 2 runners Windows ociosos podem absorver jobs leves se faltar
  minuto (ver "Failover para Windows").

## Operação do runner `tf-desktop-runner` (Windows, sem admin)

Decisão (07/10/2026): manter o runner e torná-lo persistente, em vez de remover o registro.
Motivos: o host (16 threads, 32 GB de RAM, ~9 GB livres no momento da decisão) tem folga para
um listener extra (~36 MB ocioso, como os outros 12 listeners do host); as credenciais
(`.runner`, `.credentials`) continuavam válidas; e ele dá um 2º slot Windows em paralelo.

- Persistência: atalho `futeba-tf-desktop-runner.lnk` em
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`, apontando para
  `C:\Users\renan\actions-runner\run.cmd` com janela minimizada. Sobe a cada login do usuário
  `renan` (não é serviço: não sobrevive a logoff nem a reboot sem login).
- Iniciar agora (sem reiniciar o PC):
  ```powershell
  Start-Process -FilePath 'C:\Users\renan\actions-runner\run.cmd' -WorkingDirectory 'C:\Users\renan\actions-runner' -WindowStyle Minimized
  ```
- Conferir: `gh api repos/TechFernandesLTDA/futeba-dos-parcas/actions/runners --jq '.runners[]|"\(.name) \(.status) busy=\(.busy)"'`
- Parar: encerre a janela do `run.cmd` (ou o processo `Runner.Listener` que roda de
  `C:\Users\renan\actions-runner`). Nunca mate processos `node`/`java` do host.
- Remover de vez (se o host ficar sem folga):
  `gh api -X DELETE repos/TechFernandesLTDA/futeba-dos-parcas/actions/runners/31`,
  apague o atalho da pasta Startup e, opcionalmente, `C:\Users\renan\actions-runner`.
- Se virar necessário serviço (sobreviver a logoff): rode `config.cmd remove` com token de
  remoção e reinstale com `config.cmd --runasservice` **em prompt de admin** (requer o dono).

### Re-registro (se `.runner`/credenciais forem perdidos)

```bash
# token de registro (expira em 1 h; não commite nem cole em chats)
gh api -X POST repos/TechFernandesLTDA/futeba-dos-parcas/actions/runners/registration-token --jq .token
```
```powershell
cd C:\Users\renan\actions-runner
.\config.cmd --url https://github.com/TechFernandesLTDA/futeba-dos-parcas --token <TOKEN> --name tf-desktop-runner --labels self-hosted,Windows,X64 --unattended --replace
```

## Reativar Actions após o billing lock

1. Dono resolve o billing (issue #4203). Verifique com um `workflow_dispatch` simples.
2. Confirme os 3 runners `online` (`gh api repos/.../actions/runners`).
3. Rode `Web CI`, `Functions CI`, `Android CI` e `E2E` em uma branch e confira que nenhum job
   do escopo errado executa.
4. Só então merge de PRs que dependem de CI.

## Runner dedicado a emuladores (futeba-emulators)

Os jobs que sobem emuladores Firebase (Web E2E, Functions Integration, Test Harness, Realtime Load) usam `vars.RUNNER_LABELS_EMULATORS = ["self-hosted","futeba-emulators"]`. Só o `mac-futeba-1` tem essa label (antes era o `tf-wsl-1`). Os runners de um mesmo host compartilham 127.0.0.1 (9099/8085/5001), então um único runner serializa esses jobs pela fila nativa do GitHub, sem cancelar nada. O grupo de concurrency global antigo (`firebase-emulator-integration`) cancelava runs pendentes de outros refs, porque o GitHub guarda só 1 pendente por grupo. Para adicionar capacidade, use portas dinâmicas por job antes de pôr a label em outro runner.

## Runners do E2E Gate (futeba-poller)

O job `E2E Gate` só faz polling por até 45 min. Ele roda em `vars.RUNNER_LABELS_POLLER = ["futeba-poller"]`, nos runners leves `mac-futeba-poller-1/2` (sem labels de trabalho pesado). Assim o runner pesado fica livre para Android, emuladores e Lighthouse.

## Memória e Gradle nos runners WSL (histórico, 09/10/2026)

> Os runners WSL foram desligados. No Mac, o runner pesado usa `GRADLE_USER_HOME=~/.gradle-ci` com o mesmo ajuste (`-Xmx4g`, 4 workers).

- `.wslconfig` do host: `memory=8GB`, `processors=8`, `swap=8GB`, `autoMemoryReclaim=dropCache` (devolve o cache ao Windows). Com 12 GB a VM tomava a RAM do PC e, com 3 builds Gradle de 6 GB em paralelo, caía inteira.
- `tf-wsl-4` está desligado: com 8 GB cabem 2 jobs Gradle + emuladores + gates.
- Cada runner tem o próprio `GRADLE_USER_HOME` (`/home/ghrunner/.gradle-tf-wsl-N`, definido em `/opt/ar-tf-wsl-N/.env`). O post-step do `setup-gradle` para todos os daemons do user home, e com um home compartilhado derrubava builds de outros runners ("Gradle build daemon has been stopped: stop command received").
- `gradle.properties` de cada user home (tem precedência sobre o do projeto): `org.gradle.jvmargs=-Xmx3g`, `kotlin.compiler.execution.strategy=in-process`, `org.gradle.workers.max=2`, `org.gradle.daemon=false`. Com o daemon Kotlin separado em 1 GB, o `compileReleaseKotlin` estourava com GC overhead.
- Validação: `deploy-production` com `dry_run=true` no Linux (run 38010351597): AAB assinado em 7m50s; o PC ficou com no mínimo 8,4 GB livres.
