package com.futebadosparcas.platform.firebase

import com.google.firebase.firestore.FirebaseFirestore

/**
 * Compatibilidade temporária para repositórios Android que acessam Firestore diretamente.
 *
 * Esta extensão existe para compatibilidade durante a Fase 2 da migração CMP.
 * Os repositórios que chamam `getFirestore()` continuam funcionando enquanto
 * ainda usam Firebase Android SDK diretamente (callbackFlow, .await() etc.).
 *
 * TODO: Fase 3 - migrar GameExperienceRepositoryImpl, GameRequestRepositoryImpl,
 * GameSummonRepositoryImpl, GameTeamRepositoryImpl para GitLive SDK e remover este arquivo.
 */
fun FirebaseDataSource.getFirestore(): FirebaseFirestore =
    FirebaseFirestore.getInstance()
