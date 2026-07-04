# SPEC: Descoberta de jogadores por proximidade geografica

> **Status:** `APPROVED`
> **Autor:** Codex
> **Data:** 2026-07-04
> **PR:** #xxx (preencher quando criar)
> **Issue:** #3237
> **Epico:** #3240 (Rede social da pelada)
> **Depende:** #3235 (grafo social) e coordena com #3231 (DM)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

Quando falta jogador para fechar uma pelada, hoje o app permite buscar por nome
ou convocar reforco por posicao, mas nao ajuda a descobrir quem esta perto. A
feature precisa resolver isso sem transformar localizacao em dado publico.

Localizacao e dado pessoal sensivel para o produto: o comportamento default deve
ser OFF, o consentimento precisa ser explicito e revogavel, e a exposicao de
terceiros deve acontecer apenas por callable server-side com distancia
aproximada.

### 1.2 Casos de Uso

| ID | Ator | Acao | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | Ativa compartilhamento de localizacao | App registra consentimento, geohash e coords do proprio usuario |
| UC2 | Jogador | Desativa compartilhamento | App limpa geohash/coords e deixa descoberta OFF |
| UC3 | Jogador | Abre Jogadores proximos | Ve jogadores opt-in perto dele, sem coords cruas de terceiros |
| UC4 | Jogador | Ajusta raio 1/5/10/25 km | Lista e mapa sao atualizados por callable |
| UC5 | Jogador | Filtra por pessoas com vinculo social | Resultado prioriza/restringe quem ja tem relacao via grupos/jogos/follow |
| UC6 | Usuario sem consentimento | Tenta descobrir proximos | Pode buscar usando localizacao foreground, mas nao fica descobrivel ate ativar opt-in |
| UC7 | Terceiro | Tenta ler `lat`/`lng` de outro usuario via Firestore | Rules negam leitura direta |

### 1.3 Criterios de Aceite

- [x] CA1: Spec SDD aprovada antes de codigo funcional da feature.
- [x] CA2: `user_locations/{uid}` guarda campos opcionais snake_case: `geohash`, `lat`, `lng`, `location_sharing_enabled`, `location_updated_at`, `location_consent_at`.
- [x] CA3: Default OFF; opt-in registra `location_consent_at`; revogacao limpa `geohash`/`lat`/`lng` e marca `location_sharing_enabled: false`.
- [x] CA4: Coordenadas de terceiros nao sao legiveis por rules; exposicao passa somente por callable.
- [x] CA5: Callable `discoverNearbyPlayers` usa App Check, auth, rate-limit, `geofire-common`, limite top 50 e filtra usuarios inativos/deletados.
- [x] CA6: Resposta retorna apenas perfil publico minimo e faixa/distancia aproximada, nunca `lat`/`lng`/`geohash` cru de terceiros.
- [x] CA7: Composite index de `user_locations(location_sharing_enabled ASC, geohash ASC)` registrado.
- [x] CA8: Web tem hook/tela/settings com loading/empty/error/success, dark mode e i18n pt/en/es.
- [x] CA9: Android tem repository/ViewModel/screen/settings, permissao foreground e strings pt/en/es.
- [ ] CA10: Politica de privacidade do Hosting e release notes atualizadas antes de deploy user-visible.

### 1.4 Fora de Escopo

- Tracking em background.
- Historico de localizacoes.
- Exibir coordenadas ou ponto exato de outro jogador.
- DM nativa, ate #3231 estar pronta; o CTA inicial pode ser perfil, seguir ou convidar para grupo/jogo.
- Ranking complexo por afinidade alem do filtro social simples.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegacao

```text
[Home/Players] -> [Jogadores proximos]
       |                |
       |                +-- sem permissao -> [Solicitar localizacao foreground]
       |                +-- sem resultados -> [Empty com ajustar raio]
       |                +-- resultado -> [Perfil / seguir / convidar]
       |
[Perfil/Settings] -> [Compartilhar minha localizacao]
       |                +-- ON -> captura foreground + registra consentimento
       |                +-- OFF -> limpa localizacao compartilhada
```

### 2.2 Telas e Estados

| Tela | Estado | Descricao |
|------|--------|-----------|
| Jogadores proximos | Loading | Skeleton/lista carregando apos callable |
| Jogadores proximos | Empty | Nenhum jogador opt-in no raio selecionado |
| Jogadores proximos | Error | Alert com retry; sem vazar detalhes internos |
| Jogadores proximos | Success | Lista com avatar, nome, faixa de distancia e acoes |
| Settings/localizacao | Disabled | Toggle OFF com texto de privacidade |
| Settings/localizacao | Enabled | Mostra ultima atualizacao aproximada e botao limpar |

### 2.3 Texto de Consentimento

O texto deve dizer, em linguagem curta, que:

- a localizacao sera usada para outros jogadores encontrarem o usuario por
  proximidade;
- o app nao mostra coordenada exata para outros jogadores;
- o usuario pode desligar e limpar a localizacao quando quiser;
- nao ha rastreamento em segundo plano.

---

## 3. Technical Design

### 3.1 Decisao

Implementar descoberta geografica via Cloud Function callable, nao por query
direta do cliente em `users`. Embora a issue proponha campos em `users`, o
projeto ainda permite leitura de perfis `is_searchable` por usuarios
autenticados e Firestore Rules nao oferecem mascara por campo. Portanto, a
localizacao sensivel fica em `user_locations/{uid}`, com leitura limitada ao
dono/admin e consulta feita pelo Admin SDK. O callable calcula distancia real no
server e retorna somente dados publicos minimos com distancia aproximada.

### 3.2 Modelo de Dados

Campos opcionais em `user_locations/{uid}`:

| Campo | Tipo | Escrita client-side | Leitura por terceiros |
|-------|------|---------------------|------------------------|
| `user_id` | string | dono | nao direta |
| `location_sharing_enabled` | boolean | dono | nao direta |
| `location_consent_at` | timestamp | dono ao ativar | nao direta |
| `location_updated_at` | timestamp | dono ao ativar/refresh | nao direta |
| `geohash` | string | dono ao ativar/refresh | nao direta |
| `lat` | number | dono ao ativar/refresh | nao direta |
| `lng` | number | dono ao ativar/refresh | nao direta |

Resposta de `discoverNearbyPlayers`:

```ts
type NearbyPlayer = {
  uid: string;
  displayName: string;
  photoUrl?: string | null;
  nickname?: string | null;
  preferredPosition?: string | null;
  followersCount?: number;
  isFollowing?: boolean;
  distanceKmApprox: number;
  distanceBand: 'under_1km' | 'under_5km' | 'under_10km' | 'under_25km';
  socialContext?: 'following' | 'same_group' | 'none';
};
```

### 3.3 API / Firestore

| Operacao | Collection/Endpoint | Metodo | Payload |
|----------|---------------------|--------|---------|
| Atualizar propria localizacao | `user_locations/{uid}` | set/update | `{ user_id, location_sharing_enabled, geohash, lat, lng, location_consent_at, location_updated_at }` |
| Revogar compartilhamento | `user_locations/{uid}` | set/update | `{ user_id, location_sharing_enabled: false }` sem coords/geohash |
| Descobrir proximos | callable `discoverNearbyPlayers` | call | `{ lat, lng, radiusKm, socialFilter? }` |

### 3.4 Privacidade e Retencao

- O app nao coleta background location.
- A localizacao fica em `user_locations/{uid}` apenas enquanto o toggle estiver ON.
- Revogacao limpa coordenadas e geohash.
- O callable ignora localizacoes antigas. Corte inicial: `location_updated_at`
  com no maximo 30 dias.
- A resposta arredonda `distanceKmApprox` para 1 casa decimal e inclui faixa.
- Logs nao devem incluir coordenadas, geohash completo ou payload bruto.
- A politica de privacidade precisa mencionar finalidade, opt-in, revogacao,
  ausencia de background tracking e exposicao aproximada antes do release.

### 3.5 Seguranca

- Callable com `secure-callable-wrapper.ts`, App Check e auth obrigatoria.
- Rate-limit por UID em `rate-limiter.ts`.
- Validar `lat`/`lng`, `radiusKm` permitido (`1`, `5`, `10`, `25`) e payload
  com campos conhecidos.
- Firestore rules permitem dono ler/escrever o proprio doc em
  `user_locations/{uid}` e negam leitura direta por terceiros.
- Admins podem ler para suporte/auditoria conforme regra existente.

### 3.6 Performance

- Usar `geofire-common` para bounds e filtro por distancia real.
- Limitar retorno a 50 jogadores.
- Web usa TanStack Query com `staleTime` curto.
- Android faz refresh manual/foreground, sem observacao continua.

---

## 4. Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Spec + ADR | ✅ |
| 2 | Dependencia `geofire-common` e callable `discoverNearbyPlayers` | ✅ |
| 3 | Rules + indexes + rules-tests de privacidade | ✅ |
| 4 | Web hook/tela/settings/i18n | ✅ |
| 5 | Android repository/ViewModel/screen/settings/i18n | ✅ |
| 6 | Politica de privacidade + release notes | ⬜ |
| 7 | Validacao web/functions/android/rules | ✅ |

---

## 5. Verification

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Functions | Auth, rate-limit, bounds, filtros, resposta sem coords | ✅ `npm run build`, `npm run lint` |
| Rules | Dono escreve, terceiros nao leem coords, revogacao limpa | ✅ `user-locations.test.ts` |
| Web build/lint | TS + ESLint | ✅ |
| Android compile | `:app:compileDebugKotlin` | ✅ |
| LGPD docs | Politica atualizada antes do deploy | ⬜ |

---

## Historico de Alteracoes

| Data | Autor | Alteracao |
|------|-------|-----------|
| 2026-07-04 | Codex | Spec inicial aprovada para #3237 |
| 2026-07-04 | Codex | Implementado backend seguro, rules/indexes, web e Android |
