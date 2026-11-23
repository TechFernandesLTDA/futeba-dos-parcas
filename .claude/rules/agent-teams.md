# Agent Teams - Padrões para Futeba dos Parças

Guia para uso de Agent Teams do Claude Code neste projeto. Modelos atuais: Opus 5.5 (`claude-opus-5-5`, alias `opus`), Sonnet 5.5 (`claude-sonnet-5-5`, alias `sonnet`) e Haiku 5.5 (`claude-haiku-5-5`, alias `haiku`).

## Quando Usar Agent Teams

**Use agent teams para:**
- Features cross-layer (Compose + Functions + Rules)
- Trabalho KMP multi-plataforma (commonMain + androidMain + iosMain)
- Auditorias de segurança (3 ângulos em paralelo)
- Code reviews paralelos (segurança + performance + testes)
- Debugging com hipóteses concorrentes
- Pesquisa exploratória (libs, patterns, alternativas)

**Prefira sessão única ou subagents para:**
- Edições no mesmo arquivo
- Tarefas sequenciais com dependências
- Bugfixes simples em 1-2 arquivos
- Tarefas que não beneficiam de paralelismo

## Padrões de Time por Cenário

### 1. Feature Cross-Layer (3 teammates)

```
Crie um agent team para a feature [NOME]:
- Teammate 1 (Compose/UI): Criar telas em ui/[feature]/
- Teammate 2 (Cloud Functions): Criar functions em functions/src/[feature]/
- Teammate 3 (Security): Atualizar firestore.rules e validação
Exija aprovação de plano antes de implementar.
```

**Regras de ownership:**
- UI: `app/src/main/java/com/futebadosparcas/ui/<feature>/`
- Functions: `functions/src/<feature>/`
- Rules: `firestore.rules` + `functions/src/validation/`
- Nenhum teammate edita arquivo de outro: dois agentes no mesmo arquivo geram conflito de merge e uma edição apaga a outra

### 2. KMP Multi-Plataforma (3 teammates)

```
Crie um agent team para adicionar [MODEL/REPO] ao KMP:
- Teammate 1 (Common): Interface em shared/src/commonMain/
- Teammate 2 (Android): Impl em shared/src/androidMain/
- Teammate 3 (iOS): Impl em shared/src/iosMain/
Teammate 1 termina a interface antes de os outros começarem, porque Android e iOS implementam essa interface.
```

**Dependência:** Common finaliza primeiro (use task dependencies).

### 3. Auditoria de Segurança (3 teammates)

```
Crie um agent team para auditoria de segurança pré-release:
- Teammate 1: Auditar firestore.rules (permissões, validação, escalonamento)
- Teammate 2: Auditar Cloud Functions (rate limiting, App Check, input validation)
- Teammate 3: Auditar cliente Android (secrets, network security, auth flows)
Que cada um desafie as descobertas dos outros.
```

### 4. Debugging com Hipóteses (3-5 teammates)

```
Crie um agent team para investigar [BUG]:
- Teammate 1: Investigar hipótese A (ex: race condition no ViewModel)
- Teammate 2: Investigar hipótese B (ex: query Firestore retornando stale data)
- Teammate 3: Investigar hipótese C (ex: listener não removido no onCleared)
Que cada um tente refutar as teorias dos outros.
```

### 5. Code Review Paralelo (3 teammates)

```
Crie um agent team para revisar PR #[N]:
- Teammate 1: Foco em segurança (injection, auth bypass, data exposure)
- Teammate 2: Foco em performance (recompositions, queries N+1, memory leaks)
- Teammate 3: Foco em cobertura de testes e edge cases
Cada um deve gerar relatório independente.
```

## Regras de Ouro

1. **Ownership de arquivos**: Cada teammate edita só os arquivos designados a ele, para não haver conflito de merge
2. **Delegate mode**: Use Shift+Tab para impedir o lead de implementar
3. **Plan approval**: Exija em toda feature que toca Firestore ou segurança, porque um erro nas regras expõe dados de usuários
4. **5-6 tasks por teammate**: Mantém throughput alto e permite rebalanceamento
5. **Sonnet para teammates**: Use Sonnet 5.5 (`sonnet`) nas tasks paralelas e Opus 5.5 (`opus`) no lead
6. **Cleanup**: Ao terminar, peça ao lead para fazer o cleanup do time, para não sobrarem teammates rodando

## Mapeamento de Arquivos por Domínio

| Domínio | Arquivos | Quem edita |
|---------|----------|------------|
| UI/Compose | `app/.../ui/**` | Teammate Compose |
| ViewModels | `app/.../ui/<feature>/*ViewModel.kt` | Teammate Compose |
| Domain/UseCases | `app/.../domain/usecase/` | Teammate Common |
| Repository (interface) | `shared/src/commonMain/` | Teammate Common |
| Repository (Android) | `shared/src/androidMain/` | Teammate Android |
| Repository (iOS) | `shared/src/iosMain/` | Teammate iOS |
| Cloud Functions | `functions/src/` | Teammate Functions |
| Security Rules | `firestore.rules` | Teammate Security |
| DI Modules | `app/.../di/` | Teammate Compose (ou lead) |
| Navigation | `app/.../navigation/` | Apenas lead (ponto de coordenação) |
| strings.xml | `app/src/main/res/values/` | Apenas lead (evitar merge conflicts) |

## Anti-Patterns

- **Dois teammates editando o mesmo ViewModel** - Causa merge conflicts
- **Time de 5+ para tarefa simples** - Overhead de coordenação > benefício
- **Sem plan approval em Firestore** - Risco de security rules inconsistentes
- **Lead implementando ao invés de delegando** - Use delegate mode
- **Teammates sem contexto suficiente** - Inclua detalhes específicos no spawn prompt: o teammate só sabe o que está nele
