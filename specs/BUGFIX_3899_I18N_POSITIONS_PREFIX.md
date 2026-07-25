# BUGFIX #3899 — Painel de reforço exibe a chave crua `profile.positions.*`

| Campo | Valor |
|---|---|
| **Issue** | #3899 |
| **Status** | APPROVED |
| **Tipo** | Bugfix |
| **Camadas** | Web (React/i18next) |
| **Origem** | Auditoria visual diária de 2026-07-24 (`daily-best-visual`) |

---

## 1. Problema

`PositionReinforcementsPanel.tsx` monta a chave de tradução das posições de jogador com o prefixo `profile.positions.` em dois pontos:

- **L68** — `getPreferredPositionsForNeed(need).map((position) => t(\`profile.positions.${position}\`)).join(', ')`, interpolado no texto de ajuda `games.detail.reinforcements.matchHint` (L133).
- **L187** — `<Chip size="small" label={t(\`profile.positions.${candidate.user.preferredPosition}\`)} />`, um chip por candidato na lista de reforço.

As traduções das 6 posições (`GOLEIRO`, `ZAGUEIRO`, `LATERAL`, `VOLANTE`, `MEIA`, `ATACANTE` — `PreferredPosition` em `src/types/user.ts:3`) existem completas nos 3 locales, mas sob **`player.positions.*`**, não `profile.positions.*`. O namespace `profile.positions` não existe em nenhum locale. Confirmado por leitura direta:

```
$ node -e "require('./src/i18n/locales/pt-BR.json').profile.positions"
undefined
$ node -e "console.log(Object.keys(require('./src/i18n/locales/pt-BR.json').player.positions))"
[ 'ATACANTE', 'GOLEIRO', 'LATERAL', 'MEIA', 'VOLANTE', 'ZAGUEIRO' ]
```

Como a chave não existe, i18next aplica o comportamento padrão (nenhum `parseMissingKeyHandler` configurado): devolve a própria chave. O usuário vê `profile.positions.GOLEIRO` na tela em vez de "Goleiro". Em produção isso falha em silêncio — `missingKeyHandler` (`src/i18n/index.ts:45`) só loga quando `import.meta.env.DEV` — e o `fallbackLng: 'pt-BR'` não ajuda porque a chave falta também no locale de fallback.

`grep -rn 'player\.positions' src` (excluindo testes) confirma **zero** chamadas — as 6 chaves traduzidas nos 3 idiomas estavam órfãs, assinatura de prefixo trocado (não de tradução esquecida). Introduzido em `90d3e63a` ("feat: add position reinforcement requests"), confirmado via `git log -S 'profile.positions'`.

## 2. Decisões de design

### D1 — Trocar apenas o prefixo, sem tocar nos locales

As traduções já existem completas e corretas sob `player.positions.*` nos 3 idiomas (pt-BR/en/es). A correção é textual nas duas chamadas `t()` do componente — não há necessidade de mover, duplicar ou renomear chaves no JSON. Mover as chaves de `player.positions` para `profile.positions` foi descartado: `player.positions.*` é o namespace correto pelo domínio (posição é atributo do jogador/`User`, não do formulário de perfil), e nenhum outro ponto do código usa esse prefixo hoje — trocar o destino evitaria reintroduzir o mesmo tipo de drift se outro componente vier a consumir essas chaves.

### D2 — Cobertura de regressão via i18next real, não apenas checagem de chave JSON

O repo já tem dois testes de paridade de chaves (`src/i18n/i18n-key-parity.test.ts` e `src/i18n/keyParity.test.ts` — aparentemente duplicados de auditorias anteriores) que verificam que toda chave **estática** `t('literal')` existe em pt-BR.json. Ambos **excluem explicitamente template literals** ("não é possível validar em tempo de compilação sem AST completa") — por isso não pegaram este bug: as duas chamadas afetadas são `t(\`profile.positions.${position}\`)`, um template literal.

A issue sugere um teste de contrato genérico ("nenhuma chamada `t()` com literal deve resolver para si mesma"). Dois níveis de cobertura foram adicionados:

1. **Teste de contrato genérico (`dynamicKeyPrefix.test.ts`)** — varre todo `src/` por chamadas `t(\`prefixo.estatico.${variável}\`)` via regex, extrai o prefixo estático (a parte antes do primeiro `${`) e verifica que esse prefixo resolve a um **objeto não-vazio** (container, não folha) nos 3 locales. Isso é mais fraco que validar a chave completa (não conhece o domínio da variável em tempo de análise estática), mas é robusto o bastante para pegar exatamente esta classe de bug — prefixo inteiro inexistente — sem falsos positivos nos ~30 outros pontos do código que usam o mesmo padrão (`feedback.${labelKey}`, `badges.categories.${badge.category}`, etc.), porque todos eles apontam para namespaces que de fato existem. Confirmado que este teste falha com o prefixo antigo (revertido manualmente, reproduzido, revertido de volta) e passa com o fix.
2. **Teste de regressão específico (`positionReinforcementsI18n.test.tsx`)** — renderiza o componente **real** `PositionReinforcementsPanel` com `@testing-library/react` via `renderWithProviders`, mockando apenas o hook de dados (`usePositionReinforcements`, que depende de Firestore/Cloud Functions) — sem mockar `react-i18next`. O setup global de teste (`src/test/setup.ts`) já inicializa um i18next real com os 3 JSONs de locale em pt-BR, então o componente resolve traduções de verdade. O teste afirma que o hint de busca mostra "Buscando por: Goleiro" (não a chave crua) e que o chip do candidato mostra "Defensor". Confirmado manualmente que este teste falha com o prefixo antigo — a tela mostra `profile.positions.GOLEIRO`/`profile.positions.ZAGUEIRO` literalmente — e passa com `player.positions.*`.

Uma primeira versão deste teste (`positionReinforcementsI18n.test.ts`, sem `.tsx`) instanciava um i18next isolado e chamava `t('player.positions.X')` diretamente, sem passar pelo componente. Foi descartada: como não exercitava o call site real do componente, continuava passando mesmo com o código do componente revertido para o prefixo bugado (`profile.positions.`) — só testava que a chave `player.positions.X` existe no locale, que nunca foi o problema. A versão `.tsx` acima corrige isso renderizando o componente de verdade.

**O que não foi tentado**: uma validação 100% genérica que capturasse *toda* chamada dinâmica de `t()` da árvore inteira do app resolvendo o domínio real de cada variável (ex.: seguir o tipo TypeScript da variável interpolada até um union type e enumerar seus valores) exigiria um parser AST + resolução de tipos, não regex — desproporcional ao escopo deste bugfix. O teste de prefixo (item 1) cobre a classe do bug real; o teste específico (item 2) cobre a regressão exata da issue.

## 3. Mudanças

| Arquivo | Mudança |
|---|---|
| `web/src/pages/game/PositionReinforcementsPanel.tsx` | L68 e L187: prefixo `profile.positions.` → `player.positions.` |
| `web/src/i18n/dynamicKeyPrefix.test.ts` | Novo: contrato genérico — prefixo estático de toda chamada `t(\`...\${...}\`)` deve existir como objeto não-vazio nos 3 locales |
| `web/src/pages/game/positionReinforcementsI18n.test.tsx` | Novo: regressão específica — renderiza o componente real com i18next real e afirma que o hint/chip mostram texto traduzido, não a chave crua |

## 4. Critérios de aceite

- [x] `t(\`player.positions.${position}\`)` nas L68 e L187 resolve para o texto traduzido, não para a chave crua, nos 3 locales
- [x] Nenhuma chamada remanescente a `profile.positions.*` no código
- [x] Teste de regressão específico falha com o prefixo antigo e passa com o novo (verificado manualmente antes do fix)
- [x] `npm run lint` e `npm run test` verdes em `web/`

## 5. Não coberto

- **Renderização visual do painel**: `usePositionReinforcements` depende de uma Cloud Function callable; sem o emulador de functions rodando, a seção fica em skeleton. Não foi possível capturar screenshot do chip/hint corrigidos renderizados na tela — a correção foi validada por leitura direta do código + teste automatizado com i18next real, não por captura visual.
- **Outros pontos que exibem `preferredPosition` sem tradução consistente** — achado colateral, fora do escopo desta issue: `NearbyPlayersScreen.tsx:239` exibe o valor cru do enum (`player.preferredPosition`, ex. "GOLEIRO") sem passar por `t()`; `EditProfileScreen.tsx` e `ProfileSetupScreen.tsx` usam um mapa `POSITION_LABELS`/abreviações locais próprias, não `player.positions.*`. Nenhum desses três usa o namespace afetado por este bug — não fazem parte da issue #3899, que é especificamente sobre `PositionReinforcementsPanel.tsx`. Sinalizado à parte, não corrigido aqui.
- **Deduplicação de `i18n-key-parity.test.ts` / `keyParity.test.ts`** — os dois arquivos parecem ser cópias quase idênticas de auditorias anteriores (#2485 e uma anterior sem número de issue). Não fazem parte deste bugfix; mantidos como estão para não ampliar o escopo do PR.
