<!-- markdownlint-disable MD013 -->

# Processo de Release

Como cortar um release do Futeba dos Parças ponta a ponta. O versionamento é
**independente por plataforma** (`android`, `web`, `ios`, `functions`) — cada uma
tem sua própria cadência e número.

Referências:
[`versions.json`](../versions.json) ·
[`release-notes/README.md`](../release-notes/README.md) ·
[`CHANGELOG.md`](../CHANGELOG.md) ·
spec [`feat-2026-05-22-version-control-release-notes.md`](../specs/feat-2026-05-22-version-control-release-notes.md)

## Politica obrigatoria de versao e GitHub

Toda alteracao publicada para usuarios precisa sair com rastreabilidade completa:

- Versao atualizada para cada plataforma afetada (`web`, `android`, `ios`,
  `functions`) em `versions.json` e no arquivo nativo correspondente.
- Web deve atualizar tambem `web/package.json`, metadados exibidos em
  Sobre/About, release notes, `CHANGELOG.md` e o bundle publicado no Hosting.
- `release-notes/<plataforma>/<versao>.md` deve existir antes da tag/release,
  exceto quando a mudanca for explicitamente interna e sem impacto em usuarios.
- `README.md`, README da plataforma e docs relevantes devem ser atualizados
  quando a mudanca altera comportamento, setup, deploy, seguranca ou processo.
- GitHub deve ter PR limpo, Conventional Commit, issue/epic vinculado, CI verde,
  squash merge, tag de versao e GitHub Release com notas claras.
- A comunicacao final do deploy deve informar plataforma(s), versao(oes),
  tag/release, changelog/release notes, URLs publicadas e pendencias.

Se uma correcao emergencial precisar ir ao ar antes de uma tag formal, abra uma
issue/PR de follow-up no mesmo dia para completar versionamento, changelog, tag e
GitHub Release. Nao deixe deploy user-visible sem fechamento de release.

## Peças do sistema

| Peça | Papel |
| --- | --- |
| `versions.json` | Registro central das versões correntes; fonte de verdade legível por máquina. |
| `scripts/bump-version.js` | Sobe a versão de uma plataforma em `versions.json` + no arquivo nativo. |
| `release-notes/<plataforma>/<versão>.md` | **Fonte única** das notas de cada release (1 arquivo por versão). |
| `scripts/release-notes.js` | Pipeline: `validate`, `changelog`, `bundle`, `publish`. |
| `CHANGELOG.md` | Gerado: bloco `AUTOGEN` vem dos arquivos-fonte; "Histórico anterior" é legado preservado. |
| `app/.../assets/release-notes.json` etc. | JSON de fallback embarcado (offline). Um por plataforma cliente. |
| Firestore `release_notes` | Canal dinâmico lido pelos apps. Populado pela CI via Admin SDK. |

## Passo a passo — cortar um release

Exemplo: subir o **Android** de `1.26.0` para `1.27.0`.

### 1. Garanta que `master` está verde

Todas as PRs da release já mergeadas; CI verde.

### 2. Suba a versão

```bash
node scripts/bump-version.js android minor
```

Como alternativa, dispare manualmente o workflow
`Prepare Android Version Bump`, escolha `patch`, `minor` ou `major` e complete a
PR rascunho criada por ele. O workflow nunca roda em pushes comuns ao `master`
e não cria tag nem GitHub Release: esses artefatos só podem ser publicados a
partir do commit já mesclado e validado.

- Atualiza `versions.json` (`android.version`, `android.buildNumber`).
- Atualiza o arquivo nativo (`app/build.gradle.kts`).
- Sem o nível (`major|minor|patch`), o script infere por Conventional Commits
  desde a última tag.

Mapa plataforma → arquivo nativo:

| Plataforma | Arquivo nativo |
| --- | --- |
| `android` | `app/build.gradle.kts` (`versionName` + `versionCode`) |
| `web` | `web/package.json` (versão também derivada de `versions.json` no build) |
| `ios` | `iosApp/iosApp/Info.plist` (`CFBundleShortVersionString` / `CFBundleVersion`) |
| `functions` | `functions/package.json` |

### 3. Escreva as notas do release

Crie `release-notes/android/1.27.0.md` seguindo
[`release-notes/README.md`](../release-notes/README.md). Resumo do formato:

- Frontmatter: `platform`, `version`, `buildNumber` (android/ios), `date`,
  `type`, `showPopup`, `milestone` — mais `issues`/`prs`/`published` opcionais.
- `## Para o usuário`: `### Headline` (1 item), `### Destaques` (até 3, no DSL
  `icon=nome | Título | Descrição`), `### Novidades`, `### Melhorias`,
  `### Correções`.
- `## Técnico`: subseções Keep a Changelog (`Added`, `Changed`, `Fixed`...).
- Cada item de lista cabe em **uma linha**.

### 4. Valide e regenere os artefatos

```bash
node scripts/release-notes.js validate
node scripts/release-notes.js changelog   # regenera o bloco AUTOGEN do CHANGELOG.md
node scripts/release-notes.js bundle      # regenera os JSON de fallback embarcados
```

`validate` falha (exit ≠ 0) se qualquer arquivo-fonte violar o formato.

### 5. Commit + PR

Commit dos artefatos gerados junto com a versão:

```text
chore(release): android 1.27.0
```

Arquivos no commit: `versions.json`, `app/build.gradle.kts`,
`release-notes/android/1.27.0.md`, `CHANGELOG.md`,
`app/src/main/assets/release-notes.json`. Abra a PR, faça o merge (squash).

### 6. Tag de release

Depois do merge em `master`, crie a tag `android-vX.Y.Z`. Nunca crie, mova ou
publique a tag a partir da branch da PR. O push da tag dispara
`release.yml`, que:

1. constrói o AAB/APK assinados;
2. anexa AAB/APK diretamente do workspace de build e cria o GitHub Release,
   sem usar o armazenamento intermediário de artifacts do Actions;
3. no job `publish-release-notes`, roda `release-notes.js validate` e
   `publish --platform android --version <v>`, publicando a nota no Firestore
   via Admin SDK com a service account do secret `PLAY_STORE_SERVICE_ACCOUNT_JSON`.

O mesmo push dispara `deploy-production.yml`, cuja única responsabilidade é
construir o AAB e publicá-lo no Play Internal. A separação evita que uma falha
de metadados do GitHub republique o mesmo `versionCode` na Play Store. Se apenas
o GitHub Release ou as notas precisarem de recuperação, execute manualmente o
workflow `Release` com o input `release_tag=android-vX.Y.Z`; a tag é validada e
deve apontar exatamente para o checkout usado no build.

O job de publish deriva a versão do nome da tag (`android-vX.Y.Z` → `X.Y.Z`) e assume
plataforma `android` — `release.yml` dispara apenas em tags de release Android.
Se `release-notes/android/<versão>.md` não existir, o job emite um *warning* e
**pula** o publish (não falha o release). `changelog` e `bundle` **não** rodam
aqui: os artefatos gerados já entraram no commit do release (passo 4).

> **Permissões da service account.** O `publish` escreve em `release_notes` via
> Admin SDK. Se o job falhar com `PERMISSION_DENIED`, garanta que a SA do secret
> `PLAY_STORE_SERVICE_ACCOUNT_JSON` tem `roles/datastore.user` no projeto Firebase.

## Publicar no Firestore manualmente

Fallback caso a CI não tenha rodado o `publish`. O `package.json` da raiz já traz
`firebase-admin` como dependência — instale e rode da raiz do repo com
credenciais de service account:

```bash
npm ci   # instala firebase-admin na raiz
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json
node scripts/release-notes.js publish --platform android --version 1.27.0
```

- Doc id no Firestore: `<plataforma>_<versão>` (ex.: `android_1.27.0`).
- `set(..., { merge: true })` — re-rodar é seguro (upsert idempotente).
- Notas com `published: false` no frontmatter são **recusadas** pelo `publish`.
- A coleção `release_notes` é read-only para clientes (escrita só via Admin SDK);
  ver `firestore.rules` + índice composto `platform` ASC / `buildNumber` DESC.

## Notas e limitações conhecidas

- **iOS ainda não publica.** O app iOS não está na App Store. A nota iOS mais
  recente deve permanecer com `published: false` — entra no
  `CHANGELOG.md` e no bundle, mas **não** vai ao Firestore. Quando o iOS for
  lançado, troque para `published: true` e publique.
- **`functions` não tem app cliente.** Entra só no `CHANGELOG.md` — sem `bundle`
  nem `publish`.
- **Versões correntes.** Consulte sempre `versions.json`; não replique números
  correntes nesta documentação. `release-notes/` documenta os releases mais
  recentes. O `publish` só deve rodar depois que a tag existir e apontar para o
  commit mesclado (o gate por push de tag no `release.yml` garante a execução).
- **Backfill.** O sistema nasceu em 2026-05-22 com backfill das últimas versões
  reais: Android `1.24.0`–`1.26.0`, Web `1.26.0`, iOS `1.6.0` (pré-lançamento),
  Functions `1.0.0` (linha de base). Versões mais antigas seguem apenas no
  "Histórico anterior" do `CHANGELOG.md`.
- **Não edite o bloco `AUTOGEN`** do `CHANGELOG.md` à mão — edite os
  arquivos-fonte e rode `changelog`.
