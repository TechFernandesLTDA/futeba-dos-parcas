# DOCS 4392: Política de Privacidade v2 (LGPD)

- **Status:** APPROVED-PENDING-LEGAL-REVIEW
- **Issue:** #4392 (parte de conteúdo). Relacionada: #4391 (exclusão de conta)
- **Vigência proposta:** 31/10/2026, versão 2.0 (anterior: 29/12/2025)
- **Arquivos:** `web/public/privacy_policy.html`, `web/public/terms_of_service.html` (URLs inalteradas)

## Problema

A política de 29/12/2025 citava só nome, e-mail, foto, estatísticas e Firebase. Não cobria CPF, telefone,
localização, mensagens, mídia, financeiro do grupo, App Check, Maps/Places/ViaCEP, transferência internacional,
retenção, direitos do art. 18, encarregado, menores, nem armazenamento local da web.

## Inventário (dado, finalidade, base legal, retenção, onde no código)

| Dado | Finalidade | Base legal | Retenção | Onde no código |
|---|---|---|---|---|
| Conta: nome, apelido, e-mail, foto, uid, provedor (Google, e-mail/senha, telefone) | Conta e identificação | Contrato (7º V) | Enquanto a conta existir; exclusão em até 30 dias | `users`, `users_private` (firestore.rules); `shared/.../domain/model/User.kt`; Storage `users/{uid}/profile.jpg` |
| Telefone e verificação SMS | Login e antifraude | Contrato; legítimo interesse (7º IX) | Idem conta | `users_private`, `phone_index` (hash); `functions/src/auth/verification.ts` |
| CPF (somente hash com `CPF_SALT` e `cpfVerifiedAt`) | Uma conta por pessoa, antifraude | Legítimo interesse (7º IX) | Idem conta; `cpf_index` | `cpf_index`, `users_private`; `functions/src/auth/verification.ts` (`verifyCpf`) |
| Perfil esportivo (posição, pé, altura, peso, nascimento, gênero, time do coração, autoavaliação) | Times equilibrados, perfil | Contrato (opcional) | Idem conta | `User.kt` (`birth_date`, `height_cm`, `weight_kg` vão para `users_private`) |
| Atividade: presenças, gols, MVP, votos, XP, níveis, badges, streaks, rankings | Gamificação | Contrato | `xp_logs` 1 ano; resto idem conta; stats podem ficar anonimizadas | `statistics`, `xp_logs`, `user_badges`, `season_participation`, `user_streaks`, `mvp_votes`; `functions/src/maintenance/cleanup-old-logs.ts` |
| Grupos e social: membros, convites, seguidores, bloqueios, mural, enquetes, caronas | Convivência e organização | Contrato | Idem conta; grupos/jogos apagados: lixeira 30 dias | `groups`, `users/{uid}/followers`, `blocked`, `wall_posts`, `group_polls`, `game_rides`; `functions/src/maintenance/soft-delete.ts` (`RETENTION_DAYS=30`) |
| Mensagens diretas e de grupo | Comunicação | Contrato | Idem conta (sem prazo próprio definido) | `chats/{id}/messages`, `post_game_messages` |
| Fotos e vídeos (álbum, mural, locais, logos) | Memória do jogo, identidade | Contrato | Idem conta (sem prazo próprio definido) | `game_photos`, `game_videos`; `storage.rules` (`groups/{id}/wall_media`, `locations/{id}`) |
| Financeiro do grupo e comprovantes | Caixa e cobrança | Contrato | Sem prazo definido; manter anonimizado para prestação de contas | `cashbox`, `payers`, `settlements`, `monthly_finance_*`, `subscription_*`; Storage `groups/{id}/receipts` |
| Localização GPS (lat, lng, geohash, consentimento) | Check-in, locais próximos, descoberta de jogadores | Consentimento (7º I) | Só usada se atualizada nos últimos 30 dias; some com a conta | `user_locations` (rules); `functions/src/social/nearby-players.ts` (`MAX_LOCATION_AGE_MS`) |
| Avaliações de locais | Ajudar na escolha de locais | Contrato | Idem conta | `locations/{id}/reviews`, `post_game_reputation` |
| Token FCM e preferências | Notificações | Contrato | Até logout, troca ou exclusão | `push_tokens`, `push_token_devices`, `notification_settings`; `notifications` lidas: 30 dias (`cleanup-old-logs.ts`) |
| Atividades do feed | Feed | Contrato | 90 dias | `activities` (`cleanup-old-logs.ts`) |
| Técnicos: Crashlytics, Analytics, Performance | Estabilidade e melhoria | Legítimo interesse | Prazos do Firebase | SDKs em `app/build.gradle.kts`, `web/src/services/firebaseAnalytics.ts` |
| Segurança: App Check (Play Integrity, App Attest, reCAPTCHA Enterprise), `rate_limits`, `audit_logs`, `error_logs` | Anti-abuso | Legítimo interesse; art. 46 | TTL curto em índices operacionais | `firestore.indexes.json` (TTL em `expires_at`: `notif_dedup`, `cashbox_summary_ops`, `member_counter_events`, `confirmation_counter_events`, `realtime_slo_samples`) |
| Denúncias e suporte | Moderação | Legítimo interesse; obrigação legal | Sem prazo definido | `reports`, `user_feedback` |
| Web: localStorage (tema, sessão, rascunhos, fila offline, favoritos) | Funcionamento | Necessário ao serviço | Até o usuário limpar | `web/src` (`themeMode`, `offline_write_queue`, `draft:*`, `favorite_locations`) |

## Operadores e transferência internacional

Google Firebase/Google Cloud (Auth, Firestore, Storage, Functions, FCM, Remote Config, Crashlytics, Analytics,
App Check, reCAPTCHA Enterprise), Google Maps/Places, ViaCEP. Functions em `southamerica-east1`
(`functions/src/constants.ts`). Serviços do Google podem processar fora do Brasil (art. 33).

## Decisões de texto

- Controlador: Tech Fernandes Ltda, contato `techfernandesltda@gmail.com` (já constava nas páginas). Sem CNPJ nem endereço no texto.
- Encarregado: mesmo e-mail, sem nome definido.
- Menores: idade mínima 13 mantida; 13 a 17 com ciência/consentimento do responsável; menores de 16 com conta vinculada a responsável (ECA Digital).
- Direitos: resposta em até 15 dias (art. 19, II).
- Exclusão: 30 dias (já constava em `delete_account.html`).

## Pendências para decisão (ver relatório do PR)

1. Nome do encarregado e e-mail dedicado (hoje um Gmail compartilhado).
2. Idade mínima e mecanismo de vínculo parental para menores de 16: o app não implementa.
3. Prazo de retenção de mensagens, mídia, comprovantes e denúncias.
4. Confirmar o comportamento real do `deleteAccount` (#4391) com o texto da seção 7.
5. Consentimento de Analytics/Crashlytics na web e no app (hoje tratado como legítimo interesse).
6. Revisão jurídica de todo o texto antes do deploy.
