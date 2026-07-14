# BUGFIX: Contrato canônico das divisões da Liga no Web

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issue:** #3611

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Functions e KMP usam `BRONZE`, `PRATA`, `OURO` e `DIAMANTE`, mas o Web tipa e
configura seis divisões antigas em inglês. O cast na fronteira da callable não
valida o valor recebido; por isso `PRATA`, `OURO` e `DIAMANTE` falham no lookup
visual e caem em Bronze.

### 1.2 Comportamento Esperado (Correto)

O Web deve consumir as quatro divisões canônicas, apresentar rótulos localizados
e usar a mesma escala de rating 0–100 do backend/KMP. Valores históricos em
inglês devem ser normalizados somente na leitura, sem reescrever documentos.

### 1.3 Passos para Reproduzir

1. Abrir a Liga no Web com um jogador cuja participação contém `division=OURO`.
2. Observar o chip/aba/progresso do jogador.
3. O lookup antigo não encontra `OURO` e exibe Bronze.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Web |
| Contrato servidor | `BRONZE/PRATA/OURO/DIAMANTE` |
| Escala | rating 0–100 |
| Frequência | Sempre para divisões acima de Bronze |
| Impacto | Progresso visual incorreto e perda de confiança no ranking |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

- `functions/src/league.ts` calcula 0–29 Bronze, 30–49 Prata, 50–69 Ouro e
  70–100 Diamante.
- `LeagueDivision.kt` define o mesmo enum e já aceita aliases legados
  `SILVER/GOLD/DIAMOND` na leitura.
- `web/src/types/gamification.ts` ainda define seis tiers EN e thresholds de
  pontos que não representam o rating da Liga.
- `useLeague.ts` mascara o contrato com `as LeagueDivision`.

### 2.2 Causa Raiz

O Web manteve um modelo anterior independente e não possuía normalização na
fronteira de dados nem teste de contrato cross-platform.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/types/gamification.ts` | Tipo/configuração/normalização canônica |
| `web/src/hooks/useLeague.ts` | Normalizar resposta da callable |
| `web/src/pages/league/LeagueScreen.tsx` | Ordem e progresso das quatro divisões |
| `web/src/pages/home/tabs/HomeTab.tsx` | Normalizar leitura direta do Firestore |
| `web/src/pages/profile/ProfileScreen.tsx` | Normalizar perfil legado e localizar rótulo |
| `web/src/pages/ranking/RankingScreen.tsx` | Localizar rótulo canônico |
| `web/src/pages/home/tabs/RankingsTab.tsx` | Localizar rótulo canônico |
| `web/src/i18n/locales/*.json` | Chaves explícitas das divisões canônicas |
| `web/src/types/gamification.test.ts` | Contrato, aliases e thresholds |
| `web/src/hooks/useLeague.test.ts` | Normalização na fronteira da callable |

---

## 3. Solução Proposta

### 3.1 Abordagem

1. Definir apenas `BRONZE | PRATA | OURO | DIAMANTE` no Web.
2. Centralizar ordem, rating mínimo, cor e chave i18n.
3. Criar normalizador total para `unknown`, com aliases históricos:
   `SILVER→PRATA`, `GOLD→OURO`, `DIAMOND/PLATINUM/CHAMPION→DIAMANTE`.
4. Normalizar todas as fronteiras conhecidas sem escrever de volta no banco.
5. Trocar rótulos fixos por `league.division.<CANONICAL>`.
6. Cobrir as quatro chaves do backend e os aliases em testes.

### 3.2 Compatibilidade de Dados

Não haverá migração destrutiva nem escrita automática. Aliases históricos são
aceitos em leitura. Valores desconhecidos usam Bronze de forma fail-safe; a
origem continua intacta para uma eventual migração administrativa auditável.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Dados legados `PLATINUM/CHAMPION` | Mapear para o teto canônico Diamante sem persistir alteração |
| Regressão de labels por idioma | Chaves idênticas em PT-BR, EN e ES + teste |
| Misturar pontos sazonais com rating | Configuração usa `minRating`; progresso só usa rating quando disponível |
| Novo valor inválido do servidor | Normalizador total + fallback Bronze + teste |

---

## 4. Verificação

- [x] Testes unitários do contrato e aliases
- [x] Teste do hook com as quatro divisões retornadas pela callable
- [x] Testes Web focados
- [x] Build e lint Web com Node 22
- [x] Build/lint Functions e teste focado do diretório público
- [x] Teste KMP focado de `LeagueRatingCalculatorTest`
- [x] `git diff --check`

---

## 5. Prevenção Futura

O contrato deixa de depender de casts e ganha um teste explícito que enumera os
mesmos quatro valores produzidos por Functions/KMP. Novas divisões exigirão uma
mudança deliberada no tipo, configuração, i18n e teste.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Investigação, desenho e aprovação do bugfix |
| 2026-07-13 | Codex | Implementação e verificação concluídas |
