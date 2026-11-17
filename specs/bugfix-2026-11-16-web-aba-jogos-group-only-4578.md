# BUGFIX: aba Jogos do web não listava os jogos GROUP_ONLY dos grupos do usuário (#4578)

> **Status:** `APPROVED` → `FIXED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude Code (issue #4578, aberta na correção do #4572)
> **Data:** 2026-11-16

---

## 1. Descrição do bug

A aba **Jogos** (`GamesTab` → `useGames` sem `groupId`) só consultava jogos com
`visibility in [PUBLIC_OPEN, PUBLIC_CLOSED]`. Quem joga só em grupo privado abria a aba e não via o próprio jogo
agendado; ele só aparecia na tela do grupo.

## 2. Causa raiz

O filtro de visibilidade entrou no #4155 porque, sem ele, um `GROUP_ONLY` de grupo alheio no escopo derruba a
consulta inteira (regras não são filtros). Faltou a segunda metade: buscar os jogos dos grupos do usuário.

## 3. Solução

`useGames` aceita `memberGroupIds`. Sem `groupId`, a lista junta:

1. a consulta pública de sempre;
2. uma consulta por grupo do usuário (`group_id == X`), no mesmo formato da tela do grupo.

O cliente tira os repetidos pelo ID, reaplica a ordem por data e o limite. A lista só é publicada quando todas
as consultas responderam, para não piscar com a lista pública antes.

Decisões:

- **Uma consulta por grupo, e não `group_id in [...]`.** A regra de LIST lê `groups/{id}/members/{uid}` por grupo
  distinto do resultado; um `in` com 10 grupos encosta no teto de leituras de regras por consulta (mesmo
  alerta registrado no #4393). E um vínculo desatualizado em `users/{uid}/groups` derrubaria tudo.
- **Falha na consulta de um grupo não derruba a lista.** O grupo fica de fora, com aviso no log. Falha na
  consulta pública continua aparecendo como erro.
- **Teto de 10 grupos**, igual ao Android (`userGroupIds.take(10)`).
- `GamesTab` espera `useGroups` (`enabled`) para abrir a lista já completa.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `web/src/hooks/useGames.ts` | `memberGroupIds`, `buildGamesQueries`, `mergeGameSources`, listener com várias fontes, opção `enabled` |
| `web/src/pages/home/tabs/GamesTab.tsx` | Passa os grupos do usuário |
| `web/src/hooks/useGames.test.ts` | 8 casos novos |
| `web/e2e-bateria/03-jogos.spec.ts` | Membro vê o jogo do grupo; quem é de fora não vê |

### Regras e índices

Nenhuma mudança. As regras de `games` já aceitam `group_id` de grupo em que o usuário é membro ativo. Os índices
`group_id + status + dateTime` (ascendente e descendente) existem em `firestore.indexes.json` e em produção:
sonda só de leitura em 16/11/2026, com consulta de controle sem índice devolvendo `FAILED_PRECONDITION` e as
consultas da aba (próximos, ao vivo e encerrados, por grupo) devolvendo resultado.

### Riscos

- Mais listeners: um por grupo, até 10. Cada um só cobra os documentos que devolve.
- Usuário com mais de 10 grupos não vê os jogos privados do 11º em diante na aba (continua vendo na tela do
  grupo). Mesmo limite do Android.

## 4. Verificação

- Vitest: `useGames.test.ts`, `useGames.realtime.test.tsx`, `GamesTab.test.tsx`.
- Bateria web: `03-jogos.spec.ts`.
- `tsc` e ESLint.

## 5. Outras plataformas

- **Android:** já junta três consultas (públicos, `GROUP_ONLY` dos grupos, do dono) em
  `GameQueryRepositoryImpl.getLiveAndUpcomingGamesFlow`. Sem mudança.
- **iOS:** a aba Jogos junta os públicos com os jogos em que o usuário confirmou presença
  (`getConfirmedGamesForUser`, consulta por ID de documento). Jogo privado do grupo sem presença confirmada não
  aparece, e a consulta por ID pode ser negada pelas regras. Registrado em issue própria.

## 6. Publicação

Só hosting do web.
