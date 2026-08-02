# Ollama Local Models — Benchmark Estratégico

> Referência estratégica para roteamento de tarefas locais (skill `futeba-ollama`).
> Hardware medido: **Apple M5 Pro, 24GB unified memory, 15 cores (5P+10E)**.
> Ollama **0.32.5**. Data: 2026-08-01.
> Prompt: validação de CPF em TypeScript (PT-BR, real ao projeto — `functions/src/validation/cpf.ts`).
> Métrica principal: **tok/s de geração (cold load, keep_alive=0, temperature=0)**.

---

## Tabela de performance (11 modelos de chat)

Ordenado por velocidade de geração (melhor → pior):

| # | Modelo | Disco | Load (cold) | **Gen tok/s** | Tokens | Arquitetura | Veredito M5 Pro 24GB |
|---|--------|------:|------:|------:|------:|-------------|----------------------|
| 1 | `lfm2:24b` | 14 GB | 7.4s | **119.2** | 201 | MoE 24B/**2B ativos** | 🏆 On-device ideal |
| 2 | `gemma4:e4b` | 9.6 GB | 8.7s | **64.0** | 600 | E4B (eficiente) | Ótimo rápido |
| 3 | `gpt-oss:20b` | 13 GB | 10.6s | **61.4** | 496 | MoE 20B/~3B ativos | Forte reasoning |
| 4 | `granite4.1:8b` | 5.3 GB | 4.0s | **43.7** | 275 | Denso 8B | Leve/estável |
| 5 | `ornith:9b` | 5.6 GB | 3.0s | **43.7** | 366 | Denso 9B | Coding ágil |
| 6 | `gemma4:12b-mlx` | 7.7 GB | 2.2s | **42.1** | 600 | 12B MLX | MLX otimizado |
| 7 | `brunoconterato/Gemma-3-Gaia-PT-BR-4b-it:f16` | 7.8 GB | 3.8s | **32.5** | 337 | 4B PT-BR f16 | PT-BR nativo |
| 8 | `phi4:14b` | 9.1 GB | 4.3s | **27.5** | 267 | Denso 14B | Reasoning lento |
| 9 | `qwen3:14b` | 9.3 GB | 3.7s | **26.7** | 600 | Denso 14B | Pensador |
| 10 | `deepseek-r1:14b` | 9.0 GB | ✗ | ✗ | ✗ | MoE 14B | Reasoning MoE (adicionado 2026-08-01 swap) |
| 11 | `mistral-nemo:12b` | 7.1 GB | ✗ | ✗ | ✗ | Denso 12B | Eficiente/fast (adicionado 2026-08-01 swap) |

**Embeddings (não-chat):** `bge-m3:latest` (1.2GB), `nomic-embed-text-v2-moe:latest` (957MB).

---

## Achado estratégico CRÍTICO — a "parede dos 18GB"

Modelos **densos** acima de ~14GB de memória alocada são **impraticáveis** na máquina de 24GB. Após o swap de 2026-08-01, **todos os modelos do catálogo estão ≤ 14 GB e são viáveis no M5 Pro**.

- ~~`qwen3.6:27b` (18GB) → 1.3 tok/s~~ **Removido 2026-08-01**. Substituído por `deepseek-r1:14b` (MoE 14B, 9.0 GB).
- ~~`laguna-xs-2.1` (20GB) → 7.3 tok/s~~ **Removido 2026-08-01**. Substituído por `mistral-nemo:12b` (Denso 12B, 7.1 GB).

**Conclusão de roteamento:**
1. **Preferir sempre MoE / modelos eficientes ≤ ~14GB.** O `lfm2:24b` é o caso excepcional — 24B de peso mas só **2B ativos** → 119 tok/s (na faixa de modelo pequeno).
2. **Para reasoning profundo local:** `deepseek-r1:14b` (MoE) ou `gpt-oss:20b`.
3. **Para qualidade máxima (Qwen 3.6 / DeepSeek Pro):** usar o provider cloud (`alibaba-coding-plan` / `deepseek` no opencode.jsonc).

---

## Matriz de roteamento recomendada (qual tarefa → qual modelo)

| Tarefa | Modelo local recomendado | Motivo |
|--------|--------------------------|--------|
| **Code review privado / logs (interativo)** | `lfm2:24b` | 119 tok/s, tools, on-device, privacidade total |
| **Coding agentic rápido (iteração)** | `ornith:9b` ou `granite4.1:8b` | 43.7 tok/s, leve, baixa latência de load |
| **Reasoning profundo privado** | `deepseek-r1:14b` ou `gpt-oss:20b` | MoE, forte em tarefas complexas |
| **Embeddings PT-BR (semantic search)** | `bge-m3:latest` ou `nomic-embed-text-v2-moe` | Multilingue, purpose-built |
| **Resposta em PT-BR coloquial** | `brunoconterato/Gemma-3-Gaia-PT-BR-4b-it` | Fine-tune PT-BR nativo |
| **Coding geral rápido** | `mistral-nemo:12b` | 7.1 GB, eficiente, boa relação qualidade/velocidade |
| **Qualidade máxima (Qwen 3.6 / DeepSeek)** | ⚠️ **Cloud** (`alibaba-coding-plan` / `deepseek` no opencode.jsonc) | 27B+ denso local é inviável |

---

## Top 3 por categoria

- **Velocidade pura:** `lfm2:24b` (119.2) » `gemma4:e4b` (64.0) » `gpt-oss:20b` (61.4)
- **Melhor custo/benefício (leve+rápido):** `granite4.1:8b`, `ornith:9b`, `gemma4:12b-mlx`
- **Evitar nesta máquina (interativo):** ~~`qwen3.6:27b`~~ (removido), ~~`laguna-xs-2.1`~~ (removido). Catálogo 100% viável após swap 2026-08-01.

---

## Notas metodológicas

- Cold load forçado com `keep_alive: 0` (descarrega após cada chamada) — métrica pessimista, realista para uso esporádico.
- `temperature: 0`, `num_predict: 600` (reduzido para 40 nos modelos 10/11 para evitar timeout).
- Os modelos 10 (`qwen3.6:27b`) e 11 (`laguna-xs-2.1`) foram medidos em chamada separada após o run principal exceder tempo razoável no 27B.
- Prompt foi código verificável (CPF) — todos os modelos <14GB completaram em <23s total.

## Estado do catálogo (após manutenção 2026-08-01)

- **Atualizados:** todos os 12 modelos pré-existentes (`ollama pull`).
- **Removidos (desatualizados):** `qwen2.5:14b`, `qwen2.5-coder:14b`, `llama3.2:3b` (sucedidos por qwen3/3.6, ornith, lfm2).
- **Removidos (impraticáveis no M5 Pro):** `qwen3.6:27b` (1.3 tok/s), `laguna-xs-2.1` (20 GB, lento). Substituídos por `deepseek-r1:14b` (MoE, 9.0 GB) e `mistral-nemo:12b` (7.1 GB).
- **Adicionados:** `lfm2:24b`, `ornith:9b`, `deepseek-r1:14b`, `mistral-nemo:12b`.
- **Total atual:** 13 modelos (11 chat + 2 embeddings). **100% ≤ 14 GB — todos viáveis.**
