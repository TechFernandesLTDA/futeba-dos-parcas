package com.futebadosparcas.ui.games.venue

import com.futebadosparcas.domain.model.Location
import java.text.Normalizer
import java.util.Locale

/**
 * Busca inteligente de quadras (funcoes puras, sem Android).
 *
 * Regras de produto (#4371):
 * - sem acento e sem caixa;
 * - varios termos: TODOS precisam bater, cada um em qualquer campo;
 * - cada termo casa por prefixo de palavra;
 * - termos com 5+ letras toleram 1 erro de digitacao (troca, falta, sobra ou inversao);
 * - abreviacoes: soc -> society, fut -> futsal, jd -> jardim, vl -> vila;
 * - campos: nome, bairro, endereco, cidade, CEP e tipo de campo.
 */
object VenueSearch {

    /** Quantidade minima de letras para tolerar 1 erro de digitacao. */
    const val TYPO_MIN_LENGTH = 5

    private val COMBINING_MARKS = "\\p{InCombiningDiacriticalMarks}+".toRegex()
    private val NON_ALPHANUMERIC = "[^\\p{L}\\p{N}]+".toRegex()

    private val ABBREVIATIONS: Map<String, String> = mapOf(
        "soc" to "society",
        "fut" to "futsal",
        "jd" to "jardim",
        "vl" to "vila"
    )

    /** Minusculas, sem acento e sem espacos nas pontas. */
    fun normalize(text: String): String =
        Normalizer.normalize(text, Normalizer.Form.NFD)
            .replace(COMBINING_MARKS, "")
            .lowercase(Locale.ROOT)
            .trim()

    /** Palavras (letras/numeros) ja normalizadas. */
    fun tokenize(text: String): List<String> =
        normalize(text).split(NON_ALPHANUMERIC).filter { it.isNotEmpty() }

    /** Expande a abreviacao conhecida; devolve o proprio termo quando nao ha. */
    internal fun alternatives(term: String): List<String> {
        val expanded = ABBREVIATIONS[term]
        return if (expanded == null) listOf(term) else listOf(term, expanded)
    }

    /** true quando [a] e [b] diferem em no maximo 1 edicao (insercao, remocao, troca ou inversao). */
    internal fun withinOneEdit(a: String, b: String): Boolean {
        if (a == b) return true
        val lengthDiff = a.length - b.length
        if (lengthDiff > 1 || lengthDiff < -1) return false
        if (lengthDiff == 0) {
            var i = 0
            while (i < a.length && a[i] == b[i]) i++
            if (i == a.length) return true
            if (a.substring(i + 1) == b.substring(i + 1)) return true // troca
            return i + 1 < a.length &&
                a[i] == b[i + 1] && a[i + 1] == b[i] &&
                a.substring(i + 2) == b.substring(i + 2) // inversao
        }
        val shorter = if (lengthDiff < 0) a else b
        val longer = if (lengthDiff < 0) b else a
        var i = 0
        while (i < shorter.length && shorter[i] == longer[i]) i++
        return shorter.substring(i) == longer.substring(i + 1)
    }

    /** O [term] (ja normalizado) casa com a palavra [token] por prefixo, com 1 erro se for longo. */
    internal fun termMatchesToken(term: String, token: String): Boolean {
        if (token.startsWith(term)) return true
        if (term.length < TYPO_MIN_LENGTH || !term.all { it.isLetter() }) return false
        for (prefixLength in (term.length - 1)..(term.length + 1)) {
            if (prefixLength in 1..token.length && withinOneEdit(term, token.substring(0, prefixLength))) {
                return true
            }
        }
        return false
    }

    /** Palavras pesquisaveis da quadra (inclui as abreviacoes expandidas, p.ex. "Jd." -> jardim). */
    fun searchTokens(location: Location): List<String> {
        val tokens = LinkedHashSet<String>()
        val textFields = listOf(
            location.name,
            location.neighborhood,
            location.district,
            location.address,
            location.street,
            location.city,
            location.state,
            location.primaryFieldType.orEmpty()
        ) + location.activeFieldTypes
        textFields.forEach { field ->
            tokenize(field).forEach { token -> tokens.addAll(alternatives(token)) }
        }
        val cepDigits = location.cep.filter { it.isDigit() }
        if (cepDigits.isNotEmpty()) {
            tokens.add(cepDigits)
            tokenize(location.cep).forEach { tokens.add(it) }
            if (cepDigits.length == 8) {
                tokens.add(cepDigits.substring(0, 5))
                tokens.add(cepDigits.substring(5))
            }
        }
        return tokens.toList()
    }

    /** true quando todos os termos de [query] casam com alguma palavra da quadra. Busca vazia casa tudo. */
    fun matches(location: Location, query: String): Boolean =
        matchesTokens(searchTokens(location), query)

    internal fun matchesTokens(tokens: List<String>, query: String): Boolean {
        val terms = tokenize(query)
        if (terms.isEmpty()) return true
        return terms.all { term ->
            alternatives(term).any { alternative ->
                tokens.any { token -> termMatchesToken(alternative, token) }
            }
        }
    }

    /** Filtra [locations] pela busca (ordem original preservada). */
    fun filter(locations: List<Location>, query: String): List<Location> {
        if (tokenize(query).isEmpty()) return locations
        return locations.filter { matches(it, query) }
    }
}
