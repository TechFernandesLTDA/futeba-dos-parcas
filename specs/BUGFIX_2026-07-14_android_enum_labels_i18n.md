# BUGFIX: Labels canônicos da UI Android fora de recursos localizados

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issues:** #3617, #3618, #3620, #3624

---

## 1. Requisitos

### Comportamento atual

Categorias de comparação, opções do avatar, ações de gestão de membros e níveis
de sequência armazenam textos visíveis em português diretamente no Kotlin. Os
mesmos valores aparecem independentemente do locale e ajustes de texto exigem
alteração de código.

### Comportamento esperado

- Todo texto visível dessas quatro frentes deve ser resolvido por
  `stringResource` no limite Compose.
- Os recursos novos devem existir em `values`, `values-en` e `values-es`.
- Identidades dos enums (`name`), thresholds, callbacks, ícones, cores e demais
  valores usados por lógica/persistência não devem mudar.
- O menu genérico `UserCardMenuItem` continua aceitando texto dinâmico; apenas a
  fábrica Compose `GroupMemberCard` resolve seus textos localizados.

### Invariante

Locale altera somente a apresentação. Nenhuma chave canônica, payload ou regra
de autorização muda com a tradução.

## 2. UX/UI

- PT-BR preserva a redação existente.
- Inglês e espanhol recebem traduções explícitas, sem fallback para português.
- Labels curtos de estatística permanecem compactos para chips.
- Textos usados por TalkBack e componentes reutilizáveis usam o mesmo recurso
  apresentado visualmente.
- Não há mudança de layout, interação, animação, estados ou touch targets.

## 3. Design técnico

1. Trocar propriedades `String` dos enums por IDs `@StringRes`.
2. Resolver os IDs apenas dentro dos Composables com `stringResource`.
3. Abranger labels visíveis dos enums de avatar no mesmo arquivo, inclusive
   expressão, badge e moldura, evitando um contrato parcialmente localizável.
4. Migrar também os requisitos de desbloqueio armazenados junto a badge e
   moldura, embora ainda não sejam renderizados, para impedir que futuros usos
   reintroduzam texto PT-BR direto; `NONE` usa requisito nulo.
5. Localizar também os contadores textuais do componente de streak e os textos
   `VS` da comparação, pois pertencem às mesmas superfícies auditadas.
6. Adicionar teste JVM que garante mapeamento enum→recurso, ausência dos campos
   antigos `String`, presença e paridade semântica das novas chaves nos três
   arquivos de locale.

## 4. Arquivos previstos

| Arquivo | Alteração |
|---|---|
| `SocialComparison.kt` | IDs de display/short label e resolução Compose |
| `AvatarCustomizer.kt` | IDs de labels de opções e resolução Compose |
| `UserCard.kt` | recursos do menu de gestão de membro |
| `StreakFlame.kt` | IDs dos níveis e textos associados |
| `values*/strings.xml` | recursos PT-BR, inglês e espanhol |
| `AndroidEnumLabelResourcesTest.kt` | contrato de mapeamento e locale |
| `specs/DECISIONS.md` | decisão arquitetural |

## 5. Tarefas

- [x] Criar recursos com paridade PT/EN/ES.
- [x] Migrar enums e pontos de renderização.
- [x] Adicionar testes focados.
- [x] Executar testes relevantes.
- [x] Executar `:app:compileDebugKotlin`, `detekt` e `git diff --check`.

## 6. Verificação e release

- Compilação Kotlin Android.
- Teste focado do contrato de recursos.
- Detekt e diff-check.
- Revisão por busca dos literais reportados.
- Mudança visível será incluída na próxima release Android consolidada; este
  branch não altera versão, release notes, tag nem realiza deploy isoladamente.

### Resultado

- `:app:compileDebugKotlin`: aprovado.
- `AndroidEnumLabelResourcesTest`: 3 testes, 0 falhas.
- `detekt`: aprovado; apenas findings preexistentes fora do escopo.
- XML PT-BR/EN/ES e `git diff --check`: aprovados.

## Histórico

| Data | Estado | Alteração |
|---|---|---|
| 2026-07-14 | APPROVED | Contrato e plano aprovados antes da implementação. |
| 2026-07-14 | VERIFIED | Implementação e gates focados concluídos. |
