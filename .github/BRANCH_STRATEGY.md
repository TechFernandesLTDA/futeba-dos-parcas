# Estrategia de Branches - Futeba dos Parcas

## Visao Geral

```
master (producao)
  |
  +-- develop (integracao)
       |
       +-- feature/SPEC-XXX-descricao
       +-- fix/BUG-XXX-descricao
       +-- perf/PERF-XXX-descricao
       +-- docs/descricao
       +-- chore/descricao
```

## Branches Principais

| Branch | Proposito | Protecao |
|--------|-----------|----------|
| `master` | Codigo em producao, sempre estavel | Protegida, requer PR + review |
| `develop` | Integracao de features, pre-release | Protegida, requer PR |

## Branches de Trabalho

| Prefixo | Uso | Exemplo |
|---------|-----|---------|
| `feature/` | Nova funcionalidade (requer spec aprovada) | `feature/SPEC-015-notificacoes-push` |
| `fix/` | Correcao de bug | `fix/BUG-042-crash-ao-abrir-jogo` |
| `perf/` | Otimizacao de performance | `perf/PERF-003-cache-firestore` |
| `docs/` | Documentacao | `docs/atualizar-readme` |
| `chore/` | Configuracao, CI/CD, tooling | `chore/atualizar-dependencias` |
| `release/` | Preparacao de release | `release/1.9.0` |
| `hotfix/` | Correcao urgente em producao | `hotfix/crash-login` |

## Convencao de Nomes

### Branches

```
<tipo>/<referencia>-<descricao-curta>
```

- Usar kebab-case (palavras separadas por hifen)
- Referencia ao spec/bug quando aplicavel
- Descricao curta e objetiva (max 5 palavras)

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

| Tipo | Descricao |
|------|-----------|
| `feat` | Nova funcionalidade |
| `fix` | Correcao de bug |
| `perf` | Melhoria de performance |
| `refactor` | Refatoracao sem mudar comportamento |
| `docs` | Documentacao |
| `test` | Testes |
| `chore` | Build, CI, tooling |
| `style` | Formatacao, lint |

**Escopos comuns:** `game`, `auth`, `group`, `ui`, `firestore`, `functions`, `ci`, `deps`, `navigation`

## Fluxo de Trabalho

### Feature Nova

```
1. Criar spec em /specs/ e obter aprovacao
2. Criar branch: git checkout -b feature/SPEC-XXX-descricao develop
3. Implementar com commits atomicos
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

### Hotfix (urgente em producao)

```
1. Criar branch: git checkout -b hotfix/descricao master
2. Corrigir o problema
3. Abrir PR para master E develop
4. Merge (nao squash) para manter historico
```

### Release

```
1. Criar branch: git checkout -b release/X.Y.Z develop
2. Bump versao (scripts/bump-version.js)
3. Testes finais
4. Merge para master (nao squash)
5. Tag: git tag vX.Y.Z
6. Merge de volta para develop
```

## Estrategia de Merge

| Situacao | Estrategia | Motivo |
|----------|------------|--------|
| Feature -> develop | **Squash merge** | Historico limpo, 1 commit por feature |
| Fix -> develop | **Squash merge** | Historico limpo |
| Release -> master | **Merge commit** | Preservar historico de release |
| Hotfix -> master | **Merge commit** | Rastreabilidade |
| develop -> feature | **Rebase** | Manter branch atualizada |

## Protecao de Branches

### master

- Requer Pull Request para merge
- Requer pelo menos 1 review aprovado
- Requer CI (lint, detekt, tests, build) passando
- Nao permitir force push
- Nao permitir delete

### develop

- Requer Pull Request para merge
- Requer CI passando
- Nao permitir force push

## Regras Importantes

1. **NUNCA** fazer push direto para `master` ou `develop`
2. **SEMPRE** criar PR, mesmo para mudancas pequenas
3. **SEMPRE** referenciar spec/issue no PR
4. **SEMPRE** garantir que CI passa antes de solicitar review
5. **NUNCA** fazer merge com testes falhando
6. **SEMPRE** deletar branch apos merge
