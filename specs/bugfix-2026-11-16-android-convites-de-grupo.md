# BUGFIX: convite de grupo no Android falha com PERMISSION_DENIED e o convidado lê o convite vazio (#4584)

> **Status:** `APPROVED` → `FIXED`
> **Severidade:** `HIGH` (convite de grupo pelo Android não funciona)
> **Autor:** Claude Code (issue #4584, Crashlytics da 1.43.4)
> **Data:** 2026-11-16

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

No Android, o dono do grupo escolhe um jogador e toca em convidar. O app mostra "Erro ao enviar convite" e o
Crashlytics registra `PERMISSION_DENIED` com o log `InviteRepository: Erro ao enviar convite para grupo`
(1.43.4, build 89, 16/11/2026 01:48Z).

Do outro lado, um convite criado pelo web aparece no Android sem o nome do grupo, e aceitar ou recusar responde
"Este convite não é para você".

### 1.2 Comportamento Esperado (Correto)

O dono convida, o documento sai no mesmo formato que o web grava e o convidado lê, aceita ou recusa.

### 1.3 Passos para Reproduzir

1. `scripts/bateria/rodar.sh subir` (ou duas contas em produção).
2. No Android, entrar como dono de um grupo, abrir Jogadores e convidar alguém de fora do grupo.
3. Erro na tela e `PERMISSION_DENIED` no Logcat.

---

## 2. Análise de Causa Raiz

`app/src/main/java/com/futebadosparcas/data/InviteRepositoryImpl.kt` importa `com.futebadosparcas.domain.model.*`.
O `GroupInvite` que ele usava era o do domínio (KMP, `@SerialName`), que o mapper por reflexão do Firestore não
entende. Três defeitos saem daí, mais um de permissão:

| # | Defeito | Efeito |
|---|---------|--------|
| 1 | `createInvite` lê `users/{convidado}` para pegar nome e e-mail | As regras de `users` negam a leitura do perfil alheio que tem `email` gravado (quase todos). O convite cai antes de gravar |
| 2 | Grava o modelo do domínio: camelCase, `expiresAt` numérico e campo `id` | As regras de `group_invites` exigem snake_case, `expires_at` como data, `created_at` e `updated_at` |
| 3 | Lê com o modelo do domínio | Convite do web chega com `groupId`, `groupName` e `invitedUserId` vazios; `countPendingInvites` chama `getLong` num campo que é data e lança |
| 4 | Deixa o administrador convidar | As regras só aceitam o dono (`isGroupOwnerById`); o web já restringe ao dono |

Achado durante a correção: gravar `data.model.GroupInvite` (o modelo certo, com `@PropertyName`) também não
resolve, porque o `created_at` anotado com `@ServerTimestamp` saiu sem data no emulador. Por isso a gravação é
campo a campo.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `app/.../data/InviteRepositoryImpl.kt` | Leitura e gravação no formato do Firestore; dono; nome do convidado |
| `shared/.../domain/repository/InviteRepository.kt` | `createInvite` ganha `invitedUserName: String? = null` |
| `app/.../ui/players/PlayersViewModel.kt` | Passa o nome do jogador escolhido |
| `app/.../ui/groups/InviteViewModel.kt`, `InvitePlayersScreen.kt` | Idem |
| `app/src/test/.../PlayersViewModelTest.kt` | Stubs com o terceiro parâmetro |
| `app/src/androidTest/.../bateria/ConvitesBateriaTest.kt` | Novo: três casos contra as regras reais |

---

## 3. Solução

- **Gravação:** mapa explícito com os mesmos campos do web (`group_id`, `group_name`, `group_photo`,
  `invited_user_id`, `invited_user_name`, `invited_by_id`, `invited_by_name`, `status`, `expires_at`,
  `created_at`, `updated_at`), com `FieldValue.serverTimestamp()` nas duas datas. Sem `id` e sem e-mail do
  convidado.
- **Leitura:** `data.model.GroupInvite` (com `@PropertyName` e `@DocumentId`) por `toObjectTolerant`, convertido
  para o domínio com os mapeadores que já existiam (`toKmpGroupInvite`).
- **Nome do convidado:** vem de quem chama, porque a busca de jogadores já traz o nome. Sem ele, o repositório
  tenta ler o perfil e segue com nome vazio se a leitura for negada.
- **Dono:** o repositório confere `owner_id` do grupo antes de gravar e responde "Só o dono do grupo pode enviar
  convites". Mudar as regras para aceitar administrador foi descartado: o teste de regras
  "Administrador do grupo NÃO pode criar invite" registra a restrição como intencional.
- **Contagem:** `expires_at` lido como `Timestamp`, `Date` ou número.

### Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Interface compartilhada muda | Parâmetro novo é opcional; `composeApp` compila sem alteração |
| Administrador perde o botão que nunca funcionou | Mensagem clara em vez de `PERMISSION_DENIED` |
| Convite sem nome quando quem chama não informa | As duas telas do Android passam o nome; o caso sem nome é coberto na bateria |

---

## 4. Verificação

- `ConvitesBateriaTest` (emulador, regras reais): dono convida e o convidado lê e recusa; dono convida sem
  informar o nome, repete (recusado) e cancela; administrador que não é dono recebe a mensagem.
- `PlayersViewModelTest`.
- `./gradlew :app:compileDebugKotlin :app:compileDebugAndroidTestKotlin`.

### Checklist

- [x] Telas sem mudança de layout; estados de carregamento, erro e sucesso iguais.
- [x] Sem cor nem dimensão nova.
- [ ] Mensagens do repositório continuam literais em português, como as outras do arquivo (pendência 5.2).

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

Não havia teste que passasse pelo repositório contra as regras. O teste unitário do ViewModel usa mock.

### 5.2 Pendências

- `@ServerTimestamp` em propriedade com `@get:PropertyName` de nome diferente: conferir os outros modelos.
- `GroupRepository.createGroupInvite` e `InviteToGroupUseCase` gravam o modelo do domínio e não têm chamador:
  código morto a apagar.
- iOS não tem implementação de `InviteRepository` registrada; a tela de convite do `composeApp` fica indisponível.
- Mensagens de erro do repositório em `strings.xml`.

## 6. Publicação

Só Android. Precisa de versão nova do app.
