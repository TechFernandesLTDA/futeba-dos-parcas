# SDD — Android Verified App Links

**Status:** APPROVED / VERIFIED

## Contexto

Links HTTPS compartilhados pelo Web sempre abriam no navegador porque a Activity
Compose não era exportada, não havia filtro `VIEW` verificável e o domínio não
publicava Digital Asset Links.

## Decisão

- `MainActivityCompose` recebe App Links verificados para `/join`, `/invite`,
  `/checkin` e `/game`, com `singleTop` para cold e warm start.
- O parser aceita somente o Hosting oficial (e mantém o domínio legado apenas no
  parser), valida parâmetros e converte dados externos para rotas internas.
- Jogo e check-in abrem o detalhe do jogo; convites de grupo e amigo abrem os
  pontos nativos seguros já existentes (Grupos e Home), sem tratar código como ID.
- O Hosting publica `/.well-known/assetlinks.json` com os dois certificados
  SHA-256 registrados para o app Android no Firebase.

## Segurança e limites

O token de check-in nunca é colocado na rota Compose nem em logs. O check-in
nativo continua usando o fluxo autoritativo do detalhe do jogo. Códigos de
convite não são confundidos com IDs de grupo; a aceitação por código ainda não
possui tela nativa equivalente e permanece disponível no Web.

## Validação

- Testes do parser e mapeamento de rotas.
- Manifest e JSON válidos.
- Build Web confirma cópia de `.well-known` para `dist`.
- `adb shell am start -W -a android.intent.action.VIEW -d <url>` documentado
  como smoke em device de release.
