# SPEC: Visão pública do jogo para compartilhar (web + functions)

> **Status:** `APPROVED`
> **Autor:** Claude Code (autonomia ampla autorizada pelo dono do produto)
> **Data:** 2026-11-01
> **PR:** a preencher
> **Issue:** #4408 (épico #4398, pai #4399)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O link de um jogo (`https://futebadosparcas.com.br/game/{id}`) é compartilhado
no WhatsApp e em outras redes, mas:

1. a pré-visualização é sempre a genérica da home, porque os crawlers não
   executam JS e o Hosting serve o mesmo `app-shell.html` para toda rota;
2. quem abre o link sem login cai direto em `/login`, sem saber de que jogo se
   trata.

O épico de lançamento #4398 lista isso entre os itens a resolver antes de abrir
o produto ao público.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Organizador | Cola o link de um jogo público no WhatsApp | A prévia mostra grupo, dia, horário, local e vagas |
| UC2 | Visitante sem conta | Abre o link de um jogo público | Vê a página pública com os dados do jogo e o CTA para entrar/criar conta |
| UC3 | Visitante | Toca em "Entrar para confirmar presença" | Vai ao login; depois do login volta para `/game/{id}` completo |
| UC4 | Visitante | Abre o link de um jogo GROUP_ONLY, excluído ou inexistente | Prévia e página genéricas ("Jogo indisponível"), sem nenhum dado do jogo |
| UC5 | Usuário logado | Abre `/game/{id}` | Mesmo comportamento de antes: `GameDetailScreen` dentro do `AppLayout` |

### 1.3 Critérios de Aceite

- [x] CA1: `GET /game/{id}` de jogo PUBLIC_OPEN/PUBLIC_CLOSED não excluído devolve o
  `app-shell.html` com `<title>`, `description`, `og:*` e `twitter:*` do jogo.
- [x] CA2: jogo privado, inexistente, soft-deleted ou id inválido devolvem
  exatamente o mesmo HTML genérico (sem oráculo de existência).
- [x] CA3: nenhum nome, foto, telefone ou id de jogador, nome do organizador,
  Pix, coordenada ou endereço completo sai da function. Só contagem de
  confirmados e vagas.
- [x] CA4: todo texto vindo do Firestore é escapado nas metas (sem XSS) e os
  padrões `$&`, `$1` etc. não são interpretados na substituição.
- [x] CA5: scripts inline do shell (com hash na CSP) ficam byte a byte iguais.
- [x] CA6: visitante sem login em `/game/{id}` vê a página pública com estados
  loading, empty, error e success; logado continua indo para a tela completa.
- [x] CA7: `firestore.rules` não muda; nenhuma leitura anônima de `games`.

### 1.4 Fora de Escopo

- `og:image` dinâmica (imagem gerada com data/vagas). Fica a imagem padrão do
  site; a informação vai em título, descrição e `og:image:alt`. Gerar imagem
  exige fonte embarcada e renderização na function (custo e risco maiores).
- Indexação por buscadores: a página continua `noindex, nofollow` (#4327).
- Confirmar presença sem conta ou pela página pública.
- Paridade Android/iOS: os apps abrem `/game/{id}` pelo App Link e já exigem
  conta. Nada muda neles.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
Link /game/{id}
  ├─ crawler ──> HTML do shell com metas do jogo (ou genéricas)
  └─ navegador ─> React
        ├─ auth carregando ─> splash
        ├─ sem sessão (após 300 ms) ─> PublicGameScreen
        │      ├─ Entrar ─> /login (state.from = /game/{id}) ─> /game/{id} completo
        │      └─ Criar conta ─> /register (state.from = /game/{id})
        └─ com sessão ─> ProtectedRoute + AppLayout + GameDetailScreen (inalterado)
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| PublicGameScreen | Loading | Card com skeleton (`aria-busy`) |
| PublicGameScreen | Empty | `EmptyState` "Jogo indisponível" (privado/inexistente/excluído), CTAs Entrar e Criar conta |
| PublicGameScreen | Error | `ErrorState` "Não foi possível carregar o jogo." com retry |
| PublicGameScreen | Success | Status, modo de entrada, grupo (título), data e horário, local, confirmados/vagas com barra, CTA, compartilhar |

Jogo encerrado, em andamento ou cancelado mostra o status e troca o CTA por
"Entrar" (sem convite a confirmar presença).

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Celular | Card em coluna, botões empilhados |
| Tablet / desktop | `PageContainer maxWidth="form"`, botões lado a lado |

### 2.4 Acessibilidade

- [x] Título da página em `h1`, CTA em `h2`, ícones decorativos com `aria-hidden`
- [x] Botões com altura mínima de 48 px
- [x] Cores só por tokens do tema MUI
- [x] Barra de progresso com `aria-label`

### 2.5 Animações e Micro-interações

Nenhuma além das padrão do MUI. Compartilhar usa a Web Share API e, sem ela,
copia o link e mostra toast.

---

## 3. Technical Design

### 3.1 Arquitetura

```
Firebase Hosting
  /game/create        -> /app-shell.html (estático, antes do glob)
  /game/*             -> function publicGamePage (southamerica-east1)  [HTML]
  /api/public-game/*  -> function publicGamePage                       [JSON]
  **                  -> /app-shell.html

publicGamePage (onRequest v2, maxInstances 3, 256MiB, timeout 15 s, invoker public)
  ├─ lê games/{id} com Admin SDK
  ├─ toPublicGameView(): whitelist + sanitização (falha fechado)
  ├─ HTML: busca https://futebadosparcas.com.br/app-shell.html (URL fixa,
  │        cache em memória revalidado por ETag a cada 15 s, último válido em
  │        caso de falha) e troca só title/meta; sem shell, devolve página
  │        mínima com as metas
  └─ JSON: { game: PublicGameView } ou 404 uniforme

web
  App.tsx: GameDetailRoute (padrão do RootRoute) decide público x logado
  services/publicGameService.ts: fetch same-origin de /api/public-game/{id}
  pages/game/PublicGameScreen.tsx: tela pública (TanStack Query)
```

### 3.2 Modelos de Dados

```ts
interface PublicGameView {
  id: string;                     // id validado ^[A-Za-z0-9_-]{1,128}$
  status: 'SCHEDULED' | 'CONFIRMED' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  joinMode: 'OPEN' | 'CLOSED';    // PUBLIC_OPEN | PUBLIC_CLOSED
  date: string | null;            // YYYY-MM-DD local (campo date; fallback dateTime/date_time em America/Sao_Paulo)
  time: string | null;            // HH:mm
  endTime: string | null;         // end_time
  locationName: string | null;    // location_name sanitizado (máx. 80)
  groupName: string | null;       // group_name sanitizado (máx. 80)
  maxPlayers: number | null;      // max_players
  playersCount: number;           // players_count
  spotsLeft: number | null;       // max(0, max - count)
}
```

Campos do documento conferidos nos escritores: `useCreateGame`
(`web/src/hooks/useGames.ts`, snake_case + `dateTime`) e
`functions/src/games/recurrence-engine.ts`.

### 3.3 API / Firestore

| Operação | Endpoint | Método | Resposta |
|----------|----------|--------|----------|
| Prévia/página | `/game/{id}` | GET/HEAD | 200 HTML (sempre) |
| Dados públicos | `/api/public-game/{id}` | GET/HEAD | 200 `{game}`, 404 `{error:"not_found"}`, 503 `{error:"unavailable"}` |
| Outros métodos | ambos | * | 405 |

Regra de publicidade (igual ao ramo público do `allow get` de `games` em
`firestore.rules`): `visibility in [PUBLIC_OPEN, PUBLIC_CLOSED]`, sem
`deleted_at`/`deletedAt`, status conhecido. Jogo legado com só `is_public: true`
e sem `visibility` é tratado como privado (as rules também não o liberam).

### 3.4 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| HTML | `public, max-age=0, s-maxage=60` (CDN do Hosting, purgada a cada deploy; curto porque o shell muda a cada deploy do web) |
| Shell em memória | GET condicional com `If-None-Match` a cada 15 s (o Hosting manda ETag) |
| JSON | `public, max-age=60, s-maxage=300` |
| Erro de leitura / sem shell | `no-store` |
| Sem rede no cliente | Estado de erro com retry |

### 3.5 Segurança

- [x] `firestore.rules` inalterado; leitura só via Admin SDK na function
- [x] Whitelist de campos; resposta uniforme para privado/inexistente/excluído
- [x] Escape de `& < > " '`, remoção de controles e bidi, truncamento
- [x] Substituição com replacer em função (sem expansão de `$&`)
- [x] URL do shell fixa (não deriva do `Host`), `redirect: "error"`, timeout 3 s
- [x] `X-Robots-Tag: noindex, nofollow`; `og:url` montado só com id validado
- [x] `maxInstances: 3` limita custo de varredura de ids

### 3.6 Performance

- Logado também passa pela function em `/game/{id}`; a CDN guarda o HTML por
  1 min e o shell fica em memória, então o custo é cerca de um read de
  Firestore por jogo por minuto de uso. Cold start (sem `minInstances`) pode
  somar 1 a 3 s no primeiro deep link depois de um período ocioso.
- Página pública é lazy (chunk próprio).

### 3.7 Analytics e Observabilidade

Logs `warn`/`error` da function sem PII (só `gameId` e mensagem de erro).

---

## 4. Tasks (Breakdown)

| # | Task | Status |
|---|------|--------|
| 1 | Function `publicGamePage` + export no index | ✅ |
| 2 | Jest: sanitização, privado, inexistente, soft-deleted, XSS, `$&`, cache do shell | ✅ |
| 3 | Rewrites no `firebase.json` | ✅ |
| 4 | `publicGameService` + `PublicGameScreen` + i18n pt-BR/en/es | ✅ |
| 5 | `GameDetailRoute` em App.tsx | ✅ |
| 6 | Vitest da página e do serviço | ✅ |

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Jest `functions/test/public-game-page.test.ts` | projeção, metas, escape, handler HTML/JSON, Admin SDK, shell | ✅ |
| Vitest `web/src/pages/game/PublicGameScreen.test.tsx` | 4 estados, CTAs com retorno, XSS, Web Share, serviço | ✅ |
| Injeção contra o `dist/app-shell.html` real | scripts inline idênticos, 1 ocorrência por meta | ✅ |

### 5.2 Checklist de Revisão

- [x] Build, lint e testes de functions e web passam
- [x] Strings em i18n (pt-BR, en, es)
- [x] Sem regressão no fluxo logado (`/game/:gameId` continua no AppLayout)

### 5.3 Validação pós-deploy

- `curl -s https://futebadosparcas.com.br/game/<id público> | grep og:` mostra as metas do jogo.
- Mesmo comando com id GROUP_ONLY mostra as metas genéricas.
- Depurador de compartilhamento do Facebook / prévia no WhatsApp.
- `curl -sI https://futebadosparcas.com.br/game/<id>` mostra `content-security-policy`
  e `x-frame-options` (a function também seta X-Frame-Options, nosniff e
  Referrer-Policy por garantia).
- Logado: abrir `/game/<id>` continua no detalhe completo.

---

## 6. Notas e Referências

- Issue: #4408; épico #4398
- Relacionadas: #4327 (shell noindex), SECFIX #442 (coordenadas), FIX #4126 (whitelist de visibilidade)
- Decisão proposta para `specs/DECISIONS.md` no corpo do PR

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-11-01 | Claude Code | Criação e aprovação (autonomia ampla) |
