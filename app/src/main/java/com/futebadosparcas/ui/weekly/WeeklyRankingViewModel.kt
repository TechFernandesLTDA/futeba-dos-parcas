package com.futebadosparcas.ui.weekly

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.*

data class WeeklyPlayer(
    val userId: String = "",
    val userName: String = "",
    val userPhoto: String? = null,
    val points: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0,
    val mvp: Int = 0,
    val wins: Int = 0,
    val bolaMurcha: Int = 0
)

sealed class WeeklyRankingUiState {
    data object Loading : WeeklyRankingUiState()
    data class Success(val weekKey: String, val players: List<WeeklyPlayer>) : WeeklyRankingUiState()
    data object Empty : WeeklyRankingUiState()
    data class Error(val message: String) : WeeklyRankingUiState()
}

class WeeklyRankingViewModel(
    private val firestore: FirebaseFirestore
) : ViewModel() {

    private val _uiState = MutableStateFlow<WeeklyRankingUiState>(WeeklyRankingUiState.Loading)
    val uiState: StateFlow<WeeklyRankingUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = WeeklyRankingUiState.Loading
            try {
                val weekKey = getWeekKey()
                val doc = firestore.collection("weekly-rankings")
                    .document(weekKey)
                    .get()
                    .await()

                if (!doc.exists()) {
                    _uiState.value = WeeklyRankingUiState.Empty
                    return@launch
                }

                val rankings = doc.get("rankings") as? List<Map<String, Any>> ?: emptyList()
                val players = rankings.map { map ->
                    WeeklyPlayer(
                        userId = map["userId"] as? String ?: "",
                        userName = map["userName"] as? String ?: "Jogador",
                        userPhoto = map["userPhoto"] as? String,
                        points = (map["points"] as? Long)?.toInt() ?: 0,
                        goals = (map["goals"] as? Long)?.toInt() ?: 0,
                        assists = (map["assists"] as? Long)?.toInt() ?: 0,
                        mvp = (map["mvp"] as? Long)?.toInt() ?: 0,
                        wins = (map["wins"] as? Long)?.toInt() ?: 0,
                        bolaMurcha = (map["bolaMurcha"] as? Long)?.toInt() ?: 0
                    )
                }

                if (players.isEmpty()) {
                    _uiState.value = WeeklyRankingUiState.Empty
                } else {
                    _uiState.value = WeeklyRankingUiState.Success(weekKey, players)
                }
            } catch (e: Exception) {
                _uiState.value = WeeklyRankingUiState.Error(
                    e.message ?: "Erro ao carregar ranking"
                )
            }
        }
    }

    private fun getWeekKey(): String {
        val now = Calendar.getInstance()
        val year = now.get(Calendar.YEAR)
        val week = now.get(Calendar.WEEK_OF_YEAR)
        return "$year-${String.format("%02d", week)}"
    }
}
