# SPEC: Artes da pelada (redefinição visual com ilustrações e pictogramas)

> **Status:** `DONE` (aprovada por Renan em 21/11/2026, sobre o plano com amostras)
> **Autor:** Claude Code (sessão de redefinição visual)
> **Data:** 2026-11-21
> **Plano com amostras:** https://claude.ai/artifact/MLowzGubYZunMSfL7Nop1U
> **PR:** a preencher

---

## 1. Requirements

### 1.1 Problema / Oportunidade

Quase toda a interface usa ícones genéricos. Estados vazios e de erro mostram um ícone solto, o iOS não tem
componente comum para eles e o Android tem 8 desenhos em Canvas quase sem uso. O app não aproveita o mundo da
pelada (campo, colete, apito, prancheta, vaquinha, pódio) para explicar o que está acontecendo.

### 1.2 Casos de uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador sem jogo marcado | Abre a Home ou a aba Jogos | Vê a prancheta vazia, um texto claro e a ação para marcar ou achar jogo |
| UC2 | Jogador sem grupo | Abre a aba Grupos | Vê os coletes no varal e as ações de criar ou entrar em grupo |
| UC3 | Qualquer usuário | Uma tela falha ao carregar | Vê a bola na trave, a mensagem e "Tentar de novo" |
| UC4 | Usuário com "reduzir movimento" | Abre telas com arte animada | A arte aparece parada |
| UC5 | Usuário no tema escuro | Qualquer tela com arte | A arte usa a variante escura dos mesmos tokens |

### 1.3 Critérios de aceite

- [x] CA1: Cada arte tem uma fonte SVG única em `shared/artes/` e é gerada para web (TypeScript) e Compose (Kotlin, `:shared`) por `scripts/artes/gerar.mjs`.
- [x] CA2: Toda cor das artes sai de um papel definido em `shared/design-tokens.json#arte`, cujos valores são tokens já existentes (ou transparência sobre eles). Teste falha se aparecer cor fora da lista.
- [x] CA3: O gerado está em dia com as fontes (teste compara a saída do gerador com os arquivos versionados).
- [x] CA4: Web, Android e iOS têm estado vazio, estado de erro e cabeçalho que aceitam arte, com a mesma anatomia: arte, título, texto, ação principal, ação secundária opcional.
- [x] CA5: Arte nunca tem texto embutido. Arte informativa tem descrição para leitor de tela; arte decorativa fica oculta.
- [x] CA6: Animações curtas (até ~2,4 s em laço, só em artes de destaque) e desligadas com reduzir movimento nas três plataformas.
- [x] CA7: Testes automatizados verdes (gerador, web, unitários Android) e conferência visual em web, Simulador iOS e emulador Android com capturas de antes e depois.

### 1.4 Fora de escopo

- Trocar fonte, logo, ícone do app ou paleta. Nenhuma cor nova.
- Jogadores desenhados (fica para uma leva futura, se o Renan pedir).
- Envio às lojas ou publicação do web.

---

## 2. UX/UI

### 2.1 Linguagem

"Giz de campo": formas chapadas com linhas brancas de giz, volume por luz pela esquerda e sombra feitas com
transparência. Só objetos da pelada, sem pessoas. Sem texto dentro da arte.

### 2.2 Catálogo da primeira leva

| Arte | Uso |
|------|-----|
| `campo` | Topo da Home, do jogo e do onboarding |
| `prancheta_vazia` | Sem jogos (Home, Jogos, agenda) |
| `coletes_varal` | Sem grupo, membros vazios |
| `sorteio` | Sorteio e montagem de times |
| `vaquinha` | Caixa do grupo, pagamentos |
| `podio` | Ranking, Liga, estatísticas vazias |
| `medalha` | Conquistas, nível, MVP |
| `bola_na_trave` | Erros leves, sem conexão, página não encontrada |
| `ingressos` | Convites |
| `apito` | Notificações vazias |
| `banco_vazio` | Jogadores vazios, lista de espera |
| `mapa_campo` | Locais e campos vazios |
| `lupa` | Busca sem resultado |
| `cones` | Em breve |
| `placar_zerado` | Jogo sem eventos, estatísticas sem dados |
| `chuteiras` | Presença confirmada, boas-vindas |

Pictogramas (grade 24, traço 1,8): campo, society, quadra, bola, chuteira, colete, apito, placar, súmula,
sorteio, goleiro, artilharia, presença, vaquinha.

### 2.3 Estados

Toda tela segue Loading / Empty / Error / Success. Empty e Error passam a usar arte. Loading continua com shimmer.

### 2.4 Responsividade e acessibilidade

- Arte com largura máxima (vazio 200 dp/px, cabeçalho ocupa a largura do cartão) e proporção fixa do viewBox.
- Em landscape e janelas baixas, a arte do estado vazio encolhe até 120 dp.
- Contraste do texto ao redor segue os tokens; a arte não carrega informação que não esteja no texto.

---

## 3. Technical design

- Fontes: `shared/artes/fontes/*.svg` (artes) e `shared/artes/pictogramas/*.svg`, peças comuns em `shared/artes/fontes/_pecas.svg`.
- Papéis de cor: `shared/design-tokens.json#arte` (claro e escuro).
- Gerador sem dependências: `scripts/artes/gerar.mjs` lê as fontes, expande `<use>`, converte formas em lista de
  operações (caminho, círculo, elipse, retângulo, grupo com transformação e animação) e grava:
  - `shared/src/commonMain/kotlin/com/futebadosparcas/domain/artes/ArtesGeradas.kt` (dados puros, sem Compose);
  - `web/src/components/artes/artes.generated.ts`.
- Renderizadores: `app/.../ui/components/artes/` e `composeApp/.../ui/artes/` (Canvas do Compose, com `PathParser`),
  `web/src/components/artes/Arte.tsx` (SVG). Pictogramas como `ImageVector` (Compose) e componentes SVG (web).
- Testes: `scripts/artes/gerar.test.mjs` (cores, sincronia, todas as artes nas duas saídas), Vitest do componente
  web, teste unitário Android do mapeamento de paleta.

## 4. Tasks

1. Fontes SVG e papéis de cor. 2. Gerador e testes. 3. Web. 4. Android. 5. iOS (composeApp). 6. QA com capturas.

## 5. Verify

Ver CA7. Capturas em `docs/capturas/artes-da-pelada/`:

- `web/`: antes e depois em celular claro e escuro e em desktop, contra os emuladores locais do Firebase.
- `android/`: antes e depois no emulador (Pixel, API 36) com login no emulador local do Firebase.
- `ios/`: só depois (claro e escuro) da tela de boas-vindas. O Simulador roda sem `GoogleService-Info.plist`, então as telas depois do login não abrem nele.

Gates rodados: gerador (`--verificar` e `gerar.test.js`), vitest completo, tsc e eslint do web, `compileDebugKotlin`, compilação iOS do `:composeApp`, detekt, lint Android e testes unitários de `:shared` e `:app`.
