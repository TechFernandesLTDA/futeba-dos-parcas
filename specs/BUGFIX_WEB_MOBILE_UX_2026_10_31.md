# BUGFIX: Auditoria de UX web em celulares (Android Chrome e iPhone Safari)

> **Status:** `APPROVED` (execução pedida pelo dono) / implementação `FIXED` parcial
> **Severidade:** MEDIUM
> **Autor:** Claude (agente), a pedido do dono
> **Data:** 2026-10-31
> **Épico:** #4399

---

## 1. Escopo e método

Auditoria estática do código de `web/` mais medição em Chrome (Pixel 7 e 320x640) sobre o build de produção (`vite preview`) nas rotas públicas `/`, `/login`, `/como-funciona`, `/parcerias`. O WebKit do Playwright não está instalado neste Mac, então o iPhone foi auditado só por leitura de código (nada verificado em Safari real). Rotas autenticadas não foram medidas (sem emulador/seed nesta sessão).

Já estava correto (sem ação): `viewport-fit=cover`, `theme-color` claro e escuro, `apple-touch-startup-image`, manifest com ícones maskable, fontes self-hosted com preload, `touch-action: manipulation` e `-webkit-tap-highlight-color` no tema, hover só em `(hover: hover)`, `useKeyboardInset` (visualViewport), safe-area na FixedBottomBar e no ScreenFab, imagem LCP da landing pré-carregada, locales fora do preload inicial, CLS ~0, sem overflow horizontal em 320 e 412px nas rotas públicas.

## 2. Achados

| # | Sev. | Local | Problema | Status |
|---|------|-------|----------|--------|
| 1 | MEDIUM | 14 pontos (`pages/growth/*`, `WallPostCard`, `WhatsNewDialog`, `ManageLocation*`, `AppSidebar`, fotos) | `vh` ignora a barra dinâmica do Safari iOS: scroll extra e dialogs cortados | Corrigido (`dvh`) |
| 2 | MEDIUM | `contexts/ToastContext.tsx:198-199` | Toasts de erro/desfazer a 16px do fundo (sob o home indicator) e os de topo a 80px (sob o notch em PWA) | Corrigido (`env(safe-area-inset-*)`) |
| 3 | MEDIUM | `pages/auth/LoginScreen.tsx:~320,~357` | "Esqueceu a senha?" (140x20) e "Criar conta" (82x20) abaixo de 48px | Corrigido (`minHeight: 48`) |
| 4 | MEDIUM | `components/common/AppLogo.tsx` | Logo de 180px máx. servido como PNG 512px de 292 KB; era o LCP do `/login` | Corrigido (WebP 360px, 9,8 KB, width/height) |
| 5 | MEDIUM | `services/firebase.ts:50` | App Check (reCAPTCHA Enterprise) carrega ~360 KB de `recaptcha__pt_br.js` (2x na lista de respostas) já na landing pública | Proposto (mexe em segurança, Epic #3869) |
| 6 | LOW | `public/og-futeba-dos-parcas.png` | og:image PNG de 1,2 MB (afeta só crawlers/preview de link) | Proposto |
| 7 | LOW | `index.html` startup images | Só variantes light; no dark o iPhone mostra flash claro no cold start | Proposto |
| 8 | LOW | Landing/páginas públicas | "Pular para o conteúdo" 201x40 e "Início" 41x44 abaixo de 48px | Proposto |
| 9 | LOW | Compartilhamento | Link de jogo exige login; sem visão pública | Proposto (gap de produto) |
| 10 | INFO | Rotas autenticadas | Não medidas (tabelas, dialogs, teclado em formulários) em 320-430px e paisagem | Proposto: rodar com emulador |

## 3. Medidas (build local, Pixel 7, rede sem throttle)

| Métrica | Antes | Depois |
|---|---|---|
| LCP `/login` (elemento) | `logo.png` 292 KB | `logo-360.webp` 9,8 KB |
| Transferência do logo | 292 KB | 9,8 KB |
| CLS `/` e `/login` | 0 e 0,00007 | inalterado |
| Maior chunk (vendor-firebase) | 528 KB | inalterado |

Lighthouse completo não foi rodado.

## 4. Critério de saída

Lint, testes e build verdes (ver relatório). Itens "Proposto" viram issues filhas do épico #4399.
