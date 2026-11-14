# Fichas das lojas: revisão de 14/11/2026

Cópia do que estava no ar: `backup-20261114/`. Ficha nova: `google-play/` e `app-store/`. Gerador das imagens: `ferramentas/gerar-imagens.mjs` (Chrome headless e ffmpeg).

## O que estava errado

Google Play
- Descrição com emojis e chamada "Baixe agora", que a política de metadados do Play manda evitar; só 810 caracteres, sem ranking, níveis, estatísticas nem caixa.
- 8 capturas de telefone de 29/12/2025, com a interface antiga, sem legenda e com nomes de pessoas reais.
- Tablet de 7" e de 10" com 1 captura cada (o Play pede no mínimo 4 para telas grandes).
- Imagem de destaque com telas que não são do app.
- Sem vídeo, sem site de contato. Categoria Social; na App Store é Esportes.

App Store
- Subtítulo vazio. Palavras-chave gastando espaço com termos fracos.
- Capturas sem legenda; a de Início mostra o selo "Ao vivo", que saiu do app.
- Sem prévia de vídeo.

Política de privacidade (https://futebadosparcas.com.br/privacy_policy.html)
- Não fala de anúncios (AdMob) nem da assinatura, que o iOS 1.10.0 publicado tem.
- Contato techfernandesltda@gmail.com; no Play é atendimento@techfernandes.com.br.

## Limites conferidos na documentação oficial em 14/11/2026

- Play: título 30, breve 80, completa 4000; ícone 512 PNG de 32 bits até 1024 KB; destaque 1024x500 JPEG ou PNG de 24 bits sem alfa; telefone 2 a 8 capturas, 16:9 ou 9:16, lados de 320 a 3840; telas grandes mínimo 4, de 1080 a 7680; vídeo por URL do YouTube.
- App Store: nome 30, subtítulo 30, promocional 170, palavras-chave 100, descrição 4000; iPhone 6,9" 1320x2868; prévia 886x1920, 15 a 30 s, até 500 MB.

## Achados no app (fora deste PR)

Vistos no build de depuração do `master`, com emuladores do Firebase; não conferidos no binário de produção.

- O app fecha por falta de definição no Koin: `PostGameEventEmitter` (em `MainActivityCompose.observePostGameEvents`), `UpdateProfileUseCase` e `BadgeAwarder` (parâmetros padrão de `AntiBotGate`) e `domain.repository.GameRepository` (`GameDetailViewModel`, ao abrir o detalhe do jogo).
- A apresentação inicial do Android diz "Times equilibrados com IA". A regra da casa é não dizer "IA" na interface.
- `docs` de novidades da 1.44.0 do Android marcadas como não publicadas.

As capturas evitam: login, apresentação inicial, Conquistas e detalhe do jogo.
