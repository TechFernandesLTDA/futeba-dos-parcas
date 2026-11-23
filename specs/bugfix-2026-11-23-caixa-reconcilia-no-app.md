# BUGFIX: Primeiro lançamento do caixa recusado no Android e no iOS

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `MEDIUM`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `45946afa`
> **Origem:** simulação de uso no emulador (PR #4621), issue #4629 item 23

---

## 1. Problema

Num grupo sem caixa ainda, o primeiro lançamento feito pelo app é recusado.

- O `createCashboxEntry` responde `failed-precondition` "Resumo do caixa precisa ser reconciliado" quando
  `groups/{gid}/cashbox_summary/current` não existe, ou quando um valor dele é inválido
  ("`<campo>` precisa ser reconciliado").
- O web chama `reconcileCashboxSummary` sozinho ao abrir a tela do caixa, quando o resumo falta e quem abre é
  dono ou admin.
- O Android e o iOS usam o mesmo `CashboxRepositoryImpl` (shared), que mostrava o erro e parava. O
  organizador só conseguia lançar depois de abrir o caixa pelo web.

## 2. Correção

`CashboxRepositoryImpl.addEntry` (shared, vale para Android e iOS):

- Se o lançamento volta com "precisa ser reconciliado" (na mensagem ou numa causa do erro), chama
  `reconcileCashboxSummary` e tenta o lançamento mais uma vez.
- A segunda tentativa usa o mesmo `requestId`. Se a primeira tiver sido gravada, o servidor responde como
  duplicata e não grava de novo.
- Uma tentativa a mais, no máximo. Se a reconciliação falhar (por exemplo, quem lança não é dono nem admin),
  o app mostra o erro original, como antes.
- Qualquer outro erro segue direto, sem reconciliar.

Sem mudança em regras, functions, índices ou dados gravados: a reconciliação é a mesma callable que o web já
usa, com a mesma permissão de quem pode lançar.

## 3. Testes

`shared/src/commonTest/.../CashboxSummaryReconcileTest.kt` (a regra fica em `commonMain`, sem Firebase, então o teste roda no JVM e no iOS):

- primeiro lançamento reconcilia e tenta de novo uma vez;
- outro erro não reconcilia;
- reconciliação recusada devolve o erro original sem nova tentativa;
- segunda tentativa que ainda falha não entra em laço;
- reconhece o pedido na causa do erro e no campo inválido do resumo.

## 4. Verificação

- [x] `:shared:testDebugUnitTest` verde (JVM)
- [x] `:shared:compileTestKotlinIosSimulatorArm64` compila
- [ ] `:shared:iosSimulatorArm64Test`: o link do binário de teste falha nesta máquina por `ld: framework 'FirebaseCore' not found` (o framework do Firebase iOS não está no caminho do linker); no CI esse passo é `continue-on-error`
- [ ] Publicação do Android e do iOS (fica com o Renan)
