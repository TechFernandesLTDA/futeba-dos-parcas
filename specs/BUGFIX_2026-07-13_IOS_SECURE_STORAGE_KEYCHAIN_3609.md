# BUGFIX: SecureStorage iOS propaga falhas do Keychain

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex (ios-security)
> **Data:** 2026-07-13
> **Issue:** #3609
> **PR:** pendente

---

## 1. Descricao do Bug

### 1.1 Comportamento Atual (Errado)

A implementacao iOS ignora os `OSStatus` de `SecItemAdd` e `SecItemDelete` e
converte qualquer falha de leitura em ausencia da chave. Uma falha de acesso,
assinatura ou entitlement pode, portanto, parecer uma escrita bem-sucedida e
causar logout na leitura seguinte. Novos itens tambem usam a acessibilidade
default `kSecAttrAccessibleWhenUnlocked`.

### 1.2 Comportamento Esperado (Correto)

- `save`, `get`, `delete`, `clear` e `contains` verificam todos os `OSStatus`.
- `errSecItemNotFound` e normal em leitura/remocao; demais erros lancam uma
  excecao diagnosticavel contendo somente operacao e codigo do sistema.
- `save` faz add e, em `errSecDuplicateItem`, update, sem a janela destrutiva
  de delete seguido de add.
- Itens novos/atualizados usam
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, permitindo tarefas em
  background depois do primeiro desbloqueio sem migrar segredo a outro device.
- Chaves e valores nunca aparecem em logs ou mensagens de erro.

### 1.3 Passos para Reproduzir

1. Fazer `SecureStorage.save()` em um ambiente no qual o Keychain devolva um
   erro, por exemplo `errSecMissingEntitlement`.
2. Observar que a chamada retorna normalmente.
3. Fazer `get()` e observar `null`, indistinguivel de chave inexistente.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versao iOS | 1.6.1 (build 18) |
| Plataforma | iOS 15+ / KMP |
| Frequencia | Sempre que Keychain devolve erro |
| Impacto | Segredo nao persistido e logout sem diagnostico |

## 2. Analise de Causa Raiz

### 2.1 Investigacao

O `actual` iOS descarta o retorno de add/delete, trata somente sucesso em get e
usa delete+add para sobrescrever. O `iosApp/project.yml` nao configura
`CODE_SIGN_ENTITLEMENTS`, nao existe arquivo `.entitlements` versionado e nao ha
`keychain-access-groups` declarado.

### 2.2 Causa Raiz

O wrapper do Security framework nao centraliza a classificacao dos status nem
define explicitamente o nivel de acessibilidade do item.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `shared/src/commonMain/kotlin/com/futebadosparcas/platform/storage/SecureStorage.kt` | Documentar contrato de falha |
| `shared/src/iosMain/kotlin/com/futebadosparcas/platform/storage/SecureStorage.kt` | Validar status e definir acessibilidade |
| `shared/src/iosTest/kotlin/com/futebadosparcas/platform/storage/KeychainStatusTest.kt` | Regressao da classificacao de status |
| `specs/DECISIONS.md` | Registrar acessibilidade e ausencia de access group |

## 3. Solucao Proposta

### 3.1 Abordagem

Preservar a API publica (`Unit`/nullable) e propagar falhas por uma
`SecureStorageException`, como ja e permitido por operacoes de armazenamento.
Extrair a classificacao de `OSStatus` para funcoes internas testaveis. Usar
`SecItemAdd` e, apenas para duplicata, `SecItemUpdate`; validar delete/clear e
distinguir item ausente de erro no get/contains.

Nao sera adicionado access group: o app usa o Keychain padrao do proprio bundle
e nao ha requisito ou identificador de compartilhamento versionado. Inventar um
grupo causaria `errSecMissingEntitlement`. A configuracao de assinatura real
continua responsabilidade do provisioning profile/Xcode.

### 3.2 Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Chamadores antes dependiam de falha silenciosa | Excecao torna a falha observavel; item ausente continua retorno normal |
| Segredos existentes mantem acessibilidade antiga ate nova escrita | Update passa a normalizar `kSecAttrAccessible` na proxima escrita |
| Restore para novo aparelho nao leva o segredo | `ThisDeviceOnly` exige reautenticacao, comportamento seguro para token/credencial |
| Teste nao consegue simular Security.framework real | Testar classificacao pura e compilar/linkar os targets iOS |

## 4. Verificacao

### 4.1 Testes Adicionados

- [x] Sucesso nao lanca erro.
- [x] `errSecItemNotFound` e aceito somente quando a operacao permite ausencia.
- [x] Outros status lancam excecao com operacao/codigo, sem chave ou valor.

### 4.2 Testes de Regressao

- [x] Compilar testes iOS Simulator Arm64 do modulo shared.
- [x] Linkar framework iOS Simulator Arm64 do modulo shared.
- [x] Linkar framework iOS Device Arm64 do modulo shared.
- [x] Compilar Kotlin Android do modulo shared para validar o contrato expect/actual.
- [x] Rodar testes JVM do modulo shared.
- [x] Compilar targets iOS Arm64 e x64.
- [x] Compilar o consumidor `composeApp` para iOS Simulator Arm64.
- [x] Rodar detekt e `git diff --check`.

O executavel de testes iOS nao pode ser linkado neste clone porque o linker nao
encontra o framework externo `FirebaseCore` (CocoaPods nao instalado). A
compilacao de `iosTest` e o link do framework de producao passam; a execucao dos
testes nativos deve ser repetida no CI/workspace com Pods disponiveis.

## 5. Prevenção Futura

Toda chamada ao Security.framework deve classificar explicitamente o status e
qualquer alteracao de access group deve vir acompanhada de entitlement,
provisioning e teste em device real.

## Historico

| Data | Autor | Alteracao |
|------|-------|-----------|
| 2026-07-13 | Codex (ios-security) | Spec aprovada antes da implementacao |
| 2026-07-13 | Codex (ios-security) | Implementacao e gates de compilacao concluidos |
