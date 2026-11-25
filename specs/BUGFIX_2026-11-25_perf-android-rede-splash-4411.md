# BUGFIX: Perf Android — descompressão OkHttp transparente e splash duplicada

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4411 (fatia rede + splash; restante em follow-up)

---

## 1. Descrição

### 1.1 Comportamento Atual (Errado)
- `NetworkKoinModule.kt:27-33` força `Accept-Encoding: gzip, deflate` via network interceptor, o que desliga a descompressão transparente do OkHttp (o cliente não remove o header nem infla a resposta via `BridgeInterceptor`). O ViaCEP retorna gzip sem inflar automaticamente.
- `SplashScreen.kt:72` tem `delay(800)` arbitrário quando há usuário (só para animação do brasão) e a app tem splash duplicada: `installSplashScreen()` do sistema (branca) + splash Compose. O usuário espera 800ms mesmo com destino já decidido.

### 1.2 Comportamento Esperado (Correto)
- Remover o header manual: OkHttp negocia gzip sozinho e infla transparentemente.
- Sistema splash fica via `setKeepOnScreenCondition { destination == null }`; Compose splash navega assim que o destino é decidido, sem delay artificial (brasão já nasce visível).

### 1.3 Passos para Reproduzir
1. Abrir o app como usuário logado. Observar splash do sistema seguida da Compose + 800ms de espera.
2. (Rede) ViaCEP com `Accept-Encoding` manual — resposta gzip não inflada transparentemente.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Issue | #4411 |
| Arquivos | `NetworkKoinModule.kt`, `SplashActivityCompose.kt`, `SplashScreen.kt` |
| Escopo DESTE PR | apenas rede + splash |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação
Lidos `NetworkKoinModule.kt` (interceptor linha 27-33) e `SplashActivityCompose`/`SplashScreen`. O `installSplashScreen()` já existe mas sem keep condition; o delay de 800ms está em `LaunchedEffect(destination)` e só serve para animação de fade (alpha inicial 0 → 1 imediato depois do delay). Remover o delay e ligar keep condition preserva o fluxo pós `SplashStartupResolver` (destino sempre decidido, com timeout).

### 2.2 Causa Raiz
Header manual quebra o contrato do OkHttp; delay fixo atrasa navegação sem necessidade.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/.../di/koin/NetworkKoinModule.kt` | remover network interceptor gzip |
| `app/.../ui/splash/SplashActivityCompose.kt` | keepOnScreenCondition |
| `app/.../ui/splash/SplashScreen.kt` | remover delay(800) |

---

## 3. Solução Proposta

### 3.1 Abordagem
1. Remover o `.addNetworkInterceptor { header Accept-Encoding }`.
2. `installSplashScreen().setKeepOnScreenCondition { destinationState == null }`; `enableEdgeToEdge()` mantido.
3. Remover `delay(800)` e import; brasão nasce com alpha=1, scale=1 quando há usuário.

### 3.2 Código Antes/Depois
```kotlin
// ANTES (rede)
.addNetworkInterceptor { chain ->
    val requestWithGzip = chain.request().newBuilder()
        .header("Accept-Encoding", "gzip, deflate").build()
    chain.proceed(requestWithGzip)
}
// DEPOIS: interceptor removido — OkHttp negocia gzip sozinho.

// ANTES (splash)
installSplashScreen()
...
if (user != null) { badgeAlpha = 1f; badgeScale = 1f; delay(800) }
// DEPOIS
installSplashScreen().setKeepOnScreenCondition { destinationState == null }
...
if (user != null) { badgeAlpha = 1f; badgeScale = 1f }
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| ViaCEP quebra sem header manual | OkHttp negocia e infla sozinho; smoke test ViaCEP no build |
| Splash branca some rápido/some devagar | keep condition = destino null; destino sempre decidido via resolver |
| Regressão em login | teste manual: app abre → Login/Main sem travar (resolver já tem timeout) |

---

## 4. Verificação

### 4.1 Testes
- [x] `./gradlew :app:compileDebugKotlin` (ver PR)
- [ ] Smoke: cold start logado/deslogado, ViaCEP (Buscar CEP) OK

### 4.2 Checklist
- [x] Build passa
- [ ] Testado em dispositivo/emulador (pendente de reviewer)

---

## 5. Fora deste PR (follow-up da #4411)
- R8 keeps amplas, baseline profile, imagens com `size`, `preferenceTheme` (deferido: themes.xml ainda usa), strings/drawables sem referência, correção de doc "14 Koin modules".

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-11-25 | Spec criada; fatia rede+splash da #4411 |
