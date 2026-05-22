package com.futebadosparcas.ui.whatsnew

import org.koin.core.module.Module

/**
 * Módulo Koin da feature "Novidades" — específico de plataforma.
 *
 * A camada compartilhada (`ReleaseNotesRepositoryImpl`, `LastSeenVersionStore`,
 * `GetUnseenReleaseNotesUseCase`) tem construtores que dependem da plataforma
 * (iOS não precisa de `Context`; Android sim). Como `composeApp` não inclui
 * `koin-android`, a fiação fica num `expect/actual` por target:
 *
 * - **iOS** (`iosMain`): fiação real — Firestore + fallback do bundle + use case.
 * - **Android / wasmJs**: stub ([EmptyReleaseNotesRepository]) — targets apenas
 *   de build (o app Android real é `:app`).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase G, task #23.
 */
expect fun releaseNotesModule(): Module
