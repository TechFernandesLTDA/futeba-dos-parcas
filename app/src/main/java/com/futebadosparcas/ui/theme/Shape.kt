package com.futebadosparcas.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.graphics.shapes.CornerRounding
import androidx.graphics.shapes.RoundedPolygon
import androidx.graphics.shapes.star
import androidx.graphics.shapes.toPath

val FutebaShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(28.dp)
)

object ExpressiveShapeTokens {
    val ChipUnselected = 8.dp
    val ChipSelected = 20.dp

    val BadgeContainer: Shape = RoundedPolygonComposeShape(
        RoundedPolygon(8, rounding = CornerRounding(0.18f, smoothing = 0.1f))
    )

    val MedalContainer: Shape = RoundedPolygonComposeShape(
        RoundedPolygon.star(8, rounding = CornerRounding(0.10f, smoothing = 0.1f))
    )

    val TeamBadge: Shape = RoundedPolygonComposeShape(
        RoundedPolygon(6, rounding = CornerRounding(0.16f, smoothing = 0.1f))
    )

    val LevelHalo: Shape = MedalContainer
    val BadgeCounter: Shape = MedalContainer
}

private class RoundedPolygonComposeShape(
    private val polygon: RoundedPolygon
) : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density
    ): Outline {
        val matrix = Matrix().apply {
            scale(size.width / 2f, size.height / 2f)
            translate(1f, 1f)
        }
        val path = polygon.toPath().asComposePath().apply {
            transform(matrix)
        }
        return Outline.Generic(path)
    }
}
