# Performance de Primeira Abertura - #3308

Status: evidência técnica para lançamento web.

## Medição local

Comando validado:

```bash
node scripts/deploy/build-web-hosting.js
```

Resultado observado no build de produção:

| Métrica | Valor |
| --- | ---: |
| Tempo de build Vite | 4,50 s |
| Tamanho total de `web/dist` | 47 MB |
| Chunk principal `index` | 122,10 kB raw / 31,04 kB gzip |
| Landing `/launch` | 4,41 kB raw / 1,65 kB gzip |
| Maior chunk lazy MUI | 611,29 kB raw / 176,95 kB gzip |
| Maior chunk lazy Firebase | 492,70 kB raw / 147,44 kB gzip |

O `index.html` mantém preload apenas para dependências necessárias ao shell
inicial. Chunks frios de mapas, gráficos, ícones MUI, i18n extra, Storage e
Functions ficam fora do preload inicial e são carregados quando a rota/fluxo
precisa deles.

## Controles já ativos

- Rotas principais usam `React.lazy`.
- `firebase.json` aplica cache imutável em JS/CSS versionados.
- Service Worker tem recuperação automática contra cache travado.
- `vite.config.ts` separa MUI, Firebase, Query, mapas, gráficos e i18n em
  chunks cacheáveis.
- `web/dist/stats.html` é gerado pelo build para auditoria visual de bundle.

## Próxima meta objetiva

Antes da campanha pública, rodar Lighthouse/Web Vitals em mobile real ou
emulação 4G contra Hosting:

- LCP p75 menor que 2,5 s em landing e login.
- INP p75 menor que 200 ms.
- CLS menor que 0,1.
- Primeira abertura autenticada sem download inicial de mapas, charts, PDF ou
  i18n não usado.

Se houver regressão, priorizar:

- Quebrar `vendor-mui` por subdomínio de rota.
- Remover imports de barril de `@mui/icons-material`.
- Auditar imports de Storage/Functions no shell inicial.
- Adiar prefetch de rotas autenticadas até autenticação estabilizar.
