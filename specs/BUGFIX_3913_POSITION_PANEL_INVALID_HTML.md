# BUGFIX #3913 — `PositionReinforcementsPanel` gera HTML inválido (`<div>` dentro de `<p>`)

| Campo | Valor |
|---|---|
| **Issue** | #3913 |
| **Status** | APPROVED |
| **Tipo** | Bugfix |
| **Camadas** | Web (React/MUI) |
| **Origem** | Auditoria visual diária de 2026-07-25 (`daily-best-visual`), ao validar ao vivo o fix do #3899 |

---

## 1. Problema

`PositionReinforcementsPanel.tsx` passa um `<Stack>` contendo `<Chip>`s para a prop `secondary`
de `ListItemText` (L182-203). O MUI **sempre** embrulha `secondary` num `<Typography>` quando o
valor passado não é ele próprio um elemento `Typography` (`ListItemText.js` do pacote instalado,
`@mui/material@5.18.0`):

```js
if (secondary != null && secondary.type !== Typography && !disableTypography) {
  secondary = <Typography variant="body2" className={classes.secondary} color="text.secondary" display="block" {...secondaryTypographyProps}>
    {secondary}
  </Typography>;
}
```

Sem `secondaryTypographyProps.component`, o `Typography` usa o `defaultVariantMapping` do MUI
(`Typography.js`): `body2: 'p'`. Ou seja, o `<Stack>` do componente é renderizado dentro de um
`<p>`. `Stack` (via `Box`) e `Chip` renderizam `<div>` por padrão — logo o DOM final tem
`<div>` (Stack) contendo mais `<div>`s (Chip) **dentro de um `<p>`**, o que é HTML inválido
(`<p>` só aceita conteúdo *phrasing*). O React detecta isso e loga
`Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>` no console.

### Alcance real (verificado, não apenas suposto)

- Confirmado por **leitura direta** dos três pontos da cadeia (não apenas grep): (1) `ListItemText.js`
  do pacote realmente instalado neste worktree confirma que `secondary` sempre vira `Typography`
  sem `component` explícito; (2) `Typography.js` confirma `body2 → 'p'` no `defaultVariantMapping`;
  (3) `PositionReinforcementsPanel.tsx:182-203` confirma que `secondary` é um `<Stack>` (não um
  `Typography`), então cai no branch de wrap automático.
- **Não** é uma família de bugs — é uma única call site. `grep -rn 'secondaryTypographyProps' src`
  mostra 6 outros usos no `web/src`, todos passando `secondary` como texto simples (nunca `Stack`/
  `Chip`), então nenhum deles aciona a mesma classe de bug (Typography com `variant="body2"` sobre
  uma string de texto é HTML válido).
- A issue já trouxe evidência ao vivo (emulador, `/game/<id>`, jogo `SCHEDULED` com 2 candidatos):
  6 elementos de bloco (`div`) dentro do `<p>` = 2 candidatos × (1 `Stack` + até 2 `Chip`s
  visíveis nesse cenário), 0 chips "escapando" da caixa visual — ou seja, **é HTML inválido +
  ruído de console, não um defeito visual**. Este bugfix não altera nada visualmente.

## 2. Decisão de design

### D1 — `secondaryTypographyProps={{ component: 'div' }}`, não reestruturar o layout

A correção sugerida na issue (`secondaryTypographyProps={{ component: 'div' }}`) foi adotada como
está: é a forma canônica do MUI 5 de dizer a `ListItemText` "não uses `<p>` para este `secondary`,
o conteúdo não é texto simples". `slotProps` (API mais nova de composição de slots) **não existe**
em `ListItemText` na versão instalada (`@mui/material@5.18.0` — confirmado por leitura de
`ListItemText.d.ts`/`.js`, sem `slotProps` na lista de props). `secondaryTypographyProps` é,
portanto, a única via suportada nesta versão.

Alternativa descartada: mover o `Stack` de chips para fora do `ListItemText` (ex.: como filho
irmão dentro do `ListItem`, usando `disableTypography` ou reestruturando o layout). Rejeitada
porque exigiria reposicionar manualmente o texto `primary` (nome do candidato) e o bloco de chips
lado a lado, sem o espaçamento/alinhamento que `ListItemText` já dá de graça — mudança bem mais
invasiva para o mesmo resultado (HTML válido). Uma linha resolve sem tocar em layout.

### D2 — Cobertura de regressão: assert de estrutura DOM, não de mensagem de warning

O repo não mocka nem espiona `console.error` globalmente (confirmado em `src/test/setup.ts`), então
capturar a string exata do warning do React (`validateDOMNesting(...)`) seria possível via
`vi.spyOn(console, 'error')`, mas fica acoplado ao texto interno do React (pode mudar entre
versões/minor releases). Em vez disso, o teste novo renderiza o componente **real** via
`renderWithProviders` (mesmo padrão do #3899) e inspeciona o DOM resultante diretamente:
nenhum `<p>` no `container` pode ter um `<div>` como descendente. Essa asserção é sobre o
*resultado observável* (estrutura de nós do DOM), não sobre a mensagem de log — mais robusta a
mudanças de versão do React/MUI, e é exatamente o que a seção "Como validar" da issue já propõe
(`[...document.querySelectorAll('p')].flatMap(p => [...p.querySelectorAll('div,ul,li')]).length`).

Confirmado manualmente (ver seção 4): o teste falha com o código atual (branch antes do fix) e
passa após aplicar `secondaryTypographyProps={{ component: 'div' }}`.

## 3. Mudanças

| Arquivo | Mudança |
|---|---|
| `web/src/pages/game/PositionReinforcementsPanel.tsx` | L182-203: adiciona `secondaryTypographyProps={{ component: 'div' }}` ao `ListItemText` que envolve o `Stack` de chips |
| `web/src/pages/game/positionReinforcementsPanelHtmlNesting.test.tsx` | Novo: renderiza o componente real com 1 candidato tendo todos os campos preenchidos (pior caso: 1 Stack + 5 Chips) e afirma que nenhum `<p>` do DOM renderizado contém `<div>`/`<ul>`/`<li>` como descendente |

## 4. Critérios de aceite

- [x] Alegação da issue validada por leitura direta do código-fonte instalado do MUI (`ListItemText.js` + `Typography.js`), não apenas por confiar na issue
- [x] `secondaryTypographyProps={{ component: 'div' }}` aplicado no `ListItemText` de L182-203
- [x] Teste novo falha no código não corrigido (confirmado manualmente) e passa após o fix
- [x] Nenhuma mudança visual: `component: 'div'` com `display: block` (herdado do `Typography`) mantém o mesmo fluxo de layout que `<p>` teria
- [x] `npm run lint` e `npm run test` verdes em `web/`, sem regressão na baseline (227 arquivos / ~1447 testes)

## 5. Não coberto

- **Varredura de todo o `web/src` por outras instâncias da mesma classe de bug** (conteúdo de
  bloco dentro de `secondary` sem `component: 'div'`) — fora do escopo desta issue, que é
  especificamente sobre `PositionReinforcementsPanel.tsx`. A issue já verificou em runtime que
  `/statistics` e `/badges` têm 0 violações; não foi re-verificado o restante do app.
- **Captura de screenshot do estado corrigido** — mesma limitação do #3899: `usePositionReinforcements`
  depende de uma Cloud Function callable; sem emulador rodando, a seção fica em skeleton. Validação
  aqui é por leitura direta do código-fonte do MUI + teste automatizado com DOM real via jsdom, não
  por captura visual ao vivo.
