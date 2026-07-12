---
spec: bugfix-web-video-playback
title: Corrigir playback e upload de vídeos no web (desktop + mobile)
type: bugfix
platform: web
created: 2026-07-12
related: handoff #3556 (verificação de vídeos), specs/feat-2026-07-04-game-videos.md, specs/feat-2026-07-03-group-wall-banter.md
priority: high
---

## Contexto

Auditoria exaustiva de 14 arquivos de vídeo no `web/` revelou que os vídeos **tocam** em desktop e mobile (todos usam `playsInline` + `controls`), mas há 3 bugs reais e 7 riscos. A stack de wall-post é production-grade; a stack de game-videos é o elo fraco (pula toda a resiliência do pipeline wall).

## Problemas

### 🔴 P0-1 — GameVideosTab: sem validação de duração no upload
- **Arquivo:** `web/src/pages/game/GameVideosTab.tsx:196-208` (`validateVideo`)
- **Sintoma:** usuário seleciona MP4 de vários minutos (até 25 MB), espera upload completo, e o servidor rejeita por duração. Banda e tempo desperdiçados.
- **Causa:** `validateVideo` checa só `file.type === 'video/mp4'` e `file.size > 25 MB`. Não lê duração antes do upload (diferente do `WallPostComposer` que usa `onLoadedMetadata`).
- **Fix:** ler duração via `<video>` + `URL.createObjectURL` antes de iniciar upload; rejeitar >30s (alinhado com wall). Bloquear botão de upload até metadata resolver.

### 🔴 P0-2 — GameVideosTab: sem onError no player
- **Arquivo:** `web/src/pages/game/GameVideosTab.tsx:418-427` (elemento `<video>`)
- **Sintoma:** URL de download expirada/quebrada falha silenciosamente — sem retry, sem feedback. Contrasta com `WallPostVideoPlayer` que tem recovery completo.
- **Causa:** nenhum handler `onError`. `video.url` é `getDownloadURL` de longa vida cached no Firestore, pode expirar.
- **Fix:** adicionar `onError` que re-resolve `getDownloadURL(storagePath)` e remonta via `key` (mesmo padrão do `WallPostVideoPlayer`).

### 🔴 P0-3 — WallPostCard: vídeos excluídos do lightbox
- **Arquivo:** `web/src/pages/group/WallPostCard.tsx:372`
- **Sintoma:** desktop limitado a `maxHeight: 420` inline; imagens têm zoom em `<Dialog>` (90vh) mas vídeos não.
- **Causa:** `open={!isVideo && lightboxOpen}` explicitamente exclui vídeos.
- **Fix:** renderizar `WallPostVideoPlayer` dentro do `<Dialog>` para posts de vídeo (ou remover o guard `!isVideo` e adaptar o conteúdo do dialog).

### ⚠️ P1-1 — WallPostVideoPlayer: autoPlay sem muted (iOS Safari)
- **Arquivo:** `web/src/pages/group/WallPostVideoPlayer.tsx:252-253`
- **Sintoma:** iOS Safari bloqueia autoplay audível; o user-gesture do clique no poster pode não satisfazer `play()` interno (elemento monta um render-cycle depois). Vídeo carrega pausado.
- **Fix:** remover `autoPlay` e chamar `videoRef.current?.play()` dentro de `onLoadedData`/`onCanPlay` (gesture chain mais tight); OU adicionar `muted` se autoplay silencioso for aceitável. **Decisão:** manter áudio + remover `autoPlay`, iniciar play programático no `onCanPlay` dentro do mesmo gesture.

### ⚠️ P1-2 — GameVideosTab: muted sem autoPlay
- **Arquivo:** `web/src/pages/game/GameVideosTab.tsx:422`
- **Sintoma:** usuário dá play e ouve silêncio até desmutar manualmente — sem benefício de autoplay.
- **Fix:** remover `muted`.

### ⚠️ P1-3 — GameVideosTab: sem aspectRatio/objectFit
- **Arquivo:** `web/src/pages/game/GameVideosTab.tsx:426`
- **Sintoma:** layout shift ao carregar (altura driven por dimensões intrínsecas); retrato renderiza grande, paisagem curto.
- **Fix:** adicionar `aspectRatio: '16 / 9'`, `objectFit: 'contain'`, `minHeight: { xs: 200, sm: 240 }` (alinhado com `WallPostVideoPlayer`).

### ⚠️ P1-4 — WallPostComposer: gate de duração pulável
- **Arquivo:** `web/src/pages/group/WallPostComposer.tsx:134`
- **Sintoma:** check de >30s só roda se `mediaDuration !== null`. Se `onLoadedMetadata` não dispara (codec/metadata corrompido), gate é bypassado.
- **Fix:** bloquear submit até duração resolver (`mediaDuration === null` = "carregando" para vídeos); OU tratar null como inválido para vídeo.

### ⚠️ P1-5 — Sem controlsList="nodownload" em nenhum player
- **Arquivos:** `WallPostVideoPlayer.tsx:252`, `GameVideosTab.tsx:419`
- **Sintoma:** Chrome desktop mostra botão download nos controles.
- **Fix:** adicionar `controlsList="nodownload"` (+ opcional `disablePictureInPicture`) a ambos.

### ⚠️ P1-6 — WallPostVideoPlayer: sem cleanup no unmount
- **Arquivo:** `web/src/pages/group/WallPostVideoPlayer.tsx`
- **Sintoma:** sem ref attachada; sem `pause()`/clear `src` no unmount. Browser pausa ao remover do DOM, mas best practice é explícito.
- **Fix:** attachar `ref` ao `<video>` e adicionar cleanup que chama `pause()` e seta `src = ''`.

## Fora de escopo (follow-ups)
- GameVideosTab usar pipeline de upload resiliente (draft/outbox/auth-retry) — separar em spec própria.
- `WallPostComposer.tsx:27` — ampliar `accept` para `video/mp4,video/quicktime,.mp4` (UX menor).
- `crossOrigin="anonymous"` desnecessário no WallPostVideoPlayer — avaliar separadamente.

## Critérios de aceitação

- [ ] P0-1: GameVideosTab rejeita vídeo >30s ANTES do upload, com mensagem clara.
- [ ] P0-2: GameVideosTab mostra retry + re-resolve URL em URL expirada/quebrada.
- [ ] P0-3: vídeos têm lightbox no desktop (Dialog), paridade com imagens.
- [ ] P1-1: WallPostVideoPlayer toca automaticamente após clique no poster sem ficar pausado no iOS.
- [ ] P1-2: GameVideosTab sem `muted` — áudio funciona ao dar play.
- [ ] P1-3: GameVideosTab com aspectRatio estável, sem layout shift.
- [ ] P1-4: WallPostComposer bloqueia submit até duração resolver.
- [ ] P1-5: ambos players com `controlsList="nodownload"`.
- [ ] P1-6: WallPostVideoPlayer pausa e limpa src no unmount.
- [ ] `npm run lint` verde (max-warnings 0).
- [ ] `npm run build` verde (tsc + vite).
- [ ] Testes existentes passam; novos testes para P0-1 (duration) e P0-2 (onError recovery).

## Plano de testes

### Testes unitários (Vitest)
- **P0-1:** `GameVideosTab` — mockar `<video>` metadata (duration 45s) → validar que upload NÃO inicia e mostra erro.
- **P0-2:** `GameVideosTab` — simular `onError` no `<video>` → validar que `getDownloadURL` é chamado e `key` muda (remontagem).
- **P1-4:** `WallPostComposer` — vídeo com `mediaDuration === null` → botão submit desabilitado.

### Smoke manual
- iOS Safari (real ou BrowserStack): wall-post video toca após clique no poster sem tap extra.
- Android Chrome: game-video tem áudio ao dar play.
- Desktop Chrome 1365x900: lightbox de vídeo abre; sem botão download nos controles.
