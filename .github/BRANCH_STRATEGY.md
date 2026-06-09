# Estratégia de Branches — Futeba dos Parças

## Visão Geral

```
master (produção)
  |
  +-- develop (integração)
       |
       +-- feature/SPEC-XXX-descricao
       +-- fix/BUG-XXX-descricao
       +-- perf/PERF-XXX-descricao
       +-- docs/descricao
       +-- chore/descricao
```

## Branches Principais

| Branch | Propósito | Proteção |
|--------|-----------|----------|
| `master` | Código em produção, sempre estável | Protegida, requer PR + review |
| `develop` | Integração de features, pré-release | Protegida, requer PR |

## Branches de Trabalho

| Prefixo | Uso | Exemplo |
|---------|-----|---------|
| `feature/` | Nova funcionalidade (requer spec aprovada) | `feature/SPEC-015-notificacoes-push` |
| `fix/` | Correção de bug | `fix/BUG-042-crash-ao-abrir-jogo` |
| `perf/` | Otimização de performance | `perf/PERF-003-cache-firestore` |
| `docs/` | Documentação | `docs/atualizar-readme` |
| `chore/` | Configuração, CI/CD, tooling | `chore/atualizar-dependencias` |
| `release/` | Preparação de release | `release/1.9.0` |
| `hotfix/` | Correção urgente em produção | `hotfix/crash-login` |

## Convenção de Nomes

### Branches

```
<tipo>/<referencia>-<descricao-curta>
```

- Usar kebab-case (palavras separadas por hífen)
- Referenciar spec/bug quando aplicável
- Descrição curta e objetiva (máx. 5 palavras)

### Commits

Formato: `tipo(escopo): mensagem em portugues`

```
feat(game): adicionar votacao de MVP
fix(auth): corrigir loop de login
perf(firestore): implementar cache LRU
refactor(ui): migrar para Compose
docs(specs): adicionar spec de notificacoes
test(game): adicionar testes do GameViewModel
chore(ci): configurar GitHub Actions
style(ui): ajustar espacamento do card
```

**Tipos permitidos:**

| Tipo | Descrição |
|------|-----------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `perf` | Melhoria de performance |
| `refactor` | Refatoração sem mudar comportamento |
| `docs` | Documentação |
| `test` | Testes |
| `chore` | Build, CI, tooling |
| `style` | Formatação, lint |

**Escopos comuns:** `game`, `auth`, `group`, `ui`, `firestore`, `functions`, `ci`, `deps`, `navigation`

## Fluxo de Trabalho

### Feature Nova

```
1. Criar spec em /specs/ e obter aprovação
2. Criar branch: git checkout -b feature/SPEC-XXX-descricao develop
3. Implementar com commits atômicos
4. Abrir PR para develop
5. Code review + CI passa
6. Squash merge para develop
```

### Bugfix

```
1. Criar branch: git checkout -b fix/BUG-XXX-descricao develop
2. Corrigir o bug
3. Abrir PR para develop
4. Code review + CI passa
5. Squash merge para develop
```

### Hotfix (urgente em produção)

```
1. Criar branch: git checkout -b hotfix/descricao master
2. Corrigir o problema
3. Abrir PR para master E develop
4. Merge (não squash) para manter histórico
```

### Release

```
1. Criar branch: git checkout -b release/X.Y.Z develop
2. Bump de versão (scripts/bump-version.js)
3. Testes finais
4. Merge para master (não squash)
5. Tag: git tag vX.Y.Z
6. Merge de volta para develop
```

## Estratégia de Merge

| Situação | Estratégia | Motivo |
|----------|------------|--------|
| Feature -> develop | **Squash merge** | Histórico limpo, 1 commit por feature |
| Fix -> develop | **Squash merge** | Histórico limpo |
| Release -> master | **Merge commit** | Preservar histórico de release |
| Hotfix -> master | **Merge commit** | Rastreabilidade |
| develop -> feature | **Rebase** | Manter branch atualizada |

## Proteção de Branches

### master

- Requer Pull Request para merge
- Requer pelo menos 1 review aprovado
- Requer CI (lint, detekt, tests, build) passando
- Não permitir force push
- Não permitir delete

### develop

- Requer Pull Request para merge
- Requer CI passando
- Não permitir force push

## Regras Importantes

1. **NUNCA** fazer push direto para `master` ou `develop`
2. **SEMPRE** criar PR, mesmo para mudanças pequenas
3. **SEMPRE** referenciar spec/issue no PR
4. **SEMPRE** garantir que CI passa antes de solicitar review
5. **NUNCA** fazer merge com testes falhando
6. **SEMPRE** deletar branch após merge
