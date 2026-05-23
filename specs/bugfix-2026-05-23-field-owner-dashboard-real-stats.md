# BUGFIX: Field Owner Dashboard Real Stats

**Status**: APPROVED
**Issue**: #1686
**Data**: 2026-05-23

## Requirements

- Remover estatisticas inventadas do painel do dono de campo.
- Exibir apenas dados derivados de documentos reais do Firestore.
- Atualizar dados em tempo real.
- Remover ou desabilitar acoes sem implementacao real.

## UX/UI

- Manter layout do dashboard.
- Substituir receita estimada por jogos desta semana.
- Informar claramente que gerenciamento de jogadores ainda esta indisponivel.

## Technical Design

- Usar `onSnapshot` para `locations` filtrando por `owner_id`.
- Usar `onSnapshot` para `games` filtrando por `location_id` em chunks de ate 10 IDs.
- Calcular jogos dos ultimos 30 dias, proximos jogos, jogos desta semana e rating medio ponderado por `ratingCount`.
- Evitar queries com `orderBy` para reduzir necessidade de indice composto.

## Tasks

1. Substituir `getDocs` one-shot por listeners.
2. Calcular stats reais a partir de `locations` e `games`.
3. Remover receita estimada.
4. Desabilitar acao de jogadores sem rota funcional.
5. Validar build web.

## Implementation

- `locations` do owner agora carregam via `onSnapshot`.
- Jogos das quadras do owner agora carregam via `onSnapshot` com `where('location_id', 'in', chunk)`.
- Stats passaram a ser: jogos dos ultimos 30 dias, jogos desta semana, proximos jogos e avaliacao media ponderada por reviews.
- Receita estimada foi removida.
- Acao `Gerenciar Jogadores` foi desabilitada com texto `Em breve` para nao parecer funcional.

## Verify

- [x] `npm run build` em `web/`
- [x] Stats sem constantes/fórmulas inventadas
- [x] Dashboard usa `onSnapshot`
