package com.futebadosparcas.platform

import platform.UIKit.UIImpactFeedbackGenerator
import platform.UIKit.UIImpactFeedbackStyle
import platform.UIKit.UINotificationFeedbackGenerator
import platform.UIKit.UINotificationFeedbackType
import platform.UIKit.UISelectionFeedbackGenerator

/**
 * Implementação iOS de HapticFeedback usando UIFeedbackGenerator
 */
class IOSHapticFeedback : HapticFeedback {

    private val lightGenerator = UIImpactFeedbackGenerator(UIImpactFeedbackStyle.UIImpactFeedbackStyleLight)
    private val mediumGenerator = UIImpactFeedbackGenerator(UIImpactFeedbackStyle.UIImpactFeedbackStyleMedium)
    private val heavyGenerator = UIImpactFeedbackGenerator(UIImpactFeedbackStyle.UIImpactFeedbackStyleHeavy)
    private val selectionGenerator = UISelectionFeedbackGenerator()
    private val notificationGenerator = UINotificationFeedbackGenerator()

    override fun vibrate(durationMs: Long) {
        // iOS não suporta duração customizada, usa feedback médio como padrão
        medium()
    }

    override fun vibratePattern(pattern: LongArray) {
        // iOS não suporta padrões customizados nativamente
        // Fallback para vibração simples
        medium()
    }

    override fun light() {
        lightGenerator.prepare()
        lightGenerator.impactOccurred()
    }

    override fun medium() {
        mediumGenerator.prepare()
        mediumGenerator.impactOccurred()
    }

    override fun heavy() {
        heavyGenerator.prepare()
        heavyGenerator.impactOccurred()
    }

    override fun success() {
        notificationGenerator.prepare()
        notificationGenerator.notificationOccurred(UINotificationFeedbackType.UINotificationFeedbackTypeSuccess)
    }

    override fun error() {
        notificationGenerator.prepare()
        notificationGenerator.notificationOccurred(UINotificationFeedbackType.UINotificationFeedbackTypeError)
    }

    override fun warning() {
        notificationGenerator.prepare()
        notificationGenerator.notificationOccurred(UINotificationFeedbackType.UINotificationFeedbackTypeWarning)
    }
}

/**
 * Factory iOS - sem dependências
 */
actual object HapticFeedbackFactory {
    actual fun create(): HapticFeedback = IOSHapticFeedback()
}
