---
name: futeba-rollback
description: Reverte deploy prod ou commit master quando algo quebra produção. Inclui Cloud Functions, Hosting, Firestore Rules, Web. Use quando o usuário pedir "reverter", "rollback", "voltar versão anterior", "produção quebrada".
---

# Futeba Rollback

Reverter mudanças que quebraram produção. Tempo é crítico — siga ordem.

## Tipos de rollback

| Componente | Estratégia |
|------------|-----------|
| Cloud Functions | Redeploy versão anterior via git revert + deploy |
| Hosting (web) | Console Firebase → Hosting → Versions → Rollback (1 click) |
| Firestore Rules | Console Firebase → Rules → History → Restore previous |
| Storage Rules | Idem Firestore |
| Master commit | `git revert <SHA>` + PR + merge + deploy |

## Hosting rollback (mais rápido — 30s)

```
1. Acesse: https://console.firebase.google.com/project/futebadosparcas/hosting/sites
2. Aba "Versions" → última versão estável
3. Click "..." → "Rollback to this version"
4. Confirme
```
Sem rebuild, sem CI. Útil quando deploy quebrou hospedagem.

## Cloud Functions rollback

```bash
# 1. Identificar último commit GOOD em master
git log --oneline functions/ -10

# 2. Revert PR(s) ruins
git revert <bad-commit-sha> --no-edit
# OU série de reverts em ordem reversa

# 3. PR + merge via futeba-pr-flow
git push -u origin Codex/rollback-functions
gh pr create --base master --title "revert: rollback functions broken deploy"
gh pr merge --admin --squash --delete-branch Codex/rollback-functions

# 4. Deploy
DEPLOY_DIR=/tmp/futeba-rollback-$$
git worktree add "$DEPLOY_DIR" origin/master
cd "$DEPLOY_DIR/functions" && npm ci && npm run build
cd "$DEPLOY_DIR" && firebase deploy --only functions --project futebadosparcas --force --non-interactive
git worktree remove --force "$DEPLOY_DIR"
```

## Firestore Rules rollback

### Via Console (mais rápido)
```
https://console.firebase.google.com/project/futebadosparcas/firestore/rules
→ "Rules tab" → versions list → click anterior → "Use this version"
```

### Via Git
```bash
git checkout <last-good-sha> -- firestore.rules
git commit -m "revert: rollback firestore rules"
firebase deploy --only firestore:rules --project futebadosparcas
```

## Master commit rollback

```bash
# Se o último merge quebrou tudo (master HEAD)
git revert HEAD --no-edit
git push -u origin Codex/revert-<sha-curto>
gh pr create --base master --title "revert: <descrição original>"
gh pr merge --admin --squash --delete-branch
```

## Validação pós-rollback

```bash
# Hosting
curl -sI https://futebadosparcas.web.app | head -1   # 200

# Functions
firebase functions:log --only <critical-fn> --project futebadosparcas | tail -5

# Master HEAD coerente
gh api repos/TechFernandesLTDA/futeba-dos-parcas/commits/master -q '.sha[0:7]'
```

## Comunicação

Após rollback, comunicar:
- Issue/PR original que causou o problema
- Que foi revertido (com link do revert PR)
- Qual root cause precisa de fix (cria issue follow-up)
- ETA do fix definitivo

## Anti-padrão

❌ NÃO fazer "fix em cima do fix" se não souber root cause — rollback primeiro, fix calmo depois  
❌ NÃO aplicar rollback parcial (só algumas funções) — atomic deploy/atomic rollback  
✅ Rollback é seguro: pode ser revertido (re-revert) se rollback foi erro
