# FEAT: bateria de testes com contas fictícias (web, Android e iOS)

> **Status:** `APPROVED`
> **Severidade:** `HIGH` (o app quebrou em produção em 15/11/2026 por formato de dado que nenhum teste lia)
> **Autor:** Claude (pedido do dono)
> **Data:** 2026-11-15

---

## 1. Problema

Em 15/11/2026 o Android quebrou em produção duas vezes, e nas duas a causa foi o formato dos dados do Firestore, que
nenhum teste automático lia de verdade:

- 1.43.1: `safeLong` com `get<Any?>` lançava `SerializationException` ao ler o perfil, e o cliente tentava criar
  `users/{uid}` no primeiro acesso e levava `PERMISSION_DENIED` (corrigido no #4563).
- 1.43.2: documentos legados com o campo `id` gravado derrubavam a leitura de modelos com `@DocumentId`
  (`users/*/groups` no #4566, `groups/*/members` e os demais no #4569).

Pedido do dono: contas fictícias (20 jogadores, 3 donos de quadra, 1 administrador), grupos, jogos e quadras; validar
tudo no web, no Android e no iOS; e uma bateria que rode antes de cada versão e seja sempre melhorada.

## 2. Desenho

### 2.1 Um cenário, três plataformas

`scripts/bateria/contas.ts` e `cenario.ts` são a única fonte do cenário. O seed (`seed-emulador.ts`) monta tudo no
Firebase Emulator Suite pelos escritores reais sempre que existe um (gatilhos `onUserCreate`, `onUserProfileWritten`,
`onMemberWritten`; callables `setUserRole`, `assignLocationOwner`, `confirmGamePresence`, `checkInToGame`,
`startGameLifecycle`, `submitLiveGameEvent`, `finishGameLifecycle`, `submitMvpVotes`, `concludeMvpVoting`). Assim o
formato dos documentos é o que o servidor grava hoje, não o que o teste imagina.

| Item | Conteúdo |
|---|---|
| Contas | 24: `jogador01..20` (PLAYER), `dono01..03` (FIELD_OWNER), `admin` (ADMIN), com claims |
| Quadras | 3, uma por dono |
| Grupos | alfa (público, 12 membros), beta (privado, convite `BATBETA1`), aberto (público, pedido de entrada) |
| Jogos | agendado, confirmado, ao vivo, finalizado (MVP e XP), retido para revisão, público |
| Legado | `jogador01..03` do grupo alfa têm o campo `id` gravado em `groups/*/members` e em `users/*/groups` |

Senhas do emulador são versionadas (projeto `demo-futebadosparcas`, que não alcança produção).

### 2.2 Portas próprias

Os emuladores da bateria sobem por `firebase.bateria.json` em portas próprias (auth 19099, firestore 18085, functions
15001, storage 19199, hub 14400, UI desligada). As portas padrão do `firebase.json` são do runner self-hosted
`mac-futeba-1`, que roda no mesmo Mac. `rodar.sh` recusa subir se alguma porta da bateria estiver ocupada. O web lê as
portas por `VITE_EMULATOR_*_PORT` (padrão inalterado).

### 2.3 Comandos

| Comando | O que faz | Tempo |
|---|---|---|
| `scripts/bateria/rodar.sh rapida` | conferência sem emulador; roda no `pre-push` | ~2 s |
| `scripts/bateria/rodar.sh web` | emuladores + seed + Playwright (`web/e2e-bateria`) | ~4 min |
| `scripts/bateria/rodar.sh android` | emuladores + seed + testes instrumentados no AVD | ~4 min |
| `scripts/bateria/rodar.sh ios` | emuladores + seed + roteiro no Simulador | ~5 min (mais o primeiro build) |
| `scripts/bateria/rodar.sh tudo` | as três, cada uma com seed novo | soma |
| `scripts/bateria/rodar.sh subir` | emuladores + seed no ar, para teste manual | |

### 2.4 Web (Playwright)

`web/playwright.bateria.config.ts`, specs em `web/e2e-bateria/`, pela interface real:

- `01-acesso`: as 24 contas entram e veem o próprio nome; senha errada; primeiro acesso de conta nova sem
  `PERMISSION_DENIED`; guia inicial.
- `02-grupos`: grupo e membros com documentos legados; entrar por convite; pedir entrada em grupo público; criar grupo.
- `03-jogos`: confirmar presença; cada estado do jogo; lançar gol e finalizar o jogo ao vivo; votar no MVP.
- `04-mvp-e-xp`: resultado e MVP; XP e nível no perfil; jogo retido sem XP.
- `05-dono-e-admin`: painel do dono e limite por quadra; lista de usuários e busca do admin; bloqueios por papel.

### 2.5 Android (instrumentado)

`app/src/androidTest/java/com/futebadosparcas/bateria/`. O build de debug fala com os emuladores em `10.0.2.2`:

1. `BateriaFirebaseProvider` (só em `app/src/debug`) cria o `FirebaseApp` padrão com o projeto demo antes do
   `FirebaseInitProvider`, quando a propriedade de sistema `debug.futeba.bateria=1` está ligada (o script liga e desliga).
2. `BateriaTestRunner` (runner do módulo) liga `useEmulator` em Auth, Firestore, Functions e Storage antes do
   `Application.onCreate`, só com `-e bateria true`. Sem isso é um `AndroidJUnitRunner` comum.

Os testes usam os repositórios reais pelo Koin: login das 24 contas com as claims, perfil pelo caminho do `safeLong`,
primeiro acesso esperando o `onUserCreate`, `getMyGroups` e `getGroupMembers` com os documentos legados, detalhe dos
jogos por estado.

Exceção de rede só no debug: HTTP liberado para `10.0.2.2`, `localhost` e `127.0.0.1`.

### 2.6 iOS (roteiro no Simulador)

`scripts/bateria/ios.sh`: compila o app de debug, instala no Simulador e, para `jogador01` (documentos legados),
`dono01` e `admin`, abre o app já logado no projeto demo (`iosApp/iosApp/Services/BateriaEmulador.swift`, só em
`#if DEBUG`, ligado pela variável `FUTEBA_BATERIA=1`). Confere que o login chegou ao emulador do Auth, que o app não
fechou e que não surgiu relatório de falha. Guarda uma captura por conta.

Limite conhecido: o roteiro não clica em nada. O app abre na tela de boas-vindas ("Começar"), com o pedido de
notificações por cima, e fica nela. As telas de dentro (início, grupos, jogos) não são exercitadas no iOS, então a
leitura dos documentos legados pelo iOS **não** está coberta. Isso depende de um XCUITest, que fica para depois.

### 2.7 Defeitos conhecidos não deixam a bateria vermelha, nem somem

Defeito achado e ainda não corrigido vira issue e fica no teste como falha esperada (`test.fail` no web,
`PendenciasBateria.falhaEsperada` no Android), com o link da issue. O teste passa enquanto o defeito existir e fica
vermelho quando for corrigido, para alguém tirar a marca. A conferência rápida recusa falha esperada sem issue.

### 2.8 Contas fictícias em produção

Autorizado pelo dono em 15/11/2026 ("tudo está em teste ainda"). `scripts/bateria/contas-producao.ts`
(`conferir`, `criar --aplicar`, `apagar --aplicar`), idempotente, com o login `gcloud` do Mac:

- 24 contas `techfernandesltda+futeba-teste-NN@gmail.com`, nome "Teste NN ...", uid `teste-futeba-NN`, com claims.
- Todo documento criado leva `isTestData: true`. `apagar` só remove o que tem essa marca e os 24 uids.
- 2 grupos privados, 3 quadras em rascunho, 2 jogos agendados só do grupo. Nada público e nenhum jogo finalizado, para
  não mexer em ranking, XP nem busca.
- Senhas geradas na hora, só em `~/.config/futeba/contas-teste.env` (0600, pasta 0700). Nunca no git nem na saída.
- Recusa o e-mail do revisor do Google Play e qualquer conta fora do padrão. Não altera dado existente.

## 3. Como a bateria melhora

1. Todo defeito de produção ganha primeiro um teste na bateria que o reproduz, depois a correção.
2. Formato novo de documento (campo, coleção, escritor) entra no seed pelo escritor real.
3. Tela ou fluxo novo entra no spec web da área; se tocar leitura no Android, entra no teste instrumentado.
4. Falha esperada corrigida sai do código junto com o fechamento da issue.

## 4. Fora do escopo

- Workflow novo no GitHub. A bateria é local (um comando) e a parte rápida roda no `pre-push`. Não entrou no
  `web-e2e-ci.yml`: o E2E Gate já é o passo mais lento do PR e tem contrato próprio; fica como evolução.
- Testes de tela no Android (Compose) e XCUITest no iOS.
- Criar quadra e criar jogo pela interface (o seed cria; os testes leem e operam).
- Smoke automático com login nas contas de produção (as contas existem; o roteiro ainda é manual).
- Corrigir os defeitos achados (issues #4571 a #4576).

## 5. Verificação

- [x] `rodar.sh rapida` verde.
- [x] Web: 25 testes verdes, 4 deles falha esperada (#4571, #4572, #4573, #4574).
- [x] Android: 8 testes verdes no AVD, 1 verificação como falha esperada (#4576).
- [x] iOS: 3 contas no Simulador (build, login no emulador, app aberto sem fechar). Sem navegar pelas telas.
- [x] Contas de produção criadas e conferidas; segunda execução não cria nada.
