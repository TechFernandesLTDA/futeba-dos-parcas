# Google Play: ficha nova (14/11/2026)

App `com.futebadosparcas`. Salvo na ficha principal (pt-BR) e enviado para revisão em 14/11/2026 (7 mudanças).

| Campo | Arquivo | Tamanho / limite |
|---|---|---|
| Título | `textos/titulo.txt` | 29 / 30 |
| Descrição breve | `textos/descricao-breve.txt` | 71 / 80 |
| Descrição completa | `textos/descricao-completa.txt` | 1564 / 4000 |
| Imagem de destaque | `imagem-destaque-1024x500.png` | 1024x500, PNG de 24 bits |
| Telefone | `telefone/01..06` | 1080x1920, com legenda |
| Tablet 7" | `tablet-7/01..04` | 1080x1920, sem legenda |
| Tablet 10" | `tablet-10/01..04` | 1440x2560, sem legenda |

O ícone não mudou (sem defeito).

A descrição não fala de anúncios nem de assinatura porque a produção Android é a 1.43.0, que não tem. Quando a 1.44.0 for publicada, acrescentar o parágrafo dos banners e da assinatura "Sem anúncios", igual ao da App Store.

## Não aplicado

- Vídeo: `video/futeba-play-1920x1080.mp4` (27,9 s, gravação real do app). O Play só aceita URL do YouTube (público ou não listado, sem anúncios, sem restrição de idade, incorporável). Não foi publicado em conta alguma.
- Categoria (hoje Social; na App Store é Esportes) e site de contato (vazio): ficam para decisão do Renan.
- Declaração "Rotular recursos gerados com IA": o console abriu o diálogo ao salvar; nada foi marcado. As imagens novas são capturas reais do app montadas por script (`../ferramentas/gerar-imagens.mjs`).

## Como as capturas foram feitas

App do `master` (1.44.0) em emulador Android, ligado aos emuladores do Firebase com dados fictícios. Nenhum dado de usuário real aparece. `brutas/` guarda as capturas sem legenda.
