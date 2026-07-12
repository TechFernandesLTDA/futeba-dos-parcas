# Plano de Execução — Epic #3537: CI ≤ 3 min

> Decoposição acionável do épico **#3537 "[EPIC] CI ≤3 min: reduzir fan-out e fila sem remover cobertura"**
> em ondas de execução com grafo de dependências, arquivos exatos a alterar e critérios de aceite.
>
 - **Baseline**: PR #3536 (commit `67621cb`) — 16 jobs self-hosted em 2 runners Mac; 913s acumulados; wall 518s; fila mediana 203s / p90 433s / máx 457s.
 - **Alvo**: PR web-only representativo conclui todos os checks em ≤210s; p90 de 10 PRs ≤240s.
 - **Restrição**: nenhum gate apagado — apenas consolidado, escopado ou movido de runner.

---

## 1. Sumário das 6 issues filhas

| # | Título | Complexidade (1-5) | Economia estimada (CI) | Runner alvo | Bloqueia |
|---|--------|:---:|---|---|---|
| **#3540** | ci(runners): mover gates Linux-safe p/ capacidade separada do Mac | **4** | ~150-200s de contenção Mac (ataca direto a fila) | Linux (`ubuntu-latest`) | #3541, #3543 |
| **#3542** | ci(rules): suíte portátil, cobrir storage.rules, cancelar runs obsoletos | **2** | ~40-60s + elimina runs duplicados sem `cancel-in-progress` | Linux | — |
| **#3539** | ci(web): consolidar installs e eliminar typecheck/build duplicados | **3** | ~60-90s (2-3 `npm ci` + build removidos) | Linux (já em `ubuntu-latest` no PR) | — |
| **#3541** | ci(patterns): dividir Validate Patterns por domínio e reduzir fan-out | **3** | ~80-100s (5 jobs Mac → 1-2 jobs Linux) | Linux | — (mas depende de #3540 p/ runner) |
| **#3543** | ci(functions): reutilizar install/build entre lint, testes e integração | **4** | ~70-100s (6→2 `npm ci`; reuse de `lib/`) | Misto: Linux (quality/test) + Mac (perf/mutation) | — (mas depende de #3540 p/ runner) |
| **#3544** | ci(observability): publicar tempo de fila e orçamento de duração | **2** | 0s direto (habilita medição + detecção de regressão) | Linux | — (lógica: valida o alvo após as demais) |

> **Nota sobre complexidade**: #3540 e #3543 são 4 porque envolvem migração cross-runner (permissões/segredos/SARIF) e compartilhamento de artifacts entre jobs/workflows, respectivamente. #3542 e #3544 são 2 (mudanças localizadas e bem delimitadas).

---

## 2. Grafo de dependências

```text
                          ┌─────────────────────────────────────────────┐
                          │           EPIC #3537 — CI ≤ 3 min            │
                          └─────────────────────────────────────────────┘
                                            │
          ┌─────────────────── WAVE 1 (fundacional, paralelo) ───────────────────┐
          │                                                                     │
          │   #3540 (runner split)      #3542 (rules portátil)     #3539 (web consolida)  │
          │   [sem deps]                [sem deps]                 [sem deps]             │
          │        │                                                     [coord c/ #3541]      │
          │        │  libera capacidade Mac (CodeQL/Semgrep/Patterns/Rules → Linux)       │
          └────────┼─────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
          ┌─────────────────── WAVE 2 (dependente do runner Linux) ─────────────────┐
          │                                                                        │
          │   #3541 (patterns split)          #3543 (functions reuse)              │
          │   precisa: #3540 (Linux)          precisa: #3540 (Linux) + classificador│
          │           classificador (existe)          (existe)                      │
          │           coords c/ #3539          coords c/ #3541 (typecheck overlap)  │
          └────────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
          ┌─────────────────── WAVE 3 (medição) ──────────────────┐
          │                                                        │
          │   #3544 (observability)                                │
          │   [sem deps p/ construir, mas valida o alvo só após    │
          │    as ondas 1+2 estarem em master]                     │
          └────────────────────────────────────────────────────────┘
```

**Linhas de bloqueio explícitas (das próprias issues):**
- `#3541 → #3540` (preferencial) e `#3541 → #3538` (classificador — **já implementado** em `change-scope.yml`).
- `#3543 → #3538` (classificador — já existe); `#3543 ⊣⊢ #3540` (coordenar runner).
- `#3542 ⊣⊢ #3540` (integrar ao mover p/ Linux), mas **não depende** do classificador p/ começar.
- `#3544` → sem dependências técnicas; **dependência lógica** das demais para validar o alvo de ~3 min.

**Grupos paralelizáveis:**
- **Grupo A (Wave 1)**: #3540, #3542, #3539 — totalmente independentes, podem ter 3 PRs abertos simultaneamente.
- **Grupo B (Wave 2)**: #3541 e #3543 podem rodar em paralelo entre si (workflows distintos), **após** #3540 mergear.
- **Overlap a coordenar**: #3539 ↔ #3541 compartilham a remoção do `npx tsc --noEmit` isolado em `validate-patterns.yml:158`. Decidir num único PR ou alinhar a remoção.

---

## 3. Ondas de execução recomendadas

### Wave 1 — Fundacional / Paralelo (sem dependências)

| Issue | Porquê aqui | Arquivo(s) a alterar |
|-------|-------------|----------------------|
| **#3540** | Libera capacidade Mac movendo CodeQL/Semgrep/Patterns/Rules p/ Linux; habilita Wave 2 | `codeql.yml`, `semgrep.yml`, `validate-patterns.yml`, `firestore-rules-ci.yml`, `web-lighthouse-ci.yml` |
| **#3542** | Sem deps; corrige `concurrency` ausente + adiciona `storage.rules` aos paths | `firestore-rules-ci.yml` |
| **#3539** | Web já roda em `ubuntu-latest` no PR; consolidação é autônoma | `web-ci.yml`, `web-lighthouse-ci.yml` (coords c/ #3541 p/ o typecheck) |

### Wave 2 — Dependente (exige #3540 merged + classificador)

| Issue | Porquê aqui | Arquivo(s) a alterar |
|-------|-------------|----------------------|
| **#3541** | Precisa do runner Linux livre (de #3540) e do classificador (existe) | `validate-patterns.yml`, `change-scope.yml` (consumir outputs) |
| **#3543** | Precisa do runner Linux + reuso de artifact entre jobs | `functions-ci.yml`, `functions-integration-ci.yml` |

### Wave 3 — Medição

| Issue | Porquê aqui | Arquivo(s) a alterar |
|-------|-------------|----------------------|
| **#3544** | Constrói-se a qualquer momento (telemetria read-only), mas o **critério de aceite** (validar ≤3 min) só se completa após Waves 1+2 | novo `.github/workflows/ci-metrics.yml` + script `scripts/ci/collect-metrics.js` |

> **Recomendação**: iniciar #3544 em **paralelo com a Wave 1** para capturar o **baseline (antes)**; o merge do gate/alerta fica para a Wave 3, quando há histórico ≥10 PRs pós-otimização para comparar.

---

## 4. Detalhe por issue — arquivos, mudança-chave e aceite

### #3540 — ci(runners): mover gates Linux-safe para capacidade separada do Mac

**Arquivos exatos:**
- `.github/workflows/codeql.yml:51` — trocar `runs-on` de `self-hosted,macOS,ARM64` → `ubuntu-latest`. O extrator `javascript-typescript` com `build-mode: none` **não precisa** de Mac/Rosetta (o comentário em `codeql.yml:48-50` só se aplicava ao extrator Java/Kotlin, já desabilitado). Remover o step "Cleanup CodeQL temp dirs (self-hosted)" (`codeql.yml:79-83`) — Linux efêmero não acumula `_work`.
- `.github/workflows/semgrep.yml:30` — trocar `runs-on` → `ubuntu-latest`. O step de venv (`semgrep.yml:48-53`) funciona em Linux; alternativamente usar a action Docker `returntocorp/semgrep` (instável no Mac ARM64, mas estável em Linux).
- `.github/workflows/validate-patterns.yml:36,62,79,105,140` — os 5 jobs vão p/ `ubuntu-latest` (ripgrep via `apt-get` em vez de `brew`).
- `.github/workflows/firestore-rules-ci.yml:24` — mover p/ `ubuntu-latest` (coordenar com #3542).
- `.github/workflows/web-lighthouse-ci.yml:31` — **já em `ubuntu-latest` no PR**; validar thresholds de #3270 pós-migração dos demais.

**Mudança-chave:** separar a capacidade Linux (gates JS/security/Rules portáteis) da capacidade Mac (reservada a iOS/Apple e tarefas comprovadamente dependentes do Mac). Avaliar Android Gradle em Linux após os gates JS/Rules.

**Aceite:**
- [ ] CodeQL, Semgrep, Patterns, Rules e Lighthouse passam 3× consecutivas fora do Mac.
- [ ] Uso self-hosted Mac por PR web cai ≥60%.
- [ ] Lighthouse mantém os thresholds de #3270 (variação documentada).
- [ ] Nenhum segredo/artifact perde escopo/permissão (SARIF continua subindo p/ a aba Security).

**Risco:** CodeQL em Linux pode ter path/categoria de SARIF levemente diferente — validar o upload Security tab após a migração. Semgrep em Linux permite usar a action oficial (mais rápida que venv).

---

### #3542 — ci(rules): suíte portátil, cobrir storage.rules e cancelar runs obsoletos

**Arquivos exatos:**
- `.github/workflows/firestore-rules-ci.yml` — 4 alterações:
  1. **Adicionar bloco `concurrency`** (hoje **ausente** — este é o único workflow sem `cancel-in-progress`):
     ```yaml
     concurrency:
       group: ${{ github.workflow }}-${{ github.ref }}
       cancel-in-progress: true
     ```
  2. **Adicionar `storage.rules` aos `paths`** (`firestore-rules-ci.yml:8-11` e `:14-17`) — hoje só `firestore.rules` e `firestore-rules-tests/**` disparam; um PR só com `storage.rules` **não roda** a suíte (cobertura faltante).
  3. **Mover `runs-on` → `ubuntu-latest`** (`:24`) — emuladores Firestore+Storage funcionam em Linux com `setup-java@v4`.
  4. **Tornar `test:ci` portátil** — remover fix de `JAVA_HOME` do Homebrew; usar `actions/setup-java@v4` (já presente em `:38-42`, mas o script `firestore-rules-tests/package.json` pode fixar o path do brew — auditar).
- `firestore-rules-tests/package.json` — auditar/ajustar o script `test:ci` que fixa `JAVA_HOME` do Homebrew.

**Aceite:**
- [ ] PR apenas com `storage.rules` dispara a suíte.
- [ ] Firestore e Storage executam **todos** os testes atuais sem `maxWorkers` ocultamente reduzido.
- [ ] Novo push cancela run obsoleto do mesmo PR.
- [ ] Três execuções Linux verdes, com artifacts/logs equivalentes.

**Risco:** `--maxWorkers=1` (atual `:59`) existe p/ estabilizar Vitest contra o emulador no Mac; em Linux pode ser relaxado — testar antes de remover.

---

### #3539 — ci(web): consolidar installs e eliminar typecheck/build duplicados

**Arquivos exatos:**
- `.github/workflows/web-ci.yml` — já otimizado (2 shards em `ubuntu-latest` no PR, cada um com 1 `npm ci`; shard 1 faz lint+build). A consolidação adicional é **transversal**:
  1. O typecheck isolado (`npx tsc --noEmit --project tsconfig.dev.json`) existe em `validate-patterns.yml:158` (job `validate-pre-push`) — **duplica** o `npm run build` do web-ci (que já roda `tsc`). Remover do validate-patterns (coordenar com #3541).
  2. `web-lighthouse-ci.yml:81-85` + `:95-97` — faz `npm ci` + `npm run build` que o web-ci já produziu. Considerar **artifact de build** (`dist/`) versionado por hash do `package-lock` para o Lighthouse consumir sem rebuild.
- `.github/workflows/validate-patterns.yml:157-158` — remover "Web TypeScript check" (redundante com web-ci `npm run build`).

**Aceite:**
- [ ] Lint, TypeScript, build de produção e todos os testes continuam obrigatórios.
- [ ] No máximo **dois** `npm ci` no caminho de PR do Web CI.
- [ ] Runner time Web ≤190s no cenário equivalente ao #3536.
- [ ] Falhas continuam atribuíveis a `quality` ou `tests`.

**Risco:** remover o typecheck isolado pode mascarizar erros que `tsc --noEmit` pegaria mas `vite build` não (raro, mas possível com `tsconfig.dev.json` separado). Confirmar que `npm run build` (= `tsc && vite build`) cobre `tsconfig.dev.json`.

---

### #3541 — ci(patterns): dividir Validate Patterns por domínio e reduzir fan-out

**Arquivos exatos:**
- `.github/workflows/validate-patterns.yml` — hoje **5 jobs Mac** (`audit-patterns`, `secrets-check`, `rules-catchall`, `security-headers`, `validate-pre-push`). Mudanças:
  1. **Consumir `change-scope.yml`** (já exportado por web-ci/pr-check) via `needs: changes` + `if: needs.changes.outputs.web == 'true'` para validações web; análogo p/ functions.
  2. **Juntar os 4 checks curtos** (`audit-patterns`, `secrets-check`, `rules-catchall`, `security-headers`) em **1 job Linux** — são todos bash/grep/ripgrep, levam segundos.
  3. **Escopar `validate-pre-push`** (`:138-167`): hoje instala **ambos** web e functions e roda build/lint de ambos independente do escopo. Condicionar: web só se `web == 'true'`; functions só se `functions == 'true'`. Remover o `npx tsc --noEmit` (overlap com #3539).
  4. **Runner → `ubuntu-latest`** (coords c/ #3540).
- `.github/workflows/change-scope.yml` — já existe; apenas ser consumido (adicionar o `workflow_call` já está pronto em `:4-26`).

**Aceite:**
- [ ] PR web-only **não** instala Functions.
- [ ] PR functions-only **não** instala Web.
- [ ] Audit, secrets, catch-all e headers continuam cobertos.
- [ ] Validate Patterns conclui em ≤45s após obter runner.

**Risco:** se o classificador errar (arquivo unknown → habilita todos os scopes por `classify-changes.js:89-92`), um PR escopado pode disparar tudo — é o comportamento **fail-safe** correto (super-cobertura), aceitável.

---

### #3543 — ci(functions): reutilizar install/build entre lint, testes e integração

**Arquivos exatos:**
- `.github/workflows/functions-ci.yml` — hoje **6 `npm ci`** (`:47, :69, :99, :132, :226, :275`), sendo 5 no Mac. Mudanças:
  1. **Reduzir installs**: job `build` (`:30-50`) produz `lib/` + `node_modules/` como **artifact versionado** por `SO + Node + hash(functions/package-lock.json)`. Jobs `lint`, `test`, `firestore-query-perf` consomem o artifact em vez de re-instalar.
  2. **Mover quality/test → Linux** (`ubuntu-latest`), reservar Mac só p/ `mutation` (cron) e `firestore-query-perf` se comprovar dependência. `media-runtime-linux` (`:74-109`) **já é Linux**.
  3. **Aplicar classificador**: hoje `functions-ci.yml` dispara só em `paths: functions/**`. Adicionar `needs: changes` + `if: needs.changes.outputs.functions == 'true'` p/ evitar Functions em PRs de outros domínios (mesmo que `paths` filtre, o `shared/**` e `scripts/**` podem acionar).
- `.github/workflows/functions-integration-ci.yml:59-65` — reusar `lib/` do artifact do `functions-ci` build em vez de re-instalar + re-compilar (`npm ci` + `npm run build`).

**Aceite:**
- [ ] PR functions-only preserva build, lint, Jest/coverage e integração.
- [ ] No máximo **dois** `npm ci` no caminho crítico normal de Functions.
- [ ] PR sem `functions`/`shared` **não** instala Functions.
- [ ] Cache/artifact usa chave `SO + Node + hash(package-lock)`.

**Risco:** compartilhar `node_modules/` via artifact entre jobs Linux é confiável, mas `lib/` compilado deve ter **stamp de versão** (hash do lock + hash dos sources) p/ evitar stale cache. O emulador Firestore (`firestore-query-perf`, `functions-integration`) é sensível a portas ocupadas — manter o step "Liberar portas" (`:242-244`, `:67-68`).

---

### #3544 — ci(observability): publicar tempo de fila e orçamento de duração

**Arquivos exatos:**
- **Novo** `.github/workflows/ci-metrics.yml` — workflow `workflow_run` (dispara após outros workflows concluírem) que coleta via GitHub API (`/repos/{owner}/{repo}/actions/runs/{run_id}/jobs`): `queue_time`, `run_time`, `runner` por job.
- **Novo** `scripts/ci/collect-metrics.js` — calcula critical path, fila p50/p90, top jobs; publica summary do workflow + artifact JSON (sem dados sensíveis).
- Opcional: badge/JSON em `docs/` ou upload p/ GitHub Pages p/ histórico semanal.

**Aceite:**
- [ ] Summary mostra critical path, fila e top jobs.
- [ ] Histórico de ≥10 PRs gera baseline comparável.
- [ ] Epic valida alvo de ~3 minutos com dados.
- [ ] Telemetria não adiciona >10s ao caminho crítico (usa `workflow_run`, off-critical-path).

**Risco:** `workflow_run` roda no branch default (master) — não herda permissões do PR; garantir `actions: read` e tratar rate limit da API em pico de PRs.

---

## 5. Análise de riscos

### Riscos à cobertura (o que pode quebrar testes/gates)

| Risco | Onde | Mitigação |
|-------|------|-----------|
| Migrar CodeQL p/ Linux muda categoria/SARIF | `codeql.yml` (#3540) | Validar upload p/ Security tab em 3 runs; comparar findings antes/depois |
| Remover `npx tsc --noEmit` mascariza erro que `vite build` não pega | `validate-patterns.yml` (#3539/#3541) | Confirmar que `npm run build` = `tsc && vite build` cobre `tsconfig.dev.json` |
| Classificador erra escopo → PR escopado dispara tudo | `change-scopes-v1.json` (#3541/#3543) | Comportamento fail-safe (super-cobertura) é aceitável; manter suíte completa em schedule/release p/ detectar erro de classificação |
| Reuso de `lib/` stale entre jobs Functions | `functions-ci.yml` (#3543) | Versionar artifact por hash(lock + sources); job de integração valida o `lib/` |
| Relacionar `maxWorkers=1` das Rules em Linux | `firestore-rules-ci.yml` (#3542) | Testar relaxamento do `--maxWorkers` em Linux antes de remover |

### Riscos à fila/runner (o que pode anular o ganho)

| Risco | Mitigação |
|-------|-----------|
| Muitos jobs em `ubuntu-latest` podem bater no limite de jobs concorrentes do GitHub-hosted (free tier) | Monitorar com #3544; considerar pool Linux dedicado se houver throttle |
| `workflow_run` da observability (#3544) adiciona carga | Rodar off-critical-path; não bloquear merge |
| Concorrer `cancel-in-progress` de múltiplos workflows no mesmo PR | Cada workflow já tem seu `concurrency.group` isolado por `${{ github.workflow }}` — sem colisão |

### Sinal de regressão a vigiar
- **Fila p90 >240s** após Wave 1 → algum gate não migrou ouLinux pool está em throttle.
- **Coverage diff <80%** em functions (#3543) → artifact de `lib/` stale ou `lcov` desnormalizado.
- **Lighthouse abaixo do threshold #3270** → migração de runner alterou performance do Chrome headless.

---

## 6. Matriz de cobertura — antes/depois (a preencher pós-Wave 2)

| Gate | Antes (runner) | Depois (runner) | Cobertura mantida? |
|------|---------------|-----------------|--------------------|
| Lint Web | Mac (web-ci shard 1) | Linux (web-ci) | ✅ |
| Build/TypeScript Web | Mac ×2 (web-ci + validate-patterns) | Linux ×1 (web-ci) | ✅ (validar tsconfig.dev.json) |
| Testes Web (Vitest, 2 shards) | Linux (web-ci) | Linux (web-ci) | ✅ |
| Lighthouse | Linux (web-lighthouse, PR) | Linux (consumindo artifact) | ✅ (thresholds #3270) |
| CodeQL | Mac | Linux | ✅ (JS/TS only) |
| Semgrep | Mac | Linux | ✅ |
| Validate Patterns (5 checks) | Mac ×5 jobs | Linux ×1-2 jobs (escopado) | ✅ |
| Firestore/Storage Rules | Mac | Linux | ✅ (+ storage.rules path) |
| Functions build/lint/test | Mac ×5 | Linux ×2 (com artifact) | ✅ |
| Functions Integration | Mac | Mac ou Linux (reuse lib/) | ✅ |
| Mutation (web/functions) | Mac (cron) | Mac (cron) | ✅ (inalterado) |
| iOS build | Mac | Mac (reservado) | ✅ (capacidade liberada) |

---

## 7. Ordem de merge sugerida (critério de PR)

1. **#3542** primeiro (menor risco, corrige `concurrency` ausente + `storage.rules` — bug latente de cobertura).
2. **#3540** (libera capacidade — maior impacto na fila; fundacional p/ Wave 2).
3. **#3539** (consolidação web — independente, mas tocar `validate-patterns.yml` então coordenar com #3541).
4. **#3541** (patterns split — precisa de #3540 + alinhar remoção do typecheck com #3539).
5. **#3543** (functions reuse — precisa de #3540; mais complexo pelo artifact).
6. **#3544** por último (valida o alvo com histórico pós-otimização).

> Cada PR segue o fluxo SDD: spec → branch → Conventional Commit → `gh pr create` → CI verde → squash merge. Não há push direto em `master`.

---

**Referências:**
- Epic: #3537 | Baseline: PR #3536 (`67621cb`)
- Classificador: `.github/workflows/change-scope.yml` + `scripts/ci/classify-changes.js` + `.github/ci/change-scopes-v1.json`
- Shard planner: `scripts/ci/vitest-shard-plan.js`
- Lighthouse estabilizado por: #3270
