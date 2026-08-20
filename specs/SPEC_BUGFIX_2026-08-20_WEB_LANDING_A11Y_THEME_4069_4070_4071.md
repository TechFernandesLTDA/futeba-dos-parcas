# BUGFIX: Landing/theme — contraste AA do hero e /forgot-password (#4069), override "landing clara" no provider MUI (#4070) e CTA do hero fora da paleta (#4071)

> **Status:** `FIXED`
> **Severidade:** `MEDIUM` (#4069 a11y) / `LOW` (#4070 acabamento) / `LOW` (#4071 design)
> **Autor:** Codex (automatizado)
> **Data:** 2026-08-20
> **Issues:** #4069, #4070, #4071
> **PR:** (preenchido no PR)

---

## 1. Descrição do Bug

Três defeitos relacionados à mesma superfície (landing `/` + painel verde do
`/forgot-password` + `ThemeContext`), medidos em produção com amostragem de
pixels reais:

### 1.1 Comportamento Atual (Errado)

1. **#4069 — a11y:** `primary.main` (#00852A) tem só 0,28 de folga sobre o piso
   AA (4,78:1). Dois call sites caem abaixo de 4,5:1:
   - Eyebrow "Da convocação ao apito final" do hero da landing
     (`LaunchPage.tsx`): 4,18:1 em 375px. O overlay decorativo `::before`
     (radial-gradient branco a 20% em `82% 20%`) clareia o verde sob o texto
     quando o grid empilha (xs/sm), pois o texto ocupa a largura toda e cai
     dentro do raio do brilho. Texto 11px/800 → limiar 4,5:1 (não é texto grande).
   - Subtítulo do `/forgot-password` (`ForgotPasswordScreen.tsx:101-103`):
     4,46:1. `alpha(contrastText, 0,8)` sobre o painel verde consome a folga.
2. **#4070 — theme:** a override "landing sempre clara" (#3740) é aplicada ao
   `documentElement` (dataset/color-scheme/meta theme-color), mas **não** entra
   no `useMemo` que escolhe o tema MUI — o `<CssBaseline />` continua pintando
   o body com a paleta escura (`rgb(15,23,42)` / preto no OLED) atrás de uma
   landing clara. Visível no overscroll/rubber-band. A `LaunchPage` compensava
   com um `MuiThemeProvider theme={futebaTheme}` interno duplicado.
3. **#4071 — design:** CTA "Organizar minha pelada" do hero usa
   `color="secondary"` (#005FCC azul) sobre o hero verde #00852A — único
   elemento azul da dobra, separação de apenas 1,25:1 contra o fundo, e compete
   em hierarquia com o botão outline branco.

### 1.2 Comportamento Esperado (Correto)

1. Eyebrow ≥ 4,5:1 em qualquer viewport/tema; subtítulo do /forgot-password
   ≥ 4,5:1 (sem alfa decorativo sobre o verde).
2. Com `themeMode=dark|oled` salvo, na rota `/` o tema MUI ativo (e o body via
   `CssBaseline`) é o claro — uma única fonte de verdade para "landing clara".
3. CTA do hero usa a paleta da marca (branco sólido + texto `primary.dark`),
   com separação ≥ 3:1 (non-text contrast) contra o hero.

### 1.3 Como Reproduzir

- #4069: produção, 375px, `/` — eyebrow dentro do raio do brilho; `/forgot-password`
  ≥ md (painel verde lateral) — subtítulo com alfa.
- #4070: `localStorage.themeMode='dark'`, abrir `/`, inspecionar
  `getComputedStyle(document.body).backgroundColor` → `rgb(15,23,42)`;
  fazer overscroll.
- #4071: abrir `/`, observar o CTA azul na dobra verde.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Web (hosting prod) |
| Rotas | `/`, `/forgot-password` |
| Temas | light/dark/oled (landing é sempre clara — #3740) |
| Viewports | 375px (bug), 1440px (forgot-password) |
| Frequência | Sempre |

---

## 2. Análise de Causa Raiz

1. **#4069:** o token `primary.main` foi calibrado para passar AA "no limite"
   (4,78:1). Qualquer overlay/alfa decorativo sobre o verde derruba o texto —
   o overlay do hero em xs e o `alpha(.8)` do subtítulo são instâncias disso.
2. **#4070:** o `useMemo` do tema (`ThemeContext.tsx:114-116`) não considera
   `documentThemeOverride` (nem nas deps nem no corpo). A `LaunchPage` mantinha
   um `MuiThemeProvider theme={futebaTheme}` interno para compensar — duas
   fontes de verdade para o mesmo invariant.
3. **#4071:** `secondary.main` (#005FCC) foi calibrado como cor de **texto**
   sobre fundo claro, não como preenchimento de CTA sobre verde. Matizes
   adjacentes azul/verde com luminâncias próximas → separação 1,25:1.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/contexts/ThemeContext.tsx` | #4070 — override no `useMemo` do tema |
| `web/src/pages/launch/LaunchPage.tsx` | #4070 wrapper redundante; #4069 overlay; #4071 CTA |
| `web/src/pages/auth/ForgotPasswordScreen.tsx` | #4069 — remover alfa do subtítulo |
| `web/src/theme/landingContrast.test.tsx` (novo) | teste sistêmico pós-overlay (#4069) |
| `web/src/contexts/ThemeContext.test.tsx` | trava #4070 |
| `web/src/pages/launch/LaunchPage.test.tsx` | trava #4070/#4071 na página |

---

## 3. Solução Proposta

### #4070 — override participa da escolha do tema

```tsx
// ANTES
const theme = useMemo(() => {
  return mode === 'oled' ? futebaDarkOledTheme : isDark ? futebaDarkTheme : futebaTheme;
}, [isDark, mode]);

// DEPOIS
const theme = useMemo(() => {
  if (documentThemeOverride === 'light') return futebaTheme;
  return mode === 'oled' ? futebaDarkOledTheme : isDark ? futebaDarkTheme : futebaTheme;
}, [isDark, mode, documentThemeOverride]);
```

Com isso o `CssBaseline` pinta o body claro na landing e o
`MuiThemeProvider theme={futebaTheme}` interno da `LaunchPage` é removido —
**uma** fonte de verdade para "a landing é clara".

### #4069 — overlay do hero não cobre texto empilhado; alfa fora do subtítulo

- Hero `::before`: o radial-gradient passa a existir apenas de `md` para cima
  (`content: { xs: 'none', md: '""' }`). Em xs/sm o grid empilha e o texto
  ocupa a largura toda (o brilho a `82% 20%` caía sobre o eyebrow); em `md+`
  o brilho cai sobre a coluna da imagem, nunca sobre o texto. O efeito
  decorativo é preservado no desktop.
- Subtítulo do `/forgot-password`: `alpha(contrastText, 0.8)` →
  `color="primary.contrastText"` puro (4,78:1 no pior ponto do gradiente do
  painel — `primary.main`; 7,5:1 sobre `primary.dark`).

### #4071 — CTA do hero em branco sólido

```tsx
<Button ... size="large"
  sx={{
    bgcolor: 'common.white',
    color: 'primary.dark',
    '&:hover': { bgcolor: 'grey.100' },
    '&:focus-visible': { outlineColor: 'common.white' },
  }}
>
```

- Texto `primary.dark` (#005A1C) sobre branco: ~7,4:1 (AA com folga).
- Botão branco contra hero verde: 4,78:1 (≥ 3:1 non-text contrast — antes 1,25:1).
- `outlineColor` branco no focus-visible porque o focus-ring global
  (`primary.dark`) é invisível sobre o hero verde.
- Fora do escopo: CTA "Começar agora" (mid-page, sobre `primary.dark`) e
  `alpha(contrastText, 0.8)` em Login/Register/Splash — padrão similar, a
  tratar em issues próprias se a medição reprovar.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Perder o brilho decorativo no mobile | Aceito: em xs o brilho colide com o texto; é a própria sugestão da issue |
| Outros consumidores do tema sentirem a troca do tema global na landing | Nenhum: o wrapper interno já entregava tema claro à landing; agora o provider entrega — mesmas cores, uma fonte |
| Regressão de contraste ao re-adicionar overlay/alfa | Teste sistêmico `landingContrast.test.tsx` (contraste pós-overlay + guard de CSS) |

---

## 4. Verificação

### 4.1 Testes

- `web/src/theme/landingContrast.test.tsx` (novo):
  - branco sobre `primary.main` ≥ 4,5 (4,78);
  - branco sobre `primary.main` **com** overlay 0,2 < 4,5 — prova que overlay
    nunca pode cobrir texto (causa raiz #4069);
  - branco 0,8-alfa sobre `primary.main` < 4,5 (motivo do fix do subtítulo) e
    contraste puro ≥ 4,5;
  - `primary.dark` sobre branco/grey.100 (CTA) ≥ 4,5; branco contra
    `primary.main` ≥ 3 (non-text);
  - guard de CSS: gradiente do hero só dentro de `@media (min-width:900px)`.
- `ThemeContext.test.tsx`: probe lê o `palette.mode` do MUI — `dark` salvo →
  override light → volta a `dark` ao limpar (#4070).
- `LaunchPage.test.tsx`: probe confirma tema MUI light com `dark` salvo (#4070);
  CTA do hero com bg branco + texto `primary.dark` (#4071).

### 4.3 Checklist

- [x] `npm run build` passa
- [x] `npm run lint` sem warnings
- [x] `npm run test` (arquivos afetados) passa
- [ ] Smoke manual pós-deploy (a cargo do processo de release — sem deploy neste PR)

---

## 5. Prevenção Futura

- Teste sistêmico valida pares texto/fundo **depois** de overlays (composição
  alpha), não só o token cru — padrão extensível às próximas auditorias.
- "Landing sempre clara" tem uma única implementação (provider), removida a
  duplicação da página.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-08-20 | Codex | Issues triadas; spec criada |
| 2026-08-20 | Codex | Fix implementado + testes |
