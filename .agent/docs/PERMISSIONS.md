# Sistema de Permissões e Segurança (Auditado)

Este documento detalha o sistema de permissões atual do "Futeba dos Parças", refletindo a implementação no código do App e as regras de segurança do Firebase.

## 🎭 Níveis de Acesso (Roles)

| Role | Identificador | Descrição |
| :--- | :--- | :--- |
| **Jogador** | `PLAYER` | Usuário padrão. Pode criar jogos, confirmar presença e ver estatísticas. |
| **Organizador** | `FIELD_OWNER` | Dono de quadra. Pode cadastrar locais, quadras e gerenciar reservas. |
| **Administrador** | `ADMIN` | Superusuário. Acesso irrestrito a todas as funcionalidades e dados. |

---

## 🔒 Matriz de Permissões (Firestore & Storage)

### 1. Jogos (`games`)

| Ação | Permissão | Regra Firebase |
| :--- | :--- | :--- |
| **Ler** | Todos (Autenticados) | `allow read: if isAuthenticated()` |
| **Criar** | Todos | `allow create: if isAuthenticated()` |
| **Editar** | Dono do Jogo ou Admin | `allow update: if isAdmin() || IsOwner...` |
| **Deletar** | Dono do Jogo ou Admin | `allow delete: if isAdmin() || IsOwner...` |

### 2. Confirmados (`confirmations`)

| Ação | Permissão | Regra Firebase |
| :--- | :--- | :--- |
| **Confirmar** | Próprio Usuário | `allow create: if userId == auth.uid` |
| **Remover** | Próprio, Dono do Jogo ou Admin | `allow delete: if isAdmin() || userId == auth.uid || IsGameOwner` |

### 3. Locais e Quadras (`locations`, `fields`)

| Ação | Permissão | Regra Firebase |
| :--- | :--- | :--- |
| **Criar Local** | Todos (Autenticados) | `allow create: if isAuthenticated()` |
| **Editar Local** | Dono do Local ou Admin | `allow update: if isAdmin() || IsOwner...` |
| **Criar/Editar Quadra** | Dono do Local ou Admin | `allow create/update: if isAdmin() || IsLocationOwner...` |
| **Upload Fotos** | Todos (Autenticados) | `storage.rules`: Pasta `fields_photos` e `locations_photos` liberadas. |

### 4. Times e Súmula (`teams`, `live_games`, `player_stats`)

| Ação | Permissão | Regra Firebase |
| :--- | :--- | :--- |
| **Gerenciar** | Dono do Jogo ou Admin | `allow write: if isAdmin() || IsGameOwner...` |

### 5. Usuários (`users`)

| Ação | Permissão | Regra Firebase |
| :--- | :--- | :--- |
| **Ler** | Todos | `allow read: if isAuthenticated()` |
| **Editar Perfil** | Próprio Usuário | `allow update: if userId == auth.uid` (exceto `role`) |
| **Promover (Role)** | Apenas Admin | `allow update: if isAdmin()` |

---

## 🛠️ Guia para Desenvolvedores

### Como verificar permissões no código (Kotlin)

Use as funções auxiliares na classe `User`:

```kotlin
val user = currentUser

if (user.isAdmin()) {
    // Mostrar menu admin, botão de deletar forçado, etc.
}

if (user.isFieldOwner()) {
    // Mostrar dashboard de locais
}

// "Can Manage Game" = Dono OU Admin
if (game.ownerId == user.id || user.isAdmin()) {
    enableEditButtons()
}
```

### Como conceder permissões (Firebase Console)

Para tornar um usuário Admin:

1. Acesse o Firestore Database > `users`.
2. Encontre o documento do usuário.
3. Altere o campo `role` para `"ADMIN"` (maiúsculo).

### Troubleshooting Comum

* **Erro `PERMISSION_DENIED` ao criar quadra**: Verifique se `role` é "ADMIN" ou se o usuário é o `owner_id` do Local.
* **Erro ao salvar foto**: Verifique `storage.rules`. (Atualmente `fields_photos` e `locations_photos` estão liberados).
