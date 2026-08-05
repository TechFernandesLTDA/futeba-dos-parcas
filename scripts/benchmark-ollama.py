#!/usr/bin/env python3
"""Benchmark all Ollama models: reasoning, code, creative, speed, embedding."""

import json, time, subprocess, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

OLLAMA_URL = "http://localhost:11434"
OUTDIR = f"/tmp/ollama-bench-{int(time.time())}"

REASONING_PROMPT = (
    "Resolva em PT-BR: Se 5 pedreiros constroem 3 muros em 8 dias, "
    "quantos dias 8 pedreiros precisam para construir 7 muros? "
    "Responda APENAS com a resposta numérica e a unidade."
)
CODE_PROMPT = (
    "Write ONLY the code, no explanation. Python function that takes a list of "
    "integers and returns a new list where each element is the product of all "
    "elements in the original list except itself, in O(n) time without division."
)
CREATIVE_PROMPT = (
    "Escreva uma mini-crônica de futebol em PT-BR (máximo 80 palavras) sobre o "
    "último minuto de uma partida decisiva. APENAS o texto, sem título."
)
EMBED_INPUTS = [
    "O Flamengo venceu o Vasco por 3 a 1 em um jogo eletrizante no Maracana lotado com mais de 70 mil torcedores apaixonados que cantaram o hino nacional em coro unissimo.",
    "O gato preto pulou o muro alto e correu para o quintal.",
    "Machine learning is transforming how we build software systems today.",
    "A inteligencia artificial generativa esta mudando a forma como escrevemos codigo.",
    "The quick brown fox jumps over the lazy dog near the river bank.",
]


def run_curl(method: str, path: str, data: dict, timeout: int = 120) -> dict:
    """Call Ollama HTTP API and return parsed JSON."""
    import urllib.request, urllib.error

    url = f"{OLLAMA_URL}{path}"
    body = json.dumps(data).encode("utf-8")

    start = time.time()
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        elapsed = time.time() - start
        return {"ok": True, "elapsed_s": elapsed, "data": result}
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        body_text = ""
        try:
            body_text = e.read().decode("utf-8")
        except Exception:
            pass
        return {
            "ok": False,
            "elapsed_s": elapsed,
            "error": f"HTTP {e.code}: {body_text[:200]}",
        }
    except Exception as e:
        elapsed = time.time() - start
        return {"ok": False, "elapsed_s": elapsed, "error": str(e)[:200]}


def bench_generate(model: str, prompt: str, label: str) -> dict:
    """Benchmark a chat model with /api/generate (non-streaming)."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"num_predict": 256},
    }
    result = run_curl("POST", "/api/generate", payload, timeout=180)

    r = {
        "model": model,
        "test": label,
        "prompt": prompt[:80] + "...",
    }

    if not result["ok"]:
        r["error"] = result["error"]
        r["elapsed_s"] = round(result["elapsed_s"], 2)
        return r

    data = result["data"]
    r["elapsed_s"] = round(result["elapsed_s"], 2)
    r["response"] = data.get("response", "")[:300]
    r["eval_count"] = data.get("eval_count", 0)
    r["prompt_eval_count"] = data.get("prompt_eval_count", 0)
    r["eval_duration_ns"] = data.get("eval_duration", 0)
    r["prompt_eval_duration_ns"] = data.get("prompt_eval_duration", 0)
    r["load_duration_ns"] = data.get("load_duration", 0)
    r["total_duration_ns"] = data.get("total_duration", 0)

    if data.get("eval_duration", 0) > 0:
        r["eval_rate_tok_s"] = round(
            data["eval_count"] / (data["eval_duration"] / 1e9), 1
        )
    else:
        r["eval_rate_tok_s"] = 0

    if data.get("prompt_eval_duration", 0) > 0:
        r["prompt_eval_rate_tok_s"] = round(
            data.get("prompt_eval_count", 0) / (data["prompt_eval_duration"] / 1e9), 1
        )
    else:
        r["prompt_eval_rate_tok_s"] = 0

    return r


def bench_embed(model: str, inputs: list[str]) -> dict:
    """Benchmark an embedding model with /api/embed."""
    payload = {"model": model, "input": inputs}
    result = run_curl("POST", "/api/embed", payload, timeout=120)

    r = {"model": model, "test": "embed", "batch_size": len(inputs)}

    if not result["ok"]:
        r["error"] = result["error"]
        r["elapsed_s"] = round(result["elapsed_s"], 2)
        return r

    data = result["data"]
    r["elapsed_s"] = round(result["elapsed_s"], 2)
    embeddings = data.get("embeddings", [])
    if embeddings:
        r["dimensions"] = len(embeddings[0])
        r["embeddings_count"] = len(embeddings)
    else:
        r["dimensions"] = "N/A"
        r["embeddings_count"] = 0

    # Get model info for embedding length
    info = run_curl("POST", "/api/show", {"model": model, "verbose": False}, timeout=30)
    if info["ok"]:
        r["model_info_dim"] = (
            info.get("data", {})
            .get("model_info", {})
            .get(
                "general.architecture",
                info.get("data", {}).get("details", {}).get("parameter_size", "N/A"),
            )
        )

    return r


def get_models() -> list[dict]:
    """List all models and categorize."""
    result = subprocess.run(
        ["ollama", "list"], capture_output=True, text=True, timeout=15
    )
    lines = result.stdout.strip().split("\n")[1:]  # skip header
    models = []
    for line in lines:
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 4:
            name = parts[0]
            size = f"{parts[2]} {parts[3]}"
        else:
            continue

        is_embed = any(
            k in name.lower()
            for k in ["bge", "nomic-embed", "embed", "all-minilm"]
        )
        models.append({"name": name, "size": size, "is_embed": is_embed})
    return models


def score_reasoning(response: str) -> dict:
    """Quick heuristic score for reasoning answer."""
    import re

    resp_lower = response.lower()
    score = 0
    notes = []

    # Check for numerical answer pattern
    nums = re.findall(r"(\d+[.,]?\d*)\s*(dias|horas|minutos|segundos)", resp_lower)
    if nums:
        score += 2
    elif re.search(r"\d+[.,]?\d*", resp_lower):
        score += 1
        notes.append("found number but no unit")

    # Check if answer is close to expected (~11.67 dias, or ~12 dias, or ~11 dias e 16h)
    # 5 workers * 8 days = 40 worker-days per 3 walls → each wall = 13.33 worker-days
    # 7 walls * 13.33 worker-days = 93.33 worker-days / 8 workers = 11.67 days
    expected_patterns = [r"11[.,]?67", r"11[.,]7", r"\b12\b", r"\b11\b.*\b16\b"]
    if any(re.search(p, resp_lower) for p in expected_patterns):
        score += 4
        notes.append("correct or close answer")

    # Penalize for excessive text (should be concise)
    if len(response) > 200:
        score -= 1
        notes.append("too verbose")

    return {"score": max(0, score), "notes": notes}


def score_code(response: str) -> dict:
    """Quick heuristic score for code answer."""
    score = 0
    notes = []

    lines = response.strip().split("\n")
    code_lines = [l for l in lines if l.strip()]

    # Has def keyword
    if "def " in response:
        score += 2
    # Has function body
    if "return" in response:
        score += 1
    # Has a list comprehension or loop
    if "for " in response or "[" in response:
        score += 1
    # Seems like actual code (not markdown explanation)
    if response.count("def") <= 2 and len(code_lines) >= 3:
        score += 1
    # Avoids division (O(n) without division constraint)
    if "/" not in response or "# " in response:
        score += 1
    # Uses prefix/postfix product pattern
    if "prefix" in response.lower() or "suffix" in response.lower() or "left" in response.lower():
        score += 2
        notes.append("recognized prefix/suffix pattern")

    if len(response) < 50:
        score -= 1
        notes.append("too short")

    return {"score": max(0, score), "notes": notes}


def score_creative(response: str) -> dict:
    """Quick heuristic score for creative writing."""
    score = 0
    notes = []

    words = response.split()
    wc = len(words)

    # Word count check (target: 80 words)
    if 30 <= wc <= 120:
        score += 2
    elif wc > 0:
        score += 1
        notes.append(f"word count {wc}, target ~80")

    # Has PT-BR soccer vocabulary
    pt_soccer = [
        "gol", "bola", "juiz", "torcida", "estádio", "campeonato",
        "jogador", "time", "partida", "árbitro", "campo", "chute",
        "goleiro", "atacante", "defesa", "vitória", "derrota", "empate",
        "minuto", "final", "apito",
    ]
    pt_matches = sum(1 for w in pt_soccer if w in response.lower())
    if pt_matches >= 3:
        score += 3
    elif pt_matches >= 1:
        score += 1

    # No title line (starts with narrative)
    if not response.strip().startswith("#") and not response.strip().startswith("**"):
        score += 1

    # Narrative quality markers
    narrative = ["quando", "enquanto", "então", "finalmente", "de repente", "e foi"]
    if any(w in response.lower() for w in narrative):
        score += 1

    return {"score": max(0, score), "notes": notes}


def main():
    import os

    os.makedirs(OUTDIR, exist_ok=True)
    results = []

    models = get_models()
    print(f"Models found: {len(models)}")
    print()

    chat_models = [m for m in models if not m["is_embed"]]
    embed_models = [m for m in models if m["is_embed"]]

    # ─── Chat models ───
    print("=" * 70)
    print("CHAT MODELS (reasoning + code + creative)")
    print("=" * 70)

    for i, m in enumerate(chat_models):
        name = m["name"]
        size = m["size"]
        print(f"\n[{i+1}/{len(chat_models)}] {name} ({size})")

        for prompt, label in [
            (REASONING_PROMPT, "reasoning"),
            (CODE_PROMPT, "code"),
            (CREATIVE_PROMPT, "creative"),
        ]:
            sys.stdout.write(f"  {label:>10} ... ")
            sys.stdout.flush()
            r = bench_generate(name, prompt, label)
            results.append(r)

            if r.get("error"):
                print(f"FAIL: {r['error']}")
            else:
                rate = r.get("eval_rate_tok_s", 0)
                tokens = r.get("eval_count", 0)
                elapsed = r.get("elapsed_s", 0)
                print(f"{rate:>7.1f} tok/s  {tokens:>4d} tokens  {elapsed:>5.1f}s")

                # Quick quality scoring
                if label == "reasoning":
                    q = score_reasoning(r.get("response", ""))
                elif label == "code":
                    q = score_code(r.get("response", ""))
                else:
                    q = score_creative(r.get("response", ""))
                r["quality_score"] = q["score"]
                r["quality_notes"] = q["notes"]

    # ─── Embedding models ───
    if embed_models:
        print("\n" + "=" * 70)
        print("EMBEDDING MODELS")
        print("=" * 70)

        for i, m in enumerate(embed_models):
            name = m["name"]
            size = m["size"]
            print(f"\n[{i+1}/{len(embed_models)}] {name} ({size})")
            sys.stdout.write(f"  embed({len(EMBED_INPUTS)} texts) ... ")
            sys.stdout.flush()
            r = bench_embed(name, EMBED_INPUTS)
            results.append(r)

            if r.get("error"):
                print(f"FAIL: {r['error']}")
            else:
                dims = r.get("dimensions", "?")
                elapsed = r.get("elapsed_s", 0)
                emb_count = r.get("embeddings_count", 0)
                print(f"{elapsed:>5.1f}s  {dims} dims  {emb_count} vectors")

    # ─── Save raw results ───
    with open(os.path.join(OUTDIR, "results.json"), "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nRaw results: {OUTDIR}/results.json")

    # ─── SUMMARY TABLE ───
    print("\n" + "=" * 80)
    print("FINAL RANKING & RECOMMENDATIONS")
    print("=" * 80)

    # Aggregate per model
    agg = {}
    for r in results:
        m = r["model"]
        if m not in agg:
            agg[m] = {
                "tests": {},
                "avg_tok_s": 0,
                "max_tok_s": 0,
                "total_quality": 0,
                "quality_count": 0,
            }
        test = r.get("test", "?")
        agg[m]["tests"][test] = r
        if "eval_rate_tok_s" in r and r["eval_rate_tok_s"] > 0:
            rate = r["eval_rate_tok_s"]
            agg[m]["avg_tok_s"] += rate
            agg[m]["max_tok_s"] = max(agg[m]["max_tok_s"], rate)
        if "quality_score" in r:
            agg[m]["total_quality"] += r["quality_score"]
            agg[m]["quality_count"] += 1

    # Averages
    for m in agg:
        count = len([t for t in agg[m]["tests"].values() if "eval_rate_tok_s" in t])
        if count > 0:
            agg[m]["avg_tok_s"] = round(agg[m]["avg_tok_s"] / count, 1)

    # Speed ranking (chat only)
    print("\n⚡ SPEED (eval tok/s avg):")
    chat_agg = {m: a for m, a in agg.items() if "reasoning" in a["tests"]}
    for m, a in sorted(chat_agg.items(), key=lambda x: x[1]["avg_tok_s"], reverse=True):
        bar = "█" * min(int(a["avg_tok_s"] / 5), 15)
        qs = ""
        if a["quality_count"] > 0:
            q_avg = round(a["total_quality"] / a["quality_count"], 1)
            qs = f"  [Q:{q_avg}]"
        print(f"  {a['avg_tok_s']:>7.1f} tok/s  {bar:<15}  {m}{qs}")

    # Quality ranking
    print("\n🎯 QUALITY (heuristic score avg, max 8-10):")
    for m, a in sorted(
        chat_agg.items(),
        key=lambda x: (
            x[1]["total_quality"] / max(x[1]["quality_count"], 1)
        ),
        reverse=True,
    ):
        if a["quality_count"] == 0:
            continue
        q_avg = round(a["total_quality"] / a["quality_count"], 1)
        bar = "█" * min(int(q_avg), 15)
        print(f"  {q_avg:>4.1f} / 9   {bar:<15}  {m}  ({a['avg_tok_s']:.0f} tok/s)")

    # Embedding
    emb_agg = {m: a for m, a in agg.items() if "embed" in a["tests"]}
    if emb_agg:
        print("\n🔢 EMBEDDING:")
        for m, a in emb_agg.items():
            t = a["tests"]["embed"]
            elapsed = t.get("elapsed_s", "?")
            dims = t.get("dimensions", "?")
            print(f"  {elapsed:>5.1f}s batch/{len(EMBED_INPUTS)}  {dims} dims  {m}")

    # ─── CATEGORIZED RECOMMENDATIONS ───
    print("\n" + "=" * 80)
    print("SPECIALIZATION MATRIX")
    print("=" * 80)

    categories = {
        "🧠 Deep Reasoning": [],
        "💻 Code Generation": [],
        "🇧🇷 PT-BR Creative": [],
        "⚡ Fast Iteration": [],
        "🎯 Balanced": [],
    }

    for m, a in chat_agg.items():
        tests = a["tests"]
        name_lower = m.lower()
        q_avg = a["total_quality"] / max(a["quality_count"], 1)
        speed = a["avg_tok_s"]

        # Deep reasoning: deepseek-r1, phi4, lfm2 (thinking models)
        if any(k in name_lower for k in ["deepseek-r1", "phi4", "lfm2"]):
            categories["🧠 Deep Reasoning"].append(m)

        # Code: gpt-oss, qwen, granite (known strong coders)
        if any(k in name_lower for k in ["gpt-oss", "qwen", "granite"]):
            categories["💻 Code Generation"].append(m)

        # PT-BR: brunoconterato, gemma (PT-BR fine-tunes)
        if any(k in name_lower for k in ["bruno", "gemma"]):
            categories["🇧🇷 PT-BR Creative"].append(m)

        # Fast: > 50 tok/s
        if speed > 50:
            categories["⚡ Fast Iteration"].append(m)

        # Balanced: quality > 6 AND speed > 30 AND not in other specific cats
        if (
            q_avg > 5
            and speed > 30
            and not any(
                k in name_lower
                for k in ["deepseek-r1", "phi4", "lfm2", "bruno", "embed"]
            )
        ):
            if m not in categories["🎯 Balanced"]:
                categories["🎯 Balanced"].append(m)

    for cat, models in categories.items():
        if models:
            print(f"\n  {cat}:")
            for m in models:
                a = chat_agg[m]
                q = round(a["total_quality"] / max(a["quality_count"], 1), 1)
                tests = a["tests"]
                detail = ""
                for t in ["reasoning", "code", "creative"]:
                    if t in tests:
                        r = tests[t]
                        detail += f" {t[:4]}:{r.get('eval_rate_tok_s',0):.0f}tk/s"
                print(f"    {m}  (speed:{a['avg_tok_s']:.0f} Q:{q}){detail}")

    # Per-test breakdown
    print("\n" + "=" * 80)
    print("PER-TEST BREAKDOWN (top 5 per category)")
    print("=" * 80)

    for test_label in ["reasoning", "code", "creative"]:
        print(f"\n  📋 {test_label.upper()}:")
        test_results = [
            (m, a["tests"][test_label])
            for m, a in chat_agg.items()
            if test_label in a["tests"] and "eval_rate_tok_s" in a["tests"][test_label]
        ]
        test_results.sort(
            key=lambda x: x[1].get("quality_score", 0), reverse=True
        )
        for m, t in test_results[:5]:
            q = t.get("quality_score", "-")
            rate = t.get("eval_rate_tok_s", 0)
            resp = t.get("response", "")[:80].replace("\n", " ")
            print(f"    Q:{q}  {rate:>6.0f} tok/s  {m}")
            if t.get("quality_notes"):
                print(f"           notes: {', '.join(t['quality_notes'])}")
            if resp:
                print(f"           → {resp}...")

    print(f"\n✅ Done. Full data: {OUTDIR}/results.json")


if __name__ == "__main__":
    main()
