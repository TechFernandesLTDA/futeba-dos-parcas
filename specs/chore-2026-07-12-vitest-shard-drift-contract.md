# CHORE: Prevenir drift do `include` do Vitest no shard planner dinâmico

> **Status:** `DRAFT`
> **Tipo:** CI / Testes (contrato)
> **Autor:** agente (spec gerada a partir da issue #3554)
> **Data:** 2026-07-12
> **Issue:** #3554
> **PR de origem:** #3551 (commit `625438ed`) — `perf(ci): shard web tests behind stable gate`
> **Follow-up de:** revisão independente do PR #3551 (P2/P3)
> **Não confundir com:** #3539 (meta de desempenho — permanece aberta)

---

## 1. Contexto e Problema

### 1.1 O que existe hoje

O PR #3551 introduziu o planejamento dinâmico dos testes Web em dois shards. O
planner percorre `web/src/` e seleciona arquivos de teste com uma regex própria,
enquanto o Vitest seleciona os mesmos arquivos via glob declarado em
`web/vite.config.ts`. Hoje os dois padrões coincidem, mas são mantidos em arquivos
distintos e em formatos diferentes:

| Fonte | Arquivo | Representação |
|-------|---------|---------------|
| Vitest (runtime) | `web/vite.config.ts:121` | `include: ['src/**/*.{test,spec}.{ts,tsx}']` (glob) |
| Shard planner (CI) | `scripts/ci/vitest-shard-plan.js:6` | `const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx)$/` (regex) |

### 1.2 Risco

Se o `include` do Vitest for ampliado no futuro (ex.: adicionar `.js`/`.jsx`,
acrescentar um novo diretório de testes, incluir testes de integração) **sem**
atualizar `TEST_FILE_PATTERN`, novos tipos de arquivo passam a rodar em
`vitest run` local mas **ficam de fora dos shards silenciosamente** no CI. O
verificador `scripts/ci/verify-vitest-shards.js` confirma que cada shard executou
exatamente o planejado — mas não detecta que o plano em si está desalinhado com a
configuração real do Vitest. Resultado: falsa sensação de cobertura no gate.

### 1.3 Comentário obsoleto do `web_gate`

Durante o PR #3551 o passo de verificação foi movido para dentro do job
`web_shards`, mas um comentário no job `web_gate` permaneceu desatualizado, dando
a entender que o **gate** executa o verificador. Na verdade o gate é puramente
declarativo: inspeciona apenas `needs.*.result` via shell, sem checkout, sem Node
e sem chamar nenhum script de verificação (o contrato em
`scripts/web-ci-workflow-contract.test.js` checa ativamente que o gate **não**
rode `npm ci`, `checkout`, `setup-node` etc.).

---

## 2. Objetivos

1. **Garantir que o shard planner e o `include` do Vitest nunca diverjam
   silenciosamente.**
2. **Cobrir, em teste, os quatro sufixos/extensões atuais** (`test/spec` ×
   `ts/tsx`) e uma **ampliação simulada que deve falhar** o contrato.
3. **Corrigir o comentário obsoleto do `web_gate`** para refletir que o gate apenas
   agrega resultados (e roda em runner efêmero por segurança de PR, não porque
   executa verificador algum).

### 2.1 Fora de Escopo

- Meta de desempenho dos shards (#3539) — permanece responsabilidade daquela issue.
- Mudar a estratégia de sharding (ex.: 3+ shards, balanceamento por duração).
- Refatorar `web/vite.config.ts` para ler a configuração de outro lugar (a não ser
  que a opção "fonte única" seja escolhida — ver §3.2).

---

## 3. Technical Design

### 3.1 Decisão: contrato (recomendado) vs. fonte única

A issue aceita **uma de duas** abordagens. Recomendação: **contrato** (opção B),
pelos motivos abaixo.

| Aspecto | (A) Fonte única compartilhada | (B) Contrato que compara os dois (recomendado) |
|--------|-------------------------------|------------------------------------------------|
| Aderência às convenções do repo | Baixa: exigiria ponte ESM/TS ↔ CJS | **Alta:** o repo já tem 3 contract tests (`scripts/web-ci-workflow-contract.test.js`, `scripts/ci/ci-scope-workflow-contract.test.js`, `scripts/ci/verify-vitest-shards.test.js`) que leem fonte como texto e rodam via `node --test` |
| Risco de regressão | Médio: muda path de load da config em build | **Baixo:** não toca no runtime; só adiciona asserção |
| Provê "ampliação simulada que falha" | Indireto | **Direto:** é um caso de teste natural |
| Custo de manutenção | Médio (novo arquivo compartilhado + schema) | **Baixo** (uma função de comparação + casos) |

**Portanto: implementar a opção B (contrato).** A opção A fica registrada em §6
como evolução futura (P3) caso o time prefira DRY estrutural em vez de detecção.

### 3.2 Abordagem do contrato (escolhida)

Adicionar uma função de comparação e casos de teste em
`scripts/ci/verify-vitest-shards.test.js` (arquivo já existente, já rodando em CI
no step "Verify Web CI contract" de `web_shards`).

A função de comparação deve:

1. Ler `web/vite.config.ts` como texto e extrair o valor de `test.include`
   (regex alvo: `/include:\s*\[\s*'([^']+)'\s*\]/` → captura
   `src/**/*.{test,spec}.{ts,tsx}`).
2. Expor `TEST_FILE_PATTERN` (já exportado por `vitest-shard-plan.js`) e extrair
   os grupos `(?:test|spec)` e `(?:ts|tsx)`.
3. Extrair do glob os grupos entre chaves `{test,spec}` e `{ts,tsx}`.
4. Comparar os **conjuntos de tokens** (ordem-independente) das duas fontes e
   disparar `AssertionError` descritivo em caso de divergência.

> Nota: comparar por conjuntos de tokens — e não por strings literais — torna o
> contrato imune a reordenação cosmética (ex.: `{tsx,ts}` vs `{ts,tsx}`) e foca
> no que importa: os sufixos/extensões efetivamente cobertos.

Esboço:

```js
// scripts/ci/vitest-shard-plan.js — exportar também um parser do padrão (opcional)
// Permanece: const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx)$/;
```

```js
// Em scripts/ci/verify-vitest-shards.test.js (novo bloco)

function extractBraceTokens(glob) {
  // 'src/**/*.{test,spec}.{ts,tsx}' -> { suffixes: ['test','spec'], extensions: ['ts','tsx'] }
}

function extractRegexTokens(regexSource) {
  // '\\.(?:test|spec)\\.(?:ts|tsx)$' -> { suffixes: ['test','spec'], extensions: ['ts','tsx'] }
}

function assertIncludeMatchesPlanner(viteIncludeGlob, plannerRegexSource) {
  const fromVite = extractBraceTokens(viteIncludeGlob);
  const fromPlanner = extractRegexTokens(plannerRegexSource);
  assert.deepEqual(
    [...fromVite.suffixes].sort(),
    [...fromPlanner.suffixes].sort(),
    'TEST_FILE_PATTERN suffixes divergem do test.include do Vitest'
  );
  assert.deepEqual(
    [...fromVite.extensions].sort(),
    [...fromPlanner.extensions].sort(),
    'TEST_FILE_PATTERN extensions divergem do test.include do Vitest'
  );
}
```

### 3.3 Correção do comentário do `web_gate`

Em `.github/workflows/web-ci.yml:107`, substituir:

```yaml
# O gate executa o verificador vindo do PR, portanto também deve ser efêmero.
```

por um texto correto, ex.:

```yaml
# O gate apenas agrega needs.*.result (sem checkout/npm). Mesmo assim roda em
# runner efêmero porque é acionado por PRs e nunca deve tocar runners persistentes.
```

Justificativa: o verificador (`verify-vitest-shards.js`) e os contract tests
executam dentro de `web_shards`; o `web_gate` não executa código do PR. A razão
para o runner efêmero é a **política de isolamento de PR** (já assertada por
`assertEphemeralPrRunner` em `scripts/web-ci-workflow-contract.test.js`), não a
execução de verificador.

---

## 4. Tasks (Breakdown)

| # | Task | Arquivo(s) | Estimativa | Dependências |
|---|------|-----------|------------|--------------|
| 1 | Adicionar helpers `extractBraceTokens` / `extractRegexTokens` / `assertIncludeMatchesPlanner` | `scripts/ci/verify-vitest-shards.test.js` (ou novo módulo `scripts/ci/vitest-include-contract.js` + testes) | 1h | — |
| 2 | Caso de teste: contract lê `web/vite.config.ts` e compara com `TEST_FILE_PATTERN` (passa hoje) | `scripts/ci/verify-vitest-shards.test.js` | 0.5h | 1 |
| 3 | Caso de teste: cobre os 4 sufixos `test/spec` × `ts/tsx` via fixture | `scripts/ci/verify-vitest-shards.test.js` (já existe `createFixtureWebRoot` com as 4 variantes — reaproveitar) | 0.5h | 1 |
| 4 | Caso de teste: ampliação simulada do `include` (ex.: +`js`) deve **falhar** o contrato | `scripts/ci/verify-vitest-shards.test.js` | 0.5h | 1 |
| 5 | Corrigir comentário obsoleto do `web_gate` | `.github/workflows/web-ci.yml:107` | 0.25h | — |
| 6 | Rodar `node --test scripts/ci/verify-vitest-shards.test.js` local e validar | — | 0.25h | 2,3,4 |
| 7 | Confirmar que o step "Verify Web CI contract" (`web_shards`) continua passando em CI | `.github/workflows/web-ci.yml:74-76` | 0.25h | 6 |

**Total estimado:** ~3.25h

---

## 5. Verificação

### 5.1 Casos de teste requeridos (Aceite da issue)

| ID | Descrição | Resultado esperado |
|----|-----------|--------------------|
| CT1 | Contrato carrega `web/vite.config.ts`, extrai `test.include` e compara os tokens com `TEST_FILE_PATTERN` exportado de `vitest-shard-plan.js` | Passa (padrões atuais coincidem) |
| CT2 | Fixture cobre `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` e o planner descobre todos (não-descobertos ficam fora dos shards) | Passa; 4 variantes presentes no plano |
| CT3 | Ampliação simulada: construir um glob `src/**/*.{test,spec}.{ts,tsx,js}` (ou planner regex sem `tsx`) e chamar `assertIncludeMatchesPlanner` | **Falha** com `AssertionError` citando divergência de extensions |
| CT4 | (Opcional, robustez) Reordenar chaves `{tsx,ts}` no glob simulado não deve causar falso-negativo | Passa (comparação por conjunto) |

> CT2 já é parcialmente coberto por `createFixtureWebRoot` em
> `scripts/ci/verify-vitest-shards.test.js:20-34` (cria exatamente essas 4
> variantes). Reaproveitar a fixture.

### 5.2 Execução

```bash
# local, sem dependências além do Node 22
node --test scripts/ci/verify-vitest-shards.test.js
# mesmo comando rodado em CI pelo step "Verify Web CI contract" (web_shards, shard 1)
```

### 5.3 Checklist de revisão

- [ ] Novos casos CT1–CT3 passam localmente com `node --test`.
- [ ] CT3 falha quando o contrato é propositalmente quebrado (validação manual).
- [ ] Nenhum novo arquivo de runtime em `web/` (tudo em `scripts/ci/` ou
      `.github/workflows/`).
- [ ] Comentário do `web_gate` corrigido e tecnicamente correto.
- [ ] `scripts/web-ci-workflow-contract.test.js` continua passando (não introduzir
      regex que quebre as extrações de job existentes).
- [ ] CI verde no PR que implementar esta spec.

---

## 6. Critérios de Aceite (espelham a issue #3554)

- [ ] **CA1:** Existe contrato que compara o `include` do Vite
      (`web/vite.config.ts`) com `TEST_FILE_PATTERN`
      (`scripts/ci/vitest-shard-plan.js`). *(Abordagem B, §3.2.)*
- [ ] **CA2:** O contrato cobre `test`/`spec` em `ts`/`tsx` (4 variantes).
- [ ] **CA3:** O contrato inclui uma ampliação simulada do `include` que **falha**
      (demonstrando que drift futuro seria detectado).
- [ ] **CA4:** Comentário obsoleto do `web_gate`
      (`.github/workflows/web-ci.yml:107`) corrigido — não sugere mais que o gate
      executa o verificador diretamente.
- [ ] **CA5:** Sem impacto na meta de desempenho (#3539) — não alterar
      particionamento nem runner dos shards.

### Evolução futura (P3, fora deste chore)

- **Opção A (fonte única):** extrair sufixos/extensões para
  `scripts/ci/vitest-test-pattern.json` e fazer tanto `web/vite.config.ts` (que já
  lê `versions.json` via `fs.readFileSync`) quanto `vitest-shard-plan.js` lerem
  dele. Tornaria o drift estruturalmente impossível em vez de detectável.
- Snapshot testing do plano completo em `web/src/test/` para travar a cardinalidade.

---

## 7. Referências

- Issue: **#3554** — `test(ci): prevent Vitest include drift in dynamic shard planner`
- PR de origem: **#3551** (commit `625438ed`) — `perf(ci): shard web tests behind stable gate`
- Meta de desempenho (separada): **#3539**
- Arquivos chave:
  - `web/vite.config.ts:121` — `include: ['src/**/*.{test,spec}.{ts,tsx}']`
  - `scripts/ci/vitest-shard-plan.js:6` — `const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:ts|tsx)$/;`
  - `scripts/ci/verify-vitest-shards.js` — verificador de cobertura por shard
  - `scripts/ci/verify-vitest-shards.test.js` — testes existentes do planner/verifier (alvo dos novos casos)
  - `scripts/web-ci-workflow-contract.test.js` — contrato do workflow (referência de padrão)
  - `.github/workflows/web-ci.yml:107` — comentário obsoleto do `web_gate`
- Decisões relacionadas: registrar em `specs/DECISIONS.md` após implementação.

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-12 | agente (issue #3554) | Criação inicial da spec |
