package com.futebadosparcas.data.repository

import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.tasks.await

data class NearbyPlayer(
    val id: String,
    val displayName: String,
    val photoUrl: String?,
    val nickname: String?,
    val preferredPosition: String?,
    val followersCount: Int,
    val isFollowing: Boolean,
    val distanceKmApprox: Double,
    val distanceBand: String
)

data class LocationSharingState(
    val enabled: Boolean = false
)

class NearbyPlayersRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions
) {
    suspend fun loadSharingState(): Result<LocationSharingState> = runCatching {
        val uid = currentUid()
        val snapshot = firestore.collection("user_locations")
            .document(uid)
            .get()
            .await()
        LocationSharingState(
            enabled = snapshot.getBoolean("location_sharing_enabled") == true
        )
    }

    suspend fun enableSharing(lat: Double, lng: Double): Result<Unit> = runCatching {
        val uid = currentUid()
        firestore.collection("user_locations")
            .document(uid)
            .set(
                mapOf(
                    "user_id" to uid,
                    "location_sharing_enabled" to true,
                    "location_consent_at" to FieldValue.serverTimestamp(),
                    "location_updated_at" to FieldValue.serverTimestamp(),
                    "geohash" to encodeGeohash(lat, lng),
                    "lat" to lat,
                    "lng" to lng
                )
            )
            .await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao ativar localização compartilhada", it) }

    suspend fun disableSharing(): Result<Unit> = runCatching {
        val uid = currentUid()
        firestore.collection("user_locations")
            .document(uid)
            .set(
                mapOf(
                    "user_id" to uid,
                    "location_sharing_enabled" to false,
                    "location_updated_at" to FieldValue.serverTimestamp(),
                    "geohash" to FieldValue.delete(),
                    "lat" to FieldValue.delete(),
                    "lng" to FieldValue.delete(),
                    "location_consent_at" to FieldValue.delete()
                ),
                com.google.firebase.firestore.SetOptions.merge()
            )
            .await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao revogar localização compartilhada", it) }

    suspend fun discover(
        lat: Double,
        lng: Double,
        radiusKm: Int,
        socialFilter: String
    ): Result<List<NearbyPlayer>> = runCatching {
        val result = functions
            .getHttpsCallable("discoverNearbyPlayers")
            .call(
                mapOf(
                    "lat" to lat,
                    "lng" to lng,
                    "radiusKm" to radiusKm,
                    "socialFilter" to socialFilter
                )
            )
            .await()

        val payload = result.data as? Map<*, *> ?: return@runCatching emptyList()
        val rawPlayers = payload["players"] as? List<*> ?: return@runCatching emptyList()
        rawPlayers.mapNotNull(::mapNearbyPlayer)
    }.onFailure { AppLogger.e(TAG, "Erro ao buscar jogadores próximos", it) }

    private fun currentUid(): String =
        auth.currentUser?.uid ?: throw IllegalStateException("Usuário não autenticado")

    private fun mapNearbyPlayer(raw: Any?): NearbyPlayer? {
        val data = raw as? Map<*, *> ?: return null
        val id = data["id"] as? String ?: return null
        val displayName = data["displayName"] as? String ?: return null
        return NearbyPlayer(
            id = id,
            displayName = displayName,
            photoUrl = data["photoUrl"] as? String,
            nickname = data["nickname"] as? String,
            preferredPosition = data["preferredPosition"] as? String,
            followersCount = (data["followersCount"] as? Number)?.toInt() ?: 0,
            isFollowing = data["isFollowing"] as? Boolean ?: false,
            distanceKmApprox = (data["distanceKmApprox"] as? Number)?.toDouble() ?: 0.0,
            distanceBand = data["distanceBand"] as? String ?: "under_25km"
        )
    }

    companion object {
        private const val TAG = "NearbyPlayersRepository"
        private const val GEOHASH_PRECISION = 9
        private const val BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

        fun encodeGeohash(lat: Double, lng: Double, precision: Int = GEOHASH_PRECISION): String {
            var even = true
            var bit = 0
            var ch = 0
            val geohash = StringBuilder()
            val latRange = doubleArrayOf(-90.0, 90.0)
            val lngRange = doubleArrayOf(-180.0, 180.0)

            while (geohash.length < precision) {
                val range = if (even) lngRange else latRange
                val value = if (even) lng else lat
                val mid = (range[0] + range[1]) / 2
                if (value >= mid) {
                    ch = ch or (1 shl (4 - bit))
                    range[0] = mid
                } else {
                    range[1] = mid
                }
                even = !even
                if (bit < 4) {
                    bit++
                } else {
                    geohash.append(BASE32[ch])
                    bit = 0
                    ch = 0
                }
            }

            return geohash.toString()
        }
    }
}
