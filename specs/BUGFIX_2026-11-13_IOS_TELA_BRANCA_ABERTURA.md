# BUGFIX: Tela branca ao abrir o app no iPhone (1.10.0, build 29)

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM` (apontado na revisão da App Store de 12/11/2026)
> **Autor:** Claude (pedido da sessão principal, autorizado pelo dono)
> **Data:** 2026-11-13

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Na abertura a frio, o iPhone mostra uma tela branca lisa até o Compose desenhar a primeira tela. No aparelho do
revisor isso levou cerca de 10 s.

Causa: o `Info.plist` define a tela de abertura com `UILaunchScreen` → `UIColorName = AccentColor`. Só que o
colorset `AccentColor` não tem cor definida, então o iOS desenha branco. Também não há imagem. O resultado é que
a tela de abertura não se distingue de um app travado.

### 1.2 Comportamento Esperado (Correto)

Durante o carregamento aparece uma tela de abertura com o logo do Futeba no centro:

- Modo claro: fundo branco.
- Modo escuro: fundo `#0F1114`.

Essa tela fica até a primeira tela do app.

### 1.3 Medição (Simulador iPhone SE, Debug)

| | Antes | Depois |
|---|---|---|
| Tela até o primeiro conteúdo | branca, de 1,3 s a 4,2 s | logo, de 2,1 s a 2,7 s |

O tempo até o primeiro conteúdo não muda; o que muda é o que aparece enquanto ele não chega.

Os 10 s não se reproduziram no Simulador, e o build Release num iPhone real não foi medido.

## 2. Correção

- `iosApp/iosApp/Assets.xcassets/LaunchBackground.colorset`: branco no modo claro e `#0F1114` no escuro.
- `iosApp/iosApp/Assets.xcassets/LaunchLogo.imageset`: logo em @2x (320 px) e @3x (480 px), gerado de
  `app/src/main/res/drawable/ic_app_logo_full.png`.
- `Info.plist`: `UILaunchScreen` passa a usar `UIColorName = LaunchBackground` e `UIImageName = LaunchLogo`.

Testei e descartei deixar a view do Compose transparente (`opaque = false`): é uma API experimental e não trouxe
ganho em relação à tela de abertura.

**Atenção:** o iOS guarda em cache a imagem da tela de abertura. No Simulador foi preciso apagar
`Library/SplashBoard` do app para ver a tela nova. No aparelho, o iOS refaz o cache quando o app é atualizado.

## 3. Item relacionado: cartão de login cortado

Conferi no Simulador do iPhone SE (a menor tela suportada) com a build atual:

- **Teclado fechado:** o cartão passa da dobra, mas a tela rola e mostra o cartão inteiro, os links e a versão.
- **Teclado aberto no campo de senha:** o campo e o botão Entrar ficam visíveis acima do teclado, e dá para rolar
  até "Cadastre-se".

Não achei defeito, então o código do login não mudou. Ainda falta conferir num iPhone real e no iPad em modo de
compatibilidade (o app é só para iPhone).

## 4. Mobile DoD

- [x] Modo claro e escuro conferidos no Simulador.
- [ ] Não medido num iPhone real nem em build Release.
