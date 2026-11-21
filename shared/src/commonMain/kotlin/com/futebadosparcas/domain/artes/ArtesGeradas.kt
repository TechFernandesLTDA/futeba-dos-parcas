// GERADO por scripts/artes/gerar.mjs a partir de shared/artes e shared/design-tokens.json#arte.
// Não edite à mão: mude a fonte SVG ou os tokens e rode `node scripts/artes/gerar.mjs`.
@file:Suppress("MagicNumber", "MaxLineLength", "LongMethod", "LargeClass", "TooManyFunctions", "CyclomaticComplexMethod")

package com.futebadosparcas.domain.artes

/** Papéis de cor das artes (shared/design-tokens.json#arte). */
enum class PapelCor { FUNDO, GRAMA, GIZ, BRANCO, TINTA, CONTORNO, SUP, NEUTRO, VERDE, AZUL, LARANJA, OURO, PRATA, BRONZE, AMARELO, VIDRO, SOMBRA, BRILHO }

/** Artes da pelada disponíveis (uma por arquivo em shared/artes/fontes). */
enum class ArteId { APITO, BANCO_VAZIO, BOLA_NA_TRAVE, CAMPO, CHUTEIRAS, COLETES_VARAL, CONES, INGRESSOS, LUPA, MAPA_CAMPO, MEDALHA, PLACAR_ZERADO, PODIO, PRANCHETA_VAZIA, SORTEIO, VAQUINHA }

/** Pictogramas disponíveis (shared/artes/pictogramas). */
enum class PictogramaId { APITO, ARTILHARIA, BOLA, CAMPO, CHUTEIRA, COLETE, GOLEIRO, PLACAR, PRESENCA, QUADRA, SOCIETY, SORTEIO, SUMULA, VAQUINHA }

/** Animações curtas das artes; desligadas com "reduzir movimento". */
enum class AnimacaoArte { ROLAR, CAIR, PISCAR, QUICAR }

object ArtesDaPelada {
    /** Paleta clara, cores ARGB (0xAARRGGBB). */
    val paletaClara: Map<PapelCor, Long> = mapOf(
        PapelCor.FUNDO to 0x1400852A,
        PapelCor.GRAMA to 0xFF00852A,
        PapelCor.GIZ to 0xFFFFFFFF,
        PapelCor.BRANCO to 0xFFFFFFFF,
        PapelCor.TINTA to 0xFF0F172A,
        PapelCor.CONTORNO to 0x8C0F172A,
        PapelCor.SUP to 0xFFFFFFFF,
        PapelCor.NEUTRO to 0x0F0F172A,
        PapelCor.VERDE to 0xFF00852A,
        PapelCor.AZUL to 0xFF005FCC,
        PapelCor.LARANJA to 0xFFFF6D00,
        PapelCor.OURO to 0xFFFFD700,
        PapelCor.PRATA to 0xFFE0E0E0,
        PapelCor.BRONZE to 0xFFCD7F32,
        PapelCor.AMARELO to 0xFFFDD835,
        PapelCor.VIDRO to 0x1A005FCC,
        PapelCor.SOMBRA to 0x240F172A,
        PapelCor.BRILHO to 0x66FFFFFF
    )

    /** Paleta escura, cores ARGB (0xAARRGGBB). */
    val paletaEscura: Map<PapelCor, Long> = mapOf(
        PapelCor.FUNDO to 0x144ADE80,
        PapelCor.GRAMA to 0xFF2E7D32,
        PapelCor.GIZ to 0xFFFFFFFF,
        PapelCor.BRANCO to 0xFFFFFFFF,
        PapelCor.TINTA to 0xFF0F172A,
        PapelCor.CONTORNO to 0x8CFFFFFF,
        PapelCor.SUP to 0xFF1E293B,
        PapelCor.NEUTRO to 0x0FFFFFFF,
        PapelCor.VERDE to 0xFF4ADE80,
        PapelCor.AZUL to 0xFF5CC8FF,
        PapelCor.LARANJA to 0xFFFF9E40,
        PapelCor.OURO to 0xFFFFD700,
        PapelCor.PRATA to 0xFFE0E0E0,
        PapelCor.BRONZE to 0xFFE8924A,
        PapelCor.AMARELO to 0xFFFDD835,
        PapelCor.VIDRO to 0x1F5CC8FF,
        PapelCor.SOMBRA to 0x990F172A,
        PapelCor.BRILHO to 0x2EFFFFFF
    )

    fun arte(id: ArteId): Arte = when (id) {
        ArteId.APITO -> apito()
        ArteId.BANCO_VAZIO -> bancoVazio()
        ArteId.BOLA_NA_TRAVE -> bolaNaTrave()
        ArteId.CAMPO -> campo()
        ArteId.CHUTEIRAS -> chuteiras()
        ArteId.COLETES_VARAL -> coletesVaral()
        ArteId.CONES -> cones()
        ArteId.INGRESSOS -> ingressos()
        ArteId.LUPA -> lupa()
        ArteId.MAPA_CAMPO -> mapaCampo()
        ArteId.MEDALHA -> medalha()
        ArteId.PLACAR_ZERADO -> placarZerado()
        ArteId.PODIO -> podio()
        ArteId.PRANCHETA_VAZIA -> pranchetaVazia()
        ArteId.SORTEIO -> sorteio()
        ArteId.VAQUINHA -> vaquinha()
    }

    fun pictograma(id: PictogramaId): Pictograma = when (id) {
        PictogramaId.APITO -> Pictograma(id, listOf(TracoPictograma("M10 9h9.5a1.5 1.5 0 0 1 0 3H14.6"), TracoPictograma("M15 14A5 5 0 1 1 5 14A5 5 0 1 1 15 14Z"), TracoPictograma("M11.2 14A1.2 1.2 0 1 1 8.8 14A1.2 1.2 0 1 1 11.2 14Z"), TracoPictograma("M6 9.5L4 7.5")))
        PictogramaId.ARTILHARIA -> Pictograma(id, listOf(TracoPictograma("M3 19V6h18v13"), TracoPictograma("M3 10h18M7.5 6v13M12 6v4M16.5 6v13", 0.45f), TracoPictograma("M15.5 15A3.5 3.5 0 1 1 8.5 15A3.5 3.5 0 1 1 15.5 15Z"), TracoPictograma("M2 19h20")))
        PictogramaId.BOLA -> Pictograma(id, listOf(TracoPictograma("M21 12A9 9 0 1 1 3 12A9 9 0 1 1 21 12Z"), TracoPictograma("M12 8.8l3.04 2.21-1.16 3.58h-3.76l-1.16-3.58z"), TracoPictograma("M12 8.8V3M15.04 11.01l5.52-1.79M13.88 14.59l3.41 4.69M10.12 14.59l-3.41 4.69M8.96 11.01L3.44 9.22")))
        PictogramaId.CAMPO -> Pictograma(id, listOf(TracoPictograma("M5 5H19A2 2 0 0 1 21 7V17A2 2 0 0 1 19 19H5A2 2 0 0 1 3 17V7A2 2 0 0 1 5 5Z"), TracoPictograma("M12 5v14"), TracoPictograma("M14.5 12A2.5 2.5 0 1 1 9.5 12A2.5 2.5 0 1 1 14.5 12Z"), TracoPictograma("M3 9h3v6H3M21 9h-3v6h3")))
        PictogramaId.CHUTEIRA -> Pictograma(id, listOf(TracoPictograma("M3 16V9.5C3 8 4 7 5.5 7H9l2 3.5c5 0 8.5 1 9.5 2.5.6.9.5 2 .5 3z"), TracoPictograma("M3 16h18M6 16v2.2M10 16v2.2M15 16v2.2M19 16v2.2M10 10.5l1.4-1M11.4 12l1.4-1")))
        PictogramaId.COLETE -> Pictograma(id, listOf(TracoPictograma("M8 3h2a2 2 0 0 0 4 0h2l3 3-1.5 2.5V21h-11V8.5L5 6z"), TracoPictograma("M6.5 12h11")))
        PictogramaId.GOLEIRO -> Pictograma(id, listOf(TracoPictograma("M8.6 11V5a1.4 1.4 0 0 1 2.8 0v6M11.4 11V4a1.4 1.4 0 0 1 2.8 0v7M14.2 11V5a1.4 1.4 0 0 1 2.8 0v6"), TracoPictograma("M7.5 11H18v5a5 5 0 0 1-5 5h-.5a5 5 0 0 1-5-5zM7.5 14l-2.3-2.6a1.3 1.3 0 0 1 2-1.7l.3.3")))
        PictogramaId.PLACAR -> Pictograma(id, listOf(TracoPictograma("M5 5H19A2 2 0 0 1 21 7V15A2 2 0 0 1 19 17H5A2 2 0 0 1 3 15V7A2 2 0 0 1 5 5Z"), TracoPictograma("M7 8H9A1 1 0 0 1 10 9V13A1 1 0 0 1 9 14H7A1 1 0 0 1 6 13V9A1 1 0 0 1 7 8Z"), TracoPictograma("M15 8H17A1 1 0 0 1 18 9V13A1 1 0 0 1 17 14H15A1 1 0 0 1 14 13V9A1 1 0 0 1 15 8Z"), TracoPictograma("M12 9.5v.01M12 12.5v.01M8 17v3M16 17v3")))
        PictogramaId.PRESENCA -> Pictograma(id, listOf(TracoPictograma("M8 4L4 7l2 3.5 2-1V20h8V9.5l2 1 2-3.5-4-3a4 4 0 0 1-8 0z"), TracoPictograma("M9.5 14l2 2 3.5-4")))
        PictogramaId.QUADRA -> Pictograma(id, listOf(TracoPictograma("M4 5H20A1 1 0 0 1 21 6V18A1 1 0 0 1 20 19H4A1 1 0 0 1 3 18V6A1 1 0 0 1 4 5Z"), TracoPictograma("M12 5v14M3 8.5a3.5 3.5 0 0 1 0 7M21 8.5a3.5 3.5 0 0 0 0 7"), TracoPictograma("M14.5 12A2.5 2.5 0 1 1 9.5 12A2.5 2.5 0 1 1 14.5 12Z")))
        PictogramaId.SOCIETY -> Pictograma(id, listOf(TracoPictograma("M5.5 8H18.5A1.5 1.5 0 0 1 20 9.5V18.5A1.5 1.5 0 0 1 18.5 20H5.5A1.5 1.5 0 0 1 4 18.5V9.5A1.5 1.5 0 0 1 5.5 8Z"), TracoPictograma("M12 8v12M4 4h16M6 4v4M10 4v4M14 4v4M18 4v4"), TracoPictograma("M14 14A2 2 0 1 1 10 14A2 2 0 1 1 14 14Z")))
        PictogramaId.SORTEIO -> Pictograma(id, listOf(TracoPictograma("M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3")))
        PictogramaId.SUMULA -> Pictograma(id, listOf(TracoPictograma("M7 4H17A2 2 0 0 1 19 6V19A2 2 0 0 1 17 21H7A2 2 0 0 1 5 19V6A2 2 0 0 1 7 4Z"), TracoPictograma("M10 2.5H14A1 1 0 0 1 15 3.5V4.5A1 1 0 0 1 14 5.5H10A1 1 0 0 1 9 4.5V3.5A1 1 0 0 1 10 2.5Z"), TracoPictograma("M8.5 10h7M8.5 13.5h7M8.5 17h4")))
        PictogramaId.VAQUINHA -> Pictograma(id, listOf(TracoPictograma("M5 9a7 3 0 1 0 14 0a7 3 0 1 0-14 0M5 9v4a7 3 0 0 0 14 0V9M5 13v4a7 3 0 0 0 14 0v-4")))
    }

    fun animacao(animacao: AnimacaoArte): EspecAnimacao = when (animacao) {
        AnimacaoArte.ROLAR -> EspecAnimacao(2400, true, CurvaTempo(0.42f, 0f, 0.58f, 1f), listOf(QuadroAnimacao(0f, EstadoAnimacao()), QuadroAnimacao(1f, EstadoAnimacao(dx = -38f, graus = -240f))))
        AnimacaoArte.CAIR -> EspecAnimacao(1600, false, CurvaTempo(0.42f, 0f, 1f, 1f), listOf(QuadroAnimacao(0f, EstadoAnimacao(dy = -14f, alfa = 0f)), QuadroAnimacao(0.6f, EstadoAnimacao(dy = 0.4f, alfa = 1f)), QuadroAnimacao(1f, EstadoAnimacao(dy = 10f, alfa = 0f))))
        AnimacaoArte.PISCAR -> EspecAnimacao(1800, false, CurvaTempo(0.42f, 0f, 0.58f, 1f), listOf(QuadroAnimacao(0f, EstadoAnimacao(escala = 0.7f, alfa = 0.25f)), QuadroAnimacao(0.5f, EstadoAnimacao()), QuadroAnimacao(1f, EstadoAnimacao(escala = 0.7f, alfa = 0.25f))))
        AnimacaoArte.QUICAR -> EspecAnimacao(1200, false, CurvaTempo(0.42f, 0f, 0.58f, 1f), listOf(QuadroAnimacao(0f, EstadoAnimacao()), QuadroAnimacao(0.5f, EstadoAnimacao(dx = 6f, dy = -8f)), QuadroAnimacao(1f, EstadoAnimacao())))
    }

    private fun apito() = Arte(
        ArteId.APITO, 200f, 160f,
        listOf(
            CaminhoArte("M164 86A64 64 0 1 1 36 86A64 64 0 1 1 164 86Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M152 132A50 5 0 1 1 52 132A50 5 0 1 1 152 132Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M62 74C40 44 84 22 100 48", traco = PapelCor.LARANJA, larguraTraco = 3f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M100 48C108 62 90 70 76 60", traco = PapelCor.LARANJA, larguraTraco = 3f, ponta = PontaTraco.REDONDA, opacidade = 0.8f),
            CaminhoArte("M72 78A6 6 0 1 1 60 78A6 6 0 1 1 72 78Z", traco = PapelCor.CONTORNO, larguraTraco = 2f),
            CaminhoArte("M88 72H146A9 9 0 0 1 146 90H111.2A24 24 0 1 1 88 72Z", preenchimento = PapelCor.PRATA, traco = PapelCor.CONTORNO, larguraTraco = 2f),
            CaminhoArte("M68 108A24 24 0 0 0 108 112", traco = PapelCor.SOMBRA, larguraTraco = 5f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M97 96A9 9 0 1 1 79 96A9 9 0 1 1 97 96Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M127.5 74H134.5A1.5 1.5 0 0 1 136 75.5V77.5A1.5 1.5 0 0 1 134.5 79H127.5A1.5 1.5 0 0 1 126 77.5V75.5A1.5 1.5 0 0 1 127.5 74Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M70 88A20 20 0 0 1 80 78", traco = PapelCor.BRANCO, larguraTraco = 3f, ponta = PontaTraco.REDONDA, opacidade = 0.7f),
            CaminhoArte("M164 68Q171 81 164 94", traco = PapelCor.CONTORNO, larguraTraco = 2f, ponta = PontaTraco.REDONDA, tracejado = listOf(3f, 4f)),
            CaminhoArte("M174 60Q185 81 174 102", traco = PapelCor.CONTORNO, larguraTraco = 2f, ponta = PontaTraco.REDONDA, tracejado = listOf(3f, 4f), opacidade = 0.6f)
        )
    )

    private fun bancoVazio() = Arte(
        ArteId.BANCO_VAZIO, 220f, 160f,
        listOf(
            CaminhoArte("M176 88A66 66 0 1 1 44 88A66 66 0 1 1 176 88Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M196 142A86 5 0 1 1 24 142A86 5 0 1 1 196 142Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M28 42H29A2 2 0 0 1 31 44V138A2 2 0 0 1 29 140H28A2 2 0 0 1 26 138V44A2 2 0 0 1 28 42Z", preenchimento = PapelCor.PRATA, traco = PapelCor.CONTORNO),
            CaminhoArte("M191 42H192A2 2 0 0 1 194 44V138A2 2 0 0 1 192 140H191A2 2 0 0 1 189 138V44A2 2 0 0 1 191 42Z", preenchimento = PapelCor.PRATA, traco = PapelCor.CONTORNO),
            CaminhoArte("M18 40Q110 18 202 40V48Q110 28 18 48Z", preenchimento = PapelCor.VIDRO, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M28 40Q110 22 192 40", traco = PapelCor.BRANCO, larguraTraco = 2f, opacidade = 0.5f),
            CaminhoArte("M38 66H182A4 4 0 0 1 186 70V72A4 4 0 0 1 182 76H38A4 4 0 0 1 34 72V70A4 4 0 0 1 38 66Z", preenchimento = PapelCor.BRONZE),
            CaminhoArte("M46 76H52V94H46Z", preenchimento = PapelCor.BRONZE),
            CaminhoArte("M168 76H174V94H168Z", preenchimento = PapelCor.BRONZE),
            CaminhoArte("M46 76H52V94H46Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M168 76H174V94H168Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M38 92H182A4 4 0 0 1 186 96V100A4 4 0 0 1 182 104H38A4 4 0 0 1 34 100V96A4 4 0 0 1 38 92Z", preenchimento = PapelCor.BRONZE),
            CaminhoArte("M36 100H184A2 2 0 0 1 186 102V102A2 2 0 0 1 184 104H36A2 2 0 0 1 34 102V102A2 2 0 0 1 36 100Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M46 104H50A2 2 0 0 1 52 106V138A2 2 0 0 1 50 140H46A2 2 0 0 1 44 138V106A2 2 0 0 1 46 104Z", preenchimento = PapelCor.CONTORNO),
            CaminhoArte("M170 104H174A2 2 0 0 1 176 106V138A2 2 0 0 1 174 140H170A2 2 0 0 1 168 138V106A2 2 0 0 1 170 104Z", preenchimento = PapelCor.CONTORNO),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-24 0H-11A11 9 0 0 0 11 0H24L27 16L21 20V60Q0 66 -21 60V20L-27 16Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M-21 20V60Q-17 61.3 -13 62V20Z", preenchimento = PapelCor.BRILHO),
                    CaminhoArte("M8 4H24L27 16L21 20V60Q12 62.6 8 63Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.55f),
                    CaminhoArte("M-21 30H21V36H-21Z", preenchimento = PapelCor.GIZ, opacidade = 0.55f),
                    CaminhoArte("M-10.6 45A1.4 1.4 0 1 1 -13.4 45A1.4 1.4 0 1 1 -10.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-2.6 45A1.4 1.4 0 1 1 -5.4 45A1.4 1.4 0 1 1 -2.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M5.4 45A1.4 1.4 0 1 1 2.6 45A1.4 1.4 0 1 1 5.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M13.4 45A1.4 1.4 0 1 1 10.6 45A1.4 1.4 0 1 1 13.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-6.6 51A1.4 1.4 0 1 1 -9.4 51A1.4 1.4 0 1 1 -6.6 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M1.4 51A1.4 1.4 0 1 1 -1.4 51A1.4 1.4 0 1 1 1.4 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M9.4 51A1.4 1.4 0 1 1 6.6 51A1.4 1.4 0 1 1 9.4 51Z", preenchimento = PapelCor.SOMBRA)
                ),
                matriz = MatrizArte(0.55f, 0f, 0f, 0.55f, 84f, 62f)
            ),
            CaminhoArte("M146 70H152A4 4 0 0 1 156 74V88A4 4 0 0 1 152 92H146A4 4 0 0 1 142 88V74A4 4 0 0 1 146 70Z", preenchimento = PapelCor.AZUL),
            CaminhoArte("M147 64H151A2 2 0 0 1 153 66V69A2 2 0 0 1 151 71H147A2 2 0 0 1 145 69V66A2 2 0 0 1 147 64Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO),
            CaminhoArte("M142 78H156V83H142Z", preenchimento = PapelCor.BRANCO, opacidade = 0.5f),
            CaminhoArte("M145.5 72H145.5A1.5 1.5 0 0 1 147 73.5V88.5A1.5 1.5 0 0 1 145.5 90H145.5A1.5 1.5 0 0 1 144 88.5V73.5A1.5 1.5 0 0 1 145.5 72Z", preenchimento = PapelCor.BRILHO)
        )
    )

    private fun bolaNaTrave() = Arte(
        ArteId.BOLA_NA_TRAVE, 220f, 160f,
        listOf(
            CaminhoArte("M168 88A64 64 0 1 1 40 88A64 64 0 1 1 168 88Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M17 138H203A5 5 0 0 1 208 143V143A5 5 0 0 1 203 148H17A5 5 0 0 1 12 143V143A5 5 0 0 1 17 138Z", preenchimento = PapelCor.GRAMA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M60 44V138M76 44V138M92 44V138M108 44V138M124 44V138M140 44V138", traco = PapelCor.CONTORNO),
                    CaminhoArte("M44 60H146M44 76H146M44 92H146M44 108H146M44 124H146", traco = PapelCor.CONTORNO)
                ),
                opacidade = 0.35f
            ),
            CaminhoArte("M38 36H42A2 2 0 0 1 44 38V136A2 2 0 0 1 42 138H38A2 2 0 0 1 36 136V38A2 2 0 0 1 38 36Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M148 36H152A2 2 0 0 1 154 38V136A2 2 0 0 1 152 138H148A2 2 0 0 1 146 136V38A2 2 0 0 1 148 36Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M38 34H152A2 2 0 0 1 154 36V41A2 2 0 0 1 152 43H38A2 2 0 0 1 36 41V36A2 2 0 0 1 38 34Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.AMARELO)
                ),
                matriz = MatrizArte(1.7f, 0f, 0f, 1.7f, 156f, 94f)
            ),
            CaminhoArte("M164 104L172 108M162 112L167 119", traco = PapelCor.LARANJA, larguraTraco = 2.5f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M160 88Q170 74 176 70", traco = PapelCor.CONTORNO, larguraTraco = 2f, ponta = PontaTraco.REDONDA, tracejado = listOf(2f, 5f)),
            CaminhoArte("M196 142A10 2.6 0 1 1 176 142A10 2.6 0 1 1 196 142Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                    CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                    CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                ),
                matriz = MatrizArte(1.359f, 0.634f, -0.634f, 1.359f, 188f, 62f),
                animacao = AnimacaoArte.QUICAR
            )
        )
    )

    private fun campo() = Arte(
        ArteId.CAMPO, 360f, 170f,
        listOf(
            CaminhoArte("M330 156A150 9 0 1 1 30 156A150 9 0 1 1 330 156Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.6f),
            CaminhoArte("M80 40H280L320 150H40Z", preenchimento = PapelCor.GRAMA),
            CaminhoArte("M73.45 58H286.55L293.82 78H66.18ZM58.18 100H301.82L310.55 124H49.45Z", preenchimento = PapelCor.BRANCO, opacidade = 0.09f),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M86 48H274L308 142H52Z", traco = PapelCor.GIZ, larguraTraco = 2.2f, juncao = JuncaoTraco.REDONDA),
                    CaminhoArte("M70.8 90H289.2", traco = PapelCor.GIZ, larguraTraco = 2.2f, juncao = JuncaoTraco.REDONDA),
                    CaminhoArte("M214 90A34 11 0 1 1 146 90A34 11 0 1 1 214 90Z", traco = PapelCor.GIZ, larguraTraco = 2.2f, juncao = JuncaoTraco.REDONDA),
                    CaminhoArte("M146 48L144 60H216L214 48", traco = PapelCor.GIZ, larguraTraco = 2.2f, juncao = JuncaoTraco.REDONDA),
                    CaminhoArte("M128 142L131 126H229L232 142", traco = PapelCor.GIZ, larguraTraco = 2.2f, juncao = JuncaoTraco.REDONDA)
                ),
                opacidade = 0.92f
            ),
            CaminhoArte("M182.4 90A2.4 2.4 0 1 1 177.6 90A2.4 2.4 0 1 1 182.4 90Z", preenchimento = PapelCor.GIZ),
            CaminhoArte("M168 48V40H192V48", traco = PapelCor.GIZ, larguraTraco = 2.4f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M172 41V47M176 41V47M180 41V47M184 41V47M188 41V47", traco = PapelCor.GIZ, ponta = PontaTraco.REDONDA, opacidade = 0.55f),
            CaminhoArte("M158 160V142M202 160V142M158 146H202", traco = PapelCor.GIZ, larguraTraco = 3.2f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M163 147V159M168 147V159M173 147V159M178 147V159M183 147V159M188 147V159M193 147V159M198 147V159", traco = PapelCor.GIZ, ponta = PontaTraco.REDONDA, opacidade = 0.5f),
            CaminhoArte("M52 142V122M308 142V122M86 48V36M274 48V36", traco = PapelCor.CONTORNO, larguraTraco = 1.6f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M52 122L64 126L52 130Z", preenchimento = PapelCor.LARANJA),
            CaminhoArte("M308 122L320 126L308 130Z", preenchimento = PapelCor.LARANJA),
            CaminhoArte("M86 36L94 38.5L86 41Z", preenchimento = PapelCor.LARANJA),
            CaminhoArte("M274 36L282 38.5L274 41Z", preenchimento = PapelCor.LARANJA),
            CaminhoArte("M223 121A9 2.6 0 1 1 205 121A9 2.6 0 1 1 223 121Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                    CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                    CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 214f, 111f),
                animacao = AnimacaoArte.ROLAR
            )
        )
    )

    private fun chuteiras() = Arte(
        ArteId.CHUTEIRAS, 220f, 160f,
        listOf(
            CaminhoArte("M176 86A66 66 0 1 1 44 86A66 66 0 1 1 176 86Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M176 140A72 5 0 1 1 32 140A72 5 0 1 1 176 140Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M4 0V-26Q4 -38 16 -38H30Q36 -38 38 -32L42 -24Q64 -24 76 -16Q84 -10 82 0Z", preenchimento = PapelCor.VERDE),
                    CaminhoArte("M4 -26Q4 -38 16 -38H20Q10 -36 10 -24V0H4Z", preenchimento = PapelCor.BRILHO),
                    CaminhoArte("M14 -14Q32 -8 56 -13", traco = PapelCor.GIZ, larguraTraco = 3f, ponta = PontaTraco.REDONDA, opacidade = 0.85f),
                    CaminhoArte("M29 -30L37 -33M32 -24L40 -27", traco = PapelCor.GIZ, larguraTraco = 2f, ponta = PontaTraco.REDONDA),
                    CaminhoArte("M3 -31H5A2 2 0 0 1 7 -29V-21A2 2 0 0 1 5 -19H3A2 2 0 0 1 1 -21V-29A2 2 0 0 1 3 -31Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M3 -4H82A3 3 0 0 1 85 -1V-1A3 3 0 0 1 82 2H3A3 3 0 0 1 0 -1V-1A3 3 0 0 1 3 -4Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.CONTORNO, larguraTraco = 1.2f),
                    CaminhoArte("M11.5 2H14.5A1.5 1.5 0 0 1 16 3.5V5.5A1.5 1.5 0 0 1 14.5 7H11.5A1.5 1.5 0 0 1 10 5.5V3.5A1.5 1.5 0 0 1 11.5 2Z", preenchimento = PapelCor.CONTORNO),
                    CaminhoArte("M25.5 2H28.5A1.5 1.5 0 0 1 30 3.5V5.5A1.5 1.5 0 0 1 28.5 7H25.5A1.5 1.5 0 0 1 24 5.5V3.5A1.5 1.5 0 0 1 25.5 2Z", preenchimento = PapelCor.CONTORNO),
                    CaminhoArte("M53.5 2H56.5A1.5 1.5 0 0 1 58 3.5V5.5A1.5 1.5 0 0 1 56.5 7H53.5A1.5 1.5 0 0 1 52 5.5V3.5A1.5 1.5 0 0 1 53.5 2Z", preenchimento = PapelCor.CONTORNO),
                    CaminhoArte("M71.5 2H74.5A1.5 1.5 0 0 1 76 3.5V5.5A1.5 1.5 0 0 1 74.5 7H71.5A1.5 1.5 0 0 1 70 5.5V3.5A1.5 1.5 0 0 1 71.5 2Z", preenchimento = PapelCor.CONTORNO)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 40f, 118f)
            ),
            CaminhoArte("M44 118V92Q44 80 56 80H70Q76 80 78 86L82 94Q104 94 116 102Q124 108 122 118Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.5f),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M4 0V-26Q4 -38 16 -38H30Q36 -38 38 -32L42 -24Q64 -24 76 -16Q84 -10 82 0Z", preenchimento = PapelCor.VERDE),
                    CaminhoArte("M4 -26Q4 -38 16 -38H20Q10 -36 10 -24V0H4Z", preenchimento = PapelCor.BRILHO),
                    CaminhoArte("M14 -14Q32 -8 56 -13", traco = PapelCor.GIZ, larguraTraco = 3f, ponta = PontaTraco.REDONDA, opacidade = 0.85f),
                    CaminhoArte("M29 -30L37 -33M32 -24L40 -27", traco = PapelCor.GIZ, larguraTraco = 2f, ponta = PontaTraco.REDONDA),
                    CaminhoArte("M3 -31H5A2 2 0 0 1 7 -29V-21A2 2 0 0 1 5 -19H3A2 2 0 0 1 1 -21V-29A2 2 0 0 1 3 -31Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M3 -4H82A3 3 0 0 1 85 -1V-1A3 3 0 0 1 82 2H3A3 3 0 0 1 0 -1V-1A3 3 0 0 1 3 -4Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.CONTORNO, larguraTraco = 1.2f),
                    CaminhoArte("M11.5 2H14.5A1.5 1.5 0 0 1 16 3.5V5.5A1.5 1.5 0 0 1 14.5 7H11.5A1.5 1.5 0 0 1 10 5.5V3.5A1.5 1.5 0 0 1 11.5 2Z", preenchimento = PapelCor.CONTORNO),
                    CaminhoArte("M25.5 2H28.5A1.5 1.5 0 0 1 30 3.5V5.5A1.5 1.5 0 0 1 28.5 7H25.5A1.5 1.5 0 0 1 24 5.5V3.5A1.5 1.5 0 0 1 25.5 2Z", preenchimento = PapelCor.CONTORNO),
                    CaminhoArte("M53.5 2H56.5A1.5 1.5 0 0 1 58 3.5V5.5A1.5 1.5 0 0 1 56.5 7H53.5A1.5 1.5 0 0 1 52 5.5V3.5A1.5 1.5 0 0 1 53.5 2Z", preenchimento = PapelCor.CONTORNO),
                    CaminhoArte("M71.5 2H74.5A1.5 1.5 0 0 1 76 3.5V5.5A1.5 1.5 0 0 1 74.5 7H71.5A1.5 1.5 0 0 1 70 5.5V3.5A1.5 1.5 0 0 1 71.5 2Z", preenchimento = PapelCor.CONTORNO)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 62f, 132f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M19 0A19 19 0 1 1 -19 0A19 19 0 1 1 19 0Z", preenchimento = PapelCor.GRAMA),
                    CaminhoArte("M-9 0L-3 6L10 -7", traco = PapelCor.GIZ, larguraTraco = 4f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 170f, 50f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.7f, 0f, 0f, 0.7f, 140f, 30f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.6f, 0f, 0f, 0.6f, 198f, 78f)
            )
        )
    )

    private fun coletesVaral() = Arte(
        ArteId.COLETES_VARAL, 220f, 160f,
        listOf(
            CaminhoArte("M176 88A66 66 0 1 1 44 88A66 66 0 1 1 176 88Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M14 34Q110 54 206 34", traco = PapelCor.CONTORNO, larguraTraco = 2f),
            CaminhoArte("M17 34A3 3 0 1 1 11 34A3 3 0 1 1 17 34Z", preenchimento = PapelCor.CONTORNO),
            CaminhoArte("M209 34A3 3 0 1 1 203 34A3 3 0 1 1 209 34Z", preenchimento = PapelCor.CONTORNO),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-24 0H-11A11 9 0 0 0 11 0H24L27 16L21 20V60Q0 66 -21 60V20L-27 16Z", preenchimento = PapelCor.VERDE),
                    CaminhoArte("M-21 20V60Q-17 61.3 -13 62V20Z", preenchimento = PapelCor.BRILHO),
                    CaminhoArte("M8 4H24L27 16L21 20V60Q12 62.6 8 63Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.55f),
                    CaminhoArte("M-21 30H21V36H-21Z", preenchimento = PapelCor.GIZ, opacidade = 0.55f),
                    CaminhoArte("M-10.6 45A1.4 1.4 0 1 1 -13.4 45A1.4 1.4 0 1 1 -10.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-2.6 45A1.4 1.4 0 1 1 -5.4 45A1.4 1.4 0 1 1 -2.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M5.4 45A1.4 1.4 0 1 1 2.6 45A1.4 1.4 0 1 1 5.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M13.4 45A1.4 1.4 0 1 1 10.6 45A1.4 1.4 0 1 1 13.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-6.6 51A1.4 1.4 0 1 1 -9.4 51A1.4 1.4 0 1 1 -6.6 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M1.4 51A1.4 1.4 0 1 1 -1.4 51A1.4 1.4 0 1 1 1.4 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M9.4 51A1.4 1.4 0 1 1 6.6 51A1.4 1.4 0 1 1 9.4 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-13.5 -6H-11.5A1.5 1.5 0 0 1 -10 -4.5V4.5A1.5 1.5 0 0 1 -11.5 6H-13.5A1.5 1.5 0 0 1 -15 4.5V-4.5A1.5 1.5 0 0 1 -13.5 -6Z", preenchimento = PapelCor.BRONZE),
                    CaminhoArte("M11.5 -6H13.5A1.5 1.5 0 0 1 15 -4.5V4.5A1.5 1.5 0 0 1 13.5 6H11.5A1.5 1.5 0 0 1 10 4.5V-4.5A1.5 1.5 0 0 1 11.5 -6Z", preenchimento = PapelCor.BRONZE)
                ),
                matriz = MatrizArte(0.996f, -0.087f, 0.087f, 0.996f, 62f, 41.5f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-24 0H-11A11 9 0 0 0 11 0H24L27 16L21 20V60Q0 66 -21 60V20L-27 16Z", preenchimento = PapelCor.AZUL),
                    CaminhoArte("M-21 20V60Q-17 61.3 -13 62V20Z", preenchimento = PapelCor.BRILHO),
                    CaminhoArte("M8 4H24L27 16L21 20V60Q12 62.6 8 63Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.55f),
                    CaminhoArte("M-21 30H21V36H-21Z", preenchimento = PapelCor.GIZ, opacidade = 0.55f),
                    CaminhoArte("M-10.6 45A1.4 1.4 0 1 1 -13.4 45A1.4 1.4 0 1 1 -10.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-2.6 45A1.4 1.4 0 1 1 -5.4 45A1.4 1.4 0 1 1 -2.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M5.4 45A1.4 1.4 0 1 1 2.6 45A1.4 1.4 0 1 1 5.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M13.4 45A1.4 1.4 0 1 1 10.6 45A1.4 1.4 0 1 1 13.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-6.6 51A1.4 1.4 0 1 1 -9.4 51A1.4 1.4 0 1 1 -6.6 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M1.4 51A1.4 1.4 0 1 1 -1.4 51A1.4 1.4 0 1 1 1.4 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M9.4 51A1.4 1.4 0 1 1 6.6 51A1.4 1.4 0 1 1 9.4 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-13.5 -6H-11.5A1.5 1.5 0 0 1 -10 -4.5V4.5A1.5 1.5 0 0 1 -11.5 6H-13.5A1.5 1.5 0 0 1 -15 4.5V-4.5A1.5 1.5 0 0 1 -13.5 -6Z", preenchimento = PapelCor.BRONZE),
                    CaminhoArte("M11.5 -6H13.5A1.5 1.5 0 0 1 15 -4.5V4.5A1.5 1.5 0 0 1 13.5 6H11.5A1.5 1.5 0 0 1 10 4.5V-4.5A1.5 1.5 0 0 1 11.5 -6Z", preenchimento = PapelCor.BRONZE)
                ),
                matriz = MatrizArte(0.999f, 0.035f, -0.035f, 0.999f, 110f, 44f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-24 0H-11A11 9 0 0 0 11 0H24L27 16L21 20V60Q0 66 -21 60V20L-27 16Z", traco = PapelCor.CONTORNO, larguraTraco = 2f, tracejado = listOf(4f, 4f)),
                    CaminhoArte("M0 26V44M-9 35H9", traco = PapelCor.LARANJA, larguraTraco = 3f, ponta = PontaTraco.REDONDA)
                ),
                matriz = MatrizArte(0.996f, 0.087f, -0.087f, 0.996f, 158f, 41.5f)
            )
        )
    )

    private fun cones() = Arte(
        ArteId.CONES, 220f, 160f,
        listOf(
            CaminhoArte("M176 84A66 66 0 1 1 44 84A66 66 0 1 1 176 84Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M22 126H198A6 6 0 0 1 204 132V132A6 6 0 0 1 198 138H22A6 6 0 0 1 16 132V132A6 6 0 0 1 22 126Z", preenchimento = PapelCor.GRAMA),
            CaminhoArte("M34 112Q54 92 74 108T116 104T156 108", traco = PapelCor.CONTORNO, larguraTraco = 2f, ponta = PontaTraco.REDONDA, tracejado = listOf(3f, 5f)),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-3 -38Q0 -42 3 -38L14 0H-14Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M-6.3 -22H6.3L9.1 -14H-9.1Z", preenchimento = PapelCor.BRANCO, opacidade = 0.85f),
                    CaminhoArte("M0 -40L3 -38L14 0H0Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.6f),
                    CaminhoArte("M-16 -2H16A2 2 0 0 1 18 0V2A2 2 0 0 1 16 4H-16A2 2 0 0 1 -18 2V0A2 2 0 0 1 -16 -2Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M2 -2H16A2 2 0 0 1 18 0V2A2 2 0 0 1 16 4H2A2 2 0 0 1 0 2V0A2 2 0 0 1 2 -2Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.6f)
                ),
                matriz = MatrizArte(1.25f, 0f, 0f, 1.25f, 66f, 126f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-3 -38Q0 -42 3 -38L14 0H-14Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M-6.3 -22H6.3L9.1 -14H-9.1Z", preenchimento = PapelCor.BRANCO, opacidade = 0.85f),
                    CaminhoArte("M0 -40L3 -38L14 0H0Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.6f),
                    CaminhoArte("M-16 -2H16A2 2 0 0 1 18 0V2A2 2 0 0 1 16 4H-16A2 2 0 0 1 -18 2V0A2 2 0 0 1 -16 -2Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M2 -2H16A2 2 0 0 1 18 0V2A2 2 0 0 1 16 4H2A2 2 0 0 1 0 2V0A2 2 0 0 1 2 -2Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.6f)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 116f, 126f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-3 -38Q0 -42 3 -38L14 0H-14Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M-6.3 -22H6.3L9.1 -14H-9.1Z", preenchimento = PapelCor.BRANCO, opacidade = 0.85f),
                    CaminhoArte("M0 -40L3 -38L14 0H0Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.6f),
                    CaminhoArte("M-16 -2H16A2 2 0 0 1 18 0V2A2 2 0 0 1 16 4H-16A2 2 0 0 1 -18 2V0A2 2 0 0 1 -16 -2Z", preenchimento = PapelCor.LARANJA),
                    CaminhoArte("M2 -2H16A2 2 0 0 1 18 0V2A2 2 0 0 1 16 4H2A2 2 0 0 1 0 2V0A2 2 0 0 1 2 -2Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.6f)
                ),
                matriz = MatrizArte(0.8f, 0f, 0f, 0.8f, 156f, 126f)
            ),
            CaminhoArte("M200 127A10 2.6 0 1 1 180 127A10 2.6 0 1 1 200 127Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                    CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                    CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                ),
                matriz = MatrizArte(1.25f, 0f, 0f, 1.25f, 190f, 114f),
                animacao = AnimacaoArte.QUICAR
            )
        )
    )

    private fun ingressos() = Arte(
        ArteId.INGRESSOS, 220f, 160f,
        listOf(
            CaminhoArte("M174 86A64 64 0 1 1 46 86A64 64 0 1 1 174 86Z", preenchimento = PapelCor.FUNDO),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-70 -36H70V-10A10 10 0 0 0 70 10V36H-70V10A10 10 0 0 0 -70 -10Z", preenchimento = PapelCor.AZUL)
                ),
                matriz = MatrizArte(0.99f, 0.139f, -0.139f, 0.99f, 122f, 76f)
            ),
            CaminhoArte("M174 140A70 5 0 1 1 34 140A70 5 0 1 1 174 140Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-70 -36H70V-10A10 10 0 0 0 70 10V36H-70V10A10 10 0 0 0 -70 -10Z", preenchimento = PapelCor.VERDE),
                    CaminhoArte("M-70 -36H70V-26H-70Z", preenchimento = PapelCor.BRANCO, opacidade = 0.14f),
                    CaminhoArte("M34 -30V30", traco = PapelCor.GIZ, larguraTraco = 1.6f, tracejado = listOf(3f, 4f), opacidade = 0.8f),
                    CaminhoArte("M-25 0A17 17 0 1 1 -59 0A17 17 0 1 1 -25 0Z", preenchimento = PapelCor.BRANCO, opacidade = 0.18f),
                    GrupoArte(
                        filhos = listOf(
                            CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                            CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                            CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                        ),
                        matriz = MatrizArte(1.35f, 0f, 0f, 1.35f, -42f, 0f)
                    ),
                    CaminhoArte("M-14.5 -15H20.5A3.5 3.5 0 0 1 24 -11.5V-11.5A3.5 3.5 0 0 1 20.5 -8H-14.5A3.5 3.5 0 0 1 -18 -11.5V-11.5A3.5 3.5 0 0 1 -14.5 -15Z", preenchimento = PapelCor.GIZ),
                    CaminhoArte("M-15.5 -2H9.5A2.5 2.5 0 0 1 12 0.5V0.5A2.5 2.5 0 0 1 9.5 3H-15.5A2.5 2.5 0 0 1 -18 0.5V0.5A2.5 2.5 0 0 1 -15.5 -2Z", preenchimento = PapelCor.GIZ, opacidade = 0.7f),
                    CaminhoArte("M-15.5 8H15.5A2.5 2.5 0 0 1 18 10.5V10.5A2.5 2.5 0 0 1 15.5 13H-15.5A2.5 2.5 0 0 1 -18 10.5V10.5A2.5 2.5 0 0 1 -15.5 8Z", preenchimento = PapelCor.GIZ, opacidade = 0.7f),
                    GrupoArte(
                        filhos = listOf(
                            CaminhoArte("M46 -14H60A2 2 0 0 1 62 -12V12A2 2 0 0 1 60 14H46A2 2 0 0 1 44 12V-12A2 2 0 0 1 46 -14Z", traco = PapelCor.GIZ, larguraTraco = 1.6f),
                            CaminhoArte("M44 0H62", traco = PapelCor.GIZ, larguraTraco = 1.6f),
                            CaminhoArte("M56 0A3 3 0 1 1 50 0A3 3 0 1 1 56 0Z", traco = PapelCor.GIZ, larguraTraco = 1.6f)
                        ),
                        opacidade = 0.9f
                    )
                ),
                matriz = MatrizArte(0.995f, -0.105f, 0.105f, 0.995f, 100f, 88f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.8f, 0f, 0f, 0.8f, 30f, 40f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.7f, 0f, 0f, 0.7f, 196f, 132f),
                animacao = AnimacaoArte.PISCAR
            )
        )
    )

    private fun lupa() = Arte(
        ArteId.LUPA, 200f, 160f,
        listOf(
            CaminhoArte("M164 84A64 64 0 1 1 36 84A64 64 0 1 1 164 84Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M172 130A72 13 0 1 1 28 130A72 13 0 1 1 172 130Z", preenchimento = PapelCor.GRAMA),
            CaminhoArte("M48 128L51 120L54 128M70 136L73 128L76 136M124 136L127 128L130 136M146 126L149 118L152 126M96 140L99 132L102 140", traco = PapelCor.BRANCO, larguraTraco = 2f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA, opacidade = 0.4f),
            CaminhoArte("M118 104L146 132", traco = PapelCor.LARANJA, larguraTraco = 13f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M121 103L145 127", traco = PapelCor.BRILHO, larguraTraco = 3f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M112 98L120 106", traco = PapelCor.PRATA, larguraTraco = 11f),
            CaminhoArte("M124 76A34 34 0 1 1 56 76A34 34 0 1 1 124 76Z", preenchimento = PapelCor.VIDRO),
            CaminhoArte("M124 76A34 34 0 1 1 56 76A34 34 0 1 1 124 76Z", traco = PapelCor.PRATA, larguraTraco = 8f),
            CaminhoArte("M128 76A38 38 0 1 1 52 76A38 38 0 1 1 128 76Z", traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M120 76A30 30 0 1 1 60 76A30 30 0 1 1 120 76Z", traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M101 80A11 11 0 1 1 79 80A11 11 0 1 1 101 80Z", traco = PapelCor.CONTORNO, larguraTraco = 2f, tracejado = listOf(3f, 3f)),
            CaminhoArte("M68 62A26 26 0 0 1 82 50", traco = PapelCor.BRANCO, larguraTraco = 4f, ponta = PontaTraco.REDONDA, opacidade = 0.6f)
        )
    )

    private fun mapaCampo() = Arte(
        ArteId.MAPA_CAMPO, 220f, 160f,
        listOf(
            CaminhoArte("M176 86A66 66 0 1 1 44 86A66 66 0 1 1 176 86Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M186 146A76 5 0 1 1 34 146A76 5 0 1 1 186 146Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M40 40L86 30V130L40 140Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M86 30L134 40V140L86 130Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M134 40L180 30V130L134 140Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M86 30L134 40V140L86 130Z", preenchimento = PapelCor.NEUTRO),
            CaminhoArte("M86 30L134 40V140L86 130Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.35f),
            CaminhoArte("M44 62L82 54M44 84L82 78M90 70L130 78M138 66L176 58", traco = PapelCor.CONTORNO, opacidade = 0.35f),
            CaminhoArte("M54 122Q70 96 98 108T144 102Q150 100 152 96", traco = PapelCor.LARANJA, larguraTraco = 2.5f, ponta = PontaTraco.REDONDA, tracejado = listOf(4f, 4f)),
            CaminhoArte("M58 122A4 4 0 1 1 50 122A4 4 0 1 1 58 122Z", preenchimento = PapelCor.LARANJA),
            CaminhoArte("M144 92H170A2 2 0 0 1 172 94V114A2 2 0 0 1 170 116H144A2 2 0 0 1 142 114V94A2 2 0 0 1 144 92Z", preenchimento = PapelCor.GRAMA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M146 95H168A1 1 0 0 1 169 96V112A1 1 0 0 1 168 113H146A1 1 0 0 1 145 112V96A1 1 0 0 1 146 95Z", traco = PapelCor.GIZ, larguraTraco = 1.2f),
                    CaminhoArte("M157 95V113", traco = PapelCor.GIZ, larguraTraco = 1.2f),
                    CaminhoArte("M160 104A3 3 0 1 1 154 104A3 3 0 1 1 160 104Z", traco = PapelCor.GIZ, larguraTraco = 1.2f)
                ),
                opacidade = 0.9f
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M157 46A14 14 0 0 1 171 60C171 70 157 84 157 84C157 84 143 70 143 60A14 14 0 0 1 157 46Z", preenchimento = PapelCor.VERDE, traco = PapelCor.CONTORNO, larguraTraco = 1.2f),
                    CaminhoArte("M165 60A8 8 0 1 1 149 60A8 8 0 1 1 165 60Z", preenchimento = PapelCor.BRANCO),
                    GrupoArte(
                        filhos = listOf(
                            CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                            CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                            CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                        ),
                        matriz = MatrizArte(0.62f, 0f, 0f, 0.62f, 157f, 60f)
                    )
                ),
                animacao = AnimacaoArte.QUICAR
            )
        )
    )

    private fun medalha() = Arte(
        ArteId.MEDALHA, 160f, 160f,
        listOf(
            CaminhoArte("M142 88A62 62 0 1 1 18 88A62 62 0 1 1 142 88Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M50 10H70L92 74H72Z", preenchimento = PapelCor.VERDE),
            CaminhoArte("M110 10H90L68 74H88Z", preenchimento = PapelCor.AZUL),
            CaminhoArte("M88 10H90L68 74H66Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M71 66H89A3 3 0 0 1 92 69V72A3 3 0 0 1 89 75H71A3 3 0 0 1 68 72V69A3 3 0 0 1 71 66Z", preenchimento = PapelCor.OURO, traco = PapelCor.CONTORNO, larguraTraco = 1.2f),
            CaminhoArte("M110 104A30 30 0 1 1 50 104A30 30 0 1 1 110 104Z", preenchimento = PapelCor.OURO, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M101.2 82.8A30 30 0 0 1 58.8 125.2Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.35f),
            CaminhoArte("M102 104A22 22 0 1 1 58 104A22 22 0 1 1 102 104Z", traco = PapelCor.SOMBRA, larguraTraco = 3f),
            CaminhoArte("M80 92L82.94 99.95L91.41 100.29L84.76 105.55L87.05 113.71L80 109L72.95 113.71L75.24 105.55L68.59 100.29L77.06 99.95Z", preenchimento = PapelCor.BRANCO, opacidade = 0.75f),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 36f, 98f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.8f, 0f, 0f, 0.8f, 126f, 82f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.6f, 0f, 0f, 0.6f, 120f, 142f),
                animacao = AnimacaoArte.PISCAR
            )
        )
    )

    private fun placarZerado() = Arte(
        ArteId.PLACAR_ZERADO, 220f, 160f,
        listOf(
            CaminhoArte("M176 84A66 66 0 1 1 44 84A66 66 0 1 1 176 84Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M176 142A66 4 0 1 1 44 142A66 4 0 1 1 176 142Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M72 110H76A2 2 0 0 1 78 112V140A2 2 0 0 1 76 142H72A2 2 0 0 1 70 140V112A2 2 0 0 1 72 110Z", preenchimento = PapelCor.CONTORNO),
            CaminhoArte("M144 110H148A2 2 0 0 1 150 112V140A2 2 0 0 1 148 142H144A2 2 0 0 1 142 140V112A2 2 0 0 1 144 110Z", preenchimento = PapelCor.CONTORNO),
            CaminhoArte("M44 34H176A10 10 0 0 1 186 44V104A10 10 0 0 1 176 114H44A10 10 0 0 1 34 104V44A10 10 0 0 1 44 34Z", preenchimento = PapelCor.TINTA, traco = PapelCor.CONTORNO, larguraTraco = 2f),
            CaminhoArte("M44 34H176A10 10 0 0 1 186 44V48H34V44A10 10 0 0 1 44 34Z", preenchimento = PapelCor.BRANCO, opacidade = 0.08f),
            CaminhoArte("M52.5 40H95.5A2.5 2.5 0 0 1 98 42.5V42.5A2.5 2.5 0 0 1 95.5 45H52.5A2.5 2.5 0 0 1 50 42.5V42.5A2.5 2.5 0 0 1 52.5 40Z", preenchimento = PapelCor.VERDE),
            CaminhoArte("M124.5 40H167.5A2.5 2.5 0 0 1 170 42.5V42.5A2.5 2.5 0 0 1 167.5 45H124.5A2.5 2.5 0 0 1 122 42.5V42.5A2.5 2.5 0 0 1 124.5 40Z", preenchimento = PapelCor.AZUL),
            CaminhoArte("M56 52H92A6 6 0 0 1 98 58V96A6 6 0 0 1 92 102H56A6 6 0 0 1 50 96V58A6 6 0 0 1 56 52Z", preenchimento = PapelCor.BRANCO, opacidade = 0.06f),
            CaminhoArte("M128 52H164A6 6 0 0 1 170 58V96A6 6 0 0 1 164 102H128A6 6 0 0 1 122 96V58A6 6 0 0 1 128 52Z", preenchimento = PapelCor.BRANCO, opacidade = 0.06f),
            CaminhoArte("M73 60H75A10 10 0 0 1 85 70V84A10 10 0 0 1 75 94H73A10 10 0 0 1 63 84V70A10 10 0 0 1 73 60Z", traco = PapelCor.AMARELO, larguraTraco = 6f),
            CaminhoArte("M145 60H147A10 10 0 0 1 157 70V84A10 10 0 0 1 147 94H145A10 10 0 0 1 135 84V70A10 10 0 0 1 145 60Z", traco = PapelCor.AMARELO, larguraTraco = 6f),
            CaminhoArte("M113 70A3 3 0 1 1 107 70A3 3 0 1 1 113 70Z", preenchimento = PapelCor.AMARELO),
            CaminhoArte("M113 84A3 3 0 1 1 107 84A3 3 0 1 1 113 84Z", preenchimento = PapelCor.AMARELO),
            CaminhoArte("M193 141A9 2.4 0 1 1 175 141A9 2.4 0 1 1 193 141Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                    CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                    CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                ),
                matriz = MatrizArte(1.15f, 0f, 0f, 1.15f, 184f, 130f)
            )
        )
    )

    private fun podio() = Arte(
        ArteId.PODIO, 240f, 160f,
        listOf(
            CaminhoArte("M186 84A66 66 0 1 1 54 84A66 66 0 1 1 186 84Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M208 148A86 5 0 1 1 36 148A86 5 0 1 1 208 148Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M48 90H92A4 4 0 0 1 96 94V142A4 4 0 0 1 92 146H48A4 4 0 0 1 44 142V94A4 4 0 0 1 48 90Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M100 68H144A4 4 0 0 1 148 72V142A4 4 0 0 1 144 146H100A4 4 0 0 1 96 142V72A4 4 0 0 1 100 68Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M152 106H196A4 4 0 0 1 200 110V142A4 4 0 0 1 196 146H152A4 4 0 0 1 148 142V110A4 4 0 0 1 152 106Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M47.75 90.75H92.25A3 3 0 0 1 95.25 93.75V96.75A3 3 0 0 1 92.25 99.75H47.75A3 3 0 0 1 44.75 96.75V93.75A3 3 0 0 1 47.75 90.75Z", preenchimento = PapelCor.PRATA),
            CaminhoArte("M99.75 68.75H144.25A3 3 0 0 1 147.25 71.75V74.75A3 3 0 0 1 144.25 77.75H99.75A3 3 0 0 1 96.75 74.75V71.75A3 3 0 0 1 99.75 68.75Z", preenchimento = PapelCor.OURO),
            CaminhoArte("M151.75 106.75H196.25A3 3 0 0 1 199.25 109.75V112.75A3 3 0 0 1 196.25 115.75H151.75A3 3 0 0 1 148.75 112.75V109.75A3 3 0 0 1 151.75 106.75Z", preenchimento = PapelCor.BRONZE),
            CaminhoArte("M118 102L122 99V121", traco = PapelCor.CONTORNO, larguraTraco = 3f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M65 118Q65 113 70 113Q75 113 75 118Q75 122 65 132H75", traco = PapelCor.CONTORNO, larguraTraco = 3f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M169 124Q174 119 178 124Q180 129 174 130Q181 131 179 137Q176 142 169 139", traco = PapelCor.CONTORNO, larguraTraco = 3f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M110 56H134A2 2 0 0 1 136 58V66A2 2 0 0 1 134 68H110A2 2 0 0 1 108 66V58A2 2 0 0 1 110 56Z", preenchimento = PapelCor.OURO, traco = PapelCor.CONTORNO, larguraTraco = 1.2f),
            CaminhoArte("M110 56H134A2 2 0 0 1 136 58V66A2 2 0 0 1 134 68H110A2 2 0 0 1 108 66V58A2 2 0 0 1 110 56Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.5f),
            CaminhoArte("M118 46H126V57H118Z", preenchimento = PapelCor.OURO),
            CaminhoArte("M104 22H98A8 8 0 0 0 106 36M140 22H146A8 8 0 0 1 138 36", traco = PapelCor.OURO, larguraTraco = 3.5f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M104 16H140V28A18 18 0 0 1 104 28Z", preenchimento = PapelCor.OURO, traco = PapelCor.CONTORNO, larguraTraco = 1.2f),
            CaminhoArte("M122 16H140V28A18 18 0 0 1 122 46Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.45f),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.BRANCO)
                ),
                matriz = MatrizArte(0.75f, 0f, 0f, 0.75f, 114f, 26f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 80f, 40f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.8f, 0f, 0f, 0.8f, 166f, 30f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.6f, 0f, 0f, 0.6f, 182f, 64f),
                animacao = AnimacaoArte.PISCAR
            )
        )
    )

    private fun pranchetaVazia() = Arte(
        ArteId.PRANCHETA_VAZIA, 200f, 160f,
        listOf(
            CaminhoArte("M164 86A64 64 0 1 1 36 86A64 64 0 1 1 164 86Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M146 148A46 5 0 1 1 54 148A46 5 0 1 1 146 148Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M68 28H132A12 12 0 0 1 144 40V132A12 12 0 0 1 132 144H68A12 12 0 0 1 56 132V40A12 12 0 0 1 68 28Z", preenchimento = PapelCor.GRAMA),
            CaminhoArte("M68 28H75V144H68A12 12 0 0 1 56 132V40A12 12 0 0 1 68 28Z", preenchimento = PapelCor.BRILHO, opacidade = 0.55f),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M69 44H131A3 3 0 0 1 134 47V131A3 3 0 0 1 131 134H69A3 3 0 0 1 66 131V47A3 3 0 0 1 69 44Z", traco = PapelCor.GIZ, larguraTraco = 2f),
                    CaminhoArte("M66 89H134", traco = PapelCor.GIZ, larguraTraco = 2f),
                    CaminhoArte("M111 89A11 11 0 1 1 89 89A11 11 0 1 1 111 89Z", traco = PapelCor.GIZ, larguraTraco = 2f),
                    CaminhoArte("M84 44V56H116V44M84 134V122H116V134", traco = PapelCor.GIZ, larguraTraco = 2f)
                ),
                opacidade = 0.9f
            ),
            CaminhoArte("M88 70A6 6 0 1 1 76 70A6 6 0 1 1 88 70Z", traco = PapelCor.GIZ, larguraTraco = 2f, tracejado = listOf(3f, 3f)),
            CaminhoArte("M124 70A6 6 0 1 1 112 70A6 6 0 1 1 124 70Z", traco = PapelCor.GIZ, larguraTraco = 2f, tracejado = listOf(3f, 3f)),
            CaminhoArte("M106 110A6 6 0 1 1 94 110A6 6 0 1 1 106 110Z", traco = PapelCor.GIZ, larguraTraco = 2f, tracejado = listOf(3f, 3f)),
            CaminhoArte("M85 20H115A5 5 0 0 1 120 25V31A5 5 0 0 1 115 36H85A5 5 0 0 1 80 31V25A5 5 0 0 1 85 20Z", preenchimento = PapelCor.PRATA, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            CaminhoArte("M94.5 24H105.5A2.5 2.5 0 0 1 108 26.5V26.5A2.5 2.5 0 0 1 105.5 29H94.5A2.5 2.5 0 0 1 92 26.5V26.5A2.5 2.5 0 0 1 94.5 24Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M118 28C140 28 148 46 150 62", traco = PapelCor.LARANJA, larguraTraco = 2.5f, ponta = PontaTraco.REDONDA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M153 65A3 3 0 1 1 147 65A3 3 0 1 1 153 65Z", traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
                    CaminhoArte("M152 69H174A4 4 0 0 1 174 77H162.6A11 11 0 1 1 152 69Z", preenchimento = PapelCor.PRATA, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
                    CaminhoArte("M156 80A4 4 0 1 1 148 80A4 4 0 1 1 156 80Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M166 70H169A1 1 0 0 1 170 71V72A1 1 0 0 1 169 73H166A1 1 0 0 1 165 72V71A1 1 0 0 1 166 70Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M145 76A7 7 0 0 1 150 72", traco = PapelCor.BRANCO, larguraTraco = 2f, ponta = PontaTraco.REDONDA, opacidade = 0.7f)
                ),
                animacao = AnimacaoArte.QUICAR
            ),
            CaminhoArte("M184 62L190 56M186 72H194M184 82L190 88", traco = PapelCor.LARANJA, larguraTraco = 2.5f, ponta = PontaTraco.REDONDA)
        )
    )

    private fun sorteio() = Arte(
        ArteId.SORTEIO, 240f, 160f,
        listOf(
            CaminhoArte("M186 88A66 66 0 1 1 54 88A66 66 0 1 1 186 88Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M92 132A26 4 0 1 1 40 132A26 4 0 1 1 92 132Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M200 132A26 4 0 1 1 148 132A26 4 0 1 1 200 132Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-24 0H-11A11 9 0 0 0 11 0H24L27 16L21 20V60Q0 66 -21 60V20L-27 16Z", preenchimento = PapelCor.VERDE),
                    CaminhoArte("M-21 20V60Q-17 61.3 -13 62V20Z", preenchimento = PapelCor.BRILHO),
                    CaminhoArte("M8 4H24L27 16L21 20V60Q12 62.6 8 63Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.55f),
                    CaminhoArte("M-21 30H21V36H-21Z", preenchimento = PapelCor.GIZ, opacidade = 0.55f),
                    CaminhoArte("M-10.6 45A1.4 1.4 0 1 1 -13.4 45A1.4 1.4 0 1 1 -10.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-2.6 45A1.4 1.4 0 1 1 -5.4 45A1.4 1.4 0 1 1 -2.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M5.4 45A1.4 1.4 0 1 1 2.6 45A1.4 1.4 0 1 1 5.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M13.4 45A1.4 1.4 0 1 1 10.6 45A1.4 1.4 0 1 1 13.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-6.6 51A1.4 1.4 0 1 1 -9.4 51A1.4 1.4 0 1 1 -6.6 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M1.4 51A1.4 1.4 0 1 1 -1.4 51A1.4 1.4 0 1 1 1.4 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M9.4 51A1.4 1.4 0 1 1 6.6 51A1.4 1.4 0 1 1 9.4 51Z", preenchimento = PapelCor.SOMBRA)
                ),
                matriz = MatrizArte(0.99f, -0.139f, 0.139f, 0.99f, 64f, 58f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M-24 0H-11A11 9 0 0 0 11 0H24L27 16L21 20V60Q0 66 -21 60V20L-27 16Z", preenchimento = PapelCor.AZUL),
                    CaminhoArte("M-21 20V60Q-17 61.3 -13 62V20Z", preenchimento = PapelCor.BRILHO),
                    CaminhoArte("M8 4H24L27 16L21 20V60Q12 62.6 8 63Z", preenchimento = PapelCor.SOMBRA, opacidade = 0.55f),
                    CaminhoArte("M-21 30H21V36H-21Z", preenchimento = PapelCor.GIZ, opacidade = 0.55f),
                    CaminhoArte("M-10.6 45A1.4 1.4 0 1 1 -13.4 45A1.4 1.4 0 1 1 -10.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-2.6 45A1.4 1.4 0 1 1 -5.4 45A1.4 1.4 0 1 1 -2.6 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M5.4 45A1.4 1.4 0 1 1 2.6 45A1.4 1.4 0 1 1 5.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M13.4 45A1.4 1.4 0 1 1 10.6 45A1.4 1.4 0 1 1 13.4 45Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M-6.6 51A1.4 1.4 0 1 1 -9.4 51A1.4 1.4 0 1 1 -6.6 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M1.4 51A1.4 1.4 0 1 1 -1.4 51A1.4 1.4 0 1 1 1.4 51Z", preenchimento = PapelCor.SOMBRA),
                    CaminhoArte("M9.4 51A1.4 1.4 0 1 1 6.6 51A1.4 1.4 0 1 1 9.4 51Z", preenchimento = PapelCor.SOMBRA)
                ),
                matriz = MatrizArte(0.99f, 0.139f, -0.139f, 0.99f, 176f, 58f)
            ),
            CaminhoArte("M96 70Q120 50 144 70", traco = PapelCor.LARANJA, larguraTraco = 3f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M141.6 61.3L144 70L135 69.3", traco = PapelCor.LARANJA, larguraTraco = 3f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M144 116Q120 136 96 116", traco = PapelCor.LARANJA, larguraTraco = 3f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M98.4 124.7L96 116L105 116.75", traco = PapelCor.LARANJA, larguraTraco = 3f, ponta = PontaTraco.REDONDA, juncao = JuncaoTraco.REDONDA),
            CaminhoArte("M132 111A12 3 0 1 1 108 111A12 3 0 1 1 132 111Z", preenchimento = PapelCor.SOMBRA),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                    CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                    CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                ),
                matriz = MatrizArte(1.7f, 0f, 0f, 1.7f, 120f, 92f),
                animacao = AnimacaoArte.QUICAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(1f, 0f, 0f, 1f, 120f, 34f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.7f, 0f, 0f, 0.7f, 30f, 30f),
                animacao = AnimacaoArte.PISCAR
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M0 -6Q0 0 6 0Q0 0 0 6Q0 0 -6 0Q0 0 0 -6Z", preenchimento = PapelCor.OURO)
                ),
                matriz = MatrizArte(0.8f, 0f, 0f, 0.8f, 212f, 34f),
                animacao = AnimacaoArte.PISCAR
            )
        )
    )

    private fun vaquinha() = Arte(
        ArteId.VAQUINHA, 200f, 160f,
        listOf(
            CaminhoArte("M164 88A64 64 0 1 1 36 88A64 64 0 1 1 164 88Z", preenchimento = PapelCor.FUNDO),
            CaminhoArte("M144 148A44 5 0 1 1 56 148A44 5 0 1 1 144 148Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M66 52H134A10 10 0 0 1 144 62V130A14 14 0 0 1 130 144H70A14 14 0 0 1 56 130V62A10 10 0 0 1 66 52Z", preenchimento = PapelCor.VIDRO),
            CaminhoArte("M57 118Q80 104 100 112Q122 102 143 116V130A13 13 0 0 1 130 143H70A13 13 0 0 1 57 130Z", preenchimento = PapelCor.OURO),
            CaminhoArte("M86 116A10 4 0 1 1 66 116A10 4 0 1 1 86 116Z", preenchimento = PapelCor.OURO, traco = PapelCor.BRONZE, larguraTraco = 1.5f),
            CaminhoArte("M110 111A10 4 0 1 1 90 111A10 4 0 1 1 110 111Z", preenchimento = PapelCor.OURO, traco = PapelCor.BRONZE, larguraTraco = 1.5f),
            CaminhoArte("M134 114A10 4 0 1 1 114 114A10 4 0 1 1 134 114Z", preenchimento = PapelCor.OURO, traco = PapelCor.BRONZE, larguraTraco = 1.5f),
            CaminhoArte("M98 126A10 4 0 1 1 78 126A10 4 0 1 1 98 126Z", preenchimento = PapelCor.OURO, traco = PapelCor.BRONZE, larguraTraco = 1.5f),
            CaminhoArte("M124 125A10 4 0 1 1 104 125A10 4 0 1 1 124 125Z", preenchimento = PapelCor.OURO, traco = PapelCor.BRONZE, larguraTraco = 1.5f),
            CaminhoArte("M66 52H134A10 10 0 0 1 144 62V130A14 14 0 0 1 130 144H70A14 14 0 0 1 56 130V62A10 10 0 0 1 66 52Z", traco = PapelCor.CONTORNO, larguraTraco = 2f),
            CaminhoArte("M68 64V112", traco = PapelCor.BRILHO, larguraTraco = 5f, ponta = PontaTraco.REDONDA),
            CaminhoArte("M67 38H133A5 5 0 0 1 138 43V49A5 5 0 0 1 133 54H67A5 5 0 0 1 62 49V43A5 5 0 0 1 67 38Z", preenchimento = PapelCor.LARANJA),
            CaminhoArte("M65 38H135A3 3 0 0 1 138 41V41A3 3 0 0 1 135 44H65A3 3 0 0 1 62 41V41A3 3 0 0 1 65 38Z", preenchimento = PapelCor.BRANCO, opacidade = 0.22f),
            CaminhoArte("M88.5 43H111.5A2.5 2.5 0 0 1 114 45.5V45.5A2.5 2.5 0 0 1 111.5 48H88.5A2.5 2.5 0 0 1 86 45.5V45.5A2.5 2.5 0 0 1 88.5 43Z", preenchimento = PapelCor.SOMBRA),
            CaminhoArte("M116 84A16 16 0 1 1 84 84A16 16 0 1 1 116 84Z", preenchimento = PapelCor.SUP, traco = PapelCor.CONTORNO, larguraTraco = 1.5f),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M9 0A9 9 0 1 1 -9 0A9 9 0 1 1 9 0Z", preenchimento = PapelCor.BRANCO, traco = PapelCor.TINTA, larguraTraco = 1.4f),
                    CaminhoArte("M0 -3.6L3.42 -1.11L2.12 2.91L-2.12 2.91L-3.42 -1.11Z", preenchimento = PapelCor.TINTA),
                    CaminhoArte("M0 -3.6V-8.9M3.42 -1.11L8.5 -2.76M2.12 2.91L5.25 7.2M-2.12 2.91L-5.25 7.2M-3.42 -1.11L-8.5 -2.76", traco = PapelCor.TINTA, larguraTraco = 1.2f, ponta = PontaTraco.REDONDA)
                ),
                matriz = MatrizArte(1.25f, 0f, 0f, 1.25f, 100f, 84f)
            ),
            GrupoArte(
                filhos = listOf(
                    CaminhoArte("M109 20A9 9 0 1 1 91 20A9 9 0 1 1 109 20Z", preenchimento = PapelCor.OURO, traco = PapelCor.BRONZE, larguraTraco = 1.5f),
                    CaminhoArte("M105 20A5 5 0 1 1 95 20A5 5 0 1 1 105 20Z", traco = PapelCor.BRONZE, larguraTraco = 1.5f)
                ),
                animacao = AnimacaoArte.CAIR
            ),
            CaminhoArte("M90 6V2M100 4V0M110 6V2", traco = PapelCor.CONTORNO, larguraTraco = 2f, ponta = PontaTraco.REDONDA)
        )
    )
}
