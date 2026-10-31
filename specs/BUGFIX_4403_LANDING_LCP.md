# BUGFIX: LCP das guias públicas passa de 6 s (Lighthouse CI < 0,85)

> **Status:** `APPROVED` (aprovado pelo dono do processo) / `FIXED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude Code
> **Data:** 2026-10-31
> **PR:** Closes #4403

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
O job "Lighthouse CI" falha em `/organizar-pelada`, `/como-funciona` e `/parcerias`: performance 0,75-0,79, LCP ~6.050 ms
(fase dominante: render delay, 92%). `/`, `/ranking-futebol-amador` e `/gestao-de-pelada` passam.

### 1.2 Comportamento Esperado (Correto)
As 6 URLs públicas com performance >= 0,85 (meta 0,9) e LCP vindo do HTML estático (~1,5 s no preset mobile).

### 1.3 Passos para Reproduzir
1. `cd web && npm run build`
2. `CHROME_PATH=<chromium do playwright> npm run lighthouse`

### 1.4 Contexto
| Item | Valor |
|------|-------|
| Regressão de código | Não: A/B local entre bf4fec16 e master deu notas iguais |
| Frequência | Sempre nas 3 rotas (varia com a página) |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação
Trace do Lighthouse (`largestContentfulPaint::Candidate`) em `/organizar-pelada`: candidato 1 no FCP (46 ms, `p.pr-lead`
estático, 56.960 px²) e candidato 2 após o handoff (React, `p.MuiTypography-body1`, 60.000 px²). O Chrome só troca o
candidato quando o novo elemento é MAIOR; o texto do React era maior, então o LCP passou a ser o parágrafo do app, que só
pinta depois de o bundle subir (~6 s sob throttling). Ranking e gestão passam porque o `h1` estático já era maior que tudo
o que o React pinta.

### 2.2 Causa Raiz
O texto estático do hero (`web/scripts/prerender-public-pages.mjs`) não replicava exatamente o do React, que ficava mais largo:

1. `letter-spacing`: `body1` do tema usa 0,5px; `.pr-lead` usava `normal` (organizar-pelada, parcerias).
2. Peso de fonte: o lead de `/como-funciona` tem `<strong>Tech Fernandes</strong>`; o estático era texto simples.
3. Alinhamento: o hero de `/como-funciona` é centralizado (maxWidth 840); o estático era alinhado à esquerda (a união dos
   retângulos de texto muda).

Os recursos de terceiros (recaptcha, gtag, auth iframe) só atrasam o candidato do React; sem candidato maior, o LCP fica no
estático e eles saem do caminho do LCP. Por isso não foi preciso adiar o App Check.

### 2.3 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `web/scripts/prerender-public-pages.mjs` | CSS do lead (letter-spacing, tabular-nums), `<strong>` do lead, hero centralizado |
| `web/scripts/prerender-routes.mjs` | campos `leadStrong` e `heroCenter` de `/como-funciona` |
| `web/src/pages/growth/growthPages.test.tsx` | trava: `leadStrong` precisa existir no lead da página React |

---

## 3. Solução Proposta

### 3.1 Abordagem
Igualar o texto do hero estático ao do React (mesmo letter-spacing, peso e alinhamento) para o candidato estático ser >= ao do
React. Sem mudar CSP, App Check, auth ou bundles.

### 3.3 Riscos e Mitigações
| Risco | Mitigação |
|-------|-----------|
| Paridade estático/React voltar a divergir | Teste do hero + este registro; medir com Lighthouse ao mexer nos heros |
| Alteração no HTML inline | Mudança só em CSS dentro do `<style>` do `#prerender`; o hash de CSP (script) não muda |

---

## 4. Verificação

- [x] `npm run build`, `npm run lint`, `npm run test` (2937 passed), contrato do workflow (6/6)
- [x] `npm run lighthouse`: 6 URLs com performance 0,99-1,00 (3 execuções cada)

## 5. Prevenção Futura

Qualquer ajuste no hero React das guias (tipografia, `<strong>`, alinhamento, largura) exige o mesmo ajuste no estático.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-10-31 | Claude Code | Causa raiz achada e fix implementado |
