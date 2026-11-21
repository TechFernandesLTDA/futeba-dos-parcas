package com.futebadosparcas.domain.artes

/**
 * Modelo de dados das artes da pelada (spec FEAT_2026-11-21_ARTES_DA_PELADA).
 *
 * As artes nascem em os SVGs de `shared/artes/fontes` e viram dados por `scripts/artes/gerar.mjs`
 * (arquivo [ArtesDaPelada], gerado). Aqui fica só o formato e a matemática da animação,
 * sem Compose: o Android (`:app`) e o iOS (`composeApp`) desenham a partir destes dados.
 */

/** Ponta do traço, igual a `stroke-linecap` do SVG. */
enum class PontaTraco { RETA, REDONDA, QUADRADA }

/** Junção do traço, igual a `stroke-linejoin` do SVG. */
enum class JuncaoTraco { QUINA, REDONDA, CHANFRO }

/**
 * Matriz afim 2D no formato do SVG `matrix(a b c d e f)`:
 * x' = a·x + c·y + e, y' = b·x + d·y + f.
 */
data class MatrizArte(
    val a: Float = 1f,
    val b: Float = 0f,
    val c: Float = 0f,
    val d: Float = 1f,
    val e: Float = 0f,
    val f: Float = 0f
) {
    val identidade: Boolean get() = this == IDENTIDADE

    companion object {
        val IDENTIDADE = MatrizArte()
    }
}

/** Nó da árvore de uma arte: caminho desenhado ou grupo. */
sealed interface NoArte

/**
 * Caminho com dados no formato do atributo `d` do SVG. Cores são papéis
 * ([PapelCor]); a paleta clara ou escura resolve o valor final.
 */
data class CaminhoArte(
    val d: String,
    val preenchimento: PapelCor? = null,
    val traco: PapelCor? = null,
    val larguraTraco: Float = 1f,
    val ponta: PontaTraco = PontaTraco.RETA,
    val juncao: JuncaoTraco = JuncaoTraco.QUINA,
    val tracejado: List<Float>? = null,
    val opacidade: Float = 1f
) : NoArte

/**
 * Grupo com transformação fixa, opacidade de grupo (desenhada numa camada, como no SVG)
 * e animação opcional. A animação é aplicada dentro da [matriz], em volta da origem local.
 */
data class GrupoArte(
    val filhos: List<NoArte>,
    val matriz: MatrizArte = MatrizArte.IDENTIDADE,
    val opacidade: Float = 1f,
    val animacao: AnimacaoArte? = null
) : NoArte

/** Arte pronta: tamanho do viewBox e a árvore de nós. */
data class Arte(
    val id: ArteId,
    val largura: Float,
    val altura: Float,
    val nos: List<NoArte>
) {
    val proporcao: Float get() = largura / altura
    val animada: Boolean get() = nos.any { it.temAnimacao() }
}

private fun NoArte.temAnimacao(): Boolean = when (this) {
    is CaminhoArte -> false
    is GrupoArte -> animacao != null || filhos.any { it.temAnimacao() }
}

/** Pictograma na grade 24, traço [LARGURA_TRACO_PICTOGRAMA] com pontas redondas. */
data class Pictograma(
    val id: PictogramaId,
    val tracos: List<TracoPictograma>
)

/** Um traço do pictograma; a cor vem de quem desenha (tint). */
data class TracoPictograma(val d: String, val opacidade: Float = 1f)

const val TAMANHO_PICTOGRAMA = 24f
const val LARGURA_TRACO_PICTOGRAMA = 1.8f

// ─── Animação ────────────────────────────────────────────────────────────────

/** Curva de tempo cúbica, como `cubic-bezier(x1, y1, x2, y2)` do CSS. */
data class CurvaTempo(val x1: Float, val y1: Float, val x2: Float, val y2: Float) {
    /** Progresso suavizado para [t] entre 0 e 1. */
    fun aplicar(t: Float): Float {
        if (t <= 0f) return 0f
        if (t >= 1f) return 1f
        // Newton-Raphson para achar o parâmetro u em que x(u) = t, com bisseção de reserva.
        var u = t
        repeat(8) {
            val x = bezier(u, x1, x2) - t
            val dx = derivada(u, x1, x2)
            if (kotlin.math.abs(x) < 1e-5f) return bezier(u, y1, y2)
            if (kotlin.math.abs(dx) < 1e-6f) return@repeat
            u -= x / dx
        }
        var baixo = 0f
        var alto = 1f
        u = t
        repeat(20) {
            val x = bezier(u, x1, x2)
            if (kotlin.math.abs(x - t) < 1e-5f) return bezier(u, y1, y2)
            if (x < t) baixo = u else alto = u
            u = (baixo + alto) / 2f
        }
        return bezier(u, y1, y2)
    }

    private fun bezier(u: Float, p1: Float, p2: Float): Float {
        val v = 1f - u
        return 3f * v * v * u * p1 + 3f * v * u * u * p2 + u * u * u
    }

    private fun derivada(u: Float, p1: Float, p2: Float): Float {
        val v = 1f - u
        return 3f * v * v * p1 + 6f * v * u * (p2 - p1) + 3f * u * u * (1f - p2)
    }
}

/** Estado de um grupo animado num instante: deslocamento, giro, escala e opacidade. */
data class EstadoAnimacao(
    val dx: Float = 0f,
    val dy: Float = 0f,
    val graus: Float = 0f,
    val escala: Float = 1f,
    val alfa: Float = 1f
) {
    companion object {
        /** Pose parada, usada com "reduzir movimento". */
        val REPOUSO = EstadoAnimacao()
    }
}

/** Quadro-chave de uma animação, em [posicao] entre 0 e 1. */
data class QuadroAnimacao(val posicao: Float, val estado: EstadoAnimacao)

/**
 * Animação em laço. Com [alternar], vai e volta (como `alternate` do CSS).
 * A [curva] vale para cada trecho entre quadros, como no CSS.
 */
data class EspecAnimacao(
    val duracaoMs: Int,
    val alternar: Boolean,
    val curva: CurvaTempo,
    val quadros: List<QuadroAnimacao>
) {
    /** Estado no instante [tempoMs], contado desde o início do laço. */
    fun estado(tempoMs: Long): EstadoAnimacao {
        val ciclo = if (alternar) duracaoMs * 2L else duracaoMs.toLong()
        val noCiclo = ((tempoMs % ciclo) + ciclo) % ciclo
        var p = noCiclo.toFloat() / duracaoMs
        if (alternar && p > 1f) p = 2f - p
        return interpolar(p.coerceIn(0f, 1f))
    }

    private fun interpolar(p: Float): EstadoAnimacao {
        val depois = quadros.indexOfFirst { it.posicao >= p }.let { if (it <= 0) 1 else it }
        val q0 = quadros[depois - 1]
        val q1 = quadros[depois]
        val trecho = q1.posicao - q0.posicao
        val local = if (trecho <= 0f) 1f else ((p - q0.posicao) / trecho).coerceIn(0f, 1f)
        val k = curva.aplicar(local)
        fun mistura(a: Float, b: Float) = a + (b - a) * k
        val a = q0.estado
        val b = q1.estado
        return EstadoAnimacao(
            dx = mistura(a.dx, b.dx),
            dy = mistura(a.dy, b.dy),
            graus = mistura(a.graus, b.graus),
            escala = mistura(a.escala, b.escala),
            alfa = mistura(a.alfa, b.alfa)
        )
    }
}

/** Especificação de cada animação, gerada a partir do gerador junto com as artes. */
fun AnimacaoArte.espec(): EspecAnimacao = ArtesDaPelada.animacao(this)
