package com.futebadosparcas.domain.util

/**
 * Comparador de versão semântica (`MAJOR.MINOR.PATCH`).
 *
 * Tolerante a entradas do mundo real:
 * - prefixo `v` opcional (`v1.2.3`);
 * - sufixos de pré-release / build são ignorados (`1.2.3-beta`, `1.2.3+42`);
 * - componentes ausentes contam como `0` (`1.2` == `1.2.0`);
 * - componentes não numéricos contam como `0` (degradação segura, sem exceção).
 *
 * Não compara precedência de pré-release (`-beta` < release) — o projeto numera
 * releases estáveis; build numbers cuidam da ordenação fina.
 */
object SemVer {

    /**
     * Retorna `< 0` se [a] for anterior a [b], `0` se iguais, `> 0` se [a] for posterior.
     */
    fun compare(a: String, b: String): Int {
        val partsA = parse(a)
        val partsB = parse(b)
        val size = maxOf(partsA.size, partsB.size)
        for (i in 0 until size) {
            val x = partsA.getOrElse(i) { 0 }
            val y = partsB.getOrElse(i) { 0 }
            if (x != y) return x.compareTo(y)
        }
        return 0
    }

    /** `true` se [a] for estritamente mais nova que [b]. */
    fun isNewer(a: String, b: String): Boolean = compare(a, b) > 0

    private fun parse(version: String): List<Int> =
        version.trim()
            .removePrefix("v")
            .removePrefix("V")
            .substringBefore('-')
            .substringBefore('+')
            .split('.')
            .map { it.trim().toIntOrNull() ?: 0 }
}
