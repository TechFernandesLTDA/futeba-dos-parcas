# Reconciliação de releases — 2026-10-07

Stream: release-reconciliation · Issues: #4198, #4199, #4200 (epic #4188)
Escopo: evidência ao vivo + proposta ao coordenador. Nenhum deploy, tag, release ou publicação foi feito nesta reconciliação.
Não contém segredos. Comandos com `gcloud` usam `--project=futebadosparcas` explícito (o projeto ativo local é outro).

## 1. Matriz de entrega

| Plataforma | Versão (versions.json = arquivo nativo) | Tag → commit | GitHub Release | Artefato anexado | Run da tag (release.yml/deploy) | Evidência ao vivo | Notes no repo | Firestore `release_notes` | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Web | 1.57.0 (web/package.json) | web-v1.57.0 → 5f5e87a3 | sim, 2026-10-07T02:20:43Z, não-Latest | n/a | startup_failure | Hosting live: release 3a3e567908ef1a0b (2026-10-07T19:31:00Z), bundle index-DXtG7jX-.js contém "1.57.0", 0 ocorrências de demo-api-key / host de emulador / VITE_USE_EMULATOR; /release-notes.json HTTP 200, 174 notas, topo web 1.57.0 | release-notes/web/1.57.0.md published:true | AUSENTE (web_1.57.0) | Deployado (manual). Notes incompletas (ver D6, D7). Firestore não atualizado. |
| Functions | 1.13.0 (functions/package.json) | functions-v1.13.0 → 5f5e87a3 | sim, 2026-10-07T02:20:46Z | n/a | startup_failure | 173/173 funções ACTIVE, nodejs22, updateTime 2026-10-07T03:27:06Z–03:31:40Z; source zip (gcf-v2-sources, exemplo acceptLocationManagerInvite) com package.json 1.13.0 e marcadores do release; functions/ sem commits após 5f5e87a3 | CHANGELOG apenas (por política) | n/a por política | Deployado por conta de usuário (D4), não por service account. |
| Android | 1.40.0 build 81 (app/build.gradle.kts) | android-v1.40.0 → 5f5e87a3 | sim, 2026-10-07T02:20:44Z | NENHUM (assets=[]) | startup_failure | Nenhuma evidência de Play Internal/produção | release-notes/android/1.40.0.md published:true | AUSENTE (android_1.40.0) | Não publicado comprovado. Só tag + GitHub Release sem AAB/APK. |
| iOS | 1.8.0 build 24 (Info.plist) | ios-v1.8.0 → 5f5e87a3 | sim, 2026-10-07T02:20:47Z, marcado "Latest" | NENHUM | startup_failure | Nenhuma evidência de TestFlight/App Store | release-notes/ios/1.8.0.md published:TRUE (D3) | n/a por política (iOS não publica no Firestore) | Não publicado comprovado. |

Estado de validação de todas as plataformas: `versions.json` e arquivos nativos batem (Android 1.40.0/81, iOS 1.8.0/24, Web 1.57.0, Functions 1.13.0).

## 2. Linha do tempo (UTC)

- 2026-10-07 02:20:28Z — PR #4176 mergeado; commit de release 5f5e87a3; tags e GitHub Releases criados em 02:20:43–02:20:47Z.
- 02:22:16Z — Hosting release b69aa0235bc7e419 (bundle index-_XKbmE9c.js).
- 03:27:06Z–03:31:40Z — 173 Functions atualizadas (cli-firebase). Três UpdateFunction no audit log (generateProfileThumbnail x2, generateGroupThumbnail) por rlocatizfernandes@gmail.com.
- 03:32:58Z — Regras do Firestore atualizadas (ruleset ae0f3d8d-c5ba-4822-8aee-d74ee4d058ab).
- 03:34:06Z — PR #4209 (join por convite) mergeado, commit 20f72290.
- 03:38:26Z — Hosting release 25d2e005b1f97565 (bundle index-tq2kvbJ_.js).
- 19:31:00Z — Hosting release 3a3e567908ef1a0b (bundle index-DXtG7jX-.js) — versão ao vivo mais recente.
- 23:03:42Z — PR #4215 mergeado (índices), commit 39c46a57 (= origin/master em 2026-10-07).

## 3. Verificações de consistência

- Índices Firestore: 176 ao vivo = 176 no firestore.indexes.json (0 faltando, 0 extras), todos READY. Comparação normalizada por collectionGroup/queryScope/campos.
- Regras Firestore: ruleset ao vivo (220826 chars, sha256 4629b76e…) = firestore.rules de 20f72290 = origin/master. Diferente do commit de release (5f5e87a3, sha256 6e27a828…).
- Código de produção do web mudou após o release apenas em web/src/hooks/useGroups.ts (#4209). Demais diffs pós-release são testes/e2e.
- Pós-release em código: web (6 commits), firestore.rules e firestore.indexes.json. Functions, Android, iOS, shared, composeApp, iosApp e scripts/data: 0 commits.
- `node scripts/release-notes.js changelog` regenerou CHANGELOG.md sem diff (CHANGELOG em sincronia).
- `node scripts/release-notes.js bundle` alterou só o campo generatedAt dos 4 JSON embarcados; descartado (git checkout), não commitado.

## 4. Discrepâncias

D1. GitHub Releases de Android (1.40.0) e iOS (1.8.0) não têm artefatos anexados (assets=[]). release.yml prevê AAB/APK anexado; o run da tag falhou (startup_failure).
D2. Firestore release_notes: coleção com 67 documentos (web 53, android 14). Faltam 118 web e 5 android com published:true no repo, inclusive web_1.56.0–1.56.9, web_1.57.0, android_1.40.0. release.yml só publica Android (linha 236); web não tem passo de publish automatizado.
D3. ios/1.8.0.md tem published: true. RELEASE_PROCESS.md exige que a nota iOS mais recente fique published: false enquanto o iOS não está na App Store (ios/1.7.2.md está false).
D4. Functions deployadas por conta de usuário (audit log, principal rlocatizfernandes@gmail.com), não por service account. Critério "deploy com service account" de #4200 não atendido.
D5. Todos os runs de tag e de push em master desde 2026-10-06 terminaram em startup_failure (GitHub Actions). Logo, nenhum passo automatizado de release (Android AAB, publish de notas, deploy de produção) foi comprovado. Isso não prova impossibilidade de builds locais.
D6. Notas do web 1.57.0 omitem mudanças de produto do próprio release (estão no commit 5f5e87a3): #4181 (atribuição Tech Fernandes na Sobre + alvos de toque 44px na landing) e #4208 (a11y do rail colapsado). Não há nota para elas.
D7. Sem notas para mudanças de produto pós-release (master, não publicadas por nenhuma plataforma): #4209 (web: join por convite em grupo privado; firestore.rules) e #4215 (índices/queries de jogos, firestore.indexes.json).
D8. gcloud do host tem projeto ativo `minanafest` e conta `renankakinho69@gmail.com`. Consultas deste relatório usaram `--project=futebadosparcas` explicitamente. Operações de deploy devem fixar o projeto.
D9. Build web ao vivo (3a3e56, 19:31Z) é diferente dos builds de 02:22Z e 03:38Z. Não é possível provar pelo bundle se inclui #4209. Hosting não registra SHA; atribuição exige build reproduzível do master e comparação de hash.
D10. Epic #4188 (corpo, 05/10) lista versões antigas (Web 1.56.9, Android 1.39.5, iOS 1.7.2, Functions 1.12.6) e sub-tarefas de Android build 81 e iOS build 24 que já existem como tag/Release mas sem evidência de publicação. Corpo do epic deve ser atualizado pelo coordenador.
D11. GitHub marca iOS 1.8.0 como "Latest", enquanto a versão Web/Android/Functions mais recente não tem essa marca. Pode confundir quem lê a Release.

## 5. Matriz de critérios (issues)

#4198 — Notes "pós-05/09" para cada plataforma. Parcial: notas de release existem para 1.40.0 Android, 1.8.0 iOS, 1.57.0 Web e 1.13.0 Functions. Faltam: mudanças de produto sem nota (D6, D7) e a flag iOS (D3). Não recomendo fechar.

#4199 — Release Web (bump + tag + GitHub Release + deploy Hosting). Evidência: bump em versions.json, web/package.json, tag web-v1.57.0 → 5f5e87a3, GitHub Release, deploy ao vivo (bundle com 1.57.0, sem demo-api-key/emulador). Pendências: Firestore web_1.57.0 ausente (D2); bundle ao vivo sem atribuição a commit (D9). Recomendo fechar somente após D2 resolvido e decisão sobre D6/D7 (coordenador).

#4200 — Release Functions (deploy com service account). Evidência: 173 funções ACTIVE em nodejs22; source package com version 1.13.0; tag e Release; sem mudança em functions/ depois do release. Não atendido: deploy por conta de usuário (D4). Recomendo não fechar até o coordenador decidir se a exigência de service account é mandatória ou se aceita deploy por usuário autenticado.

#4188 (epic) — Não recomendo fechar: Android e iOS não têm evidência de publicação (D1, D5), e as sub-tarefas do epic seguem abertas no corpo.

## 6. Proposta de notes pendentes (para o coordenador decidir a versão)

Não criei arquivos em release-notes/ nem alterei versions.json: versão nova é decisão de release do coordenador. Sugestão para um patch Web (ex.: 1.57.1), a confirmar:

- Produto (web): "Entrar em grupo por convite volta a funcionar em grupos privados." (#4209). Ajuste de regras e índices de jogos (#4215): "Listas de jogos voltam a carregar com regras de privacidade atualizadas." Impacto exato a confirmar pelo coordenador antes de publicar.
- Produto (web, já no 1.57.0 mas sem nota): "Sobre mostra a atribuição Tech Fernandes e a landing tem alvos de toque maiores no celular." (#4181) e "Rail lateral colapsado com foco de teclado corrigido." (#4208).
- Interno (sem nota de usuário): #4210–#4214 (testes unitários), #4204 e #4207 (testes E2E), #4178, #4179, #4183, #4116 e e140907a (CI/governança), #4176 (release).
- Dados operacionais: #4182, #4205, #4206 (importação e enriquecimento de quadras em produção). Confirmar se aparece no app antes de classificar como produto.
- Android e iOS: nenhuma mudança após os respectivos commits de release; sem nota nova necessária.
- Functions: nenhuma mudança após 1.13.0; sem nota nova necessária.

## 7. Próximos passos sugeridos ao coordenador

1. Decidir versão e formato do patch web com as notas da seção 6, após revisão de Vera. Publicação e tag são do coordenador.
2. Publicar web_1.57.0 no Firestore manualmente se for política: `node scripts/release-notes.js publish --platform web --version 1.57.0` com credencial de service account do próprio coordenador (não colocar credencial em log ou commit).
3. Corrigir ios/1.8.0.md para published: false (ou registrar exceção por escrito), via PR própria.
4. Verificar Play Internal e TestFlight por consulta de console (fora do alcance desta reconciliação) antes de declarar Android/iOS publicados.
5. Decidir se deploy de Functions por conta de usuário é aceito para #4200 ou se exige service account.
6. Atualizar o corpo do epic #4188 com estado atual (fora desta tarefa; não editado aqui).
