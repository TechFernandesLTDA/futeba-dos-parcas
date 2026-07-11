# Auditoria Firebase Rules e Cloud Functions — 2026-07-11

Issue de rastreio: [#3529](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/3529)

## Escopo

- Regras e índices do Cloud Firestore.
- Regras do Firebase Storage.
- Cloud Functions exportadas em produção, incluindo callables, triggers e schedulers.
- Compatibilidade Web dos contratos alterados por Rules/Functions.
- Evidências de produção: configuração implantada, inventário de Functions, Scheduler e erros do Cloud Logging.

## Evidências de produção antes da correção

- As regras Firestore e Storage implantadas eram idênticas ao `master` auditado.
- As 150 Functions estavam `ACTIVE` e em Node.js 22; 148 eram geração 2 em
  `southamerica-east1` e os dois triggers de Auth geração 1 permaneciam em
  `us-central1` por limitação da plataforma.
- Os 28 jobs do Cloud Scheduler estavam habilitados.
- Havia 24 falhas runtime de `checkGameReminders` por dependência de índice no
  fallback de jogos legados sem `dateTime`.
- O índice local `game_events(game_id ASC, created_at DESC)` ainda não estava
  implantado.
- `npm audit` não encontrou vulnerabilidades nos pacotes de Functions nem de
  testes de Rules.

## Falhas corrigidas

### Autorização e integridade de dados

- Membership/admin de grupo agora exige que o `user_id` do documento coincida
  com o UID do path e da sessão, no Firestore e no Storage.
- Bloqueados não reentram por self-join, convite direto nem código legado;
  owner não pode remover o próprio vínculo antes de transferir a propriedade.
- `player_stats` não permite trocar `game_id`, `player_id` ou `created_at` para
  assumir estatísticas de outro jogo.
- Atividades só podem alterar visibilidade e timestamp; mensagens pós-jogo usam
  timestamp do servidor e preservam a criação.
- Uploads sensíveis publicados são write-once, mantendo delete autorizado
  separado; tipos de imagem usam whitelist raster explícita.

### Identidade, onboarding e união de contas

- CPF e telefone são reconciliados com `cpf_index`/`phone_index`, inclusive em
  contas legadas com `users_private` incompleto; múltiplos índices ou divergência
  bloqueiam a operação para revisão.
- União de contas usa prova recente das duas sessões, lease transacional,
  migração idempotente de ownership/referências ativas e revogação dos tokens
  da origem.
- Grupos, jogos, locais, confirmações, convocações, convites e notificações são
  reconciliados antes de desativar a origem. Efeitos de triggers identificam
  `merged_from_alias` para não emitir notificações ou overlap falsos.
- O fluxo Web conclui imediatamente um merge `ready`, sem tentar cadastrar de
  novo o CPF já pertencente à origem; pedidos sobrevivem ao bloqueio de
  `sessionStorage` durante a navegação atual.
- Triggers de PII e claims falham de forma segura, retentam falhas transitórias
  e não removem a cópia pública sem equivalência semântica na área privada.

### Jogos, tempo real e regras de domínio

- Placar e evento live são validados e atualizados na mesma transação; retry com
  o mesmo `requestId` e conteúdo diferente é rejeitado.
- Exclusão de evento não produz placar negativo nem recria stats/confirmações
  incompletas; autoassistência é inválida.
- A projeção final inclui `assisted_by_id`, e um jogo não inicia sem dois times.
- Recorrência cria somente confirmações ausentes e preserva pagamento,
  check-in e status já atualizados em retries.
- Entrada em jogo público compartilha a verificação de conta, valida IDs e não
  aceita coerções silenciosas de posição/boolean.

### Caixa e financeiro mensal

- Caixa e resumo são server-authoritative, usam centavos e comparam a intenção
  financeira completa antes de aceitar um retry.
- Membros do grupo e mensalistas são conjuntos distintos; o owner/admin escolhe
  quem participa do rateio sem excluir jogadores avulsos do grupo.
- O período combina jogos materializados, agendas e séries recorrentes para
  calcular corretamente meses com três, quatro ou cinco ocorrências.
- Os índices compostos cobrem tanto o intervalo mensal
  `games(group_id, date)` quanto a busca de séries, agendas e settlements; os
  índices devem estar `READY` antes da publicação das Functions mensais.
- Feriados, cancelamentos e custos por ocorrência são explícitos e só podem ser
  ajustados antes da primeira baixa.
- Revisões de configuração e roster impedem baixa sobre snapshot obsoleto em
  duas sessões concorrentes.
- Baixa e estorno atualizam caixa, resumo, pagador, período e settlement de
  auditoria na mesma transação idempotente.

### Resiliência e privacidade

- `secureCallable` aplica App Check corretamente fora do Emulator, usa região
  explícita, UUID criptográfico e não transforma falha de enriquecimento de
  auditoria em retry de mutação já concluída.
- Falha na leitura de claims do Firebase Auth não concede papel por fallback
  Firestore potencialmente obsoleto.
- Rate limits armazenam hash SHA-256 do IP; `resetAt` e TTL do bucket têm
  semânticas separadas para impedir expiração antecipada e bypass por burst.
- Jobs administrativos usam lease com proprietário e expiração, evitando que
  execuções concorrentes sobrescrevam o lock umas das outras.
- Notificações liberam dedupe em falhas, têm retry explícito e TTL de sete dias.
- O fallback de reminders consulta a janela pequena por `date` e filtra
  `dateTime == null` em memória, não dependendo do índice durante rollout.

## Validação

- Firestore/Storage Rules: 54 arquivos e 892 testes aprovados, além de
  `firebase deploy --dry-run` para Rules, Storage e índices.
- Functions: TypeScript build, ESLint, 92 suítes e 1.401 testes aprovados
  (13 ignorados), 81% de cobertura das linhas alteradas e empacotamento
  integral em dry-run.
- Web: TypeScript/Vite build, ESLint, 175 arquivos aprovados e 1.073 testes
  aprovados (15 ignorados em um arquivo).
- Android: `:app:compileDebugKotlin` aprovado e 993 testes unitários sem falhas.
- Contratos adicionais: índices sem duplicatas, TTL, MIME/limites de arquivo,
  merge `ready`/`pending_cpf`, idempotência e concorrência.
- Pós-deploy obrigatório: hashes das Rules, paridade de índices, estado das
  Functions, Scheduler e janela limpa de Cloud Logging.

## Riscos residuais acompanhados separadamente

- Waitlist ainda usa IDs aleatórios no cliente e precisa de callable/ID
  determinístico para unicidade forte de fila.
- `challenge_progress` ainda é gravável pelo cliente e deve migrar para
  atualização server-side.
- DMs e reports ainda não possuem chave idempotente de cliente para todos os
  retries; reports privados precisam comprovar relação com o conteúdo.
- `temp_fields` mantém leitura ampla para compatibilidade e requer migração de
  mídia antes de poder ser restringido.
- Migrações de identidade com volume excepcional precisam de teste de carga no
  Emulator/Firestore e estratégia paginada antes de ultrapassar o limite atual.
