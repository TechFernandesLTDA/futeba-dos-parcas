# Security Rules

Regras de segurança para o projeto Futeba dos Parças.

## Arquivos Sensíveis - NUNCA Commitar

```
.env
*.json.example
serviceAccountKey.json
google-services.json (em alguns casos)
*.keystore
*.jks
signing.properties
```

## Código

### Evitar Vulnerabilidades OWASP Top 10

- **Injection**: Usar queries parametrizadas, nunca concatenar strings
- **XSS**: Sanitizar inputs do usuário
- **Auth**: Validar tokens no backend, não confiar no cliente

### Dados Sensíveis

```kotlin
// ERRADO - Hardcoded secrets
val apiKey = "sk-abc123..."

// CORRETO - BuildConfig ou EncryptedSharedPreferences
val apiKey = BuildConfig.API_KEY
```

### EncryptedSharedPreferences

```kotlin
val encryptedPrefs = EncryptedSharedPreferences.create(
    "secret_prefs",
    masterKey,
    context,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuário só pode ler/escrever seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Jogos - apenas membros do grupo podem ver
    match /games/{gameId} {
      allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/groups/$(resource.data.groupId)/members/$(request.auth.uid));
    }
  }
}
```

## Cloud Functions

- Sempre verificar `context.auth` antes de operações
- Usar `onCall` com validação, não `onRequest` exposto
- Rate limiting para operações sensíveis

## Logs

- NUNCA logar senhas, tokens, ou PII
- Usar níveis apropriados (DEBUG para dev, ERROR para prod)
- Sanitizar dados antes de logar
