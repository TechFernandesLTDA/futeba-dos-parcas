# CI: runners, workflows e como reativar

> Atualizado em 09/10/2026. Este documento é a fonte de verdade da topologia de CI.
> `scripts/SELF_HOSTED_RUNNER.md` e `docs/ci/wsl2-self-hosted-runner.md` descrevem a instalação
> de runners; a tabela de workflows de `SELF_HOSTED_RUNNER.md` está desatualizada.

## Estado atual (importante)

- **Actions voltou a funcionar (07/10/2026)**: o billing lock da organização (issue #4203) foi
  resolvido ao regularizar o cartão. O GHAS pago foi desligado nos repos privados — ver
  "Custos e GitHub Advanced Security" abaixo.
- Validação local (lint, typecheck, testes, build, `actionlint` e os contratos de workflow:
  `node --test scripts/*.test.js scripts/ci/*.test.js`) continua útil antes de abrir PR.

## Topologia de runners

> **Sem runner macOS desde 09/10/2026.** O `MacBook-Pro-de-Renan` foi removido. Tudo roda nos
> runners Linux do WSL do PC. iOS está estacionado (#4202).

| Runner (org) | Labels | Papel | Variável |
| --- | --- | --- | --- |
| `tf-wsl-1` | `self-hosted, Linux, X64, futeba-emulators` | Exclusivo dos jobs com emulador Firebase (Web E2E, Functions Integration, Test Harness, Realtime Load, rules-tests, query-perf) | `RUNNER_LABELS_EMULATORS` |
| `tf-wsl-2..4` | `self-hosted, Linux, X64, futeba-general` (+ `bv2`, compartilhado com o brazuka-v2) | Pool geral: Android (lint, testes, build, **deploy na Play**, release), Web, Lighthouse, Functions, Semgrep, automações | `RUNNER_LABELS_LINUX` |
| `tf-wsl-gate`, `tf-wsl-gate-2` | `futeba-poller` (sem labels padrão) | Jobs leves: E2E Gate (polling), issue pós-merge, classificação de escopo | `RUNNER_LABELS_POLLER` |
| `futeba-windows-local`, `tf-desktop-runner` (repo) | `self-hosted, Windows, X64` | Standby; nenhum workflow usa hoje | — |

Os runners vivem na VM do WSL. O keepalive é a tarefa agendada do Windows `WSL-Runners-Keepalive`
(a cada 5 min, `hermes/scripts/wsl-keepalive.ps1`), e o `.wslconfig` tem `vmIdleTimeout=-1`.
Os serviços de runner de **outros repositórios** no mesmo host (`bv2-*`, `bkc-*`, `cc-*`) não
pertencem a este repo e não devem ser alterados.

### Como cada workflow escolhe o runner

- `runs-on: ${{ fromJSON(vars.RUNNER_LABELS_LINUX || '["self-hosted","Linux","X64","futeba-general"]') }}`:
  pool geral (padrão). Os jobs de emulador usam `vars.RUNNER_LABELS_EMULATORS || ...` e os de polling
  usam `vars.RUNNER_LABELS_POLLER || ...`. A variável legada `RUNNER_LABELS` (Mac) não é mais lida.
- `fromJSON(vars.RUNNER_LABELS_LINUX || '["ubuntu-24.04"]')`: jobs que antes eram hospedados.
  O fallback hospedado só vale se a variável sumir; o orçamento hospedado é US$ 0.
- Os builds Gradle que dependiam do SDK pré-instalado no Mac (`deploy-production`, `deploy-beta`,
  `release`, `android-macrobenchmark`) instalam o SDK com `android-actions/setup-android@v4` + `sdkmanager`.
- `android-macrobenchmark`: só `workflow_dispatch`, emulador `x86_64` (KVM do WSL). Não roda em push.
- **iOS** (`ios-build`: `build-shared-framework`/`build-ios-app`; `ios-testflight`): continuam
  fixos em `[self-hosted, macOS, ARM64, futeba]`, mas só rodam com `vars.IOS_MAC_RUNNER == 'true'`.
  Sem Mac, o `ios-build` roda só os testes KMP compartilhados (Linux) e o `notify` passa.
  **Nunca** usar `macos-*` hospedado (10x os minutos). Para retomar o iOS: registrar um runner macOS
  com o label `futeba` e `gh variable set IOS_MAC_RUNNER -R TechFernandesLTDA/futeba-dos-parcas --body true`.

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

Os jobs que sobem emuladores Firebase (Web E2E, Functions Integration, Test Harness, Realtime Load) usam `vars.RUNNER_LABELS_EMULATORS = ["self-hosted","Linux","X64","futeba-emulators"]`. Só o runner de org `tf-wsl-1` tem essa label. Todos os runners WSL compartilham 127.0.0.1 (9099/8085/5001), então um único runner serializa esses jobs pela fila nativa do GitHub, sem cancelar nada. O grupo de concurrency global antigo (`firebase-emulator-integration`) cancelava runs pendentes de outros refs, porque o GitHub guarda só 1 pendente por grupo. Para adicionar capacidade, use portas dinâmicas por job antes de pôr a label em outro runner.

## Runners do E2E Gate (futeba-poller)

O job `E2E Gate` só faz polling por até 45 min. Ele roda em `vars.RUNNER_LABELS_POLLER = ["futeba-poller"]`, nos runners leves `tf-wsl-gate` e `tf-wsl-gate-2` (serviços systemd em /opt/ar-tf-wsl-gate*, sem labels padrão). Assim o pool geral (`futeba-general`) fica livre para Android, Web e Lighthouse.
