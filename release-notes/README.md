# Release Notes — Arquivos-fonte

Esta pasta contém a **fonte única** das notas de cada release. Um arquivo por
versão de cada plataforma. A partir daqui, `scripts/release-notes.js` gera:

- o `CHANGELOG.md` (bloco `AUTOGEN`, segmentado por plataforma);
- os JSONs de fallback embarcados (`bundle`);
- os documentos da coleção Firestore `release_notes` (`publish`).

Ver a spec completa em
[`specs/feat-2026-05-22-version-control-release-notes.md`](../specs/feat-2026-05-22-version-control-release-notes.md)
e o processo de release em [`docs/RELEASE_PROCESS.md`](../docs/RELEASE_PROCESS.md).

## Estrutura

```
release-notes/
├── android/<versão>.md      ex.: android/1.26.0.md
├── web/<versão>.md
├── ios/<versão>.md
└── functions/<versão>.md
```

- O nome da pasta é a plataforma (**sempre minúsculo**): `android`, `web`, `ios`,
  `functions`.
- O nome do arquivo é a versão semântica exata: `1.26.0.md`.
- `functions` só alimenta o `CHANGELOG.md` (não tem app cliente, não vai para
  `bundle` nem `publish`).

## Formato do arquivo

```markdown
---
platform: android
version: 1.26.0
buildNumber: 50
date: 2026-05-22
type: minor
showPopup: true
published: true
issues: [1480, 1466]
prs: [1481, 1414]
milestone: android-1.26.0
---

## Para o usuário

### Headline
- Frase curta e amigável que resume o release

### Destaques
- icon=palette | Título do destaque | Descrição curta do destaque.

### Novidades
- Texto de uma novidade voltada ao usuário.

### Melhorias
- Texto de uma melhoria.

### Correções
- Texto de uma correção.

## Técnico

### Added
- Item técnico (alimenta o CHANGELOG.md).

### Fixed
- Outro item técnico (#1480).
```

## Frontmatter (subconjunto YAML estrito)

O parser aceita **apenas** `chave: valor` em linhas simples. Sem aspas, sem
multi-linha, sem `:` dentro do valor. Listas são literais `[1, 2, 3]` (somente
números) ou `[]`.

| Campo | Obrigatório | Tipo | Observações |
|-------|-------------|------|-------------|
| `platform` | sim | string | `android` \| `web` \| `ios` \| `functions`; igual à pasta |
| `version` | sim | string | semver `x.y.z`; igual ao nome do arquivo |
| `buildNumber` | android/ios | número | versionCode (Android) / CFBundleVersion (iOS) |
| `date` | sim | string | `YYYY-MM-DD` |
| `type` | sim | string | `major` \| `minor` \| `patch` |
| `showPopup` | sim | booleano | exibe o pop-up de novidades no boot |
| `published` | não | booleano | default `true`; `false` mantém fora do Firestore |
| `issues` | não | lista de números | issues do GitHub fechadas (rastreabilidade) |
| `prs` | não | lista de números | PRs do GitHub |
| `milestone` | sim | string | milestone do release, ex.: `android-1.26.0` |

## Corpo

Duas seções de nível 2, **exatamente** com estes títulos:

- `## Para o usuário` — conteúdo PT-BR amigável; alimenta a UI e o Firestore.
- `## Técnico` — alimenta o `CHANGELOG.md`; não aparece para o usuário final.

### Subseções de "Para o usuário"

| `### Subseção` | Regras |
|----------------|--------|
| `Headline` | obrigatória, **exatamente 1** item |
| `Destaques` | 0 a 3 itens, cada um no formato DSL abaixo |
| `Novidades` | 0+ itens (vira `added` no Firestore) |
| `Melhorias` | 0+ itens (vira `improved`) |
| `Correções` | 0+ itens (vira `fixed`) |

**DSL de destaque:** `icon=<nome> | Título | Descrição`

- separador é ` | ` (espaço-barra-espaço); exige exatamente 3 partes;
- `<nome>` do ícone: minúsculas e `_` (ex.: `dark_mode`, `celebration`);
- proibido `|` dentro de qualquer campo — `validate` rejeita.

### Subseções de "Técnico"

Títulos no padrão Keep a Changelog (em inglês): `Added`, `Changed`,
`Deprecated`, `Removed`, `Fixed`, `Security`. Use 0+ itens; ao menos uma
subseção precisa ter conteúdo.

## Validação

```bash
node scripts/release-notes.js validate
```

Roda na CI. Falha (exit ≠ 0) se qualquer arquivo violar o formato acima ou se
algum bundle embarcado (`app/.../release-notes.json`, `web/public/...`,
`ios.../release-notes.json`) estiver fora de sincronia com a fonte.
