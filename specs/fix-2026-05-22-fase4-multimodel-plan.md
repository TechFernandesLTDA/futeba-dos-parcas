# Fase 4 — Backlog HIGH+MED+LOW (~86 issues) com pool multi-modelo

**Status:** PLAN (não executar até CRIT wave + check-in geofencing terminarem)
**Owner:** Renan + pool Ollama/DeepSeek/Qwen/Sonnet orquestrado por Claude (Opus)

> Aplica o playbook `reference_model_routing_playbook` em escala — primeira wave deste projeto a explicitamente paralelizar modelos auxiliares como produção.

---

## Distribuição alvo (86 issues por domínio, pós-CRIT)

| Domínio | Estimado |
|---|---|
| web | ~28 |
| android | ~21 |
| cloud-functions | ~22 |
| firestore/rules | ~6 |
| shared/KMP | ~3 |
| ci | ~3 |
| security | ~3 |

(Conta exata recalculada após CRIT wave fechar — algumas issues vão fechar como side-effect ou descobrir overlap.)

---

## Pipeline em 4 estágios

### Estágio 1 — Triagem em massa (Qwen turbo, ~$0.50, 5min)

Single batch: mandar lista de 86 issues (number + title + 1-line body excerpt) pro Qwen `turbo` classificar em:
- `BUG_REAL` — ação clara, sem ambiguidade
- `FP_LIKELY` — soa exagerado, precisa Read confirmar
- `NEEDS_INFO` — body insuficiente
- `DUPLICATE_OF #N` — overlap detectado
- `OUT_OF_SCOPE` — feature request disfarçada de bug

Output em JSON. Custo ínfimo (turbo: ~$0.05/1M). **Por que Qwen, não DeepSeek-flash?** Qwen-turbo é ~6x mais barato e PT-BR-native (bodies estão em PT-BR).

Eu (Claude) faço pass de validação no resultado — pra cada `FP_LIKELY`, abro o issue e Read código.

### Estágio 2 — Geração de diff por cluster (DeepSeek pro + Qwen coder em paralelo)

Agrupar issues sobreviventes em ~12-15 clusters por arquivo/módulo (ex: "web hooks queries sem limit", "android ViewModels DI direto", "functions cold start").

Para cada cluster, **rodar DS pro E Qwen coder na mesma pergunta** (Promise.allSettled):
- DS pro: "Aqui está o código + issues X/Y/Z. Proponha um diff unificado."
- Qwen coder: mesma pergunta.

Cross-validation conforme `reference_qwen_v3_usage`:
- **Ambos concordam** → alto sinal, vai pro Estágio 3 direto.
- **Discordam** → registro os dois; advisor decide; ou mando pra Sonnet investigar.
- **Ambos batem mas grep contradiz** → ambos enviesados; eu reescrevo o cluster.

Custo estimado: ~$3-8 total (DS pro ~$2.7/1M, Qwen coder similar).

### Estágio 3 — Aplicação + teste loop (Claude Sonnet, paralelo, ~6 agents)

Sonnet subagent por domínio (web, android, functions, shared, ci, security). Cada agent recebe:
- Spec do cluster
- Diff proposto do Estágio 2 (com qualquer ressalva do disagreement)
- Worktree isolada
- Mandato: aplicar diff → rodar testes → ajustar se quebrar → abrir PR

**Por que Sonnet aqui e não Qwen/DS?** Aplicação requer tools (Read/Edit/Bash/grep), loop iterativo com test runs, e julgamento sobre falhas inesperadas. DS/Qwen são generators, Sonnet é executor.

### Estágio 4 — Privacy/sensitive subset (Ollama local)

Subset de issues que envolvem código proprietário sensível (auth flows, security middleware, keys/secrets) — não mandar pra DS/Qwen externos. Rodar Ollama local (`qwen2.5-coder` 14B) ou Claude direto.

Identificar via label `security` + grep secrets na diff. Estimado: 3-5 issues.

---

## Rotação de modelos por tipo de trabalho

| Tipo de issue | Modelo primário | 2º parecer |
|---|---|---|
| **Web hooks bugs (~10)** typing/race/deps | DS pro | Qwen coder |
| **i18n / strings hardcoded (#1544, #1549, copy PT-BR)** | **Qwen max** (PT-BR nativo) | Sonnet revisa |
| **Android theme tokens (~6)** Color.* hardcoded | Sonnet (mecânico) | — |
| **Functions performance (cold start, types any)** | DS pro-think | QwQ |
| **Refactor estrutural (DI cleanup #1558)** | DS pro | Qwen coder |
| **Firestore rules (#1605, #1609, #1613)** | DS pro-max (audit) | advisor obrigatório |
| **A11y (#1543 152 contentDescription, #1565 focus-visible)** | Sonnet | — |
| **CI hardening (#1602 actions sem pin, #1627 SHA-256)** | DS pro | Sonnet aplica |

---

## Calibração / FP awareness

Memória `feedback_audit_pipeline_calibration` registra ~50% FP em waves de auditoria. Pra Fase 4:

1. Estágio 1 (Qwen turbo classify) **NÃO** decide FP final — só sugere. Eu confirmo via Read.
2. Estágio 2 (DS+Qwen diff) cross-validation reduz FP a ~25-30% (estimado).
3. Estágio 3 (Sonnet) tem mandato pra `gh issue close --reason "not planned"` se Read provar FP — sem implementar.

Meta de qualidade: pelo menos 70% das issues atacadas viram PR mergeado (vs 50% se Sonnet sozinho).

---

## Custo total estimado

- Estágio 1: ~$0.50 (Qwen turbo)
- Estágio 2: ~$5-10 (DS pro + Qwen coder × ~15 clusters)
- Estágio 3: ~$$ Sonnet (mesmo de qualquer wave Sonnet)
- Estágio 4: $0 (Ollama local)

Total externo: ~$10. Vs Sonnet-only seria $0 externo mas ~3x mais tempo Sonnet (mais ciclos) — economia líquida em wall-clock E em $ (Sonnet > DS/Qwen por token).

---

## Riscos

1. **Wrapper /tmp/ds.js ou /tmp/qwen.js sumindo entre sessões** — recriar de memory (já documentado).
2. **DS/Qwen vendo código incompleto** — sempre passar arquivo inteiro ou contexto suficiente; não fragmentos.
3. **Custo escalando** — monitorar via `usage` no wrapper; pausar se passar $20.
4. **Cross-validation virando "comitê do meio" (decisão pior que cada um)** — quando empata, advisor decide ou eu mesmo investigo. Não tomar média.

---

## Pré-requisitos pra começar
- [ ] CRIT wave (Fase 2) ≥80% merged
- [ ] Check-in geofencing (Fase 3) ≥ Fase 3.2 merged
- [ ] `ollama list` UP, `node /tmp/qwen.js turbo "ping"` OK, `node /tmp/ds.js flash "ping"` OK
- [ ] Backlog HIGH+MED+LOW recontado via `gh issue list --label "priority:high,priority:medium,priority:low" --state open`
