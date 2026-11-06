# PLANO de modernização do Futeba dos Parças

Fase 3 da missão. Base: `ESSENCIA.md` (o que o app é) e `DIAGNOSTICO.md` (o que está errado). Data: 04/11/2026.

**Nada deste plano começa sem a sua aprovação.** Você pode aprovar o plano inteiro, só algumas ondas ou só alguns passos.

## Regras que todo passo segue

1. **Um passo, um branch, um PR.** Nome `<tipo>/<onda><n>-<assunto>`, por exemplo `test/a1-xp-golden`. Squash-merge depois dos 4 gates do CI. Nunca push direto na `master`.
2. **Teste antes de mexer.** O PR começa com um commit que só adiciona testes passando contra o código atual (caracterização). A mudança vem no commit seguinte, e o teste mostra o que mudou.
3. **Nada é apagado sem estar listado aqui com ✋.** Um ✋ quer dizer "remove arquivo, tela, campo ou funcionalidade". Aprovar o passo é aprovar a remoção. O que for removido fica recuperável no histórico do git.
4. **💾 = mexe em dado de produção.** Antes: export do Firestore (`gcloud firestore export` para um bucket com data), script testado no emulador com dados sintéticos no formato dos de produção (usar dados reais, mesmo anonimizados, só com aprovação à parte), execução primeiro em modo `--dry-run` com relatório, e só então a escrita.
5. **Deploy por passo.** Functions e rules: `firebase deploy --only <alvo>` depois do merge. Web: hosting. Android: as correções se acumulam para a 1.43.0, que só sai **depois** de a 1.42.0 estar publicada (combinado: nada de play-promote antes da aprovação). iOS: acumula até haver conta Apple (#4395).
6. **Notas de versão** em `release-notes/<plataforma>/<versão>.md`, como já é feito.
7. **O novo ao lado do antigo.** Todo passo que muda comportamento (Onda C) sai atrás de uma flag do Remote Config, com o caminho antigo intacto e ligado por padrão. A flag é virada aos poucos, e a remoção do caminho antigo é um passo ✋ separado, depois de um tempo sem problema.

---

## Passo 0: a stack (decisão sua)

A missão pede Expo por padrão, mas manda não migrar uma stack multiplataforma madura "só por migrar". Prós e contras completos no `ESSENCIA.md`, Apêndice A. Resumo:

| | Manter KMP + Compose Multiplatform + React | Reescrever em Expo |
|---|---|---|
| Android | publicado, nada a refazer | refazer ~50 telas |
| iOS | falta paridade (Onda G) | paridade ao reescrever tudo |
| Risco e custo | baixo, incremental | alto, duas bases por meses |

**Recomendação: manter.** Todo o resto deste plano supõe isso. Se você escolher Expo, as Ondas A, B, E (web e functions) e H continuam valendo, e as Ondas C (Android), D2 e G viram um plano novo de app paralelo, que eu escrevo antes de qualquer código.

---

## Decisões que travam passos

As 14 decisões do `ESSENCIA.md` (seção 9), mais 3 que o diagnóstico revelou. Você pode responder aos poucos: o que não depende delas anda antes.

| # | Pergunta (resumo) | Trava |
|---|---|---|
| D1 | Qual sorteio é o oficial? | C2 |
| D2 | MVP entra no teto de 500 XP? | C5 |
| D3 | Qual catálogo de badges vale? | C4 |
| D4 | XP pode ficar negativo? | C5 |
| D5 | Ranking semanal respeita o anti-cheat? | C5 |
| D6 | Liga do grupo exige check-in? | C5 |
| D7 | Desempate dos rankings | C5 |
| D8 | O que o co-organizador pode fazer | C6 |
| D9 | Selo "by TECHFERNANDES" | C6 |
| D10 | Lista de espera confirma sozinha? | C6 |
| D11 | Quem registra gol ao vivo | C6 |
| D12 | Quem cria grupo na web | C6 |
| D13 | Avaliação de local só para quem jogou | C6 |
| D14 | Status de jogo traduzido? | C6 |
| **D15** | **As 12 telas Android que nenhuma rota abre: ligar, guardar ou remover, uma a uma?** | C7 |
| **D16** | **Android Auto: remover a declaração vazia do manifesto ou implementar o serviço?** | C1 |
| **D17** | **`UserExtensions.kt:63-66` responde "tem permissão" sempre. Posso apertar para a regra real (o que muda quem consegue fazer o quê)?** | B9 |
| **D18** | **Traduções en/es (568 de 4023 strings): completar, ou tirar os idiomas incompletos do app?** | I1 |

---

## Precisa de você (fora do código)

| Item | Onde | Por quê |
|---|---|---|
| Página do Play dá 404 com a 1.42.0 gravada (#4499) | Play Console → Visão geral da publicação e Status da política | Pode estar em análise, recusada ou esperando "Publicar". **Procure também um aviso de Android para carros**: o manifesto declara um serviço de carro sem classe (DIAGNOSTICO R1) |
| Conta Apple de desenvolvedor (#4395) | developer.apple.com | Sem ela o iOS não publica |
| Política de privacidade (#4392) | texto jurídico | Não cobre CPF, GPS, mensagens, mídia e pagamentos |
| `client_secret` OAuth no script (#4343) | Google Cloud | Você decidiu não trocar agora; fica registrado |
| Search Console (#4455) | Google Search Console | Restaurar o acesso de proprietário |
| Runner `futeba-windows-local` offline | GitHub → Settings → Actions → Runners | Remover o registro (é do PC antigo); faço se você autorizar |
| Plugin context-mode pede Node 24 | dotfiles (chezmoi) | Configuração sua; não mexo |

---

## Onda A: rede de segurança (só testes, nenhum comportamento muda)

Vem primeiro porque tudo o que vem depois se apoia nela.

| Passo | O que | Arquivos | Verificação | Deploy |
|---|---|---|---|---|
| A1 | **Testes de ouro do pipeline de XP.** Jogos sintéticos no formato dos de produção (gols, assistências, vitória, MVP, Bola Murcha, streak, tetos anti-cheat) como entrada; a saída esperada é o que **o código atual** calcula para cada um, congelada no teste. Não uso o XP já gravado em `xp_logs` como gabarito, porque parte dele foi calculada por versões antigas (antes da SECFIX #439). Cobre o `onGameStatusUpdate` inteiro | `functions/test/xp-golden/*.test.ts`, fixtures JSON | `npx jest` verde contra o código atual | nenhum |
| A2 | **Testes de rules para as 28 coleções sem teste**, começando por `challenge_progress` e o FIXME de PII (`firestore.rules:768`). Os testes descrevem o comportamento **atual**, inclusive o que parece errado (marcado `// HOJE PERMITE`) | `firestore-rules-tests/` | emulador verde | nenhum |
| A3 | **Testes de caracterização do Android:** `GameTeamRepositoryImpl` (o embaralhamento de hoje), `CachedGamesPagingSource`, `UserExtensions` | `shared/src/commonTest`, `app/src/test` | `./gradlew :shared:allTests :app:testDebugUnitTest` | nenhum |
| A4 | **Estabilizar os testes da web:** `testTimeout` e `asyncUtilTimeout` ajustados, fake timers onde há espera, o teste de paginação de 2,7 s reescrito | `web/vitest.config.ts`, `web/src/test/setup.ts`, testes lentos | 10 execuções seguidas verdes com a máquina carregada | nenhum |
| A5 | **`typecheck:test` da web de 122 erros para 0** e dentro do CI | `web/src/**/*.test.tsx`, workflow de CI web | CI | nenhum |
| A6 | **Detekt passa a ler `shared` e `composeApp`** (hoje NO-SOURCE). Achados novos vão para o baseline; o objetivo é enxergar, não corrigir | `config/detekt/`, `build.gradle.kts` | `./gradlew detekt` | nenhum |
| A7 | **ESLint da web sem o buraco em `src/pages`:** religa as regras R1 e R2 como aviso (o projeto já as exige no resto) | `web/.eslintrc*` | `npm run lint` sem erro novo | nenhum |

## Onda B: corrigir o que já é prometido (sem decisão de produto)

Cada passo faz o app cumprir uma regra que o `ESSENCIA.md` já documenta. Os números são dos passos, não dos achados do `DIAGNOSTICO.md`.

| Passo | O que | Arquivos | Teste antes | Deploy |
|---|---|---|---|---|
| B1 | Notificação de nível lê os nomes de `shared/xp-constants.json` (níveis 11 a 20 deixam de sair como "Nivel N") | `functions/src/notifications/achievement-notifications.ts` | teste com níveis 10, 11 e 20 | functions |
| B2 | Badge `streak_7` passa a ler `user_streaks`, para jogos novos | `functions/src/badges/` | teste da regra | functions |
| B2b 💾 | (depende de aprovação e de D3) Conceder retroativamente a `streak_7` a quem já tem 7+ jogos seguidos. Muda as badges, e talvez o XP, de usuários existentes. Export antes, script testado no emulador, `--dry-run` com relatório para você ver quem ganha | `scripts/backfill-streak7.ts` | teste do script | script |
| B3 | Limites das divisões lidos do JSON, não fixos no código. Se os números do JSON e os do código divergirem, **volto aqui antes**, porque trocar muda resultados da liga | `functions/src/league.ts:326-328`, `web/src/.../gamification.ts:411-413` | teste comparando com o JSON | functions + hosting |
| B4 | Nomes e regras dos 5 sorteios documentados no código; `GeminiTeamBalancer` ganha comentário de que não usa IA. **Nenhum algoritmo muda** | comentários | nenhum | nenhum |
| B5 | Lista de jogos em cache mostra a contagem real de confirmados | `CachedGamesPagingSource` | A3 | Android 1.43.0 |
| B6 | Widget sem `<View>` (troca por um tipo suportado em RemoteViews, mesmo visual) | `widget_next_game.xml:46,87` | teste instrumentado do widget | Android 1.43.0 |
| B7 | Fim dos vazamentos de Context estático | `RankingViewModel:37`, `StatisticsViewModel:21`, `SmartImageCache:327` | testes de ViewModel | Android 1.43.0 |
| B8 | Investigar as métricas fixas em 0 de `Statistics`. Se o dado existe no servidor, ligar; se não existe, **volto aqui antes**, porque criar o dado é requisito novo | `Statistics` | caracterização | Android 1.43.0 |
| B9 | (depende de D17) Permissão real em `UserExtensions` | `UserExtensions.kt` | A3 | Android 1.43.0 |
| B10 | Rules de `challenge_progress`: descobrir quem grava hoje. Se só o servidor deveria gravar, fechar para o cliente; se o app grava de propósito, **volto aqui antes** | `firestore.rules:4093` | A2 | rules |
| B11 | Teste velho do `mvp-voting` alinhado à tabela real (`LEVEL_TABLE`, `MAX_XP_PER_GAME`) | `functions/test/mvp-voting.test.ts` | ele mesmo | nenhum |
| B12 | iOS: o detalhe do grupo recebe o id do grupo (não o do jogo) e ganha um botão de entrada; Ranking, Badges e Locais ganham entrada na navegação, como no Android | `composeApp/.../App.kt` | teste de navegação no source set novo (G0) | iOS, quando houver conta. Depende do G0, então anda junto com a Onda G |

## Onda C: o que depende das suas decisões

| Passo | Decisão | O que | Observação |
|---|---|---|---|
| C1 | D16 | Android Auto: tirar a declaração vazia do manifesto ✋, ou implementar | **Se o Play Console mostrar recusa ligada a carros, este passo vira o primeiro do plano.** Uma 1.42.1 é um envio novo ao Play, então só sai com o seu OK explícito |
| C2 | D1 | Sorteio oficial único, usado por web, Android e iOS, implementado uma vez no `shared` (e portado para TS, com os mesmos testes de ouro). Inclui não sortear quem está PENDING. Atrás de flag: o embaralhamento atual do Android continua disponível até a flag virar | os outros algoritmos ✋ só depois que o oficial estiver no ar |
| C3 | D1 | Teste de paridade: mesma entrada no KMP e no TS dá os mesmos times | |
| C4 💾 | D3 | Um catálogo de badges só, num JSON compartilhado como o de XP. Script de migração das badges já concedidas, se o catálogo mudar alguma | |
| C5 | D2, D4, D5, D6, D7 | Um passo por decisão, nas functions, sobre os testes de ouro da A1. Por padrão vale só para jogos novos; recálculo retroativo 💾 só se você pedir | |
| C6 | D8 a D14 | Um passo por decisão, na plataforma que diverge | |
| C7 | D15 | Para cada tela órfã: ligar na navegação (com estados de carregando, vazio, erro e sucesso), ou ✋ remover. BlockedPlayers (Android) é forte candidata a ligar: dá ao Android a mesma função de bloquear que a App Store exige do iOS (#4423) | |

## Onda D: arrumar a casa (refatoração sem mudar comportamento)

Só começa depois da Onda A. Os testes de ouro precisam ficar verdes do começo ao fim.

| Passo | O que | Pré-requisito |
|---|---|---|
| D1 | `onGameStatusUpdate` (~1460 linhas em `functions/src/index.ts`) quebrado em módulos: validação, cálculo de XP, gravação, badges, notificações | A1 |
| D2 | `FirebaseDataSource.kt` (4326 linhas) dividido por domínio (jogos, grupos, usuários, locais) | A3 |
| D3 | `CreateGameScreen` da web (2833 linhas) dividido em seções | testes da tela |
| D4 | `location-management.ts` (3624 linhas) dividido | testes existentes |
| D5 | `firestore.rules` (4697 linhas): funções repetidas viram helpers, comentários de seção. Nada de permissão muda | A2 |
| D6 ✋ | Remover código morto das functions: `admin-notifications`, `fake-notifications`, `rate-limiter.example`, `migration-example`, `parallel-processing`, `xp/processing.ts` | grep de uso no PR |
| D7 ✋ | Remover código morto do app e do shared: `processGameLegacy`, `XPCalculator.kt` do app, `EditGameUseCase`, as 12 classes do `shared` sem uso, rotas `InviteFriend`/`DreamTeam`/`GroupChallenges` sem tela | grep de uso no PR; as telas órfãs ficam para a C7 |
| D8 | Room: `exportSchema = true`, com o schema atual versionado, para as próximas migrações serem verificáveis | A3 |
| D9 | `leaderboard-cache.ts:1380`: consulta duplicada vira uma | testes existentes |

## Onda E: dependências (um passo para cada troca grande)

A missão proíbe trocar biblioteca central sem justificar. Por isso cada linha diz o que se ganha. Onde o ganho é fraco, a recomendação é **manter** enquanto a versão atual receber correções, e o passo fica opcional. Os PRs do Dependabot (#4456, #4459, #4460, #4463, #4465) são fechados e refeitos aqui, um pacote por vez.

| Passo | Troca | Ganho concreto | Risco | Recomendação |
|---|---|---|---|---|
| E1 | ESLint 8 → 9 (flat config) na web | o 8 está fora de suporte e não recebe mais correção; destrava os plugins novos | baixo | fazer |
| E2 | Ações do GitHub (#4460) e rules-tests (#4463) | manter as ações em versões que ainda recebem correção (confirmo nas notas de cada ação, no próprio PR) | baixo | fazer |
| E3 | Firebase BoM 33.7 → 35.1 (Android) | um ano de correções do SDK do Firebase (Auth, App Check, Firestore); listo as relevantes no PR antes de trocar | médio | fazer, depois da 1.42.0 publicada |
| E4 | Retrofit 2.9 → 3.0 | pouco: o app usa Retrofit em poucos pontos | baixo | manter, a menos que outra troca exija |
| E5 | Vico 1.14 → 3.3 (gráficos do Android) | a linha 1.x ficou para trás (confirmo o suporte no PR); a 3.3 corrige um crash de gráfico no Android 10 | médio (API nova; mesmo visual) | fazer, isolado |
| E6 | Compose BOM 2025.09 → atual | 14 meses de correções de desempenho e acessibilidade do Compose, ligado ao épico de performance do Android (#4400) | médio | fazer, depois da E3 |
| E7 | firebase-admin 13 → 14 e Firebase JS 12 → 13 | só quando a linha atual entrar em fim de suporte, ou quando precisarmos de recurso novo | médio | manter por enquanto |
| E8 | TypeScript 5.9 → 7 (functions, depois web) | compilador nativo, build e lint bem mais rápidos no CI | médio | fazer, depois da E1 |
| E9 | MUI 5 → 9 (um passo por major, com x-date-pickers junto) | o MUI 5 só recebe correções de segurança; a migração destrava o React 19 e o Grid novo | alto (a web inteira usa MUI) | **manter** enquanto o 5 tiver correção; refazer a avaliação a cada trimestre |
| E10 | React 18 → 19 | recursos novos, sem ganho imediato para o usuário | médio | manter; só depois da E9 |
| E11 | Vitest 4 → 5, date-fns 3 → 4, eslint-plugin-react-hooks 4 → 7 | o plugin de hooks novo pega erros de hooks que já causaram bug aqui (regra do CLAUDE.md) | baixo | fazer o plugin; os outros, junto com ele se forem triviais |

## Onda F: desempenho da web

| Passo | O que | Meta |
|---|---|---|
| F1 | Idiomas do i18n carregados sob demanda (443 KB fora do boot) | boot < 1,5 MB |
| F2 | Ícones do MUI por import direto; `firebase/functions` e `firebase/storage` só quando usados | |
| F3 | Orçamento de bundle no Lighthouse CI que já roda | o CI falha se o boot crescer |

## Onda G: iOS com paridade

As issues já existem. Ordem: primeiro o que a App Store exige, depois o fluxo central do jogo.

| Passo | Issue | O que |
|---|---|---|
| G0 | #4433 | Source set de testes no `composeApp` |
| G1 | #4423 | Bloquear e denunciar com efeito no servidor |
| G2 | #4434 | Confirmar e cancelar presença |
| G3 | #4435 | Lista de espera |
| G4 | #4437 | Criar jogo |
| G5 | #4436 | Votação MVP e Bola Murcha |
| G6 | #4426 | Universal links e AASA |
| G7 | B9 do DIAGNOSTICO | "Entrar com Google" de verdade e "Esqueci a senha" funcionando |
| G8 | #4428, #4432 | Avisos de API depreciada; QA de modo escuro e fonte grande |

## Onda H: ambiente e documentação (Mac)

Pode andar em paralelo com qualquer onda, porque não toca código de produto.

| Passo | O que |
|---|---|
| H1 | Tirar o `C:/TEMP` de `app/build.gradle.kts:146,158-164` e o `overridePathCheck` de `gradle.properties:56-57`, com build limpo no Mac provando que nada muda |
| H2 | `firestore-rules-tests/package.json`: `JAVA_HOME` vindo do mise, não do caminho do Homebrew |
| H3 | Docs de runner WSL: arquivadas em `docs/archive/` (não apagadas) e `docs/CI_RUNNERS.md` reescrito para a topologia atual (Mac + oci-prod01) |
| H4 | `CLAUDE.md` e `AGENTS.md`: tabela de XP certa, versões atuais, caminhos que existem, iOS como plataforma |
| H5 | `docs/BUSINESS_RULES.md` e a skill `futeba-xp-validate` alinhados ao `ESSENCIA.md` |
| H6 | `ESSENCIA.md`, `DIAGNOSTICO.md` e `PLANO.md` versionados em `docs/modernizacao/` (este é o primeiro PR, logo depois da sua aprovação) |

## Onda I: qualidade visual e textos

| Passo | O que |
|---|---|
| I1 | (depende de D18) Traduções en/es |
| I2 | Cores fixas trocadas por tokens do tema: app (40 `Color.White/Black`, os 74 `Color(0x…)` fora das telas órfãs) e web (`pages/growth`), sem mudar o visual no tema claro |
| I3 | Os 23 `Text("…")` literais para `strings.xml` |
| I4 | Lint do Android: as 261 entradas obsoletas saem do baseline; `LocalContextGetResourceValueCall` e `NonObservableLocale` corrigidos |
| I5 | `RestrictedApi` do `DynamicThemeEngine` trocado por API pública |

---

## Ordem sugerida

1. **H6** (versionar os três documentos).
2. **Onda A** inteira. Os passos são independentes e podem correr em paralelo, cada um no seu branch.
3. **B1, B2, B3, B11** (functions e web, saem já).
4. **B5, B6, B7** e as respostas que chegarem (C1, C2…), acumulando para a Android 1.43.0.
5. **E1, E2, H1 a H5** no meio do caminho, porque são baratos.
6. **Onda D**, com a Onda A verde.
7. **Ondas E (resto), F, G e I**, na ordem que você preferir.

## Como aprovar

Responda com uma destas, ou com a sua versão:

- "Aprovo o plano, stack mantida." Começo pela H6 e pela Onda A.
- "Aprovo só as ondas X e Y."
- As decisões D1 a D18 podem vir junto ou depois.
