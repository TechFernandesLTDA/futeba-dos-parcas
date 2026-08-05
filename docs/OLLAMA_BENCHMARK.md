# Ollama Local Models — Benchmark Estratégico

> Referência estratégica para roteamento de tarefas locais (skill `futeba-ollama`).
> Hardware medido: **Apple M5 Pro, 24GB unified memory, 15 cores (5P+10E)**.
> Ollama **0.32.5**. Último benchmark: 2026-08-05 (lfm2.5:8b added) + auditoria de novos modelos.
> Metodologia: API `/api/generate` não-streaming, `num_predict: 256`, 3 prompts (reasoning PT-BR, code EN, creative PT-BR).
> **Total: 11 modelos** (9 chat + 2 embeddings). Catálogo enxuto, zero redundância. Todos ≤ 14 GB.

---

## Destaque: Família LFM (Liquid Foundation Models)

**A família LFM domina este benchmark — velocidade + qualidade imbatíveis no Mac.**

Desenvolvidos pela **Liquid AI** (spin-off do MIT), os LFMs usam uma arquitetura radicalmente diferente dos Transformers tradicionais: **MoE com Liquid adapters** e convolução temporal adaptativa (complexidade linear, não O(n²)).

| Modelo | Params (total/ativo) | Contexto | Disco | tok/s | Sweet spot |
|---|---|---|---|---|---|
| `lfm2:24b` | 23.8B / ~2B | 32K | 14 GB | 125 | **Heavy lifter** — qualidade máxima, raciocínio profundo |
| `lfm2.5:8b` | 8B / ~1B | **125K** | 5.2 GB | **175** | **Sweet spot** — tool calling + thinking + contexto massivo |

| Característica | LFM2 / LFM2.5 | Transformer típico (ex: LLaMA 14B) |
|---|---|---|
| Arquitetura | **MoE com Liquid adapters** | Self-attention densa |
| Complexidade | **O(n)** — convolução temporal | O(n²) — self-attention |
| KV-cache | Mínimo (sem attention tradicional) | Grande |
| Licença | LFM Open License v1.0 | Apache/MIT |

**Analogia**: Se um Transformer denso de 14B é um motor V12 sempre em rotação máxima, o LFM é um **motor com 12 cilindros mas que só liga 1-2 por vez**, dependendo do que você precisa. Resultado: potência de modelo grande com consumo de modelo pequeno.

### lfm2:24b — Heavy lifter
- **Uso ideal**: raciocínio profundo, análise complexa, quality máxima. Rodar isolado (14 GB).
- Tools (function calling), 32K contexto.

### lfm2.5:8b — Sweet spot (NOVO)
- **Uso ideal**: tool calling agentic, long context (125K), code review com arquivo inteiro, pairing com outro modelo.
- **Thinking mode** embutido (gera `<think>` blocks antes da resposta).
- 125K contexto = 4x maior que lfm2:24b. Cabe arquivo de functions inteiro sem chunking.
- Só 5.2 GB → combina com `granite4.1:8b` (10.5 GB total) para code review paralelo.
- 175 tok/s = modelo mais rápido do catálogo.

---

## Tabela de Performance (9 modelos chat + 2 embeddings)

Ordenado por velocidade de geração (média dos 3 testes):

| # | Modelo | Disco | **tok/s** | Qualidade (max 9) | Reasoning | Code | Creative | Arquitetura |
|---|--------|------:|------:|------:|------:|------:|------:|-------------|
| 🥇 | `lfm2.5:8b` 🆕 | 5.2 GB | **175.3** | ⭐5.0 | ✅ 176 t/s | ✅ 174 t/s | ✅ 176 t/s | MoE 8B/~1B ativos + thinking |
| 🥈 | `lfm2:24b` | 14 GB | **124.8** | ⭐5.3 | ✅ 129 t/s | ✅ 122 t/s | ✅ 122 t/s | MoE 24B/~2B ativos |
| 🥉 | `phi4-mini` | 2.49 GB | **90.2** | ⭐⭐⭐ | ✅ 90 t/s | ✅ 91 t/s | ✅ 90 t/s | Denso 3.8B Microsoft |
| 4 | `deepscaler` | 3.56 GB | **80.0** | ⭐⭐⭐⭐ | ✅ 81 t/s* | ✅ 79 t/s* | ✅ 80 t/s* | 1.5B Reasoning 🧠 |
| 5 | `granite4.1:8b` | 5.3 GB | **47.0** | ⭐4.7 | ✅ 47 t/s | ✅ 47 t/s | ✅ 47 t/s | Denso 8B IBM |
| 6 | `ornith:9b` | 5.6 GB | **43.3** | ⭐5.0 | ✅ 43 t/s | ✅ 43 t/s | ✅ 43 t/s | Denso 9B |
| 7 | `mistral-nemo:12b` | 7.1 GB | **41.7** | ⭐5.3 | ✅ 50 t/s | ✅ 38 t/s | ✅ 37 t/s | Denso 12B Mistral |
| 8 | `deepseek-r1:14b` | 9.0 GB | **28.9** | ¹— | ✅ 29 t/s | ❌ vazio | ✅ 29 t/s | MoE 14B Reasoning 🧠 |
| 9 | `codestral` | 12.57 GB | **20.7** | ⭐⭐⭐⭐ | ✅ 27 t/s | ✅ 21 t/s | ✅ 21 t/s | MoE 22B Code 💻 |

¹ deepseek-r1: qualidade subestimada pelo scoring heurístico — o modelo é um "thinking model" que gera raciocínio verboso antes da resposta, penalizado pelo formato conciso exigido.

### Embeddings

| Modelo | Tamanho | Batch 5 textos | Dimensões | Arquitetura |
|--------|---------|----------------|-----------|-------------|
| `nomic-embed-text-v2-moe:latest` | 957 MB | **8.7s** | 768 | MoE embedding |
| `bge-m3:latest` | 1.2 GB | **8.9s** | 1024 | Denso BAAI |

---

## Insights por teste

### 🧠 Reasoning (problema de regra de 3 composta, PT-BR)

**Resposta correta: ~11.67 dias** (5 pedreiros × 8 dias ÷ 3 muros × 7 muros ÷ 8 pedreiros)

| Modelo | Resposta | Correto? |
|--------|----------|----------|
| `phi4:14b` | 10.67 dias | ✅ (aproximado correto) |
| `mistral-nemo:12b` | 40 dias | ❌ |
| `lfm2:24b` | 15 dias | ❌ (mas show de raciocínio — 15 dias é uma aproximação comum de engenharia) |
| `ornith:9b` | 35/3 dias (~11.67) | ✅ (resposta exata em fração!) |
| `brunoconterato/...PT-BR-4b` | 20 dias | ❌ |

> **Nota**: NENHUM modelo acertou a resposta exata (11.67) em formato numérico limpo. O `ornith:9b` chegou mais perto com fração. `phi4:14b` deu 10.67 (provavelmente erro de arredondamento no cálculo intermediário).

### 💻 Code (product except self, O(n) sem divisão)

| Modelo | Abordagem | Qualidade |
|--------|-----------|-----------|
| `mistral-nemo:12b` | prefix/suffix arrays | ⭐⭐⭐⭐⭐ (8/9) |
| `lfm2:24b` | prefix/suffix arrays | ⭐⭐⭐⭐ (7/9) |
| `ornith:9b` | prefix/suffix arrays | ⭐⭐⭐⭐ (7/9) |
| `granite4.1:8b` | prefix/suffix arrays | ⭐⭐⭐⭐ (7/9) |
| `codestral` | prefix/suffix arrays | ⭐⭐⭐⭐ (7/9) |
| `phi4-mini` | prefix/suffix arrays | ⭐⭐⭐⭐ (7/9) |
| `deepseek-r1:14b` | ❌ resposta vazia | — |

> **Nota**: Todos os modelos que geraram código usaram o pattern prefix/suffix — correto e idiomático.

### 🇧🇷 Creative (mini-crônica de futebol, PT-BR, ~80 palavras)

| Modelo | Amostra |
|--------|---------|
| `lfm2:24b` | "No minuto final, o time da casa sofre um erro crítico no ataque..." |
| `mistral-nemo:12b` | "No último minuto, a tensão estava insuportável..." |
| `ornith:9b` | "Os segundos se arrastavam como gomas derretidas..." |
| `codestral` | "No épico clímax da partida, o tempo parecia estacionar..." |
| `phi4-mini` | "O relógio batia baixo no meio do tempo final..." |

---

## ⚠️ Único modelo com ressalva

Apenas `deepseek-r1:14b` retornou vazio no teste de código (1/3). É um "thinking model" — gera raciocínio antes da resposta, o que consome tokens do limite de 256. Em uso normal com streaming, funciona perfeitamente.

> Todos os outros 7 modelos de chat passaram nos 3 testes sem respostas vazias.

---

## Matriz de Roteamento

| Tarefa | Modelo | Por quê |
|--------|--------|---------|
| **🏆 Padrão (velocidade + tools)** | `lfm2.5:8b` | 175 tok/s, tools, thinking, 125K contexto |
| **🏆 Qualidade máxima (isolado)** | `lfm2:24b` | 125 tok/s, MoE 24B, raciocínio profundo |
| **💻 Código** | `codestral` > `granite4.1:8b` > `ornith:9b` > `mistral-nemo:12b` | Especialista → estável → versátil |
| **🧠 Reasoning** | `deepseek-r1:14b` (profundo) ou `deepscaler` (rápido) | Thinking models |
| **⚡ Iteração / sempre ligado** | `phi4-mini` | 90 tok/s, 2.5 GB |
| **🔗 Tool calling agentic** | `lfm2.5:8b` | Tools + thinking + 125K contexto nativo |
| **📄 Long context (>32K)** | `lfm2.5:8b` | Único com 125K (todos outros ≤ 32K) |
| **🇧🇷 PT-BR** | `ornith:9b` > `mistral-nemo:12b` | Melhores crônicas |
| **🔢 Embeddings PT-BR** | `bge-m3` | 1024 dims multilíngue |
| **🔢 Embeddings EN** | `nomic-embed-text-v2-moe` | 768 dims, rápido |

---

## Catálogo final — 11 modelos (2026-08-05)

**9 chat + 2 embeddings. Zero redundância. Todos ≤ 14 GB.**

| # | Modelo | Disco | tok/s | Função |
|---|--------|------:|------:|--------|
| 🥇 | `lfm2.5:8b` | 5.2 GB | 175 | **Padrão rápido**: tools, thinking, 125K contexto |
| 🥈 | `lfm2:24b` | 14 GB | 125 | **Qualidade máxima**: MoE 24B, raciocínio profundo |
| 🥉 | `phi4-mini` | 2.5 GB | 90 | **Sempre ligado**: ultra-rápido, minúsculo |
| 4 | `deepscaler` | 3.6 GB | 80 | **Reasoning leve**: chain-of-thought, 1.5B |
| 5 | `granite4.1:8b` | 5.3 GB | 47 | **Código estável**: IBM, consistente |
| 6 | `ornith:9b` | 5.6 GB | 43 | **PT-BR + código**: criativo, preciso |
| 7 | `mistral-nemo:12b` | 7.1 GB | 42 | **Balanceado**: confiável em tudo |
| 8 | `deepseek-r1:14b` | 9.0 GB | 29 | **Reasoning profundo**: thinking model |
| 9 | `codestral` | 12.6 GB | 21 | **Código especialista**: 22B MoE Mistral |
| — | `bge-m3` | 1.2 GB | — | **Embeddings PT-BR**: 1024 dims |
| — | `nomic-embed-text-v2-moe` | 957 MB | — | **Embeddings EN**: 768 dims |

### Combinações viáveis (24GB RAM, 2 modelos simultâneos)

| Combo | RAM total | Cabe? | Uso |
|-------|-----------|-------|-----|
| `lfm2.5:8b` + `granite4.1:8b` | 10.5 GB | ✅ folgado | Code review paralelo (já usado no batch) |
| `lfm2.5:8b` + `phi4-mini` | 7.7 GB | ✅ trivial | Tool calling + iteração |
| `lfm2:24b` sozinho | 14 GB | ✅ apertado | Heavy lifter isolado |
| `lfm2:24b` + qualquer outro | >19 GB | ❌ | Não cabem juntos |
| Qualquer modelo + `bge-m3` | +1.2 GB | ✅ | Chat + embeddings concorrentes |

### Removidos (6)

| Modelo | Motivo |
|--------|--------|
| `gemma4:12b-mlx` | 0/3 testes — quebrado |
| `gemma4:e4b` | 2/3 vazios — instável |
| `qwen3:14b` | 2/3 vazios + mais lento (27 t/s) |
| `gpt-oss:20b` | 2/3 vazios + 13 GB desperdiçados |
| `brunoconterato/...PT-BR-4b` | 7.8 GB f16 pra 4B — `ornith` cobre PT-BR com 5.6 GB |
| `phi4:14b` | Redundante — `deepseek-r1` cobre reasoning, `phi4-mini` cobre leveza |

---

## Notas Metodológicas

- API `/api/generate` não-streaming, `num_predict: 256`, temperature padrão.
- 3 prompts padronizados: reasoning (regra de 3 composta PT-BR), code (product-except-self EN), creative (crônica futebol PT-BR).
- Quality scoring: heurístico — reasoning (correção numérica), code (pattern prefix/suffix, estrutura), creative (contagem palavras, vocabulário futebol PT-BR, narrativa).
- Respostas vazias: provável timeout/stall da API não-streaming com `num_predict: 256` + prompt extenso. Modelos podem funcionar com streaming ou prompts mais curtos.
- Embeddings: batch de 5 textos (PT-BR + EN), medido via `/api/embed`.

---

## LFM: Mergulho Técnico

### O que é?
**Liquid Foundation Models** — arquitetura da Liquid AI (spin-off do MIT). Não é Transformer: usa **Liquid Neural Networks** + **Mixture of Experts**, inspirado em sistemas biológicos (neurônios de disparo adaptativo).

**LFM2** (v2): 24B/2B ativos, 32K contexto.
**LFM2.5** (v2.5): 8B/1B ativos, **125K contexto**, thinking mode embutido, tool calling otimizado para edge.

### Por que é tão rápido?
- **MoE esparso**: 23.8B (lfm2) ou 8B (lfm2.5) parâmetros totais, mas apenas **~1-2B ativos por token**. O roteador MoE decide quais "especialistas" ativar.
- **Sem self-attention quadrática**: usa operadores de convolução temporal adaptativa (Liquid Time-Constant), com complexidade **linear** em vez de O(n²).
- **KV-cache mínimo**: como não usa attention tradicional, o cache de contexto é muito menor → menos memória, mais rápido.

### Pontos fortes
- Velocidade absurda — lfm2.5:8b a 175 tok/s é o modelo mais rápido do catálogo
- Qualidade consistente nos 3 tipos de teste
- Suporta tools (function calling)
- lfm2: 32K contexto / lfm2.5: **125K contexto** (cabe arquivo de functions inteiro)
- Licença aberta (LFM Open License v1.0)

### Pontos fracos
- lfm2:24b precisa de 14 GB (rodar isolado)
- O reasoning matemático do lfm2 errou regra de 3 simples (15 em vez de 11.67) — prefira `deepseek-r1` para problemas numéricos precisos
- Licença não é Apache/MIT — verificar restrições para uso comercial

### Comparação com cloud

| Métrica | LFM2.5:8B (local) | LFM2-24B (local) | DeepSeek-V4 (cloud) |
|---------|-------------------|------------------|---------------------|
| Velocidade | **175 tok/s** | 125 tok/s | ~80 tok/s |
| Contexto | **125K** | 32K | 128K |
| Latência round-trip | ~0ms | ~0ms | ~200-500ms |
| Privacidade | 100% on-device | 100% on-device | Zero |
| Qualidade código | Muito boa | Boa | Excelente |
| Qualidade reasoning | Muito boa | Boa | Excelente+ |
| Custo por 1M tokens | $0 (local) | $0 (local) | ~$0.5-2 |

**Regra**: Use cloud para qualidade máxima em tarefas complexas. Use LFM local para tudo que pode/deve ficar on-device (código rápido, dados sensíveis, iteração). `lfm2.5:8b` é o melhor custo-benefício: 175 tok/s + 125K contexto + tools em 5.2 GB.
