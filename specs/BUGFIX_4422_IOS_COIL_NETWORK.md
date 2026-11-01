# BUGFIX: imagens de rede não carregam no iOS (#4422)

> **Status:** `APPROVED` (trabalho autorizado pelo dono em 01/11/2026; iOS só recebe correção de bugs)
> **Severidade:** `HIGH`
> **Autor:** Claude Code
> **Data:** 2026-11-01
> **PR:** a definir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

No iOS, todo `AsyncImage` do Coil com URL `https://` fica vazio. Afeta as fotos de
`BlockedPlayersScreen` e `InvitePlayersScreen` (`composeApp/.../ui/core/`).

### 1.2 Comportamento Esperado (Correto)

A imagem baixa e aparece, como no Android.

### 1.3 Passos para Reproduzir

1. Rodar o app iOS no simulador.
2. Abrir uma tela com `AsyncImage` de URL remota.
3. Observar que a imagem não aparece (o Coil devolve erro de "fetcher não encontrado").

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | iOS (Compose Multiplatform, `composeApp`) |
| Frequência | Sempre |

---

## 2. Análise de Causa Raiz

### 2.2 Causa Raiz

O Coil 3 separa a rede do núcleo. O `composeApp` declara `coil-network-okhttp` só em
`androidMain`. Em `iosMain` não havia nenhum artefato de rede do Coil, então o
`ImageLoader` não tinha fetcher para `http(s)`.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `composeApp/build.gradle.kts` | Faltava a dependência de rede do Coil no `iosMain` |

---

## 3. Solução

### 3.1 Abordagem

Em `iosMain.dependencies`: `io.coil-kt.coil3:coil-network-ktor3:3.3.0` e
`io.ktor:ktor-client-darwin:3.6.0` (mesma versão do Ktor do `:shared`). O artefato do Coil
registra o fetcher sozinho; não é preciso configurar `ImageLoader`. O Android continua só
com OkHttp, sem dois fetchers de rede.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Duas versões do Ktor no binário | `dependencies` do `iosSimulatorArm64` resolve tudo para 3.6.0 |
| Registro automático não funcionar no Kotlin/Native | Verificado no simulador (abaixo) |

---

## 4. Verificação

- `:composeApp:compileKotlinIosSimulatorArm64` e `:composeApp:compileDebugKotlinAndroid` passam.
- Simulador (iPhone 17 Pro, iOS 26.4): sonda temporária (não commitada) com `AsyncImage` de
  uma URL pública. Com a correção a imagem aparece; no build de controle, sem as duas
  dependências, ela não aparece.

---

## 5. Prevenção Futura

Toda dependência de plataforma do Coil (rede, vídeo, SVG) precisa existir nos dois
source sets que renderizam UI: `androidMain` e `iosMain`.
