---
name: futeba-task-decompose
description: Decompõe feature/spec/task complexa em subtasks acionáveis com scoring de complexidade (1-5) e grafo de dependências. Inspirado em eyaltoledano/Codex-task-master, adaptado ao SDD do projeto (specs/ + TodoWrite). Use quando "decompor", "quebrar em subtasks", "expandir task", "task complexa", "muita coisa pra fazer", "por onde começar".
---

# Futeba Task Decompose

Decomposição sistemática de trabalho. **Workflow, não tool.** Não instala npm.

## Quando invocar

- Spec em `/specs/feat-*.md` aprovada — fase TASKS vazia ou rasa
- Task na lista TodoWrite com escopo grande/ambíguo (>1 dia, >5 arquivos)
- Bugfix que toca múltiplas camadas (rules + function + UI)
- User pede "por onde começar" / "decompõe X"

## Quando NÃO invocar

- Mudança trivial (<3 arquivos, sem ambiguidade) — TodoWrite direto
- Spec ainda em REQUIREMENTS/UX — decompor cedo demais = lixo
- Bug óbvio com fix conhecido — só faz

## Fluxo (5 passos)

### 1. Identificar fonte

| Fonte | Onde |
|-------|------|
| Spec | `specs/feat-<data>-*.md` ou `specs/bug-<data>-*.md` |
| Issue GH | `gh issue view <N> --json title,body,labels` |
| Conversa | Mensagem do user contendo escopo |

### 2. Extrair tarefas de alto nível

Ler fonte → listar items que **mudam estado** (criam arquivo, editam código, deployam, configuram). Ignorar fluff (entender, pensar, explorar).

Output esperado: 5-15 items numerados. Se passar de 20 → spec está vazando escopo, voltar pra REQUIREMENTS.

### 3. Scoring complexidade (1-5)

| Score | Sinais | Exemplo |
|-------|--------|---------|
| **1 Trivial** | 1 arquivo, <20 linhas, mecânico | bump version, fix typo |
| **2 Pequeno** | 1-2 arquivos, padrão conhecido no codebase | add string XML + uso |
| **3 Médio** | 3-5 arquivos, 1 camada (UI ou function ou rules) | nova tela com ViewModel + Koin |
| **4 Grande** | 5+ arquivos, 2 camadas, integração nova | feature web+Android paritária |
| **5 Complexo** | 3+ camadas, novo conceito, decisão de design | XP system change, KMP migration |

Tasks score **4 ou 5 DEVEM ser decompostas** antes de implementar. Score 1-3 vai direto pro TodoWrite.

### 4. Grafo de dependências (DAG)

Marcar pra cada subtask:
- `depends: [N, M]` — IDs de outras subtasks que precedem
- `parallel: true` — pode rodar com outras sem deps

Pattern típico no Futeba:

```
[1] Domain/model (shared/commonMain)     ← raiz
  ↓
[2a] Repo interface (commonMain)         ← bloqueia 3,4
  ↓
[3] Repo impl Android (app/data)         ║ paralelo
[4] Repo impl iOS (shared/iosMain)       ║ paralelo
  ↓
[5] ViewModel + UiState (app/ui)
  ↓
[6] Compose Screen (app/ui)
  ↓
[7] Navigation entry (AppNavGraph)
  ↓
[8] Web parity (web/src/pages)           ← geralmente paralelo a 5-7
[9] Firestore rules (firestore.rules)    ← paralelo se domain estável
[10] Cloud Function (functions/src)      ← paralelo se contract estável
```

### 5. Próximo task (next_task heuristic)

Recomendar **um** task pra começar:
1. Sem dependências pendentes
2. Maior bloqueio downstream (libera mais paralelismo)
3. Empate → menor complexidade (ganha momentum)

Comunicar: `Próximo: [N] <título> — complexity <X>, libera <M> outros`.

## Output template

Após decompor, escrever de volta na spec (seção TASKS) **ou** TodoWrite. Formato:

```markdown
## Tasks

### Task 1 — <título> (complexity: 2, paralelo)
- **Arquivos**: `path/foo.kt`, `path/bar.kt`
- **Saída**: <o que muda no codebase>
- **Depends**: []

### Task 2 — <título> (complexity: 3)
- **Arquivos**: `path/baz.kt`
- **Saída**: ...
- **Depends**: [1]

### Task 3 — <título> (complexity: 4) ⚠️ DECOMPOR
- **Subtasks**:
  - 3a. <subtitle> (complexity: 2)
  - 3b. <subtitle> (complexity: 3)
  - 3c. <subtitle> (complexity: 2)
```

## Integração com SDD

Decomposição alimenta a fase **TASKS** das specs (AGENTS.md Regra #2). NÃO substitui spec — complementa.

Se task aparecer durante implementação que não tem no spec → para, atualiza spec, reinvoca decompose se needed. **Drift de escopo é erro.**

## Integração com TodoWrite

Após decomposição:
1. Cada task vira `TodoWrite` entry com `content` = título
2. `activeForm` = gerúndio ("Implementando X")
3. Tasks score 4-5 NÃO vão direto — entram só as subtasks (após split)
4. Marcar `in_progress` ao começar, `completed` IMEDIATAMENTE ao terminar (não em lote)

## Integração com agent teams

Quando spec tem 3+ camadas independentes pós-decomposição:
- Crear agent team paralelo (ver `.Codex/rules/agent-teams.md`)
- 1 teammate por camada (UI / Functions / Rules / Web)
- Cada um pega só suas tasks da DAG

## Pitfalls

- ❌ Decompor antes de spec ter REQUIREMENTS clara → tasks descartáveis
- ❌ Score 5 sem decompor → contexto explode no meio da implementação
- ❌ Ignorar dependências → merge conflict / re-trabalho
- ❌ Tasks vagas ("melhorar performance") → defina arquivos+critério
- ❌ Decompor mudança trivial → overhead > benefício

## Comandos auxiliares

```bash
# Listar specs sem fase TASKS preenchida
grep -L "^## Tasks" specs/feat-*.md specs/bug-*.md

# Listar issues com label "complex" (>5 dias estimados)
gh issue list --label "complex" --state open

# Ver spec atual
cat specs/<arquivo>.md
```
