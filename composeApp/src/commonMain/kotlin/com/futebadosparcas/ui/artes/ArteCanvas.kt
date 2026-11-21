package com.futebadosparcas.ui.artes

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.artes.Arte
import com.futebadosparcas.domain.artes.ArteId
import com.futebadosparcas.domain.artes.ArtesDaPelada
import com.futebadosparcas.domain.artes.CaminhoArte
import com.futebadosparcas.domain.artes.EstadoAnimacao
import com.futebadosparcas.domain.artes.GrupoArte
import com.futebadosparcas.domain.artes.JuncaoTraco
import com.futebadosparcas.domain.artes.LARGURA_TRACO_PICTOGRAMA
import com.futebadosparcas.domain.artes.MatrizArte
import com.futebadosparcas.domain.artes.NoArte
import com.futebadosparcas.domain.artes.PapelCor
import com.futebadosparcas.domain.artes.PictogramaId
import com.futebadosparcas.domain.artes.PontaTraco
import com.futebadosparcas.domain.artes.TAMANHO_PICTOGRAMA
import com.futebadosparcas.domain.artes.espec
import com.futebadosparcas.ui.theme.rememberReduceMotion
import kotlinx.coroutines.isActive

/*
 * Renderizador das artes da pelada (spec FEAT_2026-11-21_ARTES_DA_PELADA).
 *
 * ATENÇÃO: este arquivo existe em dois lugares, idênticos fora `package` e `import`:
 *   app/src/main/java/com/futebadosparcas/ui/components/artes/ArteCanvas.kt  (Android)
 *   composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/artes/ArteCanvas.kt  (iOS)
 * O teste scripts/artes/gerar.test.js falha se os dois divergirem. Mude os dois juntos.
 *
 * Os dados vêm de `:shared` (ArtesDaPelada, gerado dos SVGs de shared/artes). As cores são
 * papéis resolvidos pela paleta clara ou escura; nada de cor literal aqui.
 */

/** Abaixo desta luminância do fundo, a arte usa a paleta escura. */
private const val LUMINANCIA_TEMA_ESCURO = 0.5f

/** Área generosa para camadas de opacidade; o sistema recorta pelo que está visível. */
private val AREA_CAMADA = Rect(-10_000f, -10_000f, 10_000f, 10_000f)

/**
 * Paleta das artes já em [Color]. Sem [escuro], segue o fundo do tema do app
 * (e não o modo do sistema), para respeitar a escolha de tema dentro do app.
 */
@Composable
fun paletaArte(escuro: Boolean? = null): Map<PapelCor, Color> {
    val usarEscura = escuro ?: (MaterialTheme.colorScheme.surface.luminance() < LUMINANCIA_TEMA_ESCURO)
    return remember(usarEscura) {
        val origem = if (usarEscura) ArtesDaPelada.paletaEscura else ArtesDaPelada.paletaClara
        origem.mapValues { (_, argb) -> Color(argb) }
    }
}

/**
 * Desenha uma arte da pelada. A largura vem do [modifier]; a altura segue a proporção da arte.
 *
 * @param descricao texto para leitor de tela. Sem ele, a arte é decorativa (fica fora da acessibilidade).
 * @param animar liga as animações curtas; elas nunca rodam com "reduzir movimento".
 * @param escuro força a paleta (ex.: arte sobre o verde fixo da marca); `null` segue o tema.
 */
@Composable
fun ArteDaPelada(
    id: ArteId,
    modifier: Modifier = Modifier,
    descricao: String? = null,
    animar: Boolean = true,
    escuro: Boolean? = null
) {
    val arte = remember(id) { ArtesDaPelada.arte(id) }
    val pronta = remember(arte) { prepararArte(arte) }
    val paleta = paletaArte(escuro)
    val comMovimento = animar && arte.animada && !rememberReduceMotion()
    val tempo = remember { mutableLongStateOf(0L) }
    if (comMovimento) {
        LaunchedEffect(Unit) {
            val inicio = withFrameMillis { it }
            while (isActive) {
                withFrameMillis { agora -> tempo.longValue = agora - inicio }
            }
        }
    }
    val acessibilidade = if (descricao != null) {
        Modifier.semantics {
            contentDescription = descricao
            role = Role.Image
        }
    } else {
        Modifier
    }
    Spacer(
        modifier
            .aspectRatio(arte.proporcao)
            .then(acessibilidade)
            .drawBehind {
                // O tempo só é lido aqui: cada quadro redesenha sem recompor.
                val instante = if (comMovimento) tempo.longValue else null
                desenharArte(pronta, paleta, instante)
            }
    )
}

/** Pictograma da pelada como [ImageVector] na grade 24; colorir com `tint` do Icon. */
@Composable
fun rememberPictograma(id: PictogramaId): ImageVector = remember(id) { pictogramaVetor(id) }

/** Monta o [ImageVector] de um pictograma. A cor do traço é só máscara: o `tint` decide a cor final. */
fun pictogramaVetor(id: PictogramaId): ImageVector {
    val pictograma = ArtesDaPelada.pictograma(id)
    val builder = ImageVector.Builder(
        name = "pictograma_${id.name.lowercase()}",
        defaultWidth = TAMANHO_PICTOGRAMA.dp,
        defaultHeight = TAMANHO_PICTOGRAMA.dp,
        viewportWidth = TAMANHO_PICTOGRAMA,
        viewportHeight = TAMANHO_PICTOGRAMA
    )
    pictograma.tracos.forEach { traco ->
        builder.addPath(
            pathData = addPathNodes(traco.d),
            fill = null,
            stroke = SolidColor(Color.Black),
            strokeAlpha = traco.opacidade,
            strokeLineWidth = LARGURA_TRACO_PICTOGRAMA,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round
        )
    }
    return builder.build()
}

// ─── Preparação (uma vez por arte) ───────────────────────────────────────────

private sealed interface NoPronto

private class CaminhoPronto(
    val fonte: CaminhoArte,
    val caminho: Path,
    val traco: Stroke?
) : NoPronto

private class GrupoPronto(
    val fonte: GrupoArte,
    val filhos: List<NoPronto>,
    val matriz: Matrix?
) : NoPronto

@Stable
private class ArtePronta(val largura: Float, val altura: Float, val nos: List<NoPronto>)

private fun prepararArte(arte: Arte): ArtePronta =
    ArtePronta(arte.largura, arte.altura, arte.nos.map { prepararNo(it) })

private fun prepararNo(no: NoArte): NoPronto = when (no) {
    is CaminhoArte -> CaminhoPronto(
        fonte = no,
        caminho = PathParser().parsePathString(no.d).toPath(),
        traco = no.traco?.let {
            Stroke(
                width = no.larguraTraco,
                cap = no.ponta.paraCompose(),
                join = no.juncao.paraCompose(),
                pathEffect = no.tracejado?.let { PathEffect.dashPathEffect(it.toFloatArray(), 0f) }
            )
        }
    )
    is GrupoArte -> GrupoPronto(
        fonte = no,
        filhos = no.filhos.map { prepararNo(it) },
        matriz = if (no.matriz.identidade) null else no.matriz.paraCompose()
    )
}

private fun PontaTraco.paraCompose(): StrokeCap = when (this) {
    PontaTraco.RETA -> StrokeCap.Butt
    PontaTraco.REDONDA -> StrokeCap.Round
    PontaTraco.QUADRADA -> StrokeCap.Square
}

private fun JuncaoTraco.paraCompose(): StrokeJoin = when (this) {
    JuncaoTraco.QUINA -> StrokeJoin.Miter
    JuncaoTraco.REDONDA -> StrokeJoin.Round
    JuncaoTraco.CHANFRO -> StrokeJoin.Bevel
}

/** matrix(a b c d e f) do SVG na matriz 4x4 do Compose. */
private fun MatrizArte.paraCompose(): Matrix {
    val m = Matrix()
    m.values[Matrix.ScaleX] = a
    m.values[Matrix.SkewY] = b
    m.values[Matrix.SkewX] = c
    m.values[Matrix.ScaleY] = d
    m.values[Matrix.TranslateX] = e
    m.values[Matrix.TranslateY] = f
    return m
}

// ─── Desenho ─────────────────────────────────────────────────────────────────

/** Cabe a arte inteira na área, centrada, como `preserveAspectRatio="xMidYMid meet"`. */
private fun DrawScope.desenharArte(arte: ArtePronta, paleta: Map<PapelCor, Color>, tempoMs: Long?) {
    val escala = minOf(size.width / arte.largura, size.height / arte.altura)
    if (escala <= 0f) return
    val sobraX = (size.width - arte.largura * escala) / 2f
    val sobraY = (size.height - arte.altura * escala) / 2f
    withTransform({
        translate(sobraX, sobraY)
        scale(escala, escala, pivot = Offset.Zero)
    }) {
        arte.nos.forEach { desenharNo(it, paleta, tempoMs) }
    }
}

private fun DrawScope.desenharNo(no: NoPronto, paleta: Map<PapelCor, Color>, tempoMs: Long?) {
    when (no) {
        is CaminhoPronto -> desenharCaminho(no, paleta)
        is GrupoPronto -> desenharGrupo(no, paleta, tempoMs)
    }
}

private fun DrawScope.desenharCaminho(no: CaminhoPronto, paleta: Map<PapelCor, Color>) {
    val fonte = no.fonte
    val preenchimento = fonte.preenchimento?.let { paleta.getValue(it) }
    val traco = fonte.traco?.let { paleta.getValue(it) }
    val estilo = no.traco
    // Com preenchimento e traço juntos, a opacidade vale para o conjunto (como no SVG).
    val emCamada = fonte.opacidade < 1f && preenchimento != null && traco != null
    val alfa = if (emCamada) 1f else fonte.opacidade
    val pintar: DrawScope.() -> Unit = {
        preenchimento?.let { drawPath(no.caminho, it, alpha = alfa) }
        if (traco != null && estilo != null) drawPath(no.caminho, traco, alpha = alfa, style = estilo)
    }
    if (emCamada) emCamada(fonte.opacidade, pintar) else pintar()
}

private fun DrawScope.desenharGrupo(no: GrupoPronto, paleta: Map<PapelCor, Color>, tempoMs: Long?) {
    val estado = no.fonte.animacao?.let { animacao ->
        if (tempoMs == null) EstadoAnimacao.REPOUSO else animacao.espec().estado(tempoMs)
    }
    val alfa = no.fonte.opacidade * (estado?.alfa ?: 1f)
    if (alfa <= 0f) return
    withTransform({
        no.matriz?.let { transform(it) }
        // A animação gira e escala em volta da origem local do grupo, dentro da matriz fixa.
        if (estado != null) {
            translate(estado.dx, estado.dy)
            rotate(estado.graus, pivot = Offset.Zero)
            scale(estado.escala, estado.escala, pivot = Offset.Zero)
        }
    }) {
        val filhos: DrawScope.() -> Unit = { no.filhos.forEach { desenharNo(it, paleta, tempoMs) } }
        if (alfa < 1f) emCamada(alfa, filhos) else filhos()
    }
}

/** Desenha [bloco] numa camada com opacidade [alfa], como `opacity` de grupo no SVG. */
private fun DrawScope.emCamada(alfa: Float, bloco: DrawScope.() -> Unit) {
    drawIntoCanvas { canvas ->
        canvas.saveLayer(AREA_CAMADA, Paint().apply { this.alpha = alfa })
        bloco()
        canvas.restore()
    }
}
