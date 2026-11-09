# BUGFIX: splash presa em "Aquecendo os motores..." na revisão da Play (1.42.0, versionCode 83)

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL` (versão recusada pela Play)
> **Autor:** Claude (autorizado pelo dono)
> **Data:** 2026-11-09

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Em 08/11/2026 a Play recusou a 1.42.0 (versionCode 83) por "Política de recursos corrompidos: o app não está
respondendo". Evidência do revisor: depois de preencher a tela "Entrar" com a conta de revisor, o app fica parado
para sempre na splash com a frase "Aquecendo os motores... ⚽".

A splash só navega quando `userChecked == true` (`SplashScreen.kt`, `LaunchedEffect(launcherKey)`), e
`SplashActivityCompose.loadUserAndNavigate()` só marca `userChecked = true` depois que
`userRepository.getCurrentUser()` retorna. Essa chamada não tem teto de tempo.

### 1.2 Comportamento Esperado (Correto)

A splash sempre navega, em poucos segundos, para Main ou Login com estado coerente. O brasão do usuário é cosmético:
se não chegar a tempo, a splash segue sem ele.

### 1.3 Passos para Reproduzir

Não reproduzido no ambiente da Play (sem login em produção, sem a conta de revisor). O mecanismo é reproduzido por
teste com um `UserRepository` falso cuja leitura nunca completa (`awaitCancellation()`): antes da correção a decisão
da splash nunca sai; depois, sai em até 3 s.

1. Sessão do Firebase ativa no aparelho (o revisor acabou de entrar).
2. Abrir o app a frio (o caminho mais comum: fechar e abrir de novo).
3. `getCurrentUser()` cai na rede: o cache SQLDelight do usuário vale 1 minuto e o login (SDK Android em
   `data/repository/AuthRepository`) nunca grava nesse cache.
4. Se uma das leituras do Firestore não completa, a splash fica parada para sempre.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.42.0 (versionCode 83, targetSdk 36) |
| Build | release, R8 full mode, App Check Play Integrity (UNENFORCED no Firestore) |
| Frequência | Revisão da Play; sem dados no Android vitals nem no relatório de pré-lançamento |
| Conta | doc `users/{uid}` do revisor existe em produção com perfil completo (perfil ausente não é a causa) |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

- Nenhuma tela depois do login volta para a splash (`grep` de `SplashActivityCompose` só acha o manifesto). A splash
  só roda na abertura do app (launcher ou tap em push), então o revisor a viu numa abertura a frio já logado.
- `UserRepositoryImpl.getCurrentUser()` (`shared/.../data/repository/UserRepositoryImpl.kt`): cache SQLDelight com TTL
  de 60 s, depois `FirebaseUsersDataSource.getCurrentUser()`, que faz duas leituras do Firestore sem teto
  (`users/{uid}` e `users_private/{uid}`).
- `setLastLoginTime()` só era chamado no sucesso da biometria (`LoginActivityCompose`). Login por email, Google e
  cadastro nunca gravavam o horário, então `needsReauth` era sempre true: toda abertura fazia
  Splash → Login → continuação automática no `onStart` (`LoginViewModel.onGoogleSignInSuccess`, outra leitura sem
  teto) → Main. O resultado de `getCurrentUser()` na splash nem decidia o destino, mas a navegação esperava por ele.
- O mesmo padrão aparece depois da splash: `LoginViewModel` (continuação da sessão e login por email) e
  `VerificationGateViewModel.check()` (`getIdToken(false)`, que vai à rede com token expirado) esperam sem teto, com
  loading infinito.

### 2.2 Causa Raiz

A navegação da splash dependia de uma leitura de rede sem teto de tempo que só serve para desenhar o brasão
(`SplashActivityCompose.kt`, `loadUserAndNavigate()`, e `SplashScreen.kt`, `if (!userChecked) return@LaunchedEffect`).
Qualquer `Task` do Firebase que não complete (rede ou token parados) deixa a splash presa para sempre. O gatilho
exato no aparelho do revisor não foi observado (sem vitals); o mecanismo é este e é o único caminho de espera
indefinida na splash.

Causa secundária: o horário de login não era gravado fora da biometria, o que forçava a passagem pelo Login a cada
abertura e somava outra espera sem teto.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/.../ui/splash/SplashStartupResolver.kt` (novo) | decisão da splash testável, com teto de 3 s para o usuário |
| `app/.../ui/splash/SplashActivityCompose.kt` | usa o resolver; destino sempre definido; fallback para Login em erro |
| `app/.../ui/splash/SplashScreen.kt` | navega pelo destino decidido, não por `userChecked` |
| `app/.../ui/auth/LoginViewModel.kt` | grava o horário em todo login; teto de 20 s com erro de conexão |
| `app/.../ui/auth/RegisterActivityCompose.kt` | grava o horário após cadastro |
| `app/.../ui/onboarding/VerificationGateViewModel.kt` | teto de 15 s no `getIdToken(false)` do `check()`, cai em Failed com retry |
| `app/.../di/koin/ViewModelKoinModule.kt` | injeta `PreferencesManager` no `LoginViewModel` |

---

## 3. Solução Proposta

### 3.1 Abordagem

- `SplashStartupResolver` decide com estado local (`isLoggedIn()` e horário do último login) e carrega o usuário com
  `withTimeoutOrNull(3 s)`:
  - sem sessão: Login, sem rede;
  - carregou: destino pela regra de 4 horas, com brasão;
  - falhou: Login, como antes (o Login refaz a leitura e mostra erro com nova tentativa);
  - estourou o tempo: destino pela regra de 4 horas, sem brasão (sessão local válida; a Main usa o cache do
    Firestore).
- A Activity sempre define o destino; exceção inesperada vira Login.
- `LoginViewModel.onLoginSucceeded()` grava o horário do login antes de liberar a navegação.
- Tetos de 20 s no login/continuação da sessão (erro `auth_error_network`) e de 15 s no gate anti-bot (Failed com
  retry), para a espera não mudar de tela.

### 3.2 Fora do escopo

- Tetos em `UserRepositoryImpl`/`FirebaseUsersDataSource` (KMP, usados também no iOS): a navegação não depende mais
  deles na abertura.
- Regra de reautenticação de 4 horas: mantida como está.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Rede lenta (> 3 s) esconde o brasão | Cosmético; a navegação segue normal |
| Timeout com sessão válida manda para a Main sem o usuário carregado | A Main carrega os próprios dados e tem estados de erro; o gate anti-bot lê o token, não o doc |
| Login lento legítimo (> 20 s) vira erro | Mensagem "Sem conexão" e o usuário tenta de novo |

---

## 4. Verificação

- [x] `SplashStartupResolverTest` (8 casos, tempo virtual). Leitura que nunca completa: com a correção decide em até
      3 s; sem o teto, o `withTimeout(30 s)` externo do teste estoura.
- [x] `LoginViewModelTest` (6 casos novos): horário gravado em login por email e Google, não gravado em erro, falha ao
      gravar não bloqueia, login e continuação que nunca respondem viram `auth_error_network`.
- [x] `VerificationGateViewModelTest`: `getIdToken` que nunca completa vira `Failed(postVerify=false)`.
- [x] Os 7 testes novos falham com o comportamento antigo (teto removido ou horário não gravado) e passam com a
      correção.
- [x] `./gradlew :app:testDebugUnitTest`, `:app:assembleDebug`, `detekt`.
- [ ] Smoke test em aparelho com o AAB de release antes do reenvio: abrir logado, fechar, abrir de novo (manual).
