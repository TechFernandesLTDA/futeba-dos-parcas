# BUGFIX: CI do iOS builda o shared.framework e ficou vermelho desde 01/10 (#4427)

> **Status:** `APPROVED` (trabalho autorizado pelo dono em 01/11/2026; só ajuste de workflows existentes)
> **Severidade:** `MEDIUM`
> **Autor:** Claude Code
> **Data:** 2026-11-01
> **PR:** a definir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- `ios-build.yml` linkava `:shared:linkDebugFrameworkIosSimulatorArm64` e
  `:shared:linkDebugFrameworkIosArm64`, e o job do app linkava o shared de novo. O app
  iOS não usa esse framework desde 31/10 (`iosApp/project.yml` linka só o ComposeApp, que
  embute o `:shared`; dois frameworks estáticos duplicavam o runtime do Kotlin/Native).
- `ios-testflight.yml` também linkava `:shared:linkReleaseFrameworkIosArm64`.
- Em 01/10 o workflow ficou vermelho ou cancelado, com execuções de 5 a 7 h.

### 1.2 Comportamento Esperado (Correto)

O CI builda só o que o app usa: o `ComposeApp.framework` (simulador e device).

---

## 2. Análise de Causa Raiz

### 2.1 Investigação (execuções de `ios-build.yml`)

| Execução | Data | Resultado | Observação |
|----------|------|-----------|------------|
| 36859524014 (push master) | 01/10 | failure | Framework falhou em ~45 s no 1º passo Gradle |
| 36860738411 (release) | 01/10 | failure | Mesmo passo, mesmo tempo |
| 36811083259 | 01/10 | failure | Mesmo passo |
| 36858607570 e outras | 01/10 | cancelled | `cancel-in-progress` com o job na fila do Mac |
| 41220983148 em diante | 31/10 | success | Mac de volta e `IOS_MAC_RUNNER=true` |

Os logs de 01/10 expiraram (HTTP 410), então a causa abaixo é inferida dos passos e do
histórico do workflow.

### 2.2 Causa Raiz

1. **Falha rápida (01/10):** o job usava "Setup JDK 17", e `gradle/gradle-daemon-jvm.properties`
   exige JetBrains 21. O Gradle tentava baixar o JDK pelo foojay, que respondia 400. O
   commit 23730efa (#4249, 09/10) trocou para JDK 21 JetBrains em todos os jobs Gradle.
2. **5 a 7 h:** não era build lento. Era fila: o job de framework só começava horas depois
   de criado, esperando o único Mac self-hosted (`futeba`), e novas execuções do mesmo ref
   cancelavam as antigas (`cancel-in-progress`).
3. **09/10 a 31/10:** sem runner macOS, os jobs de iOS ficaram atrás de
   `vars.IOS_MAC_RUNNER` (#4322). Desde 31/10 (Mac de volta, variável `true`) o workflow
   está verde.
4. **Passo morto:** o link do `shared.framework` sobrou da época em que o app o usava.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `.github/workflows/ios-build.yml` | Remover links do `:shared`; ComposeApp para simulador e device |
| `.github/workflows/ios-testflight.yml` | Remover `:shared:linkReleaseFrameworkIosArm64` |
| `iosApp/build_shared.sh`, `CLAUDE.md` | Comandos locais passam a gerar o ComposeApp |

---

## 3. Solução

- Job `build-shared-framework` (id mantido, porque `build-ios-app` e `notify` dependem dele)
  passa a se chamar "Build ComposeApp Framework" e linka o ComposeApp para simulador e
  device. Nenhum check de iOS é obrigatório na master, então trocar o nome não quebra regra.
- O `:shared` continua compilado (dependência do ComposeApp) e testado em `kmp-shared-tests`.
- Nenhum workflow novo, nenhum runner novo.

---

## 4. Verificação

- `ruby -ryaml` carrega os dois workflows.
- Local (Mac): `:composeApp:linkDebugFrameworkIosSimulatorArm64` e
  `:composeApp:linkDebugFrameworkIosArm64` passam.
- A execução do próprio PR no Mac é a validação do workflow.
- `ios-testflight.yml` é só `workflow_dispatch` e não foi executado.
