package com.futebadosparcas.performance

external fun jsRequestAnimationFrame(callback: () -> Unit)
external fun jsGetMemoryUsage(): Double?
external fun jsGetBundleSizeEstimate(): String?
external fun jsGetTimestamp(): Double
