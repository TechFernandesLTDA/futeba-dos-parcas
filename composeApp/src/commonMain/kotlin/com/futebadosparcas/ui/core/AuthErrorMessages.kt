package com.futebadosparcas.ui.core

/**
 * Traduz erros do Firebase Auth (iOS: "Error Domain=FIRAuthErrorDomain Code=17008 ...";
 * Android/web: mensagens em inglês) para texto curto em português, sem código técnico.
 * Mensagem que já está em português (as nossas) passa como está.
 */
fun friendlyAuthError(raw: String?, fallback: String): String {
    val text = raw?.trim().orEmpty()
    if (text.isEmpty()) return fallback
    val lower = text.lowercase()
    val code = Regex("""Code=(\d{5})""").find(text)?.groupValues?.get(1)

    return when {
        code in setOf("17004", "17009", "17011") ||
            "invalid_login_credentials" in lower || "invalid-credential" in lower ||
            "auth credential is incorrect" in lower || "password is invalid" in lower ||
            "no user record" in lower ->
            "E-mail ou senha incorretos. Confira e tente de novo."
        code == "17008" || "badly formatted" in lower || "invalid-email" in lower ->
            "Esse e-mail não parece válido. Confira e tente de novo."
        code == "17007" || "already in use" in lower || "email-already-in-use" in lower ->
            "Já existe uma conta com esse e-mail. Entre com ela ou recupere a senha."
        code == "17026" || "weak-password" in lower || "password should be at least" in lower ->
            "Escolha uma senha mais forte, com pelo menos 6 caracteres."
        code == "17010" || "too-many-requests" in lower || "too many" in lower ->
            "Muitas tentativas. Espere um pouco e tente de novo."
        code == "17020" || "network" in lower || "timed out" in lower || "offline" in lower ->
            "Sem conexão com a internet. Confira sua rede e tente de novo."
        code == "17005" || "user-disabled" in lower || "has been disabled" in lower ->
            "Essa conta está desativada. Fale com o suporte."
        code == "17012" || "account-exists-with-different-credential" in lower ->
            "Esse e-mail já usa outra forma de entrar. Tente o método que você usou antes."
        code == "17999" || "internal error" in lower || "internal-error" in lower ->
            "Algo deu errado do nosso lado. Tente de novo em instantes."
        "Error Domain=" in text || "Serializer for class" in text || "NSLocalizedDescription" in text ||
            "FIRAuthErrorDomain" in text ->
            fallback
        else -> text
    }
}
