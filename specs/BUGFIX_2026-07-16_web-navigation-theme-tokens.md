# BUGFIX: Tokens visuais das superfícies de navegação web

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3800, #3795, #3794, #3790, #3789

## 1. Problema

As superfícies de navegação duplicam tamanhos tipográficos, tamanho de avatar e
filtros de vidro. O rail médio ainda reduz captions abaixo do menor token MD3 e
o desktop desativa o blur em dark/OLED, divergindo da navegação mobile.

## 2. Resultado esperado

- Captions do rail usam `caption`/`labelSmall`, sem tamanho abaixo da escala.
- Chips usam `md3TypeScale.labelMedium`; overrides redundantes da bottom nav são removidos.
- Avatar compacto tem token semântico próprio em `avatarSizes`.
- Blur, opacidade, fallback e preferência de transparência são definidos uma vez.
- Light, dark e OLED preservam o mesmo comportamento de vidro.

## 3. Design técnico e tarefas

1. Criar tokens/utilitário de vidro para superfícies mobile e desktop.
2. Aplicar o utilitário em sidebar, top bar e bottom nav.
3. Migrar tipografia e avatar para tokens existentes/semânticos.
4. Cobrir os três temas e fallbacks com testes unitários.
5. Executar testes direcionados, lint e build com Node 22.

## 4. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Blur reduzir legibilidade em dark/OLED | Manter opacidade de superfície já validada e fallback sólido |
| Custo de composição no mobile | Preservar token mobile em 12px, menor que desktop |
| Navegador sem suporte | Fallback derivado do mesmo token e prefixo WebKit |
| Conflito com PR #3810 | Diff mínimo; integração deve preservar `AppSidebar.styles.ts` do PR |

## 5. Verificação

- [x] Testes direcionados passam (32 testes)
- [x] Testes dos componentes de navegação passam
- [x] Lint passa
- [x] Build passa
- [x] Diff permanece limitado às cinco issues

A suíte web completa não encerrou no ambiente local e deixou workers Vitest
órfãos, que foram finalizados somente neste clone. Os testes direcionados incluem
os três temas, fallbacks e os componentes alterados; nenhum teste do lote falhou.
