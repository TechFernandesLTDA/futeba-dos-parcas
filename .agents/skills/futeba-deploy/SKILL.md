---
name: futeba-deploy
description: Deploy guiado dos componentes Firebase do projeto Futeba — Cloud Functions, Hosting (web), Firestore rules+indexes, Storage rules, Remote Config. Use quando o usuário pedir "deploy", "publicar", "subir pra produção", ou após PRs que tocam functions/web/rules.
---

# Futeba Deploy

Deploy seguro com pré-checks, build em worktree isolada, validação pós-deploy.

## Quando deploys são necessários

| Mudança | Componentes a deploy |
|---------|----------------------|
| `functions/src/**` | functions |
| `web/src/**` | hosting (build web/dist primeiro) |
| `firestore.rules` | firestore:rules |
| `firestore.indexes.json` | firestore:indexes |
| `storage.rules` | storage |
| `remote_config.json` | remoteconfig |
| Outras (specs, docs) | nenhum deploy |

## Pré-checks obrigatórios

1. Confirmar firebase auth ativo: `firebase projects:list`
2. Confirmar gcloud auth: `gcloud auth list`
3. Branch limpo + sincronizado com origin/master
4. Verificar se há PRs pendentes não-mergeados que afetam mesmas pastas

## Deploy seguro (worktree isolado)

NUNCA deploy do worktree principal — pode ter mudanças locais não-commitadas.

```bash
# 1. Cria worktree limpo de origin/master
DEPLOY_DIR=/tmp/futeba-deploy-$$
git worktree add "$DEPLOY_DIR" origin/master

# 2. Build (se aplicável)
cd "$DEPLOY_DIR/functions" && npm ci && npm run build
cd "$DEPLOY_DIR/web" && npm ci --legacy-peer-deps && npm run build

# 3. Deploy seletivo (escolher target conforme mudança)
cd "$DEPLOY_DIR"
firebase deploy --only firestore:rules,firestore:indexes,storage,remoteconfig --project futebadosparcas --non-interactive
firebase deploy --only functions --project futebadosparcas --non-interactive --force
firebase deploy --only hosting --project futebadosparcas --non-interactive

# 4. Cleanup
git worktree remove --force "$DEPLOY_DIR"
```

## Bugs conhecidos

### Functions deploy falha com `lib/index.js does not exist`
Build config gera `lib/functions/src/index.js`. Verificar que `functions/lib/index.js` existe (PR #385 corrigiu permanentemente — `rootDir: "src"` em tsconfig).

### `Changing from HTTPS to background trigger is not allowed`
Função mudou tipo entre versões. Solução:
```bash
firebase functions:delete <function-name> --project futebadosparcas
firebase deploy --only functions --project futebadosparcas
```
⚠️ Causa downtime momentâneo.

### Web build com peer-dep errors
Sempre `npm ci --legacy-peer-deps` (pre-existente, conhecido).

## Pós-deploy

```bash
# Hosting alive?
curl -sI https://futebadosparcas.web.app | head -1   # Deve ser 200

# Functions listadas
firebase functions:list --project futebadosparcas | head -10

# Smoke test 1 endpoint crítico (ex: leaderboard)
firebase functions:log --only getLeaderboardCached --project futebadosparcas | tail -5
```

## Output

Reportar para usuário:
- O que foi deployed
- URLs/endpoints afetados
- Quaisquer falhas + ação tomada
- Próximos passos manuais (se houver)
