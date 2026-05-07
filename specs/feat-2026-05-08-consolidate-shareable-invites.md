# SPEC: Consolidar Shareable Invite Codes — Android → invites/

> **Status:** `APPROVED`
> **Autor:** Renan Locatiz Fernandes (com Claude Opus 4.7)
> **Data:** 2026-05-08
> **PR:** #xxx (preencher quando criar)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

Hoje existem **3 sistemas de convite** convivendo no projeto, e dois deles competem pela MESMA feature (shareable invite code) com schemas divergentes:

| # | Sistema | Propósito | Owner atual | Schema |
|---|---------|-----------|-------------|--------|
| 1 | `groups.invite_code` (campo) | Shareable code, 1 por grupo, sem TTL, sem tracking | **Android** | `code: string` em `groups/{id}` |
| 2 | `invites/` (collection) | Shareable code rico, múltiplos por grupo, TTL + tracking | **Web** | `code, group_id, inviter_id, created_at, expires_at, used, used_by, used_at` |
| 3 | `group_invites/` (collection) | Direct invite pessoa→pessoa via email, status workflow, expiry 48h | Android | `invited_user_id, invited_by_id, status, expiry` |

Sistemas **1 e 2 são a MESMA feature** com implementações divergentes — usuário do Android cria um shareable code que difere do code criado no Web (não há TTL, não há tracking de quem usou, não há rotação). Sistema **3 é caso de uso DIFERENTE** (convite direto, não shareable) e fica fora desta consolidação.

Com iOS chegando em breve (CMP Phase 4 — TestFlight), precisamos consolidar ANTES para evitar que iOS herde divergência ou crie 4º sistema.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Dono do Grupo (Android) | Gera link shareable do grupo | Documento criado em `invites/` com TTL 7d, code retornado e copiável |
| UC2 | Dono do Grupo (Android) | Compartilha link `futebadosparcas://invite/{code}` | Code persiste em `invites/`, observa quem usou no painel |
| UC3 | Convidado (Android) | Clica deep-link com code antigo (`groups.invite_code`) | App localiza grupo via fallback no campo `groups.invite_code` e entra normalmente |
| UC4 | Convidado (Android) | Clica deep-link com code novo (`invites/`) | App resolve via `invites/` collection, marca `used=true`, registra `used_by`/`used_at`, entra no grupo |
| UC5 | Convidado (Web) | Usa code criado no Android | Interopera — code criado em qualquer plataforma funciona em ambas |
| UC6 | Admin | Roda Cloud Function de migração | Todos os codes em `groups.invite_code` são copiados como docs em `invites/` (sem TTL, marcados como migrados) |
| UC7 | Convidado (qualquer plataforma) | Tenta usar code expirado/já usado | Recebe erro tratado: "Convite expirado" / "Convite já utilizado" |

### 1.3 Critérios de Aceite

- [ ] CA1: Android cria shareable codes em `invites/` (não em `groups.invite_code`)
- [ ] CA2: Android resolve deep-link primeiro em `invites/`, fallback `groups.invite_code` se não achar
- [ ] CA3: Cloud Function `migrateGroupsInviteCodeToInvites` (callable, admin-only) migra docs existentes
- [ ] CA4: Migração é **idempotente** — pode rodar múltiplas vezes sem duplicar
- [ ] CA5: Codes existentes (pre-migração) continuam funcionando via fallback
- [ ] CA6: Web usa codes criados pelo Android sem mudança de código
- [ ] CA7: Documentos em `invites/` têm: TTL 7d default (configurável), `used`, `used_by`, `used_at`
- [ ] CA8: Tela "Compartilhar convite" no Android mostra TTL e permite regenerar
- [ ] CA9: KMP — toda lógica nova mora em `shared/src/commonMain/` + `shared/src/nativeAndAndroidMain/` (zero duplicação)
- [ ] CA10: Sistema 3 (`group_invites/`) **não é tocado**

### 1.4 Fora de Escopo

- **Sistema `group_invites/`** (direct invite por email/userId) — caso de uso diferente, mantém-se como está
- Remoção do campo `groups.invite_code` — fica deprecated mas presente até major release seguinte (Phase 3 do rollout)
- Mudanças em UX do Web — Web já usa `invites/` corretamente
- iOS implementação — herda automaticamente quando CMP Phase 4 for ativada (somente consome KMP shared, nada platform-specific)
- Notificações push de "convite usado" — feature future, não bloqueia
- UI admin pra ver lista de convites pendentes/usados — feature future

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

**Android — Criar/compartilhar convite (UC1, UC2):**

```
[GroupDetailScreen]
    --tap "Convidar Jogadores"--> [InviteSheet]
        --gera novo code--> Cloud (cria doc em invites/)
        --code retornado--> [InviteSheet com link copiável + TTL "7 dias"]
        --tap "Regenerar"--> nova chamada → novo code
        --tap "Compartilhar"--> Intent.ACTION_SEND com link
```

**Android — Convidado entra (UC3, UC4, UC7):**

```
[Deep-link futebadosparcas://invite/{code}]
    --> AppNavGraph resolve "invite/{code}"
        --> JoinGroupScreen.loadInviteByCode(code)
            --> 1. query invites/ where code == X (canônico)
                --found + valid--> mostra preview do grupo, botão "Entrar"
                --found + expired--> [Dialog "Convite expirado"]
                --found + used--> [Dialog "Convite já utilizado"]
                --not found--> 2. fallback: query groups where invite_code == X
                    --found--> mostra preview, botão "Entrar" (sem tracking)
                    --not found--> [Dialog "Convite inválido"]
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| InviteSheet | Loading | Skeleton enquanto cria/busca code (`LoadingState` shimmer) |
| InviteSheet | Success | Link copiável, badge "Expira em N dias", botão "Regenerar" |
| InviteSheet | Error | Mensagem + retry (ex: rate-limited, sem internet) |
| JoinGroupScreen | Loading | Resolvendo code (deep-link recém-aberto) |
| JoinGroupScreen | Success (Preview) | Nome do grupo, avatar, count de membros, botão "Entrar" |
| JoinGroupScreen | Error (Expired) | "Convite expirado em DD/MM" + botão "Voltar" |
| JoinGroupScreen | Error (Used) | "Convite já foi utilizado" + botão "Voltar" |
| JoinGroupScreen | Error (Invalid) | "Convite inválido ou cancelado" + botão "Voltar" |

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Phone Portrait | InviteSheet ocupa bottom sheet padrão |
| Phone Landscape | InviteSheet adapta altura, link continua copiável |
| Tablet (sw600dp+) | InviteSheet em modal centralizado, ~480dp wide |

### 2.4 Acessibilidade

- [ ] `contentDescription` em ícones de "Copiar link", "Compartilhar", "Regenerar"
- [ ] Touch targets >= 48dp em todos botões da sheet
- [ ] TalkBack lê: "Link de convite. Copiar para área de transferência."
- [ ] Mensagem de TTL não usa só cor (ícone + texto)
- [ ] Contraste >= 4.5:1 em badge "Expira em N dias"

### 2.5 Animações e Micro-interações

- Snackbar "Link copiado!" ao tap "Copiar"
- Loading spinner inline ao "Regenerar" (não bloqueia sheet)
- Fade-in da preview do grupo em JoinGroupScreen (300ms)

---

## 3. Technical Design

### 3.1 Arquitetura

```
[InviteSheet (Compose)]
    ↓ ações (createInvite, regenerate)
[InviteViewModel: StateFlow<InviteUiState>]
    ↓
[InviteRepository (commonMain interface)]
    ↓
[FirebaseDataSource (nativeAndAndroidMain)]
    ↓
[Firestore: invites/ collection]
```

```
[JoinGroupScreen (Compose)]
    ↓ deep-link com code
[JoinGroupViewModel.resolveInviteCode(code)]
    ↓
[InviteRepository.lookupByCode(code)]
    ↓
1. query invites/ where code == X AND used == false AND expires_at > now
   ↓ (se não achou)
2. fallback: query groups where invite_code == X
```

### 3.2 Modelos de Dados

**Novo (em `shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/`):**

```kotlin
data class Invite(
    val id: String,                    // doc ID em invites/
    val code: String,                  // 6-8 chars alfanumericos, único
    val groupId: String,
    val inviterId: String,
    val createdAt: Long,               // epoch ms
    val expiresAt: Long?,              // null = sem TTL (caso migration)
    val used: Boolean = false,
    val usedBy: String? = null,        // userId que usou
    val usedAt: Long? = null,          // epoch ms
    val migratedFrom: String? = null   // "groups.invite_code" se veio de migração
)

sealed class InviteResolution {
    data class Found(val invite: Invite, val group: Group) : InviteResolution()
    data class FoundLegacy(val groupId: String, val group: Group) : InviteResolution()  // veio de groups.invite_code
    object Expired : InviteResolution()
    object AlreadyUsed : InviteResolution()
    object NotFound : InviteResolution()
}
```

**Compatibilidade com Web:** schema bate com docs já criados pelo Web (`invites/` collection já existe e tem campos `code, group_id, inviter_id, created_at, expires_at, used, used_by, used_at`). Adicionamos apenas `migratedFrom` (nullable, ignorado pelo Web).

### 3.3 API / Firestore

| Operação | Collection/Endpoint | Método | Payload |
|----------|---------------------|--------|---------|
| Criar invite | `invites/` (Cloud Function `createInvite` callable) | POST | `{ groupId: string, ttlDays?: number }` → `{ code: string, expiresAt: number }` |
| Lookup por code | `invites/` query | GET | `where code == X, used == false, expires_at > now` |
| Lookup legacy (fallback) | `groups/` query | GET | `where invite_code == X` |
| Marcar como usado | `invites/{id}` (Cloud Function `useInvite` callable) | POST | `{ inviteId: string, userId: string }` → atualiza `used, used_by, used_at` + adiciona userId em `groups.{id}.members` (transação) |
| Migration one-shot | Callable `migrateGroupsInviteCodeToInvites` | POST | `{}` (admin-only) → cria docs em `invites/` para cada `groups.invite_code` existente, idempotente via `migratedFrom` field |

**Por que Cloud Function (não direct write)?**
- `useInvite` precisa de **transação atômica** (marcar usado + adicionar membro). Direct write do client poderia race condition.
- `createInvite` precisa de **rate-limit** (já existe middleware) pra evitar spam.
- `migrateGroupsInviteCodeToInvites` é admin-only — Custom Claims gate.

### 3.4 Cache e Offline

| Cenário | Comportamento |
|---------|---------------|
| Sem internet ao abrir InviteSheet | Mostra último code conhecido do cache + banner "offline" |
| Sem internet ao usar deep-link | Mostra "Sem conexão. Tente novamente." (não cache de invites — security) |
| Sem internet ao "Regenerar" | Snackbar "Sem conexão" + botão retry |
| Code expirado em cache | Banner "Convite expirado, gere novo" |

**Importante:** `invites/` lookup usa `Source.SERVER` por default (security — code pode ter sido invalidado). Cache só pra código próprio do dono do grupo.

### 3.5 Segurança

- [ ] Firestore rules em `invites/` **já existem** (linhas 1222-1258) — auditar se cobre fallback writes
- [ ] `useInvite` Cloud Function valida: code existe, não usado, não expirado, user não é membro ainda
- [ ] `createInvite` Cloud Function valida: requester é membro do grupo (idealmente owner/admin)
- [ ] `migrateGroupsInviteCodeToInvites` valida: requester tem `role == 'ADMIN'` via Custom Claims
- [ ] Code generation: `crypto.randomBytes(6).toString('base64url')` no servidor (não client-generated)
- [ ] Rate limit em `createInvite`: 5 codes/grupo/hora (reusa middleware existente)
- [ ] Sem PII em logs (não logar code completo — só primeiros 2 chars + `***`)

### 3.6 Performance

- [ ] Index composto necessário: `invites: (code ASC, used ASC, expires_at ASC)` — para lookup rápido
- [ ] Já existe? Verificar `firestore.indexes.json` — se não existe, adicionar na PR
- [ ] InviteSheet não recompõe ao copiar link (use `remember` no estado de "copied")
- [ ] Preview do grupo em JoinGroupScreen usa `Source.CACHE` se grupo já conhecido localmente

### 3.7 Analytics e Observabilidade

| Evento | Quando dispara | Parâmetros |
|--------|----------------|------------|
| `invite_created` | createInvite sucesso | `group_id, inviter_id, ttl_days` |
| `invite_resolved` | lookup sucesso | `source: "invites" \| "legacy"` |
| `invite_used` | useInvite sucesso | `group_id, used_by, age_minutes` |
| `invite_failed` | lookup retorna Expired/Used/NotFound | `reason: string` |
| `invite_migration_run` | Cloud Function migrate executa | `migrated_count, skipped_count` |

**Logs Cloud Functions:** structured JSON, sem code completo. Nível INFO em sucesso, ERROR em falhas.

---

## 4. Tasks (Breakdown)

| # | Task | Camada | Estimativa | Status |
|---|------|--------|------------|--------|
| 1 | Adicionar Cloud Function `createInvite` (callable, rate-limited) | Backend | 2h | ⬜ |
| 2 | Adicionar Cloud Function `useInvite` (callable, transação atômica) | Backend | 3h | ⬜ |
| 3 | Adicionar Cloud Function `migrateGroupsInviteCodeToInvites` (callable, admin-only, idempotente) | Backend | 3h | ⬜ |
| 4 | Tests Jest para 3 functions (sucesso + edge cases: expired, used, race) | Backend | 3h | ⬜ |
| 5 | Atualizar `firestore.rules` se necessário (auditar cobertura existente) | Backend | 1h | ⬜ |
| 6 | Adicionar index composto em `firestore.indexes.json` | Backend | 0.5h | ⬜ |
| 7 | Criar `Invite` model + `InviteResolution` sealed class em `shared/commonMain/` | KMP | 1h | ⬜ |
| 8 | Criar `InviteRepository` interface em `shared/commonMain/` | KMP | 1h | ⬜ |
| 9 | Implementar `InviteRepositoryImpl` em `shared/nativeAndAndroidMain/` (chama Cloud Functions + Firestore lookup com fallback) | KMP | 4h | ⬜ |
| 10 | Tests unit do `InviteRepositoryImpl` (mock Firebase + Functions) | KMP | 2h | ⬜ |
| 11 | Atualizar `JoinGroupViewModel` para usar `InviteRepository.lookupByCode()` (com fallback path) | Android | 2h | ⬜ |
| 12 | Atualizar `InviteSheet` UI: TTL badge, regenerate button, integração `createInvite` | Android | 3h | ⬜ |
| 13 | Atualizar deep-link handler em `AppNavGraph` para passar code → `JoinGroupScreen` (já existe? verificar) | Android | 1h | ⬜ |
| 14 | Strings em `strings.xml` (PT-BR): mensagens de erro, badges, snackbars | Android | 0.5h | ⬜ |
| 15 | Tests ViewModel (`JoinGroupViewModel`, `InviteViewModel`) | Android | 2h | ⬜ |
| 16 | Atualizar Koin DI module `inviteModule` (ou similar) | Android | 0.5h | ⬜ |
| 17 | Deploy Cloud Functions em prod | Deploy | 0.5h | ⬜ |
| 18 | Rodar `migrateGroupsInviteCodeToInvites` em prod (one-shot) | Deploy | 0.5h | ⬜ |
| 19 | Code review + ajustes | Review | 2h | ⬜ |

**Total estimado:** ~32h (4 dev-days)

**Ordem recomendada:** 1-6 (backend) em paralelo com 7-10 (KMP shared). Depois 11-16 (Android UI). Depois 17-18 (deploy).

---

## 5. Verification (Verificação)

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit (Cloud Functions Jest) | createInvite, useInvite, migrate — happy path + edge cases | ⬜ |
| Unit (KMP commonTest) | InviteRepositoryImpl com fakes — fallback path, expired, used | ⬜ |
| Unit (Android ViewModel) | JoinGroupViewModel.resolveCode flows | ⬜ |
| UI (Compose Test) | InviteSheet states, JoinGroupScreen states | ⬜ |
| Emulators end-to-end | Firebase + Functions emulators rodando completo flow | ⬜ |
| Rules tests | Verificar `invites/` rules cobrem operações novas | ⬜ |

### 5.2 Cenários Manuais (QA)

- [ ] Criar code novo no Android → aparece em `invites/` no console Firestore
- [ ] Criar code novo no Web → Android consegue resolver (interop verified)
- [ ] Code antigo (criado pre-migration via `groups.invite_code`) ainda funciona em deep-link
- [ ] Code expirado → mensagem correta
- [ ] Code já usado → mensagem correta
- [ ] Code inválido → mensagem correta
- [ ] Deep-link `futebadosparcas://invite/{code}` abre app e resolve OK
- [ ] Migration roda 2x sem duplicar docs (idempotência)

### 5.3 Checklist de Revisão

- [ ] Build Android passa
- [ ] Build KMP shared passa (Android + iOS framework — pode falhar em CI Linux, normal)
- [ ] Cloud Functions build (`npm run build` em `/functions`) passa
- [ ] Lint + Detekt passam
- [ ] Todos testes passam (Android, KMP, Functions)
- [ ] Rules tests passam (Firestore Emulator)
- [ ] Strings em `strings.xml` (zero hardcode)
- [ ] Comentários em PT-BR
- [ ] Sem regressão: codes antigos continuam entrando no grupo
- [ ] Analytics implementado
- [ ] Sem PII nos logs

### 5.4 Demo

- [ ] Demo gravada: criar code Android → usar Web (interop)
- [ ] Demo: deep-link com code antigo (fallback path)
- [ ] Demo: migration run + audit no Firestore console

---

## 6. Rollout

Phased rollout pra minimizar risco — mantém compat enquanto migra:

| Phase | O quê | Quando | Critério de avanço |
|-------|-------|--------|---------------------|
| **Phase 1** | Code merged: Android lê `invites/` (canônico) com fallback `groups.invite_code` (legacy). Android cria novos codes em `invites/`. Cloud Functions deployadas. | Imediato após PR merge | CI verde, manual QA OK em internal testing |
| **Phase 2** | Migration one-shot: rodar `migrateGroupsInviteCodeToInvites` em prod via callable. Audit count antes/depois. | 1-2 dias após Phase 1 | Migration roda sem erro, count de `invites/` aumenta corretamente |
| **Phase 3** | Deprecate `groups.invite_code`: documentar como deprecated em DECISIONS.md. NÃO remover ainda — fallback continua ativo. | 4 semanas após Phase 2 | 95%+ de invite uses vem de `invites/` (analytics confirma) |
| **Phase 4** | Hard removal: remover fallback `groups.invite_code` lookup, remover campo do schema (data migration final). | Próximo major version (>= v2.0.0) | Phase 3 estável por 1+ mês |

**Rollback strategy:**
- Phase 1: revert PR — fallback path significa zero impact
- Phase 2: migration é idempotente, mas rollback puro = deletar docs em `invites/` com `migratedFrom != null`
- Phase 3-4: feature-flag controlled

---

## 7. Risks (Riscos)

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migration script não-idempotente — duplica docs | Média | Médio | Field `migratedFrom` + check `where migratedFrom == 'groups.invite_code' AND group_id == X` antes de criar |
| Dual-source-of-truth durante transição → user vê estado inconsistente | Baixa | Baixo | Lookup sempre `invites/` PRIMEIRO; só falla pra legacy se não achar. Web já usa `invites/` |
| Cloud Function `useInvite` race condition (2 users usam mesmo code simultâneo) | Média | Alto | Transação Firestore com check `used == false` no read antes de write |
| Index composto não existe → query lenta em produção | Média | Médio | Adicionar em `firestore.indexes.json` na PR; deploy antes do code merge |
| KMP build quebra em CI (já é flaky em Linux) | Alta | Baixo | Conhecido — ignorar falhas Linux, validar local em macOS via skill `futeba-kmp-build` |
| Rate-limit em `createInvite` muito restritivo (UX ruim) | Baixa | Baixo | Começar 5/h por grupo, monitorar e ajustar via Remote Config se necessário |
| Codes legacy sem TTL ficam pra sempre | Baixa | Baixo | Trade-off aceito; Phase 4 (major version) faz cleanup |
| iOS futuro tenta criar 4º sistema | Baixa | Alto | KMP shared garante reuso — todo lookup/create mora em `commonMain` |
| Migration deleta dados acidentalmente | Muito Baixa | Crítico | Cloud Function NUNCA deleta — só cria docs novos. `groups.invite_code` field permanece intacto |

---

## 8. Notas e Referências

- Issue relacionada: GitHub issue (criar se ainda não existe — referenciar quando spec for APPROVED)
- Sistemas existentes:
  - `groups.invite_code`: ver `firestore.rules` e `shared/src/nativeAndAndroidMain/.../FirebaseDataSource.kt::joinGroupByInviteCode`
  - `invites/`: ver Web em `web/src/services/inviteService.ts` (ou similar) + `firestore.rules` linhas 1222-1258
  - `group_invites/`: out-of-scope — ver decisão em `specs/DECISIONS.md`
- Decisões relacionadas: registrar em `/specs/DECISIONS.md` quando APPROVED:
  - Por que NÃO unificar com `group_invites/` (caso de uso diferente)
  - Por que Cloud Function (não direct write) pra `useInvite`
  - Por que manter `groups.invite_code` como deprecated (não remover já)
- Memory references: `project_invite_systems_divergence.md`, `project_issue_517_phase2_pending.md`
- KMP guidance: `CLAUDE.md` seção "Where to Put New Code"

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-08 | Renan + Claude | Criação inicial (DRAFT) |
