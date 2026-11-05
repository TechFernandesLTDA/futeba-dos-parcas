---
name: futeba-ollama
description: Usar Ollama local (Mac M-series, 2 modelos concorrentes) para semantic search, code review privado, embeddings PT-BR, parsing de logs. Use quando o usuário pedir "busca semântica", "indexar specs", "review local", "embeddings", "parsear log grande", ou para análise privacy-sensitive (não mandar dados pra cloud). Sempre verifica disponibilidade antes de chamar.
---

# Futeba Ollama

Integração com Ollama local pra workflows que beneficiam de privacy + custo zero.

## Modelos disponíveis (2026-05-05)

| Modelo | Tamanho | Uso ideal | Tier |
|--------|---------|-----------|------|
| `nomic-embed-text:latest` | 274 MB | Embeddings EN (semantic search) | embed |
| `bge-m3:latest` | 1.2 GB | Embeddings PT-BR + EN multilíngue | embed |
| `llama3.2:3b` | 2 GB | Classificação rápida, label gen, summarization curta | tiny |
| `qwen2.5-coder:7b` | 4.7 GB | Code review, refactor, geração de boilerplate | code |
| `deepseek-r1:7b` | 4.7 GB | Chain-of-thought reasoning, debug hipóteses | reason |
| `gemma4:e4b` | 9.6 GB | Chat geral médio, análise PT-BR fluente | medium |
| `gemma4:31b` | 19 GB | Análise complexa (rodar isolado) | heavy |
| `qwen3.6:35b` | 23 GB | Reasoning pesado (rodar isolado) | heavy |

**Routing por task:**
- Indexar/buscar specs+issues → `nomic-embed-text` ou `bge-m3` (PT-BR melhor)
- Classificar/labelar → `llama3.2:3b`
- Code review pre-PR → `qwen2.5-coder:7b`
- Hipóteses de bug / 2nd opinion → `deepseek-r1:7b`
- Resumo longo / análise contextual PT-BR → `gemma4:e4b`
- Audit profundo (privacy-sensitive) → `gemma4:31b` ou `qwen3.6:35b` (1 por vez)

## Configuração

`OLLAMA_MAX_LOADED_MODELS=2` + `OLLAMA_NUM_PARALLEL=2` permitem **2 modelos diferentes em RAM simultaneamente**, cada um com 2 requests paralelos.

Ideal: 1 embeddings (~200MB-1.2GB) + 1 generative (3-9GB). Total <12GB RAM.

NÃO carregar 2x modelos 14B+ ao mesmo tempo (esgota RAM).

## Disponibilidade — sempre checar antes

```bash
curl -sf http://localhost:11434/api/version > /dev/null && echo "ollama UP" || echo "ollama DOWN"
```

Se DOWN:
1. Tentar restart: `OLLAMA_MAX_LOADED_MODELS=2 OLLAMA_NUM_PARALLEL=2 nohup ollama serve > /tmp/ollama.log 2>&1 &`
2. Aguardar 3s
3. Re-checar
4. Se persistir DOWN: skip Ollama, fallback pra cloud (Sonnet/Opus) e avisar usuário.

## Patterns de uso

### 1. Semantic search (já implementado)

```bash
node scripts/semantic-index.js index            # build (1x ou após mudanças specs/issues)
node scripts/semantic-index.js query "X"        # top-5 results
node scripts/semantic-index.js stats            # info
```

Antes de criar issue/spec novo, **sempre rodar query** pra evitar duplicação.

### 2. Code review local (qwen2.5-coder:7b)

Pra PRs sensíveis (security, CPF, money) onde diff não deve sair do Mac:

```bash
git diff master...HEAD | curl -s http://localhost:11434/api/generate -d '{
  "model": "qwen2.5-coder:7b",
  "prompt": "Code review este diff. Foque em: security bugs, race conditions, error handling, type safety. Output em PT-BR, conciso, top 5 issues priorizados.",
  "stream": false
}' | jq -r '.response'
```

### 3. Reasoning local (deepseek-r1:7b)

Pra design decisions, debugging complexo:

```bash
echo "Problema: <descrever>. Análise <opções>. Qual escolher?" | curl -s http://localhost:11434/api/generate -d "$(jq -n --arg p "$(cat)" '{model:"deepseek-r1:7b", prompt:$p, stream:false}')" | jq -r '.response'
```

### 4. Concorrência (2 modelos)

Aproveitar `OLLAMA_MAX_LOADED_MODELS=2`:

```bash
# Job 1: embeddings em background
node scripts/semantic-index.js index &

# Job 2: code review concorrente (modelo diferente, RAM separada)
git diff | bash -c 'curl -s http://localhost:11434/api/generate -d "$(jq -n --arg p "$(cat)" "{model:\"qwen2.5-coder:7b\", prompt:\$p, stream:false}")" | jq -r ".response"'

wait
```

## Quando NÃO usar Ollama

- Decisões críticas de prod (manter Sonnet/Opus cloud, mais inteligentes)
- Tasks que exigem context window grande (>8K tokens) — modelos pequenos perdem qualidade
- Quando velocidade é crítica e modelos cloud são mais rápidos pra task pequena

## Quando USAR Ollama

- Privacy/LGPD: dados que não devem sair do device (CPF, audit logs internos)
- Batch processing de muitos itens (custo cloud somaria, local é grátis)
- Iteração rápida durante dev (latência local <1s)
- Embeddings (uso constante, custo cloud cumulativo)

## Métricas de saúde

```bash
ollama ps  # modelos carregados em RAM agora
curl -s http://localhost:11434/api/tags | jq '.models[] | {name, size: (.size / 1024 / 1024 / 1024 | round)}'
```

Se `ollama ps` mostra 2 modelos e RAM Mac < 4GB livre → unload o menos usado:
```bash
curl -s http://localhost:11434/api/generate -d '{"model":"<name>","keep_alive":0}' > /dev/null
```
