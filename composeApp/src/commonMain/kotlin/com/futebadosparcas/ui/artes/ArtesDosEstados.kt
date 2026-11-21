package com.futebadosparcas.ui.artes

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.artes.ArteId

/*
 * Artes nos estados vazio e de erro do Android e do iOS (spec FEAT_2026-11-21_ARTES_DA_PELADA, CA4).
 * Mesmo mapeamento do web (web/src/components/common/EmptyState.tsx).
 */

/** Largura máxima da arte num estado vazio ou de erro. */
private val LARGURA_ARTE_ESTADO = 200.dp

/** Altura máxima, para caber em celular deitado sem empurrar o texto para fora. */
private val ALTURA_ARTE_ESTADO = 140.dp

/** Arte decorativa no topo de um estado vazio ou de erro; o texto ao lado já explica a tela. */
@Composable
fun ArteDeEstado(id: ArteId, modifier: Modifier = Modifier, animar: Boolean = true) {
    ArteDaPelada(
        id = id,
        modifier = modifier
            .widthIn(max = LARGURA_ARTE_ESTADO)
            .fillMaxWidth()
            .heightIn(max = ALTURA_ARTE_ESTADO),
        animar = animar
    )
}

/**
 * Arte da pelada para o ícone que a tela já passava ao estado vazio.
 * `null` mantém o ícone (ex.: chat e fotos, que não têm arte no catálogo).
 */
fun arteDoIcone(icone: ImageVector): ArteId? = when (icone.name.substringAfterLast('.')) {
    "Inbox", "EventRepeat", "Event", "EventBusy", "CalendarMonth", "CalendarToday",
    "SportsSoccer", "SportsFootball", "Schedule" -> ArteId.PRANCHETA_VAZIA
    "Groups", "Group", "GroupAdd", "GroupOff" -> ArteId.COLETES_VARAL
    "PersonSearch", "People", "Person", "PersonAdd", "PersonOff", "SportsHandball" -> ArteId.BANCO_VAZIO
    "SportsScore", "BarChart", "Timeline", "History", "Analytics", "QueryStats", "ShowChart" -> ArteId.PLACAR_ZERADO
    "Leaderboard" -> ArteId.PODIO
    "EmojiEvents", "MilitaryTech", "WorkspacePremium", "Stars" -> ArteId.MEDALHA
    "Stadium", "LocationOff", "LocationOn", "Place", "Map", "Public" -> ArteId.MAPA_CAMPO
    "Notifications", "NotificationsNone", "NotificationsOff" -> ArteId.APITO
    "FilterList", "FilterListOff", "Search", "SearchOff" -> ArteId.LUPA
    "AccountBalanceWallet", "AttachMoney", "Payments", "Savings" -> ArteId.VAQUINHA
    "Shuffle", "Casino" -> ArteId.SORTEIO
    "CheckCircle", "HowToReg", "TaskAlt" -> ArteId.CHUTEIRAS
    "Flag", "Sports" -> ArteId.CONES
    "ConfirmationNumber", "Mail", "MailOutline" -> ArteId.INGRESSOS
    "Error", "ErrorOutline", "WifiOff", "CloudOff", "Warning", "SignalWifiOff" -> ArteId.BOLA_NA_TRAVE
    else -> null
}
