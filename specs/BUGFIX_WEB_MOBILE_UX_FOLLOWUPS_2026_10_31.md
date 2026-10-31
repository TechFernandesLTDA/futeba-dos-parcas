# BUGFIX: Follow-ups da auditoria de UX web mobile (#4404 a #4407)

> **Status:** `APPROVED` (execução pedida pelo dono) / implementação `FIXED` parcial
> **Severidade:** MEDIUM
> **Autor:** Claude (agente)
> **Data:** 2026-10-31
> **Épico:** #4399 (fase 1 em `BUGFIX_WEB_MOBILE_UX_2026_10_31.md`)

## 1. Itens

| Issue | Mudança | Status |
|---|---|---|
| #4404 | og:image da home em JPEG 1200x630 de 240 KB (era PNG de 1,2 MB); `index.html` e `seo/metadata.ts` atualizados. O PNG antigo continua publicado para links já compartilhados. As 5 imagens `public/og/*.png` (~500 KB cada) ficam fora do escopo. | Corrigido |
| #4405 | Os 18 arquivos `startup/dark-*` já existiam sem uso; cada tamanho ganhou link `prefers-color-scheme: dark` (e `light` explícito). | Corrigido |
| #4406 | Breadcrumb "Início" e itens (44 para 48px, minWidth 48) e skip link (min 48px). | Corrigido |
| #4407 | Varredura autenticada (ver 2) e correções de alvos de toque (ver 3). | Corrigido parcial |

## 2. Método da varredura (#4407)

Emulador Firebase (auth + firestore, projeto `demo-futeba`), seed E2E (`seed:e2e`, `seed:e2e:groups`), `vite dev` com `VITE_USE_EMULATOR=true`, login como PLAYER. 23 rotas autenticadas em: WebKit iPhone 15 retrato e paisagem, WebKit 320x568 (iPhone SE), Chromium Pixel 7 (viewport do Pixel 8 não existe no Playwright instalado; 412 de largura, mesmo comportamento) e Chromium 430x900. Medido por rota: overflow horizontal, elementos fora da viewport fora de contêiner rolável, inputs de texto visíveis < 16px (zoom do iOS) e alvos de toque < 44px.

Resultado:
- Overflow horizontal: 0 em todas as rotas e viewports (320 a 430 e paisagem).
- Inputs de texto < 16px: nenhum. Só `input[type=range]` (sliders do perfil), que não dispara zoom.
- Elementos cortados fora da viewport: nenhum fora de contêineres roláveis.
- Alvos de toque < 44px: chips de filtro (24-37px em notificações, locais, ranking), tabs de 36-42px (Jogos, Ranking), ToggleButtons de 27-39px (tema, filtros), selo de nível da Home (28px).

## 3. Correções

- `theme/index.ts` (MuiCssBaseline, só `@media (hover: none) and (pointer: coarse)`): chips clicáveis ganham área de toque de 44px via pseudo-elemento invisível (visual intacto); Tab e ToggleButton ganham `minHeight: 44` (especificidade dobrada para vencer `sx` locais de 36/40px).
- `pages/home/tabs/RankingsTab.tsx:485-489`: tabs com `minHeight` 44 (eram 40).
- `pages/home/tabs/HomeTab.tsx`: selo de nível de 28px com área de toque de 48px (`::after` com inset -10).
- Teste em `theme/mobileTapFeedback.test.ts`.

## 4. Não corrigido / observações

| Item | Local | Motivo |
|---|---|---|
| Selo de nível da Home e botão "Destaques" (38px) | `HomeTab.tsx` | Selo corrigido; "Destaques" (38px) não tratado |
| Cabeçalho duplicado em `/game/create` (barra "Criar" + título "Criar Jogo") em 320px | `pages/game/*` | Decisão de design; ocupa ~25% da altura de 568px |
| Barra inferior translúcida sobrepõe o conteúdo em `/game/create` em 320px | `components/layout/*Bottom*` | Decisão de design (glass); legibilidade do texto sob o vidro pode piorar |
| Teclado virtual sobre inputs e rotas dinâmicas (`/game/:id`, `/group/:id`) | — | Não exercitados: exigem digitação em dispositivo real e dados do seed por id |
| Rotas de dono/admin (`/owner`, `/admin/*`) | — | Não medidas (usuário PLAYER) |
| Safari real | — | Medido no WebKit do Playwright, não no Safari do iPhone |
