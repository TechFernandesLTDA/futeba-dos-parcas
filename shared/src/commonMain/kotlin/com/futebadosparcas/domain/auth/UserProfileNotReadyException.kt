package com.futebadosparcas.domain.auth

/**
 * O usuário já está autenticado, mas o documento users/{uid} ainda não foi criado
 * pela Cloud Function onUserCreate (primeiro login). O cliente não cria esse
 * documento: as regras do Firestore negam. A mensagem é exibida como está no iOS
 * (friendlyAuthError devolve o texto); no Android o AuthErrorMapper usa strings.xml.
 */
class UserProfileNotReadyException :
    Exception("Sua conta está sendo preparada. Tente entrar de novo em instantes.")
