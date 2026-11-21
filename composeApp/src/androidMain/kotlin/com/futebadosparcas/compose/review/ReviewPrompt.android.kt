package com.futebadosparcas.compose.review

import com.futebadosparcas.platform.review.NativeReviewLauncher

// O Android de produção pede a avaliação em :app (MainActivityCompose); este alvo é só o harness.
internal actual fun createNativeReviewLauncher(): NativeReviewLauncher = NativeReviewLauncher { null }
