# SPEC: Baixar meus dados no Android (`exportMyData`)

> **Status:** `APPROVED` (dono autorizou a entrega Android do #4483; iOS fica fora por decisão do dono)
> **Autor:** Claude Code (sessão agente) para Renan Locatiz Fernandes
> **Data:** 2026-11-01
> **Issue:** #4483 (paridade do #4482). Backend e web: `specs/FEATURE_4482_EXPORT_MY_DATA.md`
> **PR:** (preencher ao abrir)

---

## 1. Requirements

### 1.1 Problema

A LGPD (art. 18, V) dá ao titular o direito à portabilidade dos dados. A web já oferece
"Baixar meus dados" (#4482), que chama a callable `exportMyData` e baixa um JSON. O app
Android não tem a entrada, então quem só usa o app não consegue exercer o direito.

### 1.2 Casos de uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador logado | Sobre → "Baixar meus dados" → escolhe onde salvar | Arquivo JSON salvo no local escolhido e aviso de sucesso |
| UC2 | Jogador logado | Igual ao UC1, mas o backend devolve `complete: false` | Arquivo salvo e aviso de exportação parcial |
| UC3 | Jogador logado | Quarta exportação em 24 h | Nada é salvo; aviso do limite de 3 por dia |
| UC4 | Jogador logado | Cancela o seletor de arquivo | Nada acontece; a callable não é chamada; sem mensagem |

### 1.3 Critérios de aceite

- [ ] CA1: o item "Baixar meus dados" aparece na tela Sobre, logo antes de "Excluir conta", no mesmo padrão de item de lista.
- [ ] CA2: o toque abre o seletor do sistema (`ActivityResultContracts.CreateDocument("application/json")`) com o nome sugerido `futeba-meus-dados-AAAA-MM-DD.json` (data local).
- [ ] CA3: a callable só é chamada depois que o usuário escolhe o URI. Cancelar o seletor não gasta cota nem mostra erro.
- [ ] CA4: o JSON devolvido pela callable é gravado inteiro no URI (`contentResolver.openOutputStream(uri, "wt")`).
- [ ] CA5: `complete == false` ⇒ o arquivo é salvo e o usuário vê o aviso de exportação parcial.
- [ ] CA6: `resource-exhausted` sem motivo ⇒ mensagem de limite diário; `resource-exhausted` com `details.reason == "export-too-large"` ⇒ mensagem de arquivo grande demais; qualquer outro erro ⇒ mensagem genérica.
- [ ] CA7: se a callable ou a gravação falhar (ou o job for cancelado), o documento é apagado **se estiver vazio** (best-effort). Um arquivo existente que o usuário escolheu sobrescrever nunca é apagado.
- [ ] CA8: enquanto gera, o item mostra um `CircularProgressIndicator` pequeno no lugar do chevron e fica desabilitado (sem segundo disparo).
- [ ] CA9: textos em `strings.xml` (pt-BR, en, es), copiados da web com "baixado" trocado por "salvo".

### 1.4 Fora de escopo

- iOS (`composeApp/`, `iosApp/`): decisão do dono, segue no #4483.
- Mudanças na callable, na web ou nas rules.
- Compartilhar o arquivo direto (share sheet) ou guardar cópia no Storage.

---

## 2. UX/UI

### 2.1 Fluxo

```
Sobre → toque em "Baixar meus dados"
  → seletor do sistema (CreateDocument, nome sugerido)
      ├─ cancelou (URI nulo) → volta à tela, nada acontece
      └─ escolheu URI → item em "Gerando arquivo…" (spinner)
            → callable exportMyData (timeout 180 s)
            → grava JSON no URI
            → diálogo de resultado: sucesso | parcial | erro
```

### 2.2 Telas e estados

| Estado | Item na lista | Diálogo |
|--------|---------------|---------|
| Idle | Ícone de download, título, descrição, chevron | — |
| Loading | Subtítulo "Gerando arquivo…", spinner pequeno no lugar do chevron, item desabilitado | — |
| Success (completo) | Volta ao normal | "Dados salvos" + mensagem de sucesso, botão OK |
| Success (parcial) | Volta ao normal | "Exportação parcial" + aviso, botão OK |
| Error | Volta ao normal | "Não foi possível exportar" + mensagem do erro, botão OK |

A tela Sobre não tem `SnackbarHost` (o `SecondaryScreenWrapper` não expõe um). O resultado
usa `AlertDialog` dirigido pelo estado, no mesmo padrão dos diálogos de exclusão de conta.
OK volta o estado para Idle. Empty não se aplica (ação única, sem lista).

### 2.3 Responsividade

O item herda a `LazyColumn` da tela Sobre (`adaptiveContentWidth`), já validada em phone,
landscape e tablet. O diálogo é o `AlertDialog` padrão do M3.

### 2.4 Acessibilidade

- [x] Ícone do item com `contentDescription` (mesmo padrão do `LinkMenuItem`); spinner com descrição "Gerando arquivo…".
- [x] Touch target: o item ocupa a largura toda com 16 dp de padding (bem acima de 48 dp).
- [x] Cores só de `MaterialTheme.colorScheme`.
- [x] O seletor de arquivo é do sistema (TalkBack nativo).

---

## 3. Technical Design

### 3.1 Arquitetura

```
AboutScreen (launcher CreateDocument)
  → ExportMyDataViewModel (StateFlow<ExportMyDataUiState>, Job guardado)
      → MyDataExportRepository (interface)
          └─ MyDataExportRepositoryImpl
               ├─ FirebaseFunctions (single do Koin, southamerica-east1)
               └─ ContentResolver (gravar / apagar o documento)
```

- `MyDataExportRepository.fetch()` chama `getHttpsCallable("exportMyData")` com
  `setTimeout(180, SECONDS)` (mesmo valor da web e do `EXPORT_TIMEOUT_SECONDS`) e devolve
  `ExportMyDataPayload(json, complete)`.
- O `HttpsCallableResult.data` chega como `Map`/`List`/primitivos. A conversão para texto
  JSON é pura (kotlinx.serialization `JsonElement`, `prettyPrint`), sem `org.json`, para
  ser testável na JVM.
- `mapExportMyDataError(Throwable)` é puro (mesmo estilo de `mapDeleteAccountError`) e olha
  `e` e `e.cause` como `FirebaseFunctionsException`.
- `exportMyDataFileName(LocalDate)` é puro (desugaring já está ligado; minSdk 24).

### 3.2 Modelos

```kotlin
data class ExportMyDataPayload(val json: String, val complete: Boolean)

sealed interface ExportMyDataError { RateLimited, TooLarge, Generic }

sealed interface ExportMyDataUiState {
    Idle; Loading; Success(partial: Boolean); Error(@StringRes messageRes: Int)
}
```

### 3.3 API

Callable `exportMyData` (já em produção, `functions/src/auth/export-my-data.ts`): sem
payload, uid de `request.auth.uid`. Erros: `unauthenticated`, `resource-exhausted`
(3 por 24 h) e `resource-exhausted` + `details.reason = "export-too-large"` (acima de 8 MiB).

### 3.4 Ordem: seletor antes da callable (decisão)

A callable tem limite de 3 chamadas por 24 h. Chamar antes de ter o URI gastaria cota toda
vez que o usuário cancelasse o seletor. Por isso o seletor abre primeiro e a callable só
roda com URI escolhido. Efeito colateral: `CreateDocument` cria o arquivo vazio antes de
devolver o URI. Se a callable ou a gravação falhar, ou o job for cancelado, o app apaga o
documento com `DocumentsContract.deleteDocument` (best-effort, em `NonCancellable`), mas
**só se `OpenableColumns.SIZE == 0`**: o seletor permite escolher um arquivo existente para
sobrescrever, e uma falha da callable não pode apagar o conteúdo do usuário. Tamanho
desconhecido ⇒ não apaga. Caso raro aceito: falha no meio da gravação deixa um arquivo
parcial (não vazio), que fica no lugar.
A gravação usa o modo `"wt"` para truncar caso o usuário sobrescreva um arquivo existente.

Sair da tela Sobre durante a exportação cancela o job (o ViewModel vive no back stack da
tela). A cota já foi consumida no backend e o documento vazio é descartado.

### 3.5 Cache e offline

Sem cache: a exportação é sob demanda. Sem rede, a callable falha e o usuário vê a
mensagem genérica; o arquivo vazio é apagado.

### 3.6 Segurança e privacidade

- [x] Nenhum segredo no cliente; autorização no backend.
- [x] O conteúdo do arquivo nunca é logado; o log só registra o tipo do erro.
- [x] O JSON fica só em memória até ser gravado no local escolhido pelo usuário.

### 3.7 Performance

O JSON tem no máximo 8 MiB. A conversão e a gravação rodam em `Dispatchers.IO`.

---

## 4. Tasks

- [x] T1: spec (este arquivo)
- [x] T2: `MyDataExportRepository` + impl + funções puras (conversão JSON, erro, nome do arquivo)
- [x] T3: `ExportMyDataViewModel` + registro no Koin (`RepositoryKoinModule`, `ViewModelKoinModule`)
- [x] T4: item na `AboutScreen`, launcher `CreateDocument`, diálogo de resultado, ligação no `AppNavGraph`
- [x] T5: strings pt-BR, en, es
- [x] T6: testes unitários (ViewModel e funções puras)

---

## 5. Verification

### 5.1 Testes

`ExportMyDataViewModelTest` (JUnit 5, MockK, `runTest`):
- sucesso completo, parcial, `resource-exhausted` (limite), `export-too-large`, erro genérico;
- URI nulo não chama a callable;
- falha de gravação ⇒ Error e `discard` chamado; sucesso ⇒ `discard` não chamado;
- conversão `Any? → JSON` (mapa/lista aninhados, número, booleano, null) e nome do arquivo.

Comandos: `./gradlew :app:compileDebugKotlin`,
`./gradlew :app:testDebugUnitTest --tests "*ExportMyDataViewModelTest*"`, `./gradlew detekt`.

### 5.2 Mobile DoD

- [x] Responsividade: herda a tela Sobre (phone portrait/landscape, tablet).
- [x] Acessibilidade: contentDescription, touch target ≥ 48 dp.
- [x] Performance: estado único em `StateFlow`, sem recomposição extra na lista.
- [x] Offline/erros: comportamento definido (mensagem + limpeza do arquivo vazio).
- [ ] Teste manual em aparelho (pendente: depende do build de release do dono).

---

## 6. Notas

- Nome do arquivo: a tarefa pediu `futeba-meus-dados-AAAA-MM-DD.json`; a web usa
  `futeba-dos-parcas-meus-dados-AAAA-MM-DD.json`. Ponto em aberto para alinhar, se o dono quiser.

## Histórico de Alterações

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-11-01 | Claude Code | Criação (APPROVED) |
