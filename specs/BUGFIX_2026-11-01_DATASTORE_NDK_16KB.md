# BUGFIX: libdatastore_shared_counter.so marcada pela Play como compilada com NDK antigo (16 KB)

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM` (aviso da Play Console na 1.41.0, versionCode 82)
> **Autor:** Claude (autorizado pelo dono)
> **Data:** 2026-11-01

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

A Play Console avisa que `base/lib/arm64-v8a/libdatastore_shared_counter.so` e
`base/lib/x86_64/libdatastore_shared_counter.so` "foram compiladas com um NDK antigo" e "podem
falhar em dispositivos de 16 KB". A `.so` vem do `androidx.datastore:datastore-core-android`,
puxado por `datastore-preferences:1.2.0`.

### 1.2 Comportamento Esperado (Correto)

Nenhuma `.so` do APK/AAB linkada com NDK anterior ao suporte a 16 KB.

---

## 2. Análise de Causa Raiz

O alinhamento ELF não é o problema: em todas as versões o `p_align` dos segmentos `PT_LOAD` já é
`0x4000`, e a guarda `scripts/ci/check-16kb-alignment.js` passa. O que muda é o NDK registrado na
nota `.note.android.ident`, que a Play usa no aviso:

| datastore-core-android | NDK (`.note.android.ident`) | API mínima | p_align |
|---|---|---|---|
| 1.2.0 (atual) | r20 (build 5594570) | 21 | 0x4000 |
| 1.2.1 | r20 (build 5594570) | 21 | 0x4000 |
| 1.3.0 | **r27** (build 12077973) | 24 | 0x4000 |

A 1.2.1 traz o mesmo binário de NDK r20. A 1.3.0 é a primeira versão estável com a `.so`
recompilada (clang 18.0.1, r522817).

## 3. Solução

`androidx.datastore:datastore-preferences` 1.2.0 → 1.3.0 em `app/build.gradle.kts`.

Efeitos transitivos no `releaseRuntimeClasspath`:

- `kotlinx-coroutines-core` 1.9.0 e `kotlin-stdlib` 2.2.20 são requisitos mínimos; o projeto já usa
  1.11.0 e 2.4.20.
- `androidx.tracing` 1.2.0 → 2.0.1. É compatível em binário: `javap` da classe
  `androidx.tracing.Trace` mantém os mesmos métodos estáticos (`isEnabled`, `beginSection`,
  `endSection`, `beginAsyncSection`, `endAsyncSection`, `setCounter`) e só acrescenta
  `setCounter(String, long)`. O `TraceKt` (`trace {}`) tem a mesma assinatura.
- API mínima da `.so` passa a 24, igual ao `minSdk` do app.

### Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Mudança de comportamento do DataStore (tema, rascunho de jogo, busca) | Mesma API pública; `GlobalSearchViewModelTest` e build completo |
| `androidx.tracing` 2.x quebrar Compose/Room/WorkManager | Assinaturas idênticas conferidas com `javap`; R8 do release sem avisos novos |

## 4. Verificação

- [x] `./gradlew :app:compileDebugKotlin` e `:app:assembleDebug`
- [x] `node scripts/ci/check-16kb-alignment.js app-debug.apk`: 4 `.so` OK
- [x] `.note.android.ident` da `.so` empacotada no APK: `r27`
- [x] `GlobalSearchViewModelTest`
- [x] `./gradlew :app:minifyReleaseWithR8` sem avisos novos sobre `androidx.tracing`/`androidx.datastore`
- [ ] Conferir na Play Console, no próximo upload, que o aviso sumiu

## 5. Observação

`libandroidx.graphics.path.so` (androidx.graphics) vem do NDK r25c e não foi citada pela Play.
