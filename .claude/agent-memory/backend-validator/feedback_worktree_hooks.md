---
name: feedback-worktree-hooks
description: Worktree pre-commit hooks require web/node_modules symlink and commitlint header ≤100 chars
type: feedback
---

Worktrees do NOT copy node_modules. The Husky pre-commit hook runs `cd web && npx tsc --noEmit`, which fails with "Cannot find module" errors when `web/node_modules` is absent.

Fix: `ln -s /path/to/main-repo/web/node_modules /path/to/worktree/web/node_modules`

**Why:** node_modules is gitignored; worktrees share .git but have isolated working trees. The symlink lets the worktree tsc use the main repo's installed packages.

**How to apply:** Always symlink before attempting a commit in any functions-only worktree where web/node_modules is missing.

Also: commitlint enforces `header-max-length: 100` and `subject-max-length: 100`. Keep the `fix(scope): description` line under 100 characters — multi-issue references like `#2797 #2798 #2799` eat chars fast.
