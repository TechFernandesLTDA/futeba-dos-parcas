# SPEC: iOS TestFlight Setup

| Campo | Valor |
|-------|-------|
| **ID** | IOS_TESTFLIGHT_SETUP |
| **Status** | DEFERRED (rota free via [BOOTSTRAP_FREE.md](../iosApp/BOOTSTRAP_FREE.md) ativa por enquanto — retomar quando decidir pagar $99/ano) |
| **Autor** | Renan Locatiz Fernandes |
| **Criado em** | 2026-05-11 |
| **Tipo** | Infra / CI / Release Pipeline |
| **Depende de** | IOS_BUILD_SETUP.md (concluído 2026-05-07) |
| **Bloqueado por** | Conta Apple Developer Program (Organization, ~1-2 semanas) |

---

## 1. Requirements

### 1.1 Problema / Oportunidade

App iOS está com KMP framework linkado e `xcodebuild` smoke build OK desde 2026-05-07, mas **sem caminho pra distribuir** pra testers. Web e Android já têm pipeline (Hosting + Play Store Internal Testing); iOS é o gap.

TestFlight é o canal oficial Apple pra beta testing — equivalente ao Firebase App Distribution / Internal Testing do Play Store, mas obrigatório para iOS (não tem alternativa legal pra apps não-públicos com distribuição massiva).

### 1.2 Casos de Uso

1. **Time interno** instala beta no iPhone via TestFlight (até 100 testers internos sem revisão Apple)
2. **Beta público convidado** (até 10.000 testers externos, com revisão Apple de 1-2 dias)
3. **CI auto-deploy** em tag `ios-v*.*.*` envia para TestFlight automaticamente
4. **Release manager** dispara deploy manual via `fastlane ios beta`

### 1.3 Critérios de Aceite

- [ ] Conta Apple Developer Program (Organization) ativa pra TechFernandes LTDA
- [ ] App ID `com.futebadosparcas` registrado no Apple Developer Portal com capabilities (Push, Sign in with Apple, Background Modes, Location)
- [ ] App criado no App Store Connect com pt-BR primary language
- [ ] App Store Connect API Key gerada e armazenada em GH Secrets
- [ ] Signing configurado (decisão `match` vs Automatic — ver §3.2)
- [ ] `fastlane ios beta` local: arquiva + assina + sobe pro TestFlight com sucesso
- [ ] Workflow CI `.github/workflows/ios-deploy.yml` reproduz o fluxo em self-hosted macOS runner
- [ ] Tester (Renan) recebe convite TestFlight, instala via app TestFlight, abre app
- [ ] Documentação em `iosApp/SETUP.md` com runbook completo

### 1.4 Fora de Escopo

- App Store **release público** (escopo de outra spec, depende de revisão Apple)
- Push Notifications certificate setup (escopo separado — depende de APNs)
- In-app purchases / StoreKit
- iCloud / CloudKit
- Migração de Individual → Organization (vamos direto pra Organization)

---

## 2. UX/UI Design

N/A — esta spec é infra de release, sem UI nova. Reaproveita ContentView atual (placeholder smoke test).

---

## 3. Technical Design

### 3.1 Arquitetura do Pipeline

```
DEV LOCAL                            CI (self-hosted macOS runner)
─────────                            ─────────────────────────────
fastlane ios beta                    git tag ios-v1.0.0
    │                                    │
    ├─ build_shared.sh                   ├─ checkout
    ├─ xcodegen generate                 ├─ runner labels: [self-hosted, macOS, ARM64]
    ├─ pod install                       ├─ fastlane ios beta (mesmo fluxo)
    ├─ xcodebuild archive                │
    ├─ xcodebuild -exportArchive         │
    └─ pilot upload (App Store           ▼
       Connect API Key)         TestFlight (Internal Testers)
                                         │
                                         ▼
                                    Renan (iPhone) recebe convite
```

### 3.2 Signing Strategy: `fastlane match` (decidido)

**Decisão:** Usar `fastlane match` (vs Xcode Automatic Signing).

**Justificativa:**
- Self-hosted macOS runner não tem GUI pra Xcode resolver signing automático
- `match` centraliza certs+profiles em repo privado git criptografado — runner clona, decripta, usa
- Funciona em local e CI sem divergência
- Padrão da comunidade pra CI iOS

**Setup:**
- Repo privado novo: `TechFernandesLTDA/futeba-ios-certificates` (separado, **NUNCA** público)
- Branch `master` armazena `certs/` + `profiles/` criptografados
- Senha de decriptação: GH Secret `MATCH_PASSWORD` (32+ chars random)
- Renan tem acesso ao repo via SSH key configurada no runner

**Alternativa rejeitada:** Automatic Signing — quebra em CI headless.

### 3.3 Bundle ID e App ID

- **Bundle ID:** `com.futebadosparcas` (igual project.yml atual)
- **App ID Description:** "Futeba dos Parças"
- **Capabilities habilitadas no App ID:**
  - Push Notifications
  - Sign in with Apple
  - Associated Domains (pra deeplinks futuros)
  - Time Sensitive Notifications (Background Modes)

### 3.4 Arquivos a Criar/Modificar

| Arquivo | Tipo | Conteúdo |
|---------|------|----------|
| `iosApp/project.yml` | MODIFY | `DEVELOPMENT_TEAM: "<TEAM_ID>"`, release config com `CODE_SIGN_STYLE: Manual` + `PROVISIONING_PROFILE_SPECIFIER: "match AppStore com.futebadosparcas"` |
| `iosApp/exportOptions.plist` | NEW | Config export Archive→IPA (method: app-store, teamID, provisioningProfiles dict) |
| `fastlane/Fastfile` | MODIFY | Adicionar `platform :ios do` com lanes: `setup_match`, `build_ios`, `beta` (alias `beta_ios` pra não conflitar com Android) |
| `fastlane/Appfile` | MODIFY | `apple_id`, `team_id`, `itc_team_id`, `app_identifier` |
| `fastlane/Matchfile` | NEW | URL repo certs, `type("appstore")`, storage mode `git` |
| `.github/workflows/ios-deploy.yml` | NEW | Trigger: `push` tag `ios-v*` + `workflow_dispatch`. Runner: self-hosted macOS ARM64. Steps: checkout → setup ruby → fastlane ios beta |
| `iosApp/SETUP.md` | MODIFY | Atualizar §"Próximos passos" → §"TestFlight Release Runbook" |
| `specs/DECISIONS.md` | MODIFY | Registrar decisão `match` vs `Automatic` |
| `.gitignore` | MODIFY | Garantir `*.p8`, `AuthKey_*.p8`, `fastlane/*.p8` ignorados |

### 3.5 Segurança

**GH Secrets necessários:**

| Secret | Origem | Uso |
|--------|--------|-----|
| `APPLE_TEAM_ID` | developer.apple.com → Membership | project.yml, Fastfile |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect → Users and Access → Integrations | pilot upload |
| `APP_STORE_CONNECT_ISSUER_ID` | mesmo lugar | pilot upload |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | `.p8` baixado (base64 encoded) | pilot upload |
| `MATCH_PASSWORD` | gerar random 32+ chars | decriptar repo certs |
| `MATCH_GIT_URL` | URL SSH do `futeba-ios-certificates` | match clone |
| `MATCH_GIT_SSH_KEY` | SSH private key com acesso ao repo certs | match clone em CI |

**Setar via skill `/futeba-gh-secrets`** (workaround `$digit`, paths mascarados, multiline).

**Repo de certs:** privado obrigatório. Acesso apenas via SSH key dedicada (não usar PAT do Renan).

### 3.6 Performance

- Archive + sign local: ~3-5 min num MacBook M-series
- Upload TestFlight via pilot: ~1-3 min (depende internet)
- Total CI: ~8-12 min (incluindo `:shared` framework build pra device iOS arm64)

### 3.7 Observabilidade

- Workflow `ios-deploy.yml` envia status pro mesmo canal que `deploy-production.yml` (se Slack webhook existir; senão GitHub Actions UI)
- Logs do pilot incluem upload progress e App Store Connect processing status
- Falhas comuns documentadas em `iosApp/SETUP.md` troubleshooting

---

## 4. Tasks (Breakdown)

### Fase 0: Pré-requisitos manuais (Renan, bloqueante)
- [ ] **T0.1** Submeter D-U-N-S Number request com CNPJ TechFernandes LTDA
- [ ] **T0.2** Enroll Apple Developer Program como Organization
- [ ] **T0.3** Aguardar aprovação Apple (typical 1-2 semanas total)
- [ ] **T0.4** Após aprovação: gerar App Store Connect API Key
- [ ] **T0.5** Compartilhar com Claude: Team ID, Key ID, Issuer ID, conteúdo `.p8`

### Fase 1: Setup repo de certificados
- [ ] **T1.1** Criar repo `TechFernandesLTDA/futeba-ios-certificates` (privado, vazio)
- [ ] **T1.2** Gerar SSH key dedicada pra esse repo
- [ ] **T1.3** Adicionar deploy key no repo certs
- [ ] **T1.4** Configurar SSH key no self-hosted runner

### Fase 2: Apple Developer Portal (após T0)
- [ ] **T2.1** Registrar App ID `com.futebadosparcas` com capabilities
- [ ] **T2.2** Criar app no App Store Connect (SKU, pt-BR, bundle ID)
- [ ] **T2.3** Adicionar Renan como Internal Tester

### Fase 3: Fastlane match setup (pode rodar antes de T0 se simular com placeholders)
- [ ] **T3.1** Criar `fastlane/Matchfile`
- [ ] **T3.2** Rodar `fastlane match appstore` local → gera certs + profile, sobe no repo certs
- [ ] **T3.3** Validar: `fastlane match appstore --readonly` baixa e usa

### Fase 4: Fastfile + project.yml
- [ ] **T4.1** Adicionar `platform :ios do` no Fastfile com lanes `build_ios`, `beta`
- [ ] **T4.2** Atualizar `iosApp/project.yml` com Team ID e signing manual pra Release
- [ ] **T4.3** Criar `iosApp/exportOptions.plist`
- [ ] **T4.4** Atualizar `fastlane/Appfile` com apple_id, team_id

### Fase 5: GitHub Secrets + CI workflow
- [ ] **T5.1** Setar todos secrets via `/futeba-gh-secrets`
- [ ] **T5.2** Criar `.github/workflows/ios-deploy.yml`
- [ ] **T5.3** Testar workflow via `workflow_dispatch` manual

### Fase 6: Smoke release
- [ ] **T6.1** Bump version pra `1.0.0` (iOS standalone — Android continua em 1.22.x)
- [ ] **T6.2** Tag `ios-v1.0.0` no master
- [ ] **T6.3** Workflow dispara, faz upload TestFlight
- [ ] **T6.4** Renan recebe convite, instala, valida smoke screen abre

### Fase 7: Docs + decisões
- [ ] **T7.1** Atualizar `iosApp/SETUP.md` com runbook TestFlight
- [ ] **T7.2** Registrar decisão `match` vs Automatic em `specs/DECISIONS.md`
- [ ] **T7.3** Atualizar memory: project_ios_testflight_live.md

---

## 5. Verification

### 5.1 Testes

- **Local:** `fastlane ios beta` num MacBook → upload OK
- **CI:** workflow_dispatch manual no GH Actions → upload OK em self-hosted runner
- **TestFlight:** Renan recebe email, instala via app TestFlight, abre, vê smoke screen

### 5.2 Checklist de Revisão

- [ ] Bundle ID `com.futebadosparcas` consistente em project.yml + App ID + App Store Connect
- [ ] Team ID não comitado em código (apenas via secret/env)
- [ ] `.p8` API key não comitado (`.gitignore` cobre)
- [ ] Repo `futeba-ios-certificates` privado e com deploy key dedicada
- [ ] `MATCH_PASSWORD` >= 32 chars
- [ ] Workflow CI usa self-hosted runner com label `macOS` (não `macos-latest` GitHub-hosted — custa $$$)
- [ ] Build em CI consegue baixar certs via SSH (testar antes do primeiro upload)
- [ ] Smoke build local antes de cada release CI (evita queimar TestFlight build number à toa)

### 5.3 Demo

Após T6.4: vídeo curto Renan instalando via TestFlight + abrindo app.

---

## 6. Notas e Referências

### Custos
- Apple Developer Program: **$99 USD/ano** (renovação automática)
- Self-hosted runner: $0 (já existe pool de 8 no MacBook do Renan)
- D-U-N-S: $0
- GitHub Actions minutos: $0 (self-hosted)

### Referências
- [Apple Developer Enrollment](https://developer.apple.com/programs/enroll/)
- [D-U-N-S Number request](https://developer.apple.com/enroll/duns-lookup/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [fastlane match docs](https://docs.fastlane.tools/actions/match/)
- [fastlane pilot docs](https://docs.fastlane.tools/actions/pilot/)
- [TestFlight overview](https://developer.apple.com/testflight/)

### Links internos
- `specs/IOS_BUILD_SETUP.md` — spec da reativação iOS (2026-05-07)
- `iosApp/SETUP.md` — runbook iOS atual
- `.github/workflows/ios-build.yml` — workflow de build (não-deploy) existente
- Skill `/futeba-gh-secrets` — para setar secrets corretamente
- Skill `/futeba-runner` — para gerenciar self-hosted runners
- Skill `/futeba-kmp-build` — para builds KMP shared/composeApp

### Decisões pendentes
- D1: Versionamento iOS — começar em `1.0.0` ou seguir Android (`1.22.0`)? **Proposta:** começar em `1.0.0` (build iOS é primeiro release público; Android está em 1.22 por histórico)
- D2: TestFlight Internal vs External Testing — começar Internal (até 100 testers, sem revisão Apple). External quando tiver UX validada.
- D3: Distribuir apenas pro Renan ou já adicionar early adopters? **Proposta:** só Renan na Fase 6, expandir Fase 8 (out-of-spec).

---

## 7. Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-11 | Renan | Spec criada, status DRAFT |
