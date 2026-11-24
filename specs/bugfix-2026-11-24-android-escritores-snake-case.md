# BUGFIX: Android grava modelos KMP inteiros com chaves camelCase

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-24; a aprovação é o merge deste PR)
> **Severidade:** `HIGH`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-24
> **Base:** `origin/master` em `c52dec2e`
> **Origem:** issue #4645 (achada ao investigar o #4592)

---

## 1. Problema

Quatro escritores do Android gravam um modelo de `shared/domain/model` inteiro com `set(modelo)`. Esses modelos
só têm `@SerialName`, que o mapper do SDK Android ignora, então as chaves saem em camelCase. As regras, o web e
as functions usam snake_case. Mesmo padrão do #4066.

| Escritor | Efeito |
|---|---|
| `GroupRepository.createGroup` | **Criar grupo no Android é negado.** A regra pede `owner_id == uid` e `status == 'ACTIVE'`; o documento saía com `ownerId` e sem `status`. A transação inteira falha, então o membro dono e o espelho também não são gravados |
| `AuthRepository.getCurrentUser` (perfil de reserva, quando a conta entra sem perfil) | Negado. A regra recusa `experiencePoints`, `level` e `milestonesAchieved` no create; o modelo grava os três |
| `GameTemplateRepositoryImpl.saveTemplate` | Aceito (a regra só confere o dono), mas com `templateName`, `createdAt` em camelCase |
| `SettingsRepositoryImpl.updateGamificationSettings` (só ADMIN) | Aceito, com `xpPerGoal` e afins. `normalizeGamificationSettings` (functions) lê `xp_per_goal`: a edição feita no Android não valia no XP |

### Reprodução

`firestore-rules-tests/src/android-snake-case-4645.test.ts`, contra as regras reais no emulador:

- o lote que o Android manda hoje ao criar grupo (grupo com as chaves medidas com
  `CustomClassMapper.convertToPlainJavaTypes`, mais o membro e o espelho) é negado;
- controle: o mesmo lote com o grupo em snake_case passa;
- controle: trocar só `ownerId` por `owner_id` ainda é negado (falta `status`);
- o perfil de hoje é negado, com ou sem código de convite; o perfil em snake_case passa com código de convite
  válido e é negado sem ele.

## 2. Correção

Novo `app/.../data/firestore/AndroidEscritoresFirestore.kt`, com funções puras que montam cada documento campo a
campo, em snake_case:

- **Grupo:** as mesmas chaves do web (`useGroups.createGroup`): `name`, `description`, `photo_url`, `type`,
  `is_public`, `owner_id`, `owner_name`, `member_count: 0`, `status: 'ACTIVE'`, `created_at` e `updated_at` do
  servidor, `default_gender` só quando escolhido. Membro dono e espelho com `joined_at` do servidor (antes saía
  nulo).
- **Perfil de reserva:** `email`, `name`, `nickname`, `photo_url`, `role: 'PLAYER'`, os quatro ratings em 0,
  `preferred_position`, `preferred_field_types`, `is_searchable`, `created_at` e `updated_at`. Sem XP, nível,
  telefone, status nem contadores. Os ratings precisam estar no documento: a regra os lê sem `get()` e campo
  ausente nega.
- **Modelo de jogo:** os nomes de `@SerialName` do modelo (`template_name`, `game_time`...), `created_at` do
  servidor.
- **Gamificação:** os nomes que as functions leem (`xp_per_goal`, `xp_streak_3`...), `updated_at` do servidor.

Os leitores do modelo de jogo e da gamificação no Android passam a ler snake_case, com o camelCase antigo como
reserva (documento gravado antes desta correção).

## 3. Fora do escopo

- **Cadastro novo pelo Android continua negado.** A regra de `users` exige `invited_by_code` válido e o Android
  não tem como informar um código de convite. Com as chaves certas, o que falta é o código. Decidir se o Android
  pede o código (como o web) é decisão de produto.
- **Esquema do modelo de jogo diverge entre web e Android.** O web grava `name`, `time`, `recurrence_type`; o
  Android grava `template_name`, `game_time`, `recurrence`. Um não lê o modelo do outro. Unificar é mudança de
  dados nas duas plataformas.
- `shared/.../FirebaseGroupsDataSource.createGroup` grava `is_active` sem `status` nem membro dono. Nenhuma tela
  chama esse caminho hoje (nem no iOS).

## 4. Dados em produção

Consulta só de leitura em 2026-11-24: nenhum documento em `game_templates`, nenhum em `app_settings` e nenhum
grupo com `ownerId`. Nada a migrar.

## 5. Verificação

- JVM: `AndroidEscritoresFirestoreTest` (chaves, valores que a regra exige, ausência de camelCase, leitura do
  formato novo e do antigo) e `GroupCreationMemberCountTest`.
- Regras: `android-snake-case-4645.test.ts` (7 casos).
- Sem deploy de Firebase. Sai na próxima versão do Android.
