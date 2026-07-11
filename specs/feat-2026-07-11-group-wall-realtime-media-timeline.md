# SPEC: Mural em tempo real com timeline e mídia assíncrona

> **Status:** `APPROVED`
> **Autor:** Produto Futeba dos Parças + Codex
> **Data:** 2026-07-11
> **PR:** #3532

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O Mural do grupo precisa funcionar como uma conversa moderna: publicação direta,
mensagens mais recentes no topo, histórico navegável, reações e mídia reproduzível.
O fluxo anterior podia falhar ao enviar ou preparar MP4, não oferecia paginação
robusta e deixava usuários sem feedback claro durante upload e processamento.

### 1.2 Casos de Uso

1. Um membro publica texto diretamente, sem uma etapa separada de “Criar post”.
2. Um membro seleciona foto ou MP4 e acompanha upload, processamento e resultado.
3. Todos com o grupo aberto recebem novos posts e reações em tempo real.
4. O usuário abre um vídeo pelo poster, sem baixar o player antes do gesto.
5. O usuário navega do conteúdo recente para o histórico por scroll infinito.
6. Um retry reaproveita o mesmo identificador e nunca duplica a publicação.
7. Uma reconexão com muitas mensagens novas preserva a continuidade do histórico.

### 1.3 Critérios de Aceite

- Timeline ordenada do mais recente para o mais antigo no Web e Android.
- Janela recente em tempo real e páginas históricas de 20 itens por cursor.
- Rebase do cursor quando a janela realtime muda sem sobreposição após reconexão.
- Texto, foto e MP4 podem ser publicados; legenda é opcional quando há mídia.
- Imagens têm menos de 10 MiB; vídeos MP4 têm menos de 25 MiB e até 30 segundos.
- O servidor valida magic bytes, MIME, dimensões, duração, contêiner e codecs.
- Vídeo aceito usa H.264/AAC; poster é WebP e o player só nasce após interação.
- Upload é resumível, exibe progresso sem emissões duplicadas e permite cancelamento.
- Posts só aparecem como publicados depois que o draft chega a `READY`.
- Retries são idempotentes e não sobrescrevem reação, comentário, pin ou soft-delete.
- Reações e novos posts propagam para os usuários conectados pelo Firestore realtime.
- Erros de expiração, rejeição, permissão e mídia inválida são específicos e recuperáveis.
- Pipeline suporta cenários de 10, 100 e 1.000 usuários sem violar invariantes.
- Regras impedem upload fora do staging autorizado e IDs arbitrários de posts cliente.

### 1.4 Fora de Escopo

- Streaming adaptativo HLS/DASH e vídeos acima de 30 segundos.
- Edição de vídeo no cliente.
- Alteração da semântica de comentários ou moderação existente.
- Migração imediata de todos os clientes legados; há janela temporária controlada.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

`Grupo → Mural → digitar ou escolher mídia → enviar → upload → processando → READY`.
O histórico continua abaixo da janela recente e é carregado conforme o usuário avança.

### 2.2 Telas e Estados

- **Loading:** skeleton/lista e indicador de página histórica.
- **Empty:** convite para iniciar a conversa do grupo.
- **Composing:** campo direto, seletor de mídia, preview e contador de caracteres.
- **Uploading:** percentual, cancelamento e mídia preservada em caso de falha recuperável.
- **Processing:** mensagem explícita enquanto o servidor valida e gera o poster.
- **Error:** mensagem específica com retry, sem descartar texto/anexo indevidamente.
- **Success:** item `READY` no topo e atualização em tempo real para os demais membros.

### 2.3 Responsividade

O Web é mobile-first e mantém composer, cards e player utilizáveis em telas estreitas.
Android usa lista virtualizada e componentes adaptáveis a telefone e tablet.

### 2.4 Acessibilidade

- Controles com rótulos e áreas de toque adequadas.
- Poster informa que um toque inicia o vídeo.
- Progresso e erros não dependem apenas de cor.
- Foco e teclado permanecem utilizáveis no composer Web.

### 2.5 Animações e Micro-interações

Animações são discretas: feedback de envio/reação e transição de poster para player,
sem autoplay, download antecipado ou movimento que prejudique leitura.

---

## 3. Technical Design

### 3.1 Arquitetura

- Web: `useGroupWall` + `groupWallMediaService` + componentes de composer/card.
- Android: `GroupWallRepository` + `GroupWallMediaPipeline` + ViewModel/Compose.
- Backend: callable de reserva, trigger de Storage, janitor agendado e cleanup de post.
- Firestore é a fonte realtime; Storage mantém staging temporário e objetos imutáveis.
- FFmpeg 8.1.2 é pinado por tag e SHA-256, com gate real Linux no CI.

### 3.2 Modelos de Dados

- `groups/{groupId}/wall_post_drafts/{postId}`: intenção, owner, staging, estado e TTL.
- `groups/{groupId}/wall_posts/{postId}`: conteúdo social e referências finais de mídia.
- Estados do draft: `AWAITING_UPLOAD`, `PROCESSING`, `READY`, `REJECTED`, `EXPIRED`.
- Objetos finais usam paths imutáveis content-addressed para original e poster.

### 3.3 API / Firestore

- `createGroupWallMediaDraft`: autentica, limita taxa e reserva path/ID determinísticos.
- `onGroupWallMediaStaged`: reivindica lease, valida/transcodifica e publica atomicamente.
- `cleanupExpiredGroupWallMediaDrafts`: pagina drafts expirados e remove paths exatos.
- Listener recente: 20 itens newest-first; histórico usa `startAfter` e páginas de 20.
- Post de texto Android usa UUID estável; Web/legado mantém auto-ID Firestore.

### 3.4 Cache e Offline

- Emissão “não existe” vinda apenas do cache não encerra um draft recém-criado.
- Ausência confirmada pelo servidor falha imediatamente, sem aguardar timeout completo.
- Reconexão sem sobreposição rebasa o cursor e o merge por ID elimina duplicatas.
- Retry mantém `clientRequestId` para a mesma intenção e gira o ID se o conteúdo muda.

### 3.5 Segurança

- Auth, App Check limited-use e rate limit na reserva.
- Regras vinculam owner, path, MIME, tamanho declarado e expiração do staging.
- Clientes não escrevem mídia final nem posts de pipeline server-authoritative.
- Magic bytes e probe limitado precedem qualquer processamento pesado.
- Runtime restringe protocolos, demuxer, codecs, threads e recursos do FFmpeg.
- Tombstone `READY` mínimo evita reprocessamento e não duplica UGC/URLs sensíveis.
- Janitor remove somente paths registrados, sem listagem ampla do bucket.
- Compatibilidade legada é fail-closed, temporizada e configurada em produção.

### 3.6 Performance

- Player e rede de vídeo são lazy após o toque no poster.
- Lista usa janela realtime pequena, cursores e deduplicação por ID.
- Um único `snapshotFlow` observa a paginação no Android sem churn por nova mensagem.
- Janitor pagina até 2.000 drafts por execução com concorrência limitada.
- Teste de carga cobre 10/100/1.000 usuários e retries contenciosos.

### 3.7 Analytics e Observabilidade

- Métricas usam buckets sem PII para latência, resultado, tamanho e backlog.
- Logs distinguem rejeição permanente de falha transitória do processo FFmpeg.
- Alertas operacionais observam backlog, idade do draft e erros dos triggers.

---

## 4. Tasks (Breakdown)

- [x] Implementar timeline newest-first e paginação Web/Android.
- [x] Transformar o composer em envio direto estilo chat.
- [x] Adicionar reações, agrupamento temporal, foto, poster e player lazy.
- [x] Criar contrato idempotente de reserva/upload/processamento.
- [x] Validar imagem/MP4 e publicar somente em `READY`.
- [x] Adicionar cleanup, TTL, leases, retries e tombstones.
- [x] Endurecer Firestore/Storage Rules e compatibilidade temporária.
- [x] Atualizar FFmpeg e isolar funções em service account dedicada.
- [x] Cobrir reconexão, histórico, cancelamento, erros e regras com testes.
- [x] Executar testes de carga, segurança, diff coverage e smoke Linux.
- [x] Atualizar versões, release notes, changelog e documentação operacional.

---

## 5. Verification (Verificação)

### 5.1 Testes

- Web: lint, TypeScript, unit tests, build e Lighthouse.
- Functions: build, lint, Jest completo, diff coverage e smoke FFmpeg Linux.
- Firebase: Firestore/Storage Rules em emulador e validações catch-all/headers.
- Android: unit tests focados/completos, compile, APK, lint e detekt.
- Segurança: Gitleaks, CodeQL, Semgrep e auditoria manual do pipeline.
- Carga: 10/100/1.000 usuários com zero erro e invariantes preservadas.

### 5.2 Checklist de Revisão

- [x] Loading, empty, error e success cobertos.
- [x] Strings PT-BR/EN/ES e acessibilidade básica.
- [x] Escritas multi-documento server-side atômicas.
- [x] Listeners realtime possuem callbacks de erro.
- [x] Mídia inválida não cria post público.
- [x] Retry não duplica post nem ressuscita conteúdo removido.
- [x] Rules e clientes compartilham contratos de path, ID, MIME e tamanho.
- [x] Versões Web, Functions e Android alinhadas às release notes.

### 5.3 Demo

Após o deploy, validar no grupo VIP: publicar foto e os dois MP4 de referência,
abrir o vídeo pelo poster, reagir em outra sessão, confirmar atualização realtime,
navegar o histórico e remover os posts de QA.

---

## 6. Notas e Referências

- Issues: #3518 e #3519.
- Operação: `docs/operations/GROUP_WALL_MEDIA_PIPELINE.md`.
- Smoke: `docs/QA_SMOKE_MATRIX.md`.
- Decisões gerais: `specs/DECISIONS.md`.

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-11 | Produto + Codex | Consolidação e aprovação do escopo entregue no PR #3532 |
