# GitHub Repository Audit Report

**Data**: 2026-02-18
**Repo**: `TechFernandesLTDA/futeba-dos-parcas`
**Executado por**: github-project-manager (agent team)

---

## 1. Dependabot

### PRs Abertos
**0 PRs abertos** - Sem PRs pendentes do Dependabot.

### Alertas de Segurança
Requer permissão `security_events` para listar via API. Verificar em:
`Settings > Security > Dependabot alerts`

**Nota**: Nenhum PR Dependabot pendente é positivo - significa que todas as atualizações de dependências foram processadas recentemente.

---

## 2. Code Scanning (CodeQL)

### Resumo de Alertas Abertos: **28 alertas**

| Regra | Severidade | Quantidade | Ação Recomendada |
|-------|------------|------------|------------------|
| Use of implicit PendingIntents | **error** | 10 | **Alta prioridade** - Usar `FLAG_IMMUTABLE` ou `FLAG_MUTABLE` |
| Missing rate limiting | warning | 15 | Parcialmente resolvido (rate-limiter middleware existe) - verificar cobertura |
| Insecure local authentication | warning | 2 | Revisar fluxo de autenticação local |
| Incomplete multi-character sanitization | warning | 1 | Revisar sanitização de inputs |

### Alertas Resolvidos Recentemente
- 2 alertas de "Incomplete multi-character sanitization" marcados como `fixed`

### Prioridades de Correção

**P0 - Urgente (10 alertas: `Use of implicit PendingIntents`)**
- Todos os `PendingIntent.getActivity/getBroadcast/getService` precisam de `FLAG_IMMUTABLE` ou `FLAG_MUTABLE`
- Afeta: Notificações FCM, AlarmManager, deep links
- Referência: [Android PendingIntent Security](https://developer.android.com/reference/android/app/PendingIntent)

**P1 - Rate Limiting (15 alertas: `Missing rate limiting`)**
- O middleware `rate-limiter.ts` foi adicionado no PR #134
- Verificar se todas as Cloud Functions usam `secureCallableWrapper`
- Alguns endpoints podem não estar protegidos ainda

**P2 - Autenticação Local (2 alertas)**
- Revisar uso de `SharedPreferences` vs `EncryptedSharedPreferences`
- Verificar se dados sensíveis estão protegidos em armazenamento local

---

## 3. Labels Criados

### Labels da Migração CMP (novos)

| Label | Cor | Descrição |
|-------|-----|-----------|
| `cmp-migration` | #0075ca | Migração Compose Multiplatform |
| `phase-0-infra` | #e4e669 | Fase 0: Infraestrutura CMP |
| `phase-1-koin` | #d93f0b | Fase 1: Hilt → Koin |
| `phase-2-firebase` | #006b75 | Fase 2: Firebase GitLive SDK |
| `phase-3-models` | #1d76db | Fase 3: Models + Abstrações de Plataforma |
| `phase-4-theme` | #e99695 | Fase 4: Tema, Strings e Imagens |
| `phase-5-viewmodels` | #5319e7 | Fase 5: ViewModels → composeApp |
| `phase-6-screens` | #0e8a16 | Fase 6: Telas e Componentes |
| `phase-7-pwa` | #fbca04 | Fase 7: PWA Web |
| `phase-8-ios` | #b60205 | Fase 8: iOS Completo e Cleanup |

### Labels de Suporte (novos)

| Label | Cor | Descrição |
|-------|-----|-----------|
| `security` | #ee0701 | Security vulnerability or concern |
| `performance` | #c2e0c6 | Performance improvement |
| `android` | #3ddc84 | Android-specific |
| `ios` | #555555 | iOS-specific |
| `web` | #0075ca | Web/PWA-specific |
| `cloud-functions` | #f9d0c4 | Firebase Cloud Functions |

### Labels Pré-existentes (10)
`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`, `epic`

**Total de labels**: 26 (10 existentes + 16 novos)

---

## 4. Milestones Criados (10)

| # | Milestone | Prazo | Issues |
|---|-----------|-------|--------|
| 1 | Fase 0: Infraestrutura CMP 1.10.0 | 2026-03-04 | #150 |
| 2 | Fase 1: Migração DI Koin | 2026-03-18 | #151 |
| 3 | Fase 2: Firebase GitLive SDK | 2026-04-01 | #152 |
| 4 | Fase 3: Models + Abstrações | 2026-04-15 | #153 |
| 5 | Fase 4: Tema, Strings e Imagens | 2026-05-01 | #154 |
| 6 | Fase 5: ViewModels → composeApp | 2026-05-15 | #155 |
| 7 | Fase 6: Telas e Componentes | 2026-06-01 | #156 |
| 8 | Fase 7: PWA Web | 2026-06-15 | #157 |
| 9 | Fase 8: iOS Completo + Cleanup | 2026-07-01 | #158 |
| 10 | v2.0: CMP Multiplataforma | 2026-07-15 | Epic #149 |

Todos os issues de migração (#149-#158) foram tagueados com labels e milestones correspondentes.

---

## 5. GitHub Projects

### Status
O token OAuth atual (`gho_`) não possui escopo `project` necessário para criar GitHub Projects v2.

### Alternativa: Usar Milestones + Labels
A organização por **Milestones** (criados acima) e **Labels** de fase oferece rastreamento equivalente para este projeto:
- Filtre por label `cmp-migration` para ver toda a migração
- Filtre por `phase-N-*` para ver cada fase
- Milestones mostram progresso percentual automaticamente no GitHub

### Criar GitHub Project Manualmente (se desejado)
1. Acessar: https://github.com/orgs/TechFernandesLTDA/projects/new
2. Título: "Migração CMP - Android + iOS + Web"
3. Adicionar issues #149-#158 ao projeto
4. Configurar colunas: Backlog → In Progress → Review → Done

---

## 6. Branch Protection (master)

**Status**: Master branch **NÃO está protegida** via GitHub API.

Entretanto, o projeto usa **pre-push hooks** locais que bloqueiam push direto para master. Este é um controle local, não server-side.

### Recomendação: Ativar Branch Protection no GitHub
```
Settings > Branches > Add rule > Branch name: master
```
Configurações recomendadas:
- [x] Require pull request before merging (1 approval)
- [x] Require status checks to pass (android-ci, functions-ci)
- [x] Require branches to be up to date
- [x] Include administrators
- [ ] Allow force pushes (manter desabilitado)

---

## 7. Secrets Configurados

| Secret | Última Atualização |
|--------|-------------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | 2026-01-05 |

### Secrets Necessários para CI/CD Completo
Verificar se estão configurados (não visíveis via API):
- `FIREBASE_TOKEN` - Para deploy de Cloud Functions
- `GOOGLE_SERVICES_JSON` - Para CI builds
- `KEYSTORE_*` - Para build de release (Play Store)
- `FIREBASE_APP_DISTRIBUTION_*` - Para beta deploys

---

## 8. Issues em Aberto

### Issues de Migração CMP (9 issues, recém-criados)
- #149: Epic - Migração CMP (com label `epic` + `cmp-migration`)
- #150-#158: Issues por fase (cada um com label de fase + milestone)

### Oportunidades Identificadas

#### Correções de Segurança Prioritárias
1. **PendingIntents implícitos** (10 alertas CodeQL `error`): Adicionar `FLAG_IMMUTABLE` em todos `PendingIntent.*`
2. **Rate limiting incompleto** (15 alertas): Auditar Cloud Functions que não usam `secureCallableWrapper`

#### Melhorias de Processo
1. **Branch Protection**: Ativar regras server-side (ver seção 6)
2. **GitHub Environments**: Configurar `production` e `beta` environments com approval gates
3. **Dependabot config**: Verificar se `.github/dependabot.yml` cobre todas as dependências (npm + gradle + actions)
4. **GitHub Packages**: Considerar publicar `:shared` como biblioteca KMP no GitHub Packages

#### Melhorias de CI/CD
1. **Merge queue**: Ativar para evitar conflicts em PRs paralelos (Dependabot)
2. **Auto-merge Dependabot**: Configurar auto-merge para patches após CI verde
3. **Stale bot**: Adicionar workflow para fechar issues/PRs stale automaticamente

---

## Resumo Executivo

| Item | Status |
|------|--------|
| GitHub Projects | Requer escopo OAuth adicional - usar Milestones como alternativa |
| Labels criados | **16 novos** (10 CMP + 6 suporte) |
| Milestones criados | **10** (Fases 0-8 + v2.0) |
| Issues tagueados | **9 issues** (#149-#158) com labels e milestones |
| Dependabot PRs abertos | **0** |
| CodeQL alertas abertos | **28** (10 error, 18 warning) |
| Branch protection | **Ausente** - recomendada configuracao server-side |
| Secrets | 1 configurado (`CLAUDE_CODE_OAUTH_TOKEN`) |
