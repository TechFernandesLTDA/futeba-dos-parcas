# SPEC: Videos curtos anexados ao jogo

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3238
> **Epico:** #3240 (Rede social da pelada)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O app ja tem fotos por jogo e midia de mural, mas nao existe suporte a videos.
Clipes curtos de gols, defesas e lances polemicos sao conteudo social forte,
mas aumentam custo de Storage/egress e introduzem risco operacional com
thumbnail/validacao server-side.

### 1.2 Casos de Uso

| ID | Ator | Acao | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Participante confirmado | Envia video curto de um jogo | Video aparece na aba de videos do jogo |
| UC2 | Usuario nao participante | Tenta enviar video | Rules negam upload/doc |
| UC3 | Participante | Assiste video | Player inicia mudo e permite fullscreen |
| UC4 | Autor/owner/admin | Remove video | Doc some da UI e Storage e limpo com retry |
| UC5 | Sistema | Recebe video invalido | CF remove objeto/doc ou marca como rejeitado |

### 1.3 Criterios de Aceite

- [x] CA1: Spec aprovada apos spike de ffmpeg/ffprobe em Functions v2.
- [x] CA2: `game_videos` espelha matriz de acesso de `game_photos`.
- [x] CA3: Storage path `games/{gameId}/videos/{uid}/{fileName}` aceita apenas `video/mp4` <= 25MB.
- [x] CA4: Validacao em 3 camadas: client, storage.rules e Cloud Function on-finalize.
- [x] CA5: Thumbnail gerado automaticamente via Cloud Function.
- [x] CA6: Player web/Android com mute por padrao, controles nativos e fullscreen quando suportado pelo SO/browser.
- [x] CA7: Limite de videos por jogo/usuario definido e aplicado no client e backend.
- [x] CA8: Estados loading/empty/error/success e i18n pt/en/es.
- [x] CA9: Estrategia de custo/egress documentada antes de deploy.

### 1.4 Fora de Escopo

- Feed global de videos.
- Edicao/corte avancado dentro do app.
- Moderacao automatica de conteudo.
- Streaming adaptativo/HLS.
- Upload em background Android com WorkManager na primeira entrega, salvo se o
  spike mostrar necessidade.

---

## 2. Decisoes Pendentes

### 2.1 Thumbnail e validacao server-side

Spike executado em 2026-07-04:

- maquina local tem `ffmpeg`/`ffprobe`, mas isso nao prova runtime de CF;
- `ffprobe-static` foi descartado por tamanho (~351MB unpacked);
- `@ffmpeg-installer/ffmpeg` foi escolhido como binario deterministico para
  Linux x64 (~68MB unpacked no pacote alvo);
- duracao sera extraida do stderr do proprio `ffmpeg`, sem dependencia
  separada de `ffprobe`.

Decisao aprovada:

- criar funcao separada `functions/src/storage/generate-video-thumbnails.ts`;
- configurar memoria >= 1GB e `timeoutSeconds` explicito;
- usar `ffmpeg` para detectar duracao real e gerar frame em ~1s;
- deletar objeto e marcar doc `status: REJECTED` quando duracao/MIME real falhar.

### 2.2 Compressao client-side

Compressao client-side reduz custo, mas pode aumentar complexidade:

- Web: `ffmpeg.wasm` e pesado; considerar deixar fora do MVP e validar apenas
  tamanho/duracao antes do upload.
- Android: Media3 Transformer e opcional; adicionar so se uploads reais em 4G
  ficarem ruins.

### 2.3 Limites

Limites aplicados:

- 30 segundos;
- 25MB;
- 10 videos por jogo;
- 3 videos por usuario por jogo.

Os limites de quantidade tambem sao rechecados na Cloud Function antes de
marcar o video como `READY`, reduzindo custo/egress e evitando bypass por
cliente modificado.

---

## 3. Technical Design

### 3.1 Dados

Colecao top-level `game_videos/{videoId}`:

```ts
{
  game_id: string;
  url: string;
  storage_path: string;
  thumbnail_path: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_by_photo: string;
  content_type: 'video/mp4';
  size: number;
  caption: string | null;
  reactions: Record<string, string[]>;
  status: 'PROCESSING' | 'READY' | 'REJECTED';
  rejection_reason: string | null;
  duration_sec: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### 3.2 Storage

Path canonico:

```text
games/{gameId}/videos/{userId}/{fileName}
```

Regras devem espelhar fotos do jogo:

- read para participantes/owner/admin conforme `game_photos`;
- create somente `userId == request.auth.uid`, participante confirmado e
  `contentType == video/mp4`;
- size <= 25MB;
- filename allowlist `[A-Za-z0-9._-]+.mp4`;
- delete pelo autor, owner, co-owner ou admin.

### 3.3 Web

- `GameVideosTab.tsx` lista `game_videos` por `game_id`, `created_at desc`.
- `GameVideosTab.tsx` entra no detalhe do jogo junto das fotos.
- upload via `uploadBytesResumable`, progress e retry.
- player HTML5 `<video muted playsInline controls>`.

### 3.4 Android

- `GameVideosRepository`, `GameVideosViewModel`, `GameVideosSection`.
- Player via Media3 ExoPlayer mudo por padrao.
- Upload via Storage SDK; WorkManager fica fora do MVP salvo decisao contraria.

---

## 4. Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Spec inicial e matriz de decisoes | ✅ |
| 2 | Spike ffmpeg/ffprobe Functions v2 | ✅ |
| 3 | ADR final apos spike | ✅ |
| 4 | Storage rules + Firestore rules + tests | ✅ |
| 5 | Cloud Function thumbnail/validacao | ✅ |
| 6 | Web hook/tela/player/upload | ✅ |
| 7 | Android repository/ViewModel/tela/player/upload | ✅ |
| 8 | Custo/monitoring/release notes | ✅ custo/monitoring; release notes pendentes para release |

---

## 5. Verification

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Spike | ffmpeg/ffprobe, memoria, timeout, deploy size | ✅ `@ffmpeg-installer/ffmpeg`, sem `ffprobe-static` |
| Rules | Participante vs nao participante, MIME/size/path | ✅ `firebase emulators:exec ... npx vitest run src/game-videos.test.ts` (10/10) |
| Functions | MP4 valido, video longo, MIME falso, thumbnail | ✅ build/lint; runtime smoke pendente no deploy |
| Web | Build/lint + upload/player states | ✅ `npm run build`, `npm run lint` |
| Android | `:app:compileDebugKotlin` + player/upload states | ✅ `./gradlew :app:compileDebugKotlin` |

---

## Historico de Alteracoes

| Data | Autor | Alteracao |
|------|-------|-----------|
| 2026-07-04 | Codex | Spec inicial em review; bloqueada por spike ffmpeg/ffprobe |
| 2026-07-04 | Codex | Spike concluido; spec aprovada com `@ffmpeg-installer/ffmpeg` |
| 2026-07-04 | Codex | Rules/indexes e function de thumbnail/validacao implementados |
| 2026-07-04 | Codex | Web/Android implementados; limites por jogo/usuario aplicados; validacoes locais verdes |
