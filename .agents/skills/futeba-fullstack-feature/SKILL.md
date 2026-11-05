---
name: futeba-fullstack-feature
description: Pattern para implementar feature full-stack que toca rules + Cloud Function + web + Android. Usado em PR #526 (issue #517 Phase 2 — request to join). Use quando feature precisa coordenar 4 layers ou usuário pedir "implementar completo".
---

# Futeba Full-Stack Feature

Feature que precisa de Firestore rules + Cloud Function + UI web + UI Android segue esse padrão. Validado em [PR #526](https://github.com/TechFernandesLTDA/futeba-dos-parcas/pull/526) (request-to-join, issue #517 Phase 2).

## Estrutura recomendada

| Layer | Arquivos | Tests |
|-------|----------|-------|
| **3 — Rules** | `firestore.rules` | `firestore-rules-tests/src/<feat>.test.ts` |
| **2 — Function** | `functions/src/<scope>/<name>.ts` + export em `functions/src/index.ts` | `functions/test/<name>.test.ts` |
| **Web UI** | `web/src/hooks/use<Feature>.ts` + screen edits em `web/src/pages/...` | (vitest se aplicável) |
| **Android UI** | `app/.../data/repository/<Feature>Repository.kt` + `app/.../ui/<scope>/<Feature>ViewModel.kt` + screen edits | `app/src/test/.../<Feature>ViewModelTest.kt` |
| **DI** | `app/.../di/koin/AppKoinModule.kt` (repo) + `ViewModelKoinModule.kt` (VM) | — |
| **Strings** | `app/src/main/res/values/strings.xml` | — |

## Ordem de implementação (deepest first)

```
1. Spec em /specs/feat-<nome>.md (per Regra #1 SDD)
2. Layer 3 — Firestore rules + tests (rodar npm test em firestore-rules-tests)
3. Layer 2 — Cloud Function + tests (npm run build + npx jest em functions/)
4. Web UI (typecheck + npm run build em web/)
5. Android UI (./gradlew :app:compileDebugKotlin + testes)
6. PR único bundleando tudo (referência issue)
7. Deploy: rules → functions → hosting (em worktree isolado)
```

Test cada camada conforme escreve. Não acumular bugs em camadas.

## Template Cloud Function trigger

```typescript
// functions/src/<scope>/<name>.ts
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FUNCTION_REGION} from "../constants";

export const onSomethingChanged = onDocumentUpdated(
  {
    document: "groups/{groupId}/sub_collection/{itemId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    if (!event.data) return;
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!before || !after) return;

    // Só processa transição esperada (idempotência)
    if (before.status !== "PENDING" || after.status !== "APPROVED") return;

    // Validação defesa em profundidade (rules + function)
    // ...

    // Idempotência via check exists antes de criar member/etc
    // ...

    // Batch atomico
    const batch = admin.firestore().batch();
    // ... batch.set / batch.update
    await batch.commit();

    // Side effects best-effort (push) NUNCA bloqueiam o fluxo
    try {
      // sendNotificationToUser(...)
    } catch (e) {
      logger.warn("side effect failed", { error: (e as Error).message });
    }
  }
);
```

E exportar em `functions/src/index.ts`:
```typescript
export * from "./<scope>/<name>";
```

## Template Firestore rules (subcoleção)

```javascript
match /groups/{groupId} {
  // ... rules existentes ...

  match /<sub_collection>/{itemId} {
    function isGroupOwnerById2(gId) {
      let groupDoc = get(/databases/$(database)/documents/groups/$(gId));
      return groupDoc != null && groupDoc.data.owner_id == userId();
    }

    allow read: if isAuthenticated() && (
      itemId == userId() ||
      isGroupOwnerById2(groupId) ||
      isGroupAdmin(groupId)
    );

    allow create: if isAuthenticated() &&
      itemId == userId() &&
      request.resource.data.user_id == userId() &&
      request.resource.data.status == 'PENDING' &&
      // Pre-condições negocio
      get(/databases/$(database)/documents/groups/$(groupId)).data.is_public == true;

    allow update: if isAuthenticated() &&
      isGroupOwnerById2(groupId) &&
      resource.data.status == 'PENDING' &&
      (request.resource.data.status == 'APPROVED' || request.resource.data.status == 'REJECTED');

    allow delete: if isAuthenticated() && (
      itemId == userId() || isGroupOwnerById2(groupId)
    );
  }
}
```

## Template rules tests

⚠️ Em `firestore-rules-tests/src/`, **não use `clearFirestore()`** em beforeEach — quebra outras suites paralelas. Use `afterEach` específico:

```typescript
async function cleanupSubCollection() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore().collection(`groups/${GROUP_ID}/<sub>`).get();
    for (const doc of snap.docs) await doc.ref.delete();
  });
}

describe("<sub> — CREATE", () => {
  afterEach(cleanupSubCollection);
  it("...", async () => { ... });
});
```

## Template Android repo + VM

```kotlin
// app/.../data/repository/<Feature>Repository.kt
class <Feature>Repository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) {
    fun observeMyItem(groupId: String): Flow<Item?> = callbackFlow { ... }
    suspend fun create(...): Result<Unit> = ...
    suspend fun update(...): Result<Unit> = ...
}

// app/.../ui/.../<Feature>ViewModel.kt
sealed class <Feature>State {
    data object Loading : <Feature>State()
    data object Empty : <Feature>State()
    data class Success(val data: T) : <Feature>State()
    data class Error(val message: String) : <Feature>State()
}

class <Feature>ViewModel(repo: <Feature>Repository, ...) : ViewModel() {
    private val _state = MutableStateFlow<<Feature>State>(<Feature>State.Loading)
    val state: StateFlow<<Feature>State> = _state.asStateFlow()

    private var job: Job? = null

    fun observe(groupId: String) {
        job?.cancel()
        job = repo.observeMyItem(groupId)
            .onEach { ... _state.value = ... }
            .catch { e -> _state.value = <Feature>State.Error(e.message ?: "Erro") }
            .launchIn(viewModelScope)
    }

    override fun onCleared() { job?.cancel(); super.onCleared() }
}
```

DI:
```kotlin
// AppKoinModule.kt
single<<Feature>Repository> { <Feature>Repository(get(), get()) }

// ViewModelKoinModule.kt
viewModel { <Feature>ViewModel(get(), ...) }
```

## Template Web hook

```typescript
// web/src/hooks/use<Feature>.ts
export function useMyItem(groupId: string | undefined) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !uid) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, `groups/${groupId}/<sub>/${uid}`), snap => {
      setItem(snap.exists() ? snap.data() as Item : null);
      setLoading(false);
    });
    return () => unsub();
  }, [groupId, uid]);

  const create = useCallback(async () => { ... }, [...]);
  return { item, loading, create };
}
```

## Validation checklist

- [ ] Spec aprovada em `/specs/`
- [ ] Rules: 80%+ test coverage (read/create/update/delete + negative cases)
- [ ] Function: idempotência testada (não duplica em re-run)
- [ ] Function: batch atomico, side effects best-effort
- [ ] Web: TypeScript strict, hook sem race conditions (useEffect cleanup)
- [ ] Android: ViewModel cancela jobs em onCleared, sealed state
- [ ] Strings em strings.xml (regra #6 AGENTS.md)
- [ ] Compose: MaterialTheme.colorScheme.* (regra #5)
- [ ] PR único cobrindo tudo, descrição com Refs #issue

## Deploy pós-merge

```bash
# Rules (additive — safe)
DEPLOY_DIR=/tmp/futeba-deploy-$$
git worktree add "$DEPLOY_DIR" origin/master
cd "$DEPLOY_DIR"
firebase deploy --only firestore:rules --project futebadosparcas --non-interactive

# Function (deploy só a nova)
cd "$DEPLOY_DIR/functions" && npm ci && npm run build
cd "$DEPLOY_DIR"
firebase deploy --only functions:<funcName> --project futebadosparcas --non-interactive

# Web (se tem mudança UI)
cd "$DEPLOY_DIR/web" && npm ci --legacy-peer-deps && npm run build
cd "$DEPLOY_DIR"
firebase deploy --only hosting --project futebadosparcas --non-interactive

# Cleanup
git worktree remove --force "$DEPLOY_DIR"
```

## Refs

- Exemplo concreto: PR #526 (issue #517 Phase 2)
- Skill `futeba-deploy` — deploy detalhes
- Skill `futeba-spec` — criar spec antes
- AGENTS.md Regra #1 — spec antes de implementar
