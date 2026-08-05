#!/bin/zsh
# Benchmark all Ollama models: reasoning, code, creative, speed
# Outputs: structured JSON per model + final ranking table

set -eo pipefail
OUTDIR="/tmp/ollama-bench-$$"
mkdir -p "$OUTDIR"
RESULTS="$OUTDIR/results.jsonl"

echo "🧪 Ollama Benchmark — $(date)"
echo "   $(ollama list | tail -n +2 | wc -l | tr -d ' ') modelos"
echo ""

# ─── Prompts (brief, deterministic-in-spirit) ───
REASONING_PROMPT='Resolva em PT-BR: Se 5 pedreiros constroem 3 muros em 8 dias, quantos dias 8 pedreiros precisam para construir 7 muros? Responda APENAS com a resposta numérica e a unidade.'
CODE_PROMPT='Write ONLY the code, no explanation. Python function that takes a list of integers and returns a new list where each element is the product of all elements in the original list except itself, in O(n) time without division.'
CREATIVE_PROMPT='Escreva uma mini-crônica de futebol em PT-BR (máximo 80 palavras) sobre o último minuto de uma partida decisiva. APENAS o texto, sem título.'

embedding_text="O Flamengo venceu o Vasco por 3 a 1 em um jogo eletrizante no Maracanã lotado com mais de 70 mil torcedores apaixonados que cantaram o hino nacional em coro uníssono."

bench_chat() {
  local model="$1" prompt="$2" label="$3"
  local outfile="$OUTDIR/${model//\//_}-${label}.txt"
  local start_ms=$(python3 -c 'import time; print(int(time.time()*1000))')

  ollama run "$model" "$prompt" > "$outfile" 2>"$outfile.stderr" || true
  local end_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
  local elapsed_s=$(python3 -c "print(($end_ms - $start_ms) / 1000)")

  # Parse eval stats from stderr
  local eval_rate="N/A" total_dur="N/A" load_dur="N/A" prompt_eval="N/A" prompt_tokens="N/A" eval_count="N/A"
  if [ -f "$outfile.stderr" ]; then
    eval_rate=$(grep -oP 'eval rate:\s*\K[\d.]+(?=\s*tokens/s)' "$outfile.stderr" 2>/dev/null || echo "N/A")
    total_dur=$(grep -oP 'total duration:\s*\K[\d.]+(?=s)' "$outfile.stderr" 2>/dev/null || echo "N/A")
    load_dur=$(grep -oP 'load duration:\s*\K[\d.]+(?=ms)' "$outfile.stderr" 2>/dev/null || echo "N/A")
    prompt_eval=$(grep -oP 'prompt eval rate:\s*\K[\d.]+(?=\s*tokens/s)' "$outfile.stderr" 2>/dev/null || echo "N/A")
    prompt_tokens=$(grep -oP 'prompt eval count:\s*\K\d+' "$outfile.stderr" 2>/dev/null || echo "N/A")
    eval_count=$(grep -oP 'eval count:\s*\K\d+' "$outfile.stderr" 2>/dev/null || echo "N/A")
  fi

  printf '{"model":"%s","test":"%s","elapsed_s":%.2f,"eval_rate_tok_s":"%s","prompt_eval_rate_tok_s":"%s","total_dur_s":"%s","load_dur_ms":"%s","eval_count":"%s","prompt_eval_count":"%s"}\n' \
    "$model" "$label" "$elapsed_s" "$eval_rate" "$prompt_eval" "$total_dur" "$load_dur" "$eval_count" "$prompt_tokens" >> "$RESULTS"

  echo "   $label → ${elapsed_s}s, ${eval_rate} tok/s, ${eval_count} tokens"
}

bench_embed() {
  local model="$1"
  local start_ms=$(python3 -c 'import time; print(int(time.time()*1000))')

  curl -s http://localhost:11434/api/embed -d "$(python3 -c "
import json
print(json.dumps({'model': '$model', 'input': ['$embedding_text', 'O gato preto pulou o muro alto e correu para o quintal.', 'Machine learning is transforming how we build software systems today.']}))
")" > /dev/null 2>&1
  local end_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
  local elapsed_s=$(python3 -c "print(($end_ms - $start_ms) / 1000)")

  # Get dimensions from ollama show
  local dims=$(ollama show "$model" 2>/dev/null | grep -oP 'embedding length\s+\K\d+' || echo "N/A")

  printf '{"model":"%s","test":"embed_batch3","elapsed_s":%.2f,"dimensions":"%s"}\n' \
    "$model" "$elapsed_s" "$dims" >> "$RESULTS"

  echo "   embed(3) → ${elapsed_s}s, ${dims} dims"
}

# ─── Chat models ───
echo "📊 Chat models (reasoning + code + creative):"
echo ""

for model_line in $(ollama list | tail -n +2); do
  model=$(echo "$model_line" | awk '{print $1}')
  # Skip embedding models
  case "$model" in
    bge-m3*|nomic-embed-text*) continue ;;
  esac

  echo "▶  $model ($(echo "$model_line" | awk '{print $3, $4}'))"
  bench_chat "$model" "$REASONING_PROMPT" "reasoning"
  bench_chat "$model" "$CODE_PROMPT" "code"
  bench_chat "$model" "$CREATIVE_PROMPT" "creative"
  echo ""
done

# ─── Embedding models ───
echo "🔢 Embedding models:"
echo ""

for model_line in $(ollama list | tail -n +2); do
  model=$(echo "$model_line" | awk '{print $1}')
  case "$model" in
    bge-m3*|nomic-embed-text*) ;;
    *) continue ;;
  esac

  echo "▶  $model ($(echo "$model_line" | awk '{print $3, $4}'))"
  bench_embed "$model"
  echo ""
done

# ─── Final summary table ───
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "                           FINAL RESULTS TABLE"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

python3 << 'PYEOF'
import json, os

results_dir = os.environ.get('OUTDIR', '/tmp/ollama-bench')
results_file = os.path.join(results_dir, 'results.jsonl')
models = {}
with open(results_file) as f:
    for line in f:
        r = json.loads(line.strip())
        m = r['model']
        if m not in models:
            models[m] = {}
        models[m][r['test']] = r

# Ranking categories
chat_models = {m: d for m, d in models.items() if 'reasoning' in d}

# Calculate avg tok/s for each chat model
speeds = {}
for m, tests in chat_models.items():
    rates = []
    for t in ['reasoning', 'code', 'creative']:
        if t in tests:
            v = tests[t].get('eval_rate_tok_s', 'N/A')
            if v != 'N/A':
                rates.append(float(v))
    speeds[m] = sum(rates)/len(rates) if rates else 0

# Speed ranking
print("⚡ SPEED RANKING (avg eval tok/s):")
for m, s in sorted(speeds.items(), key=lambda x: x[1], reverse=True):
    print(f"  {s:>8.1f} tok/s  {m}")

print()

# Model sizes
print("📦 MODEL SIZES:")
for m in chat_models:
    rc = models[m].get('reasoning', {})
    ec = rc.get('eval_count', '?')
    print(f"  {ec:>6} tokens gen  {m}")

print()

# Embedding
emb_models = {m: d for m, d in models.items() if 'embed_batch3' in d}
if emb_models:
    print("🔢 EMBEDDING MODELS:")
    for m, d in emb_models.items():
        print(f"  {d['embed_batch3']['elapsed_s']:>6.2f}s batch3  {m}  ({d['embed_batch3'].get('dimensions','?')} dims)")

print()
print("💡 RECOMMENDATIONS:")
print()

# Classify by role
fastest = sorted(speeds.items(), key=lambda x: x[1], reverse=True)
if fastest:
    print(f"  🏎️  Fastest iteration: {fastest[0][0]} ({fastest[0][1]:.0f} tok/s)")

# Reasoning candidates (slower models with deeper thinking - deepseek-r1, phi4, qwen3)
reasoning_models = [m for m in chat_models if any(k in m.lower() for k in ['deepseek-r1', 'phi4', 'qwen3:14b', 'lfm2'])]
if reasoning_models:
    print(f"  🧠  Reasoning/deep-thinking: {', '.join(reasoning_models)}")

# Code candidates
code_models = [m for m in chat_models if any(k in m.lower() for k in ['gpt-oss', 'qwen3', 'granite', 'gemma4'])]
if code_models:
    print(f"  💻  Code generation: {', '.join(code_models)}")

# Creative/PT-BR candidates
pt_models = [m for m in chat_models if any(k in m.lower() for k in ['gemma', 'bruno', 'ornith'])]
if pt_models:
    print(f"  🇧🇷  Creative/PT-BR: {', '.join(pt_models)}")

# Embedding
if emb_models:
    emb_names = list(emb_models.keys())
    print(f"  🔢  Embedding/RAG: {', '.join(emb_names)}")

PYEOF

# Cleanup option
echo ""
echo "Raw results saved to: $OUTDIR/results.jsonl"
echo "Per-model outputs at: $OUTDIR/"
