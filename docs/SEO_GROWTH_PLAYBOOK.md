# SEO e crescimento orgânico — Futeba dos Parças

## Objetivo

Transformar `https://futebadosparcas.com.br` na origem canônica da marca e atrair organizadores de peladas, jogadores e gestores de quadras por buscas com intenção real de uso.

## Fonte canônica e páginas públicas

- Domínio canônico: `https://futebadosparcas.com.br`.
- Landing pública principal e URL canônica: `/`.
- A rota legada `/launch` deve redirecionar para `/` e não deve competir pela indexação.
- `robots.txt`, sitemap, canonical, Open Graph e Twitter Cards devem usar sempre o domínio canônico.
- Páginas privadas, pessoais ou dependentes de autenticação não entram no sitemap.
- Toda página indexável precisa entregar título, descrição, canonical, `h1`, conteúdo útil e links internos coerentes.
- Conteúdo público não deve depender exclusivamente de dados pessoais ou do login para fazer sentido.

## Clusters de busca prioritários

### Organizar a pelada

- aplicativo para organizar pelada;
- como organizar futebol com amigos;
- confirmação de presença em pelada;
- montar times para futebol;
- controlar mensalistas da pelada.

### Estatísticas e engajamento

- ranking de futebol amador;
- estatísticas da pelada;
- aplicativo para marcar gols e MVP;
- tabela de artilharia entre amigos.

### Quadras e descoberta local

- quadra de futebol perto de mim;
- onde jogar futebol em `<cidade>`;
- divulgar quadra society;
- agenda para arena de futebol.

## Roadmap editorial

1. `/organizar-pelada`: guia completo com checklist, confirmações, vagas e times.
2. `/ranking-futebol-amador`: como registrar resultados, artilharia, MVP e evolução.
3. `/gestao-de-pelada`: mensalistas, caixa, recorrência e comunicação do grupo.
4. `/quadras`: página pública de descoberta, somente com dados comerciais autorizados.
5. `/como-funciona`: demonstração visual dos fluxos de organizador, jogador e quadra.

Cada conteúdo deve responder uma intenção específica, incluir exemplos reais do produto, CTA para cadastro e links para outras páginas do mesmo cluster. Não criar páginas rasas apenas para repetir palavras-chave.

## Distribuição

- Compartilhar a landing com UTMs próprias para WhatsApp, Instagram, YouTube e parcerias com quadras.
- Usar o card Open Graph oficial em todo link público.
- Publicar demonstrações curtas com uma única ação: criar grupo, confirmar presença ou ver o ranking.
- Buscar links editoriais reais em sites de ligas, arenas, associações e comunidades de futebol amador.
- Manter nome, domínio, descrição e identidade visual iguais em perfis sociais e lojas de aplicativos.

## Mensuração

Funil mínimo:

1. `landing_viewed`;
2. `signup_cta_clicked`;
3. `registration_completed`;
4. criação do primeiro grupo;
5. criação do primeiro jogo;
6. primeira confirmação de presença.

Segmentar aquisição por `utm_source`, `utm_medium`, `utm_campaign` e domínio de referência, sem armazenar URL completa, e-mail, CPF, nome ou outros dados pessoais nos eventos.

KPIs mensais:

- impressões, cliques, CTR e posição no Google Search Console;
- visitas orgânicas à landing;
- conversão landing → cadastro;
- ativação cadastro → primeiro grupo/jogo;
- instalações PWA originadas por campanha;
- páginas indexadas e erros de cobertura.

## Operação no Google Search Console

1. Criar e verificar uma propriedade de domínio para `futebadosparcas.com.br` via DNS.
2. Enviar `https://futebadosparcas.com.br/sitemap.xml`.
3. Inspecionar `/` e solicitar indexação depois do deploy.
4. Conferir HTML renderizado, canonical escolhido pelo Google e recursos bloqueados.
5. Revisar semanalmente Page indexing, Core Web Vitals e Enhancements.
6. Comparar consultas reais com os clusters deste documento e priorizar conteúdo pela combinação de intenção, impressões e conversão.

### Evidência operacional — 2026-07-16

- Propriedade de domínio `sc-domain:futebadosparcas.com.br` verificada no Google Search Console por DNS na Hostinger.
- Registro TXT `google-site-verification` publicado com TTL de 300 segundos e resolução pública confirmada.
- `https://futebadosparcas.com.br/sitemap.xml` enviado ao Search Console e processado sem erro, com 1 página descoberta.
- A inspeção de `https://futebadosparcas.com.br/` inicialmente informou URL desconhecida/não indexada; a solicitação manual foi aceita com o estado “Indexação solicitada” e inclusão na fila prioritária.
- Os relatórios de desempenho e indexação ainda estavam em processamento, com orientação do Google para nova consulta em aproximadamente 1 dia. Isso não bloqueia a configuração; apenas adia o primeiro baseline numérico.
- A automação Codex `seo-mensal-futeba-dos-par-as` acompanha mensalmente impressões, cliques, CTR, posição média, páginas indexadas, erros de cobertura e oportunidades editoriais.

O baseline inicial deve registrar o período consultado, impressões, cliques, CTR, posição média, páginas indexadas e erros de cobertura assim que os dados forem liberados. A evidência acima conclui a configuração operacional de #3706; o acompanhamento mensal passa a ser rotina contínua, não uma pendência de implantação.

Referências oficiais:

- [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Dados estruturados para aplicativos](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Inspeção de URL](https://support.google.com/webmasters/answer/9012289)

## Critério de pronto para cada release

- metadata e dados estruturados validados;
- sitemap e robots respondendo `200` no domínio canônico;
- página pública utilizável em 360 px e 1365 px;
- sem conteúdo essencial oculto por navegação fixa;
- eventos de aquisição observáveis em produção;
- release notes e changelog alinhados;
- inspeção de URL solicitada após o deploy quando houver página nova ou alteração relevante.
