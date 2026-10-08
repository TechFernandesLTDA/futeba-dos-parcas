# GitHub Actions — startup_failure com registro de workflow fantasma (pacote de suporte, issue #4203)

Status: PACOTE PARA GITHUB SUPPORT. Este documento NÃO resolve a issue #4203. A issue só pode ser encerrada depois de: (a) GitHub Support confirmar/remover o registro `375847629` e (b) um run real (`web-e2e-ci.yml` ou `e2e-gate.yml`) concluir com `conclusion=success` no SHA esperado, com URL do run anexada.

Responsável por abrir o caso: dono da conta/org (renanlocatizfernandes). Agentes não abrem casos de suporte.

## 1. Identificação

- Organização: TechFernandesLTDA
- Repositório afetado: https://github.com/TechFernandesLTDA/futeba-dos-parcas (privado)
- Repositórios com o mesmo sintoma: https://github.com/TechFernandesLTDA/brazuka-v2 e https://github.com/TechFernandesLTDA/brazuka-v3
- Workflow fantasma: id 375847629, `name: ""`, `path: "BuildFailed"`, `state: deleted`
  - Verificação: `gh api repos/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/375847629` (exit 0)
  - Criado em 2026-10-05T19:00:52-03:00 (= 2026-10-05T22:00:52Z)

## 2. Sintoma

Todo evento novo de Actions morre com `conclusion: startup_failure`, com `jobs.total_count = 0` e `check_runs = 0`. Inclui `push`, `pull_request`, `issue_comment` e `schedule`, inclusive em workflows sem qualquer mudança de código.

Exemplo verificado (futeba-dos-parcas):
- run 37702565509, event pull_request, head 59f8e4b9, criado 2026-10-07T23:29:28Z, conclusion startup_failure, path BuildFailed, workflow_id 375847629
- check-suite github-actions 102142209449: startup_failure

Exemplos em outros repositórios:
- brazuka-v2: run 37380418169 (schedule, branch main), 2026-10-05T22:07:29Z, startup_failure, path BuildFailed. Run 37679249365 (schedule, main), 2026-10-07T20:04:19Z, startup_failure.
- brazuka-v3: run 37401923541 (push, main), 2026-10-06T01:59:29Z, startup_failure, path BuildFailed.

## 3. Cronologia (UTC, extraída da API)

- 2026-10-05T16:53:36Z: último sucesso no master do futeba (run 37344288771, CI Metrics, SHA 76c296e7af).
- 2026-10-05T15:52:14Z: último commit em .github/workflows antes do incidente (76c296e7af).
- 2026-10-05T22:00:52Z: criação do registro fantasma 375847629.
- 2026-10-05T22:01:29Z: primeiro startup_failure do futeba-dos-parcas nos últimos 100 runs.
- 2026-10-05T22:07:29Z: primeiro startup_failure do brazuka-v2 (nos runs listados).
- 2026-10-06T01:36Z: primeiros startup_failure do brazuka-v3 (nos runs listados).
- 2026-10-05T22:11:09Z: commit e140907a ("force reindex of actions dispatch registry") — feito pelo mantenedor, sem efeito.
- 2026-10-07T23:29:28Z: ainda startup_failure (run 37702565509).

## 4. O que já foi tentado (não repetir)

Sem sucesso, segundo o histórico da issue #4203 e revalidação de 2026-10-07:
- Deletar runs fantasma pela API (2x; novos runs continuam nascendo com o mesmo path).
- Reindex por commit vazio (e140907a).
- Re-push e commits vazios para disparar de novo.
- Disable/enable do workflow real, close/reopen de PR, re-dispatch.
- Validação dos YAMLs de workflow (reportada no histórico da #4203 com js-yaml): nenhum inválido no master. Não reexecutada com actionlint nesta revalidação de 2026-10-07.

## 5. Hipóteses testadas

- H1 "YAML inválido no master": CONTRADITA. Houve sucessos no master (16:35–16:53Z) depois do último commit de workflow (15:52Z). O início coincide com o registro fantasma, não com commit de workflow. A mesma falha ocorre em brazuka-v2/v3, que têm YAMLs diferentes.
- H2 "Problema específico do repositório futeba-dos-parcas": CONTRADITA. brazuka-v2 e brazuka-v3 também geram startup_failure com o mesmo path fantasma `BuildFailed`.
- H3 "Registro corrompido do Actions na conta/org (workflow fantasma)": SUSTENTADA. Mesmo path fantasma em três repositórios e início coincidente com a criação do registro 375847629.
- H4 "Limite de cobrança/spending limit de Actions que impede início de runs": NÃO VERIFICADA. A API de billing retornou 404 (usuário) e 410 (org) com o token do agente. Dono deve verificar em Settings → Billing and plans → Actions (a UI mostra a causa de bloqueio, a API não). Se houver limite de gasto, a correção é de billing, não de registro.
- H5 "Política de Actions/permissões": DESCARTADA para o repo futeba. `actions/permissions` = enabled, allowed_actions=all (exit 0).

## 6. Pedido ao GitHub Support

1. Remover ou reparar o registro de workflow id 375847629 (`name: ""`, `path: BuildFailed`, state deleted) que continua capturando novos runs em TechFernandesLTDA/futeba-dos-parcas, TechFernandesLTDA/brazuka-v2 e TechFernandesLTDA/brazuka-v3.
2. Confirmar se há bloqueio de conta/org (billing, spending limit ou verificação) que faça o GitHub recusar o início de jobs, e a mensagem exibida na UI para um run startup_failure.
3. Confirmar quando novos runs passam a iniciar, para que a validação seja feita com um run real.

## 7. Como o dono coleta a mensagem da UI (não coberta pela API)

- Abrir https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/runs/37702565509 e copiar a mensagem exibida no run (ex.: "This run likely failed because of a workflow file issue" ou aviso de billing). Não é exposta pela API (check-runs = 0, annotations = nenhuma).
- Em Settings → Billing and plans, registrar se há limite de Actions ativo.

## 8. Critério de encerramento da #4203 (não encerrar antes)

- GitHub Support confirma remoção/reparo do registro 375847629 ou causa alternativa com evidência.
- Run real de `web-e2e-ci.yml` ou `e2e-gate.yml` com `conclusion=success` no SHA esperado, URL anexada.
- Nenhum novo run com path `BuildFailed`.

Não basta criar este documento para encerrar a #4203.

## 9. Dados não incluídos por segurança

Nenhum token, chave, segredo ou conteúdo de credencial. Dados de identificação de conta foram omitidos; os IDs acima são IDs públicos de runs/workflows do repositório.
