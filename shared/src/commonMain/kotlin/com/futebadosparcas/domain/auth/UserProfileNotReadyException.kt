package com.futebadosparcas.domain.auth

/**
 * O usuário já está autenticado, mas o documento users/{uid} ainda não foi criado
 * pela Cloud Function onUserCreate (primeiro login). O cliente não cria esse
 * documento: as regras do Firestore negam. A tela pede para tentar de novo.
 */
class UserProfileNotReadyException :
    Exception("Perfil do usuário ainda não foi criado pelo servidor")
