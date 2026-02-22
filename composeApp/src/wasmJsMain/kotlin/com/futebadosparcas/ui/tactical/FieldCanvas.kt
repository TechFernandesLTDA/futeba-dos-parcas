package com.futebadosparcas.ui.tactical

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.*

data class FieldPlayer(
    val id: String,
    val name: String,
    val position: FormationPosition,
    val teamId: Int,
    val number: Int = 1
)

@Composable
fun FieldCanvas(
    team1Players: List<FieldPlayer>,
    team2Players: List<FieldPlayer>,
    team1Name: String,
    team2Name: String,
    onPlayerMoved: (playerId: String, newPosition: Offset) -> Unit,
    modifier: Modifier = Modifier
) {
    val team1Color = Color(0xFF2196F3)
    val team2Color = Color(0xFFF44336)
    val fieldGreen = Color(0xFF2E7D32)
    val lineColor = Color.White

    var draggedPlayerId by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableStateOf(Offset.Zero) }

    val density = LocalDensity.current

    Card(
        modifier = modifier,
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(fieldGreen)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TeamHeader(name = team1Name, color = team1Color)
                Text(
                    text = "VS",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                TeamHeader(name = team2Name, color = team2Color)
            }

            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(0.7f)
                    .padding(8.dp)
            ) {
                val canvasWidth = maxWidth
                val canvasHeight = maxHeight

                val lineStrokePx = with(density) { 3.dp.toPx() }
                val cornerRadiusPx = with(density) { 20.dp.toPx() }
                val paddingPx = with(density) { 8.dp.toPx() }
                val playerDotRadiusPx = with(density) { 18.dp.toPx() }
                val dotBorderWidthPx = with(density) { 2.dp.toPx() }

                Canvas(
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    val allPlayers = team1Players + team2Players
                                    draggedPlayerId = allPlayers.minByOrNull { player ->
                                        val playerOffset = Offset(
                                            player.position.x * size.width,
                                            player.position.y * size.height
                                        )
                                        (playerOffset - offset).getDistance()
                                    }?.id
                                },
                                onDrag = { change, dragAmount ->
                                    change.consume()
                                    dragOffset += dragAmount
                                },
                                onDragEnd = {
                                    draggedPlayerId?.let { id ->
                                        val finalOffset = Offset(
                                            (dragOffset.x / size.width).coerceIn(0.05f, 0.95f),
                                            (dragOffset.y / size.height).coerceIn(0.05f, 0.95f)
                                        )
                                        onPlayerMoved(id, finalOffset)
                                    }
                                    draggedPlayerId = null
                                    dragOffset = Offset.Zero
                                }
                            )
                        }
                ) {
                    val width = size.width
                    val height = size.height

                    drawFieldLines(
                        width = width,
                        height = height,
                        strokeWidth = lineStrokePx,
                        cornerRadius = cornerRadiusPx,
                        paddingPx = paddingPx,
                        color = lineColor
                    )

                    team1Players.forEach { player ->
                        val x = player.position.x * width
                        val y = player.position.y * height
                        drawPlayerDot(
                            centerX = x,
                            centerY = y,
                            color = team1Color,
                            radius = playerDotRadiusPx,
                            borderWidth = dotBorderWidthPx
                        )
                    }

                    team2Players.forEach { player ->
                        val x = player.position.x * width
                        val y = player.position.y * height
                        drawPlayerDot(
                            centerX = x,
                            centerY = y,
                            color = team2Color,
                            radius = playerDotRadiusPx,
                            borderWidth = dotBorderWidthPx
                        )
                    }
                }

                team1Players.forEach { player ->
                    PlayerLabel(
                        player = player,
                        color = team1Color,
                        canvasWidth = canvasWidth,
                        canvasHeight = canvasHeight
                    )
                }

                team2Players.forEach { player ->
                    PlayerLabel(
                        player = player,
                        color = team2Color,
                        canvasWidth = canvasWidth,
                        canvasHeight = canvasHeight
                    )
                }
            }
        }
    }
}

private fun DrawScope.drawFieldLines(
    width: Float,
    height: Float,
    strokeWidth: Float,
    cornerRadius: Float,
    paddingPx: Float,
    color: Color
) {
    drawRoundRect(
        color = color,
        topLeft = Offset(paddingPx, paddingPx),
        size = Size(width - paddingPx * 2, height - paddingPx * 2),
        cornerRadius = CornerRadius(cornerRadius),
        style = Stroke(width = strokeWidth)
    )

    drawLine(
        color = color,
        start = Offset(width / 2, paddingPx),
        end = Offset(width / 2, height - paddingPx),
        strokeWidth = strokeWidth
    )

    val centerCircleRadius = min(width, height) * 0.12f
    drawCircle(
        color = color,
        radius = centerCircleRadius,
        center = Offset(width / 2, height / 2),
        style = Stroke(width = strokeWidth)
    )

    val centerDotRadius = min(width, height) * 0.015f
    drawCircle(
        color = color,
        radius = centerDotRadius,
        center = Offset(width / 2, height / 2)
    )

    val penaltyAreaHeight = height * 0.32f
    val penaltyAreaWidth = width * 0.18f

    drawRect(
        color = color,
        topLeft = Offset(paddingPx, (height - penaltyAreaHeight) / 2),
        size = Size(penaltyAreaWidth, penaltyAreaHeight),
        style = Stroke(width = strokeWidth)
    )

    drawRect(
        color = color,
        topLeft = Offset(width - paddingPx - penaltyAreaWidth, (height - penaltyAreaHeight) / 2),
        size = Size(penaltyAreaWidth, penaltyAreaHeight),
        style = Stroke(width = strokeWidth)
    )

    val goalAreaHeight = height * 0.16f
    val goalAreaWidth = width * 0.06f

    drawRect(
        color = color,
        topLeft = Offset(paddingPx, (height - goalAreaHeight) / 2),
        size = Size(goalAreaWidth, goalAreaHeight),
        style = Stroke(width = strokeWidth)
    )

    drawRect(
        color = color,
        topLeft = Offset(width - paddingPx - goalAreaWidth, (height - goalAreaHeight) / 2),
        size = Size(goalAreaWidth, goalAreaHeight),
        style = Stroke(width = strokeWidth)
    )

    val penaltySpotDistance = width * 0.11f
    val penaltySpotRadius = min(width, height) * 0.01f
    drawCircle(
        color = color,
        radius = penaltySpotRadius,
        center = Offset(paddingPx + penaltySpotDistance, height / 2)
    )
    drawCircle(
        color = color,
        radius = penaltySpotRadius,
        center = Offset(width - paddingPx - penaltySpotDistance, height / 2)
    )

    val arcRadius = penaltyAreaHeight * 0.3f
    val arcPath = Path().apply {
        arcTo(
            rect = Rect(
                left = paddingPx + penaltyAreaWidth - arcRadius * 0.5f,
                top = height / 2 - arcRadius,
                right = paddingPx + penaltyAreaWidth + arcRadius * 0.5f,
                bottom = height / 2 + arcRadius
            ),
            startAngleDegrees = -60f,
            sweepAngleDegrees = 120f,
            forceMoveTo = true
        )
    }
    drawPath(
        path = arcPath,
        color = color,
        style = Stroke(width = strokeWidth)
    )

    val arcPath2 = Path().apply {
        arcTo(
            rect = Rect(
                left = width - paddingPx - penaltyAreaWidth - arcRadius * 0.5f,
                top = height / 2 - arcRadius,
                right = width - paddingPx - penaltyAreaWidth + arcRadius * 0.5f,
                bottom = height / 2 + arcRadius
            ),
            startAngleDegrees = 120f,
            sweepAngleDegrees = 120f,
            forceMoveTo = true
        )
    }
    drawPath(
        path = arcPath2,
        color = color,
        style = Stroke(width = strokeWidth)
    )

    val cornerArcRadius = min(width, height) * 0.02f
    drawCircle(
        color = color,
        radius = cornerArcRadius,
        center = Offset(paddingPx + cornerArcRadius, paddingPx + cornerArcRadius),
        style = Stroke(width = strokeWidth)
    )
    drawCircle(
        color = color,
        radius = cornerArcRadius,
        center = Offset(width - paddingPx - cornerArcRadius, paddingPx + cornerArcRadius),
        style = Stroke(width = strokeWidth)
    )
}

private fun DrawScope.drawPlayerDot(
    centerX: Float,
    centerY: Float,
    color: Color,
    radius: Float,
    borderWidth: Float
) {
    drawCircle(
        color = color,
        radius = radius,
        center = Offset(centerX, centerY)
    )

    drawCircle(
        color = Color.White,
        radius = radius - borderWidth / 2,
        center = Offset(centerX, centerY),
        style = Stroke(width = borderWidth)
    )
}

@Composable
private fun BoxWithConstraintsScope.PlayerLabel(
    player: FieldPlayer,
    color: Color,
    canvasWidth: Dp,
    canvasHeight: Dp
) {
    val x = (player.position.x * canvasWidth.value).dp
    val y = (player.position.y * canvasHeight.value).dp

    Box(
        modifier = Modifier
            .offset(x = x - 24.dp, y = y - 40.dp)
            .width(48.dp)
    ) {
        Text(
            text = player.name.take(8),
            color = Color.White,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.align(Alignment.Center)
        )
    }
}

@Composable
private fun TeamHeader(
    name: String,
    color: Color
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .background(color, CircleShape)
        )
        Text(
            text = name,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}
