# Firestore Rules Tests

Testes unitários das Firestore Security Rules do projeto **Futeba dos Parças**.

## Stack

- `@firebase/rules-unit-testing` v3+ (emulador local)
- `vitest` v2 (runner de testes)
- `typescript` v5
- Firebase Emulator Suite (Firestore, porta 8085)

## Pré-requisitos

- Node 20+
- Java 21+ (o emulador Firestore requer Java 21+)
  - macOS com Homebrew: `brew install openjdk` (instala v25+)
  - Configurar `JAVA_HOME` se necessário (ver seção abaixo)
- Firebase CLI: `npm install -g firebase-tools`

## Executar os testes

```bash
cd firestore-rules-tests
npm install
npm test
```

O script `npm test` usa `firebase emulators:exec` para:
1. Subir o Firestore Emulator automaticamente (porta 8085)
2. Rodar o Vitest com as rules do projeto (`../firestore.rules`)
3. Derrubar o emulador ao finalizar

## Java 21+ no macOS

Se o sistema tem Java 17 e o emulador rejeitar:

```bash
# Verificar se há Java 21+ via Homebrew
ls /opt/homebrew/Cellar/openjdk/

# Se existir, exportar JAVA_HOME antes de rodar
export JAVA_HOME=/opt/homebrew/Cellar/openjdk/25.0.2/libexec/openjdk.jdk/Contents/Home
npm test
```

O `package.json` já hardcoda esse path para o runner local do projeto.

## Estrutura

```
firestore-rules-tests/
├── package.json          # Dependências e scripts
├── vitest.config.ts      # Configuração do Vitest
├── tsconfig.json         # Configuração TypeScript
├── README.md             # Este arquivo
└── src/
    ├── setup.ts          # Variável FIRESTORE_EMULATOR_HOST
    ├── helpers.ts        # initTestEnv, asAdmin, asPlayerA, seedDoc...
    ├── users.test.ts     # 18 testes — coleção users
    ├── games.test.ts     # 21 testes — coleção games
    ├── locations.test.ts # 20 testes — coleção locations
    ├── groups.test.ts    # 24 testes — groups + cashbox
    ├── notifications.test.ts  # 14 testes — notifications
    └── group-invites.test.ts  # 13 testes — group_invites
```

## Roles testadas

| Role       | Custom Claim               |
|------------|---------------------------|
| ADMIN      | `{ role: 'ADMIN' }`       |
| FIELD_OWNER| `{ role: 'FIELD_OWNER' }` |
| PLAYER     | `{ role: 'PLAYER' }`      |
| Não-auth   | contexto anônimo           |

As claims são injetadas via `initializeTestEnvironment` + `authenticatedContext(uid, claims)`,
replicando exatamente o comportamento dos Custom Claims do Firebase Auth (PERF_001).

## Bug encontrado nas rules

> **groups — leitura**: `isAdmin()` está **ausente** do bloco de autorização final.

```javascript
// firestore.rules, linha 1067-1073
allow read: if isAuthenticated() && (
  !('deleted_at' in resource.data) || resource.data.deleted_at == null || isAdmin()
) && (
  resource.data.is_public == true ||
  resource.data.owner_id == userId() ||
  exists(/databases/$(database)/documents/groups/$(groupId)/members/$(userId()))
  // ↑ isAdmin() FALTANDO aqui — admin NÃO consegue ler grupos privados
);
```

**Impacto**: Admin não consegue ler grupos privados onde não é membro.
**Teste documentador**: `groups — leitura > Admin NÃO pode ler grupo privado sem ser membro (BUG)`.
**Fix sugerido**: Adicionar `|| isAdmin()` no bloco de autorização final da regra de leitura de groups.

## Cobertura por coleção

| Coleção         | Operações testadas                              | Testes |
|-----------------|------------------------------------------------|--------|
| `users`         | read (own/other/searchable), create, update (campos imutáveis), delete | 18 |
| `games`         | read (soft-deleted), create (validações), update (owner/co-org/admin), delete | 21 |
| `locations`     | read (público/auth/deleted), create (verified/fraud), update (campos protegidos), delete | 20 |
| `groups`        | read (público/privado/member), update, delete  | 8  |
| `groups/cashbox`| read (member), create (admin/member/bounds), delete=false | 8 |
| `notifications` | read (destinatário only), create (campos/self), update (fields restritos), delete | 14 |
| `group_invites` | read (dest/sender/random), create (admin only), update, delete | 13 |
| **Total**       |                                                | **102+** |

> Nota: vitest reporta 105 testes (diferença por testes de seed dentro das suites).
