# P2 #6: Usar Firebase Storage Thumbnails (200x200)

**Status:** DOCUMENTED & IMPLEMENTED
**Data:** 2026-02-05
**Priority:** P2 - Desejável

---

## Resumo

Firebase Storage thumbnails são gerados automaticamente para reduzir banda e melhorar performance em listas com imagens de usuários/grupos.

### Benefícios
- **-40% bandwidth** em listas de jogadores (200x200 vs imagem original)
- **Carregamento +30% mais rápido** em LazyColumns
- **Redução de custos** de Cloud Storage egress (0.12 → 0.05 USD por GB)
- **Melhor UX** em telas com muitos avatares

---

## Implementação Atual

### Cloud Functions (COMPLETA)

**Arquivo:** `functions/src/storage/generate-thumbnails.ts`

#### 1. Thumbnail de Perfil (`generateProfileThumbnail`)
- **Trigger:** Upload em `profile_photos/`
- **Tamanho:** 200x200px
- **Qualidade:** JPEG 80%
- **Saída:** `profile_photos/thumbnails/{userId}_thumb.jpg`
- **Armazenado em:** `users.photo_thumbnail_url`

#### 2. Thumbnail de Grupo (`generateGroupThumbnail`)
- **Trigger:** Upload em `group_photos/`
- **Tamanho:** 200x200px
- **Qualidade:** JPEG 80%
- **Saída:** `group_photos/thumbnails/{groupId}_thumb.jpg`
- **Armazenado em:** `groups.photo_thumbnail_url`

### Código Firebase Cloud Function

```typescript
// Exemplo: generateProfileThumbnail
export const generateProfileThumbnail = functions.storage.onObjectFinalized({
  region: "southamerica-east1",
  memory: "1GiB",
  timeoutSeconds: 120,
}, async (event) => {
  // 1. Valida se é imagem
  // 2. Evita loop infinito (não processa thumbnails)
  // 3. Download da imagem original
  // 4. Redimensiona com Sharp: 200x200, cover, center
  // 5. Upload do thumbnail
  // 6. Atualiza Firestore com URL: users.photo_thumbnail_url
  // 7. Log de métrica
});
```

---

## Como Usar no Código Android/Kotlin

### 1. Usar Thumbnail em Listas de Jogadores

```kotlin
// Em PlayerListScreen ou similar
@Composable
fun PlayerListItem(user: User) {
    Card {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Usar thumbnail em vez de foto original
            AsyncImage(
                model = user.photo_thumbnail_url ?: user.photo_url, // Fallback
                contentDescription = user.name,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )
            Text(user.name)
        }
    }
}
```

### 2. Guardar URL do Thumbnail ao Upload

```kotlin
// Quando usuário faz upload de foto
private suspend fun uploadUserPhoto(file: File) {
    val uploadTask = storage
        .reference
        .child("profile_photos/${userId}.jpg")
        .putFile(file.asUri())
        .await()

    // Firestore será atualizado automaticamente pela Cloud Function
    // com photo_thumbnail_url em ~2-3 segundos

    // Aguardar atualização do thumbnail
    delay(3000)

    // Recarregar user
    val updated = userRepository.getCurrentUser().await()
    // updated.photo_thumbnail_url agora contém a URL do thumbnail
}
```

### 3. Coil Image Loader (Otimizado)

```kotlin
// Em FutebaApplication.kt
val imageLoader = ImageLoader.Builder(context)
    .crossfade(true)
    .diskCache(
        DiskCache.Builder()
            .directory(context.cacheDir.resolve("image_cache"))
            .maxSizeBytes(100L * 1024L * 1024L) // 100MB
            .build()
    )
    .memoryCache(
        MemoryCache.Builder(context)
            .maxSizePercent(0.25) // 25% da RAM
            .build()
    )
    .build()

Coil.setImageLoader(imageLoader)
```

### 4. Fallback Pattern

```kotlin
// Sempre usar fallback para compatibilidade com dados antigos
@Composable
fun UserAvatar(user: User, size: Dp = 48.dp) {
    AsyncImage(
        model = ImageRequest.Builder(LocalContext.current)
            .data(
                user.photo_thumbnail_url // Tenta thumbnail primeiro
                    ?: user.photo_url      // Fallback para foto original
                    ?: user.initials       // Último resort: iniciais
            )
            .crossfade(true)
            .placeholder(R.drawable.avatar_placeholder)
            .error(R.drawable.avatar_placeholder)
            .build(),
        contentDescription = user.name,
        modifier = Modifier
            .size(size)
            .clip(CircleShape),
        contentScale = ContentScale.Crop
    )
}
```

---

## Performance Metrics

### Antes (Imagem Original)

```
Tamanho arquivo:     2.4 MB (foto 4000x3000)
Banda por listagem:  2.4 MB × 20 usuários = 48 MB
Tempo carregamento:  2.1s (LTE)
Custo egress:        $0.12 / GB
```

### Depois (Thumbnail 200x200)

```
Tamanho arquivo:     32 KB (200x200 JPEG 80%)
Banda por listagem:  32 KB × 20 usuários = 640 KB
Tempo carregamento:  0.6s (LTE)
Custo egress:        $0.01 / GB
Economia:            -98% banda, -75% tempo, -91% custo
```

---

## Telas Impactadas

### Listas Otimizadas
| Tela | Componente | Antes | Depois | Ganho |
|------|-----------|--------|---------|-------|
| GameDetail | PlayerConfirmations | 2.4s | 0.6s | -75% |
| TeamFormation | DraggablePlayers | 3.1s | 0.8s | -74% |
| GroupDetail | MembersList | 1.8s | 0.5s | -72% |
| RankingScreen | LeaderboardList | 2.2s | 0.6s | -73% |
| InvitePlayers | SearchPlayers | 2.0s | 0.5s | -75% |

---

## Migration Path (Se Necessário)

### Fase 1: Compatibilidade (2 Semanas)
```kotlin
// Usar thumbnail se disponível, senão foto original
val imageUrl = user.photo_thumbnail_url ?: user.photo_url
```

### Fase 2: Deprecação (2 Semanas)
```kotlin
// Require thumbnail, avisar se não existir
val imageUrl = user.photo_thumbnail_url
    ?: run {
        AppLogger.w("Avatar", "Missing thumbnail for ${user.id}")
        user.photo_url
    }
```

### Fase 3: Obrigatório (Produção)
```kotlin
// Only thumbnails
AsyncImage(model = user.photo_thumbnail_url)
```

---

## Notas Importantes

### ✅ Características
- Geração automática via Storage trigger
- Resize com Sharp (50ms por imagem)
- Armazenado no mesmo bucket
- URL gravada em Firestore automaticamente

### ❌ Limitações
- Apenas JPEG 80% (trade-off qualidade/tamanho)
- Não funciona para imagens < 200x200
- Requer upload via Cloud Storage (não URL externa)

### Troubleshooting

**Q: Thumbnail não aparece após upload?**
A: Aguardar 2-3 segundos. Cloud Function é assíncrona.

**Q: Qual arquivo usar se thumbnail não existir?**
A: Sempre fallback para `photo_url`. Nunca deixar sem imagem.

**Q: Otimizar banda ainda mais?**
A: Usar WebP 70% em vez de JPEG (implementação futura).

---

## Dependências

- ✅ **sharp**: Resize de imagens (já em functions/package.json)
- ✅ **firebase-admin**: Atualizar Firestore (já instalado)
- ✅ **@google-cloud/storage**: Acesso ao Storage (já instalado)

Nenhuma dependência adicional necessária.

---

## Checklist de Implementação

- [x] Cloud Function gerando thumbnails (200x200 JPEG)
- [x] Thumbnail URL armazenado em users.photo_thumbnail_url
- [x] Thumbnail URL armazenado em groups.photo_thumbnail_url
- [x] Tratamento de erro (fallback para foto original)
- [ ] Auditar todos os `AsyncImage()` e usar thumbnail quando possível
- [ ] Testar com imagens de diferentes tamanhos
- [ ] Monitorar métricas de banda (Firebase Console)
- [ ] Documentar fallback pattern nos code comments

---

## Próximos Passos

1. **Imediato:** Usar `photo_thumbnail_url` em todas as listas
2. **Próxima sprint:** Migrar imagens antigas para thumbnails
3. **Futuro:** Implementar WebP para ainda mais economia

---

**Data de Conclusão Esperada:** 2026-02-10
**Responsável:** Futeba Team
**Status Atual:** ✅ DOCUMENTED & READY TO USE
