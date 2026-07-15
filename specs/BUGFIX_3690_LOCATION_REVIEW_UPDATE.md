# BUGFIX: Atualização de avaliação de quadra

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issue:** #3690

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Ao enviar uma segunda avaliação para a mesma quadra, o cliente usa `setDoc` no
documento já existente e envia um novo `created_at`. O Firestore trata a
operação como update e a regra rejeita a alteração do timestamp original com
`permission-denied`.

### 1.2 Comportamento Esperado (Correto)

- Uma avaliação inédita deve ser criada com `created_at` gerado pelo servidor.
- Uma avaliação existente deve abrir pré-preenchida e ser atualizada sem alterar
  `created_at`, gravando `updated_at` com o horário do servidor.
- O cooldown de 60 segundos definido nas regras deve continuar valendo.

### 1.3 Passos para Reproduzir

1. Entrar como usuário autenticado.
2. Abrir o detalhe de uma quadra e publicar uma avaliação.
3. Abrir novamente o diálogo de avaliação e reenviar nota/comentário.
4. Observar o erro de permissão retornado pelo Firestore.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Web |
| Versão afetada | 1.54.1 |
| Frequência | Sempre na atualização |
| Impacto | Qualquer usuário que já avaliou a quadra |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

O documento da avaliação usa o UID como ID, garantindo uma avaliação por
usuário. `setDoc` cria na primeira submissão, mas passa a ser uma atualização
nas seguintes. O payload atual sempre recria `created_at`.

### 2.2 Causa Raiz

O cliente não diferencia create de update, enquanto `firestore.rules` exige
`created_at` imutável e `updated_at == request.time` nas atualizações.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/pages/locations/LocationDetailScreen.tsx` | Escrita e estado do diálogo de avaliação |
| `web/src/pages/locations/LocationDetailScreen.test.tsx` | Regressão do create/update e pré-preenchimento |
| `firestore-rules-tests/src/locations.test.ts` | Contrato de create, update e cooldown |

---

## 3. Solução Proposta

### 3.1 Abordagem

Localizar a avaliação do usuário no snapshot já carregado. Ao abrir o diálogo,
pré-preencher nota e comentário quando ela existir. Usar `setDoc` somente para
criação e `updateDoc` para edição, omitindo `created_at` e enviando
`updated_at: serverTimestamp()`.

### 3.2 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Regressão na primeira avaliação | Teste de componente verifica `setDoc` e `created_at` |
| Alteração acidental de `created_at` | Teste de componente verifica payload do `updateDoc` |
| Cooldown ser contornado | Testes do emulador cobrem update permitido e precoce negado |

---

## 4. Verificação

- [x] Teste de componente para criação de avaliação.
- [x] Teste de componente para pré-preenchimento e atualização.
- [x] Teste de rules para create e update permitido.
- [x] Teste de rules para update antes de 60 segundos negado.
- [x] Build, lint e testes focalizados passam.

---

## 5. Prevenção Futura

O contrato de timestamps das rules não possuía teste na tela que grava a
avaliação. Os novos testes mantêm cliente e autorização sincronizados.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-14 | Codex | Spec criada e aprovada para implementação da #3690 |
| 2026-07-14 | Codex | Correção implementada e verificada localmente |
