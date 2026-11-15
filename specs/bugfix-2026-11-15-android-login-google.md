# BUGFIX: Login com Google falha no Android (primeiro acesso e mensagens genéricas)

> **Status:** `APPROVED` → `IN_PROGRESS`
> **Severidade:** `CRITICAL`
> **Autor:** Claude Code (pedido do Renan em 15/11/2026)
> **Data:** 2026-11-15
> **PR:** a definir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- Quem entra com Google pela primeira vez (conta nova no Firebase Auth) vê "Erro ao autenticar. Tente novamente" e não entra.
- Qualquer falha do Credential Manager (inclusive o usuário fechar a folha do Google) mostra a mesma mensagem genérica.
- Aparelho sem conta Google configurada para o app (`NoCredentialException`) não tem saída: só o erro genérico.
- A cada login, a foto do Google sobrescreve a foto que o usuário escolheu no perfil.

### 1.2 Comportamento Esperado (Correto)

- Primeiro acesso com Google entra normalmente: o app espera o documento `users/{uid}` que a Cloud Function `onUserCreate` cria.
- Cancelar a folha do Google não mostra erro.
- Sem credencial salva, o app abre o fluxo "Fazer login com o Google" (`GetSignInWithGoogleOption`).
- Erros têm mensagens específicas em pt-BR.
- A foto do Google só preenche o perfil quando ele não tem foto; falha nessa gravação nunca derruba o login.

### 1.3 Passos para Reproduzir

1. Instalar o app Android (1.43.x) num aparelho.
2. Tocar em "Entrar com Google" com uma conta Google que nunca usou o Futeba.
3. O Firebase Auth cria o usuário, mas o login termina com erro.

### 1.4 Contexto

- Plataformas: Android e iOS (código compartilhado em `shared/src/nativeAndAndroidMain`).
- Afeta todo usuário novo que entra com Google; usuários com documento já criado entram.

## 2. Análise de Causa Raiz

### 2.1 Investigação

- SHA-1 de assinatura do Play, client ID web, provedor Google e App Check conferidos: corretos.
- Crash de Koin da 1.43.0 já corrigido na 1.43.1 (#4551).
- O mapeador `toUserOrNull()` tolera inteiros lidos como `Double` (o decodificador do GitLive converte qualquer `Number`).

### 2.2 Causa Raiz

**Falha vista no aparelho do Renan (Crashlytics, 15/11/2026 04:02 UTC, Android 1.43.1, Xiaomi):**
`SerializationException: Serializer for class 'kotlin.Any' is not found` em
`FirebaseMappingExtensions.safeLong` ← `toUserOrNull` ← `getCurrentAuthUser`. Na tag `android-v1.43.1`, o
`safeLong` lê `get<Any?>(field)`, que não tem serializador; como `toUserOrNull` chama `safeLong("created_at")` em
todo documento, **qualquer login** na 1.43.1 quebra logo depois de autenticar. Master já corrigiu com
`getScalar` (#4544, commit `a71d4a75`), que não entrou na 1.43.1. A correção para o usuário é publicar uma versão
Android a partir de master com este PR.

**Primeiro acesso (corrigido neste PR):**

`FirebaseUsersDataSource.getCurrentAuthUser()` lê `users/{uid}` cerca de 100 ms depois do `signInWithCredential`. Para usuário novo, a `onUserCreate` ainda não criou o documento (leva alguns segundos), e o app tenta criá-lo no cliente com `set({id})` + `update(...)`. Em prod a função levou 6 a 7 s nas contas Google de novembro, e nenhuma delas voltou a fazer login depois do
cadastro. A regra `match /users/{userId}` (`allow create`) exige `role == 'PLAYER'`, código de convite válido e proíbe `level`, `experience_points`, `milestones_achieved` e `auto_*`. O `set` só com `id` é sempre negado, e a falha vira "Erro ao autenticar".

Na tela, `LoginActivityCompose.signInWithGoogle()` trata toda `GetCredentialException` igual, sem distinguir cancelamento nem `NoCredentialException`.

### 2.3 Arquivos Afetados

- `shared/src/nativeAndAndroidMain/kotlin/com/futebadosparcas/platform/firebase/FirebaseUsersDataSource.kt`
- `app/src/main/java/com/futebadosparcas/ui/auth/LoginActivityCompose.kt`
- `app/src/main/res/values/strings.xml`

## 3. Solução Proposta

### 3.1 Abordagem

1. Remover a criação do documento no cliente. Se ele não existe, consultar de novo com espera crescente (cerca de 14 s no total, dentro do limite de 20 s do `LoginViewModel`). Se não aparecer, falhar com mensagem clara ("Sua conta está sendo preparada. Tente de novo em instantes.").
2. Sincronizar a foto do Google só quando o perfil está sem foto, em `try/catch` (melhor esforço).
3. Na tela: cancelamento não mostra erro; `NoCredentialException` tenta de novo com `GetSignInWithGoogleOption`; outras falhas usam mensagens específicas.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| `onUserCreate` fora do ar ou lenta | Mensagem clara e nova tentativa; o usuário já existe no Auth, então o próximo login encontra o documento |
| Usuário sem foto continuar sem foto se a gravação falhar | Melhor esforço; o próximo login tenta de novo |

## 4. Verificação

### 4.1 Testes Adicionados

- Teste unitário do mapeamento de exceções do Credential Manager para mensagens.

### 4.3 Checklist

- [ ] `./gradlew :app:compileDebugKotlin`
- [ ] `./gradlew :app:testDebugUnitTest --tests "*Login*"`
- [ ] `./gradlew :shared:compileKotlinIosSimulatorArm64`

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

Os testes usam contas com documento já criado; o caminho "documento ainda não existe" nunca rodou contra as regras reais.

### 5.2 Ações para evitar bugs similares

- Cliente nunca cria `users/{uid}`; a fonte é a `onUserCreate`.

## Histórico

| Data | Mudança |
|---|---|
| 2026-11-15 | Criação e aprovação (pedido do Renan: "Localize todos os erros e corrija") |
