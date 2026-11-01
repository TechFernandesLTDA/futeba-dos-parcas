# BUGFIX: R8 remove o construtor e renomeia os modelos de domain.model lidos por toObject (#4410)

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL` (release da Play Store)
> **Autor:** Claude (autorizado pelo dono)
> **Data:** 2026-11-01
> **Issue:** #4410

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

No release minificado (R8 full mode, `android.r8.fullMode=true` e
`android.r8.strictFullModeForKeepRules=true`), as classes de `com.futebadosparcas.domain.model`
(módulo `:shared`) perdem o construtor sem argumentos e têm campos e getters renomeados. O `:app`
lê essas classes por reflexão com `DocumentSnapshot.toObject()`/`QuerySnapshot.toObjects()`.
O `CustomClassMapper` do Firestore então lança
`RuntimeException: Class ww3 does not define a no-argument constructor` ou, quando o chamador
engole a exceção, devolve `Result.failure`/lista vazia. Isso afeta login (`AuthRepository`),
perfil (`GetUserProfileUseCase`), ranking da Liga (`GetLeagueRankingUseCase`, `LeagueViewModel`)
e outras telas de dados que o revisor da Play vai abrir.

### 1.2 Comportamento Esperado (Correto)

Toda classe passada a `toObject()`/`toObjects()` mantém, no release, o `<init>()`, os getters e
campos com o nome original e as constantes de enum com o nome original.

### 1.3 Passos para Reproduzir

1. `./gradlew :app:minifyReleaseWithR8` (não exige a chave de assinatura).
2. Abrir `app/build/outputs/mapping/release/mapping.txt` e `usage.txt`.
3. Procurar `com.futebadosparcas.domain.model.Statistics ->` (vira `jg3`, `userId -> b`) e
   `com.futebadosparcas.domain.model.User:` em `usage.txt` (lista `public void <init>()` como removido).

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.41.0 (versionCode 82, targetSdk 36) |
| Build | release, `isMinifyEnabled = true`, `isShrinkResources = true` (igual no commit da 1.41.0, `702dcb14`) |
| Frequência | Sempre, em todo caminho que chama `toObject` com classe de `domain.model` |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

Inventário de todas as chamadas `toObject(X::class.java)`, `toObjects(X::class.java)` e
`toObject<X>()` em `app/src/main` e `shared/src` (resolvendo imports, aliases e curingas):

| Pacote | Classes | Regra de keep antes |
|--------|---------|---------------------|
| `com.futebadosparcas.data.model` (`:app`) | Game, GameChatMessage, GameComment, GameEvent, Group, GroupMember, GroupWallPost, SavedTeamFormation, Schedule, Season, Team, UserBadge, UserGroup, AndroidGameWaitlist | `-keep class com.futebadosparcas.data.model.** { *; }` |
| `com.futebadosparcas.domain.model` (`:shared`) | User, Game, GameConfirmation, Team, UserGroup, GroupInvite, GroupMember, Statistics, XpLog, LiveGameScore, LivePlayerStats, GameEvent, Season, SeasonParticipation, UserStreak, GameTemplate, GamificationSettings, Location, PlayerAttendance, GameCancellation, Group | **nenhuma** |
| `com.futebadosparcas.domain.usecase.user` | NotificationSettings | **nenhuma** |

O `:shared` lê o Firestore pelo GitLive SDK com kotlinx.serialization (serializers gerados, sem
reflexão), então não há `toObject` lá. O helper reificado `DataConverter.toObject<T>()` não tem
chamadores com tipo concreto fora dos já listados.

Evidência do `mapping.txt`/`usage.txt` de `./gradlew :app:minifyReleaseWithR8` no master
(`8542ebe0`), antes da correção:

| Classe | Resultado |
|--------|-----------|
| `domain.model.User` | renomeada para `ww3`; `<init>()` removido (`usage.txt`); todos os campos renomeados (ex.: `weightKg -> A`), só o `Companion` fica |
| `domain.model.Statistics` | renomeada para `jg3`; `<init>()` removido; `userId -> b` |
| `domain.model.Game`, `GameConfirmation`, `GroupInvite`, `Season`, `SeasonParticipation`, `UserStreak`, `GamificationSettings`, `Location`, `Group` | renomeadas, `<init>()` removido, campos renomeados |
| `domain.model.Team`, `UserGroup`, `GroupMember`, `XpLog`, `LiveGameScore`, `LivePlayerStats`, `GameEvent`, `GameTemplate`, `PlayerAttendance`, `GameCancellation`, `domain.usecase.user.NotificationSettings` | removidas por inteiro (os chamadores são código morto no release hoje; sem keep, quebrariam no dia em que fossem ligados) |
| Grupo de controle `data.model.*` (14 classes) | nome original, `<init>()` mantido, getters originais |

### 2.2 Causa Raiz

A regra `-keep class com.futebadosparcas.shared.** { *; }` em `app/proguard-rules.pro` foi
escrita para o módulo KMP, mas nenhuma classe usa o pacote `com.futebadosparcas.shared` (0
ocorrências no `mapping.txt`). O `:shared` não declara `consumerProguardFiles`. Assim nada protege
`domain.model`, e o R8 full mode não mantém o construtor padrão sem regra explícita.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/proguard-rules.pro` | troca a regra morta por `domain.model.** { *; }` e `NotificationSettings { *; }` |
| `app/src/test/java/com/futebadosparcas/r8/FirestoreReflectionKeepRulesTest.kt` | contrato: toda classe lida por `toObject` precisa de keep completo (pacote `r8` porque `build/` e `proguard/` estão no `.gitignore`) |

---

## 3. Solução Proposta

### 3.1 Abordagem

```proguard
-keep class com.futebadosparcas.domain.model.** { *; }
-keep class com.futebadosparcas.domain.usecase.user.NotificationSettings { *; }
```

Mesmo formato da regra de `data.model`, que o `mapping.txt` prova funcionar. `{ *; }` mantém o
`<init>()`, campos, getters e as constantes de enum (o mapper do Firestore converte enum pelo nome
da constante). As anotações (`@PropertyName`, `@ServerTimestamp`, `@Exclude`) já são preservadas por
`-keepattributes *Annotation*` e pelo keep de `com.google.firebase.**`.

Regra por pacote, e não por classe: a lista por classe envelhece a cada modelo novo, que foi
justamente como este bug nasceu.

### 3.2 Fora do escopo

- `@SerialName` não é lido pelo mapper do Firestore (#4066). O keep resolve o R8, não o
  mapeamento snake_case dos modelos de `domain.model`.
- Não ligar nem desligar R8/shrink: a 1.41.0 já saiu com `isMinifyEnabled = true`.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| APK maior (classes de domain.model mantidas inteiras) | No `mapping.txt`, `domain.model` passa de 122 para 398 classes (inclui serializers e companions); dex total do release 21,3 MB |
| Modelo novo lido por `toObject` fora dos pacotes cobertos | `FirestoreReflectionKeepRulesTest` falha no CI |

---

## 4. Verificação

- [x] `./gradlew :app:minifyReleaseWithR8` depois da regra: as 21 classes de `domain.model` e a
      `NotificationSettings` com nome original, `<init>()` presente e nenhum membro renomeado.
- [x] `./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.r8.FirestoreReflectionKeepRulesTest"`
      verde; com o `proguard-rules.pro` do master o mesmo teste falha e lista exatamente as 21
      classes de `domain.model` e a `NotificationSettings` (conferido com `--rerun`).
- [x] `./gradlew :app:compileDebugKotlin`
- [ ] Smoke test em device com o AAB de release: login, perfil, estatísticas e Liga (manual, antes do envio).

## 5. Achados relacionados (registrados, sem mudança aqui)

- Play Console sugere "otimização do R8" na 1.41.0. O código da 1.41.0 (`702dcb14`) tem
  `isMinifyEnabled = true` e `isShrinkResources = true`, e o `mapping.txt` local confirma
  ofuscação. Só o AAB enviado (explorador de pacotes da Play) diria se aquele binário foi
  minificado. A sugestão provavelmente vem das regras amplas (`-keep class com.google.firebase.** { *; }`,
  `androidx.compose.**`, `androidx.work.**`), que limitam a otimização. Não mexer às vésperas da revisão.
