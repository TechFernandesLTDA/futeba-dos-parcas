# SECURITY & PRIVACY - Futeba dos Parças

> Diretrizes de segurança e privacidade para proteção de dados do usuário.
> Última atualização: 2025-01-10

---

## 1. DADOS SENSÍVEIS

### 1.1 Classificação de Dados

| Categoria | Exemplos | Proteção |
|-----------|----------|----------|
| **Críticos** | Senhas, tokens, API keys | Nunca logar, encrypted storage |
| **PII** | Email, telefone, nome completo | Apenas log quando necessário |
| **Sensitive** | XP, histórico de jogos | Não expor em logs públicos |
| **Public** | Nome de exibição, nível | OK para logs/analytics |

### 1.2 PII (Personally Identifiable Information)

**Dados considerados PII:**
- Email
- Telefone
- Nome completo
- Foto de perfil
- Localização (precisa)
- Data de nascimento

**Regras:**
- ✅ Pode armazenar em Firestore (com regras de segurança)
- ❌ NUNCA logar PII em plaintext
- ✅ Pode mostrar ao próprio usuário
- ❌ NUNCA expor em analytics sem hash/anonimização

---

## 2. ARMAZENAMENTO SEGURO

### 2.1 EncryptedSharedPreferences

**Usar para:**
- FCM tokens
- Timestamps de login
- Chaves de criptografia
- Configurações sensíveis

```kotlin
val encryptedPrefs = EncryptedSharedPreferences.create(
    "secret_prefs",
    masterKey,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Uso
encryptedPrefs.edit()
    .putString("fcm_token", token)
    .apply()
```

### 2.2 Firebase Security Rules

**Regras Firestore:**
```javascript
// Exemplo: users collection
match /users/{userId} {
    // Usuário só pode ler/escrever seus próprios dados
    allow read, write: if request.auth != null
        && request.auth.uid == userId;

    // Admin pode ler todos
    allow read: if isAdmin();
}

// Exemplo: games collection
match /games/{gameId} {
    // Membros do grupo podem ver
    allow read: if request.auth != null
        && isMember(resource.data.groupId);

    // Apenas dono pode editar
    allow write: if request.auth != null
        && resource.data.ownerId == request.auth.uid;
}
```

### 2.3 App Check

**Configurado em FutebaApplication.kt:**
```kotlin
if (BuildConfig.DEBUG) {
    firebaseAppCheck.installAppCheckProviderFactory(
        DebugAppCheckProviderFactory.getInstance()
    )
} else {
    firebaseAppCheck.installAppCheckProviderFactory(
        PlayIntegrityAppCheckProviderFactory.getInstance()
    )
}
```

---

## 3. PERMISSÕES

### 3.1 Permissões do App

| Permissão | Uso | Justificativa |
|-----------|-----|---------------|
| `INTERNET` | Firebase, APIs | Core functionality |
| `ACCESS_FINE_LOCATION` | Mapa de locais | Feature de Nearby |
| `POST_NOTIFICATIONS` | FCM | Notificações de jogos |
| `CAMERA` | Foto de perfil | User avatar |
| `READ_EXTERNAL_STORAGE` | Galeria de fotos | User avatar |
| `USE_BIOMETRIC` | Biometric login | UX alternativo |

### 3.2 Solicitação de Permissões

**Sempre explicar o motivo:**
```kotlin
if (ContextCompat.checkSelfPermission(requireContext(),
        Manifest.permission.ACCESS_FINE_LOCATION) !=
        PackageManager.PERMISSION_GRANTED) {

    // Mostrar explicação antes de pedir
    showRationaleDialog(R.string.location_permission_rationale) {
        requestLocationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
    }
}
```

---

## 4. LOGGING SEGURO

### 4.1 O QUE NUNCA LOGAR

```kotlin
// ❌ NUNCA
Log.d("Auth", "User logged in: email@domain.com password123")
Log.d("Payment", "Credit card: 4532-xxxx-xxxx-7890")
Log.d("API", "Using API key: sk-abc123...")

// ✅ CORRETO
Log.d("Auth", "User logged in: userId=${user.id}")
Log.d("Payment", "Payment processed for order=${orderId}")
Log.d("API", "API call made to endpoint=${endpoint}")
```

### 4.2 PII em Logs

**Hash quando necessário:**
```kotlin
// Para analytics/tracking
val hashedEmail = hash256(email)
Log.d("Analytics", "User action from: ${hashedEmail}")
```

### 4.3 Debug vs Release

```kotlin
if (BuildConfig.DEBUG) {
    // Logs detalhados apenas em debug
    Log.d("ViewModel", "State: $state")
}
```

---

## 5. AUTENTICAÇÃO

### 5.1 Firebase Auth

**Providers configurados:**
- Google Sign-In
- Email/Password

**Regras:**
- Senhas NUNCA armazenadas localmente
- Tokens gerenciados pelo Firebase
- Refresh automático via SDK

### 5.2 Google Sign-In

```kotlin
val googleIdOption = GetGoogleIdOption.Builder()
    .setServerClientId(getString(R.string.default_web_client_id))
    .setAutoSelectEnabled(true)
    .build()

// NUNCA expor server client ID em logs
```

### 5.3 Biometric Authentication

**Disponível como opção alternativa:**
```kotlin
val biometricPrompt = BiometricPrompt(
    fragment,
    ContextCompat.getMainExecutor(context),
    object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            // Login bem-sucedido
        }
    }
)
```

---

## 6. COMUNICAÇÃO SEGURA

### 6.1 HTTPS Only

```xml
<!-- AndroidManifest.xml -->
<application
    android:usesCleartextTraffic="false"
    ...>
```

### 6.2 Certificate Pinning (se aplicável)

```kotlin
// Para APIs críticas, considerar certificate pinning
val okHttpClient = OkHttpClient.Builder()
    .certificatePinner(
        CertificatePinner.Builder()
            .add("api.example.com", "sha256/AAAAAAAAAA...")
            .build()
    )
    .build()
```

---

## 7. VULNERABILIDADES COMUNS

### 7.1 OWASP Mobile Top 10

| Vulnerabilidade | Status | Mitigação |
|-----------------|--------|-----------|
| Improper Platform Usage | ✅ OK | Uso correto de APIs Android |
| Insecure Data Storage | ✅ OK | EncryptedSharedPreferences |
| Insecure Communication | ✅ OK | HTTPS only |
| Insecure Authentication | ✅ OK | Firebase Auth |
| Insufficient Cryptography | ✅ OK | AES256_GCM |
| Insecure Authorization | ✅ OK | Firestore rules |
| Client Code Quality | ⚠️ Em andamento | Lint + testes |
| Code Tampering | ⚠️ Parcial | ProGuard + App Check |
| Reverse Engineering | ⚠️ Parcial | ProGuard (release) |
| Extraneous Functionality | ✅ OK | Sem código oculto |

### 7.2 Prevenção de Injection

```kotlin
// ❌ ERRADO - SQL injection (se usar SQL raw)
db.execSQL("DELETE FROM users WHERE id = $userId")

// ✅ CORRETO - parâmetros
db.delete("users", "id = ?", arrayOf(userId))

// ❌ ERRADO - Firestore injection (não existe, mas conceito similar)
// Sempre usar parâmetros em queries
```

### 7.3 XSS Prevention

**Não aplicável diretamente (não é web), mas:**
- Sanitizar inputs do usuário antes de exibir
- Usar `stringResource()` para strings estáticas
- Validar inputs antes de salvar

---

## 8. PRIVACIDADE

### 8.1 LGPD Compliance

**Direitos do usuário:**
- ✅ Acesso aos dados (Profile screen)
- ✅ Edição (EditProfile screen)
- ✅ Exclusão (via suporte)
- ✅ Portabilidade (export em JSON - TODO)

**Coleta de dados:**
- Apenas dados necessários para funcionamento
- Consentimento explícito para localização
- Opção de não compartilhar foto

### 8.2 Analytics

**Firebase Analytics:**
- Sem PII em eventos
- Eventos anonymizados por padrão
- Opt-out via Remote Config

```kotlin
// ✅ CORRETO
analytics.logEvent("game_confirmed", bundleOf(
    "game_id" to gameId,
    "player_count" to playerCount
))

// ❌ ERRADO
analytics.logEvent("game_confirmed", bundleOf(
    "user_email" to user.email,
    "user_phone" to user.phone
))
```

---

## 9. CRASH REPORTING

### 9.1 Crashlytics

**Configuração segura:**
- PII removido automaticamente
- Stack traces sem dados sensíveis
- Logs sanitizados antes de enviar

```kotlin
// Adicionar contexto sem PII
FirebaseCrashlytics.getInstance().setCustomKey("user_level", user.level)
FirebaseCrashlytics.getInstance().setUserId(user.id) // apenas ID, não email
```

### 9.2 Non-Fatal Exceptions

```kotlin
try {
    riskyOperation()
} catch (e: Exception) {
    // Log sem PII
    FirebaseCrashlytics.getInstance().recordException(e)
}
```

---

## 10. CHECKLIST DE SEGURANÇA

### 10.1 Antes de Commit

- [ ] Sem secrets no código
- [ ] Sem PII em logs
- [ ] EncryptedSharedPreferences para dados sensíveis
- [ ] HTTPS para todas as requisições
- [ ] Permissões justificadas

### 10.2 Antes de Release

- [ ] ProGuard ativo
- [ ] App Check ativo (prod)
- [ ] Crashlytics configurado
- [ ] Sem logs em produção
- [ ] Security rules revisadas

---

## 11. INCIDENT RESPONSE

### 11.1 Se Descobrir Vulnerabilidade

1. **Não commitar correção pública**
2. Reportar via canal privado
3. Avaliar impacto
4. Preparar correção
5. Testar exaustivamente
6. Deploy em janela de manutenção

### 11.2 Contatos de Segurança

- Security Lead: [nome/email]
- Firebase Console: https://console.firebase.google.com/
- Bug Bounty: [se aplicável]

---

## 12. REFERÊNCIAS

- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [Firebase Security](https://firebase.google.com/docs/security)
- [Android Security Best Practices](https://developer.android.com/topic/security/best-practices)
- [LGPD](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
