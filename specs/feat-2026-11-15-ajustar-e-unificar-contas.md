# SPEC: Ajustar e unificar contas (trocar a conta Google do perfil e unir conta duplicada)

> **Status:** `DRAFT`
> **Autor:** Claude Code (pedido do Renan em 15/11/2026)
> **Data:** 2026-11-15
> **PR:** a definir (PR só com esta spec; nada implementado)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

Uma pessoa pode ter mais de uma conta Google (por exemplo, uma antiga e uma nova) e quer usar o mesmo perfil
do Futeba com qualquer uma, sem perder XP, grupos, jogos e estatísticas. Hoje:

- O app já une contas, mas só num caminho: no onboarding, quando o telefone informado já pertence a outra
  conta. Não há entrada em Configurações.
- No Android a união para no meio: o app pede a união (`requestAccountMerge`) e não tem como concluir
  (`completeAccountMerge` só é chamada pela web). No iOS não existe nada.
- "Contas conectadas" (Android) e o `AuthContext` (web) vinculam e desvinculam o Google, mas não tratam o
  caso em que a outra conta Google já tem um perfil próprio no Futeba.

**Estado medido em produção em 15/11/2026** (Firebase Auth, só leitura):

| Item | Valor |
|------|-------|
| Contas no Auth | 27 |
| Conta Google antiga do Renan | 1 UID, provedores `google.com` + `phone`, papel ADMIN, criada em 25/12/2025, último login em 15/11/2026. Tem dados: 4 grupos, 6 confirmações, 5 registros de XP, 3 medalhas, 6 jogos e 5 grupos como dono |
| Conta Google nova do Renan | **0 UID.** O endereço não aparece em nenhuma conta, nem como e-mail principal nem como e-mail de provedor |
| E-mails ou telefones repetidos em mais de um UID | 0 |
| "Uma conta por e-mail" | Ligado (padrão do projeto) |
| Proteção contra enumeração de e-mail | Ligada (`enableImprovedEmailPrivacy: true`) |

Ou seja: **hoje não existe conta duplicada do Renan.** A duplicata nasce no dia em que ele entrar com a conta
Google nova, se ela for uma conta Google diferente da antiga (ver 1.2).

### 1.2 Casos de Uso

| # | Como... | Quero... | Para... |
|---|---------|----------|---------|
| 1 | jogador que trocou o endereço da mesma conta Google | continuar entrando no mesmo perfil | não perceber a troca. O Firebase identifica a conta Google pelo ID interno (`sub`), não pelo e-mail: o UID é o mesmo. Só o e-mail exibido fica antigo |
| 2 | jogador com duas contas Google diferentes | trocar a conta Google ligada ao meu perfil | passar a entrar com a nova. A conta nova ainda não tem perfil no Futeba |
| 3 | jogador que já entrou com a segunda conta e criou um perfil vazio (ou com dados) | unir os dois perfis num só | ter XP, grupos, jogos e estatísticas num lugar só |
| 4 | jogador | ver no app com quais métodos eu entro (Google, telefone, senha) e qual e-mail está em cada um | saber o que estou usando |

### 1.3 Critérios de Aceite

- [ ] CA1: Em Configurações → Contas conectadas existe "Trocar conta Google". Pede a confirmação da conta atual, desvincula o Google atual e vincula o novo. O UID e todos os dados ficam iguais.
- [ ] CA2: Se a conta Google escolhida já tem perfil no Futeba, o app explica que existe outro perfil e oferece "Unir os dois perfis". Nunca desvincula nada antes de a pessoa decidir.
- [ ] CA3: A união só acontece com prova recente (até 15 min) de posse das **duas** contas, cada uma reautenticada no aparelho.
- [ ] CA4: Antes de confirmar, a tela mostra o que vem de cada perfil (jogos, XP, grupos, medalhas) e qual perfil fica.
- [ ] CA5: Depois da união existe 1 UID ativo. O outro fica desativado, com `account_aliases/{uidAntigo}` apontando para o que ficou.
- [ ] CA6: XP total = soma dos dois; nível recalculado; estatísticas somadas; medalhas unidas sem repetir; papéis em grupos ficam com o maior dos dois; nenhum grupo fica sem dono.
- [ ] CA7: Android, web e iOS concluem a união (hoje só a web conclui).
- [ ] CA8: Se a união parar no meio, repetir a ação retoma do ponto em que parou e não duplica nada.
- [ ] CA9: O e-mail exibido no perfil acompanha o e-mail atual do provedor depois do login (caso de uso 1).
- [ ] CA10: Nenhum e-mail, telefone, CPF ou UID aparece em log, mensagem de erro ou ID de documento.

### 1.4 Fora de Escopo

- Dois vínculos Google no mesmo perfil ao mesmo tempo. **O Firebase não permite**: cada usuário tem no máximo um vínculo por provedor. "Usar as duas contas Google no mesmo perfil" só existe como troca (CA1).
- União decidida por semelhança de nome, foto ou e-mail. Continua valendo a invariante da spec de identidade: só prova de posse autoriza.
- Desfazer uma união concluída. Ela é irreversível por desenho (o alias e o manifesto ficam para auditoria).
- União feita por administrador em nome do usuário.
- Apple, Facebook e outros provedores (o app só tem Google, telefone e senha).

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
Configurações → Contas conectadas
   ├─ Google: <e-mail atual>            [Trocar conta Google]
   ├─ Telefone: (••) •••••-1234
   └─ Senha: definida / não definida

[Trocar conta Google]
   → Confirmar a conta atual (reautenticação)
   → Escolher a nova conta Google (Credential Manager / popup)
        ├─ conta nova sem perfil  → vincula → "Pronto. Agora você entra com <novo e-mail>."
        └─ conta nova com perfil  → "Essa conta Google já tem um perfil no Futeba"
                                       [Unir os dois perfis]  [Escolher outra conta]  [Cancelar]

[Unir os dois perfis]
   → Resumo: o que há em cada perfil e qual fica (o que tem telefone verificado)
   → Confirmar posse do perfil que fica (SMS no telefone dele)
   → "Unir agora" → progresso → "Perfis unidos" (resumo do que foi trazido)
```

Entrada alternativa (já existe na web e parcialmente no Android): colisão de telefone no onboarding.

### 2.2 Telas e Estados

| Tela | Loading | Empty | Error | Success |
|------|---------|-------|-------|---------|
| Contas conectadas | Shimmer na lista de métodos | Não se aplica (sempre há um método) | Mensagem + "Tentar de novo" | Lista de métodos com e-mail/telefone mascarado |
| Trocar conta Google | Progresso no botão | Não se aplica | Mensagem específica: cancelou, sem rede, conta já tem perfil, sessão expirada | Confirmação com o novo e-mail |
| Resumo da união | Shimmer nos dois cartões | "Este perfil não tem dados" no cartão vazio | Mensagem + "Tentar de novo" | Dois cartões e o botão "Unir agora" |
| União em andamento | Barra de progresso, sem botão de voltar | Não se aplica | "A união parou. Toque para continuar" (retoma) | "Perfis unidos" com o resumo |

### 2.3 Responsividade

- [ ] Phone portrait (360dp+)
- [ ] Phone landscape
- [ ] Tablet (sw600dp+): os dois cartões do resumo lado a lado
- [ ] Web desktop: `PageContainer maxWidth="form"`

### 2.4 Acessibilidade

- [ ] `contentDescription` nos ícones dos provedores e no estado de cada método
- [ ] Touch targets >= 48dp
- [ ] Contraste WCAG AA
- [ ] Leitor de tela anuncia o progresso e o resultado da união
- [ ] A ação irreversível tem texto explícito no botão ("Unir agora"), não só cor

### 2.5 Animações e Micro-interações

Só o progresso da união. Sem animação decorativa.

---

## 3. Technical Design

### 3.1 Arquitetura

O que já existe e será reaproveitado:

| Peça | Onde | O que faz |
|------|------|-----------|
| `requestAccountMerge` | `functions/src/auth/account-merge.ts` | Recebe o ID token da conta de origem (até 15 min) e exige que a conta de destino (a que chama) tenha acabado de se autenticar por **telefone**. Cria `account_merge_requests/{idOpaco}`. Limite de 3 pedidos por hora, App Check obrigatório |
| `completeAccountMerge` | mesmo arquivo | Exige CPF verificado em pelo menos uma das contas (`mergeStatus`). Migra os dados, desativa a conta de origem, revoga os tokens dela e libera o vínculo Google dela para ser vinculado ao destino. Idempotente, com lease e manifesto |
| Lista de coleções por UID | `functions/src/auth/uid-owned-collections.ts` | Fonte única do que pertence a um UID e como cada coleção é tratada na união e na exclusão (#4112, #4113) |
| Vincular/desvincular Google | Android `ConnectedAccountsViewModel` (#3190, #3197); web `AuthContext` (`linkWithPopup`, `unlink`) | Vínculo simples, sem tratar conta que já tem perfil |
| Reautenticação | Android `DeleteAccountViewModel`; web `useDeleteAccount` | Reautentica com Google ou senha |
| Entrada atual da união | Web `PhoneVerificationScreen` → `CpfVerificationScreen`; Android `PhoneVerificationViewModel.claimExistingAccount` | Só no onboarding, por colisão de telefone |
| Spec anterior | `specs/SPEC_FEATURE_IDENTITY_ONBOARDING_ACCOUNT_UNION.md` | Invariantes de identidade (CPF, telefone, prova de posse) |

O que o Firebase oferece (e não oferece):

- **Uma conta por e-mail** (ligado): o mesmo e-mail não cria dois UIDs com provedores diferentes. Não ajuda quando os e-mails são diferentes, que é o caso aqui.
- **Vínculo de provedores**: `linkWithCredential` / `linkWithPopup` e `unlink`. Um vínculo por provedor por usuário.
- **Colisão**: vincular uma credencial que já pertence a outro UID falha com `credential-already-in-use` (Android: `FirebaseAuthUserCollisionException`). É o sinal confiável de "essa conta já tem perfil".
- **`fetchSignInMethodsForEmail`: não usar.** Com a proteção contra enumeração de e-mail ligada (é o caso), ele devolve lista vazia. Está descontinuado.
- **Não existe união de UIDs no Firebase.** Unir é sempre migrar dados no Firestore e desativar um dos UIDs. É o que a `completeAccountMerge` faz.
- **Admin SDK**: `updateUser(uid, {providerToLink})` vincula um provedor federado pelo servidor. Fica como alternativa (ver decisão D4).

Desenho proposto:

```
[Contas conectadas]  ──(trocar Google)──>  reautentica → unlink(google.com) → linkWithCredential(novo)
        │                                           │
        │                                           └─ credential-already-in-use
        ▼                                                      ▼
[AccountLinkRepository]                         [AccountMergeRepository]
        │                                                      │ guarda ID token da conta nova (origem)
        ▼                                                      │ reautentica o perfil que fica por telefone
   FirebaseAuth                                                ▼
                                             requestAccountMerge → completeAccountMerge
                                                               ▼
                                             linkWithCredential(novo Google) no perfil que ficou
```

Ordem obrigatória na troca: **só desvincular o Google atual depois de confirmar que o perfil tem outro método
de entrada verificado (telefone) e que o novo vínculo é possível.** Se o perfil só tem Google, a troca exige
vincular telefone antes.

### 3.2 Modelos de Dados

```kotlin
// shared/commonMain
data class SignInMethod(
    val provider: SignInProvider,      // GOOGLE, PHONE, PASSWORD
    val maskedIdentifier: String,      // e-mail ou telefone mascarado
    val canUnlink: Boolean             // falso se for o único método
)

data class MergePreview(
    val keptProfile: ProfileSummary,   // o que fica (tem telefone verificado)
    val mergedProfile: ProfileSummary  // o que será absorvido
)

data class ProfileSummary(
    val games: Int, val xp: Long, val groups: Int, val ownedGroups: Int, val badges: Int
)

sealed interface AccountMergeUiState {
    data object Loading : AccountMergeUiState
    data class Preview(val preview: MergePreview) : AccountMergeUiState
    data class InProgress(val stage: MergeStage) : AccountMergeUiState
    data class Error(val message: String, val canResume: Boolean) : AccountMergeUiState
    data class Success(val manifest: MergeManifestSummary) : AccountMergeUiState
}
```

### 3.3 API / Firestore

| Operação | Collection / Callable | Mudança |
|----------|-----------------------|---------|
| Pedir a união | `requestAccountMerge` | Sem mudança de contrato |
| Concluir a união | `completeAccountMerge` | Sem mudança de contrato. Android e iOS passam a chamar |
| Resumo antes de unir | **Nova** `previewAccountMerge` (callable) | Devolve só contagens dos dois perfis para quem provou as duas posses. Nunca devolve e-mail, telefone ou UID |
| Sincronizar e-mail exibido | `users/{uid}.email` | Atualizado no servidor a partir do Auth depois do login (caso de uso 1). O cliente não grava `email` |
| Estado do pedido | `account_merge_requests/{id}` | Hoje as rules só deixam ADMIN ler e ninguém gravar. O cliente continua sem ler o documento: o estado vem na resposta das callables |

### 3.4 Cache e Offline

- União e troca de conta exigem rede. Offline: botão desabilitado com a explicação.
- Depois da união, o cache local (Room, cache de perfil) é limpo e recarregado: os dados mudaram no servidor.

### 3.5 Segurança

- Prova das duas posses continua obrigatória e recente (15 min). O perfil que fica prova por SMS; o absorvido, por ID token recente.
- A exigência de CPF da `completeAccountMerge` continua (ver decisão D2).
- App Check e limite de pedidos continuam.
- Papel ADMIN: se o perfil absorvido for ADMIN e o que fica não for, o papel **não** é herdado automaticamente (ver decisão D5).
- Reautenticação antes de desvincular qualquer método.
- Nada de e-mail, telefone, CPF ou UID em logs e respostas.

### 3.6 Performance

- A união já usa `BulkWriter` e cursor para coleções grandes (#3909, #4015, #4039). O resumo usa contagens agregadas (`count()`), não leitura de documentos.

### 3.7 Analytics e Observabilidade

| Evento | Parâmetros | Quando |
|--------|------------|--------|
| `account_google_switch_started` | - | Abriu "Trocar conta Google" |
| `account_google_switch_result` | `result` (ok, cancelled, collision, error) | Fim da troca |
| `account_merge_started` | `entry` (settings, onboarding) | Confirmou a união |
| `account_merge_result` | `result`, `resumed` | Fim da união |

Erros da união continuam em `audit_logs` e no log das Functions, sem dados pessoais.

### 3.8 Riscos

| Área | Risco | Mitigação |
|------|-------|-----------|
| XP | XP somado duas vezes se a união rodar de novo | Já tratado: a soma roda numa transação que grava `xp_merged_to` na origem; repetir não soma de novo. Manter o teste de idempotência |
| XP | Nível e marcos ficarem inconsistentes com o XP somado | `getLevelForXp` recalcula o nível e `milestones_achieved` é a união das duas listas; conferir a temporada corrente |
| XP | Limites anticheat por jogo (500 XP) não se aplicam à soma de perfis | Documentar: a soma é de totais, não reprocessa jogos |
| Grupos | Grupo sem dono, ou dois donos | Posse relida em transação; papel fica com o maior dos dois (`strongestGroupRole`) |
| Grupos | `member_count` divergir quando os dois perfis estão no mesmo grupo | Recontar o grupo depois da união (já existe função de correção de contagem) |
| Grupos | A cópia do espelho `users/{uid}/groups` leva campos indevidos do documento antigo (`...sourceLinkData`). Um campo `id` gravado fecha o app Android até a 1.43.2 (#4566) | Copiar só os campos conhecidos do espelho |
| Jogos | Os dois perfis confirmados no mesmo jogo: confirmação duplicada, vaga contada duas vezes | `mergeConfirmationRecords` une por jogo; conferir contadores do jogo e a fila de espera |
| Jogos | Jogo ao vivo em andamento com um dos perfis | Bloquear a união enquanto houver jogo `LIVE` com participação de qualquer um dos dois |
| Estatísticas | Os dois perfis no mesmo jogo: jogo contado duas vezes na soma | Detectar jogos em comum antes de somar; decisão D3 |
| Estatísticas | Ranking da temporada e cache do ranking com o UID antigo | `mergeSeasonParticipationRecords` + invalidar o cache do ranking |
| Votos de MVP | Um perfil votou no outro (voto em si mesmo depois da união) | Regra explícita: voto do absorvido no que fica é descartado |
| Acesso | A pessoa fica sem conseguir entrar (desvinculou o Google e a vinculação nova falhou) | Ordem obrigatória de 3.1; telefone verificado como âncora |
| Acesso | União interrompida com a origem já desativada | Lease e retomada já existem; a tela oferece "continuar" |
| Privacidade | Alguém une o perfil de outra pessoa | Só com prova das duas posses; sem união por semelhança |
| LGPD | Localização do perfil absorvido herdada sem consentimento | Já tratado: `user_locations` da origem é apagado (#4124) |
| Plataformas | Android não conclui a união hoje | Tarefa 3 |

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Responsável | Status |
|---|------|------------|-------------|--------|
| 1 | Functions: `previewAccountMerge` + testes | 4h | | ⬜ |
| 2 | Functions: cópia do espelho de grupos só com campos conhecidos; bloqueio com jogo `LIVE`; regra do voto de MVP; jogos em comum nas estatísticas | 6h | | ⬜ |
| 3 | Android: concluir a união (`completeAccountMerge`) no fluxo que já pede | 4h | | ⬜ |
| 4 | KMP: `AccountLinkRepository` e `AccountMergeRepository` (interfaces em `commonMain`, impl Android e iOS) | 6h | | ⬜ |
| 5 | Android: "Trocar conta Google" em Contas conectadas + tratamento de colisão | 6h | | ⬜ |
| 6 | Android: telas de resumo e progresso da união (4 estados) | 6h | | ⬜ |
| 7 | Web: mesma entrada em Configurações (reaproveita `PhoneVerificationScreen`/`CpfVerificationScreen`) | 6h | | ⬜ |
| 8 | iOS (CMP): contas conectadas e união | 8h | | ⬜ |
| 9 | Sincronizar `users/{uid}.email` com o Auth no servidor | 2h | | ⬜ |
| 10 | Testes no emulador: união com dados nos dois perfis, repetição, interrupção | 6h | | ⬜ |

**Total estimado:** 54h

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit (Functions) | Resumo, idempotência da soma de XP, jogos em comum, voto de MVP, cópia do espelho | ⬜ |
| Emulador (Auth + Firestore + Functions) | União completa, repetida e interrompida; troca de Google com e sem colisão | ⬜ |
| Unit (ViewModel) | Estados da troca e da união, retomada | ⬜ |
| UI (Compose / Playwright) | Fluxo crítico nas três plataformas | ⬜ |

### 5.2 Checklist de Revisão

- [ ] Build passa sem erros/warnings
- [ ] Lint passa
- [ ] Testes passam
- [ ] Testado em light/dark theme
- [ ] Testado em diferentes tamanhos de tela
- [ ] Sem regressões em login, onboarding e exclusão de conta
- [ ] Strings em `strings.xml` e no i18n da web
- [ ] Analytics implementado
- [ ] `docs/` e `specs/DECISIONS.md` atualizados

### 5.3 Demo

- [ ] União feita em ambiente de teste com duas contas de teste antes de qualquer conta real

---

## 6. Notas e Referências

### Decisões que dependem do Renan

| # | Decisão | Opções | Recomendação |
|---|---------|--------|--------------|
| D1 | As duas contas Google são a mesma conta (endereço trocado) ou duas contas diferentes? | Mesma conta: não há o que unir, só o e-mail exibido (tarefa 9). Contas diferentes: troca (CA1) ou união (CA2) | Conferir entrando com a conta nova num aparelho de teste: se abrir o perfil ADMIN, é a mesma conta |
| D2 | Exigir CPF para unir? | Manter (hoje: CPF em pelo menos uma das contas). Ou aceitar telefone + duas reautenticações sem CPF | Manter. É a única prova de que é a mesma pessoa, não só de que alguém tem os dois aparelhos |
| D3 | Os dois perfis jogaram o mesmo jogo: como somar? | Contar o jogo uma vez (fica a melhor linha). Ou somar tudo | Contar uma vez |
| D4 | Como o novo Google entra no perfil depois da união? | O próprio usuário vincula no app (hoje). Ou o servidor vincula (`providerToLink`) | Usuário vincula: o servidor não fabrica credencial (invariante da spec de identidade) |
| D5 | Papel ADMIN do perfil absorvido | Herdar. Ou não herdar e pedir promoção manual | Não herdar |
| D6 | Qual perfil fica quando os dois têm telefone? | O mais antigo. Ou o que a pessoa escolher | A pessoa escolhe, com o mais antigo pré-selecionado |
| D7 | Ordem de entrega | Android primeiro (onde o Renan usa). Ou as três plataformas juntas | Functions + Android + web juntos; iOS em seguida |
| D8 | O caso do Renan agora | Esperar a feature. Ou só trocar o Google do perfil atual em Contas conectadas (já existe: desvincular e vincular) | Não entrar com a conta nova antes de decidir: entrar cria o segundo perfil e obriga a união |

### Referências

- Spec de identidade e união no onboarding: `specs/SPEC_FEATURE_IDENTITY_ONBOARDING_ACCOUNT_UNION.md`
- `specs/BUGFIX_3909_ACCOUNT_MERGE_BULKWRITER.md`, `specs/bugfix-2026-07-12-public-searchable-merged-accounts.md`
- Issues: #3526 (união no onboarding), #3190/#3197 (contas conectadas Android), #4015, #4039, #4112, #4113, #4124
- Crash relacionado ao espelho de grupos: `specs/bugfix-2026-11-15-android-crash-meus-grupos-documentid.md` (#4566)

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-11-15 | Claude Code | Criação inicial (investigação e proposta, sem implementação) |
