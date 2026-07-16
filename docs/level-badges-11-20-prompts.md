# Brasões da Eternidade — níveis 11–20

Direção e prompts finais dos brasões de **Rumo ao Estrelato**. A coleção substitui
os medalhões numéricos provisórios por símbolos de habilidade legíveis desde
24 px, sem retratos, marcas, uniformes oficiais ou texto gerado.

## Especificação técnica

| Propriedade | Valor |
| --- | --- |
| Web | `web/public/images/levels/level_11.png` … `level_20.png` |
| Android | `app/src/main/res/drawable-nodpi/ic_level_badge_11.png` … `ic_level_badge_20.png` |
| Formato | PNG RGBA, `1536 × 1024`, cantos transparentes |
| Leitura mínima | 24 px |
| Estilo | Emblema 3D premium, metal e esmalte, silhueta frontal forte |

## Prompt comum

```text
Premium 3D illustrated football achievement badge, front-facing game icon,
strong clean silhouette, thick sculpted contours, polished enamel and metal,
centered emblem occupying about 78% of a wide 3:2 canvas, readable at 24 pixels.
Perfectly flat solid #ff00ff chroma-key background for removal, with no shadow,
gradient, texture, reflection or floor plane. No human figure, face or real-person
likeness; no club or federation crest, official uniform, sponsor, brand, flag,
official trophy, text, letters, numbers or watermark. Do not use #ff00ff in the badge.
```

## Conceitos finais

| Nível | Conceito | Símbolo e paleta |
| --- | --- | --- |
| 11 — Garrincha | Dança do drible | Bola entre zigue-zagues e penas de velocidade; platina, esmeralda e lima. |
| 12 — Zico | Maestro Galinho | Coroa heráldica de penas, bola e arcos de falta; platina, carmim, ouro e marinho. |
| 13 — Cruyff | Futebol total | Bola central e três órbitas táticas interligadas; platina, laranja queimado e grafite. |
| 14 — Beckham | Precisão cirúrgica | Trajetória curva, alvos concêntricos e canto do gol; platina, cobalto e rosé. |
| 15 — Ronaldinho | Joga bonito | Bola dourada envolta por fita de ritmo e brilhos; ouro, esmeralda, lima e turquesa. |
| 16 — Ronaldo Fenômeno | Explosão imparável | Bola-cometa rompendo muralha abstrata; ouro, azul elétrico e branco incandescente. |
| 17 — Messi | Labirinto genial | Bola luminosa atravessando pilares em caminho impossível; ouro, azul-noturno e gelo. |
| 18 — Cristiano Ronaldo | Ascensão e excelência | Bola de cristal subindo por três chevrons e halo; diamante, prata, ciano e azul. |
| 19 — Diego Maradona | Magia impossível | Bola levitando sobre chuteira esquerda com espiral gravitacional; violeta, ciano e prata. |
| 20 — Pelé | Coroa do futebol | Bola dourada, coroa abstrata, três estrelas e louros; ouro imperial, violeta e esmeralda. |

## Validação obrigatória

- dimensões `1536 × 1024`, modo RGBA e quatro cantos com alpha zero;
- inspeção em 24, 44, 52, 90, 140 e 160 px;
- fundos branco, escuro e verde da marca;
- estado bloqueado com escala de cinza e opacidade reduzida;
- nenhuma letra, número, marca ou logotipo acidental;
- web em Perfil, Rankings e Rumo ao Estrelato;
- Android sem fallback para o nível 10.
