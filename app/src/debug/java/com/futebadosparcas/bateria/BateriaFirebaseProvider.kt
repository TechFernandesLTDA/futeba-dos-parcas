package com.futebadosparcas.bateria

import android.annotation.SuppressLint
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

/**
 * Só no build de DEBUG. Chave da bateria de testes (scripts/bateria).
 *
 * Com a propriedade de sistema `debug.futeba.bateria=1` (ligada por
 * `adb shell setprop`, que o `scripts/bateria/android.sh` faz e desfaz), cria o
 * `FirebaseApp` padrão com o projeto `demo-futebadosparcas` antes do
 * `FirebaseInitProvider` (initOrder maior roda primeiro). O provider do
 * Firebase vê que o app padrão já existe e não lê o `google-services.json`.
 *
 * Projeto demo não alcança nenhum recurso real: sem os emuladores ligados
 * (quem liga é o `BateriaTestRunner`), o app simplesmente não conecta. Sem a
 * propriedade, este provider não faz nada. Não existe no build de release.
 */
class BateriaFirebaseProvider : ContentProvider() {

    override fun onCreate(): Boolean {
        val contexto = context ?: return false
        if (propriedade(PROPRIEDADE) != "1") return false

        val opcoes = FirebaseOptions.Builder()
            .setProjectId(PROJETO_DEMO)
            // Identificadores fictícios, só no formato que os SDKs exigem
            // (o Installations recusa chave fora do padrão "A" + 38 caracteres).
            .setApplicationId("1:000000000000:android:0000000000000000")
            .setApiKey("A" + "0".repeat(38))
            .setStorageBucket("$PROJETO_DEMO.appspot.com")
            .build()
        FirebaseApp.initializeApp(contexto, opcoes)
        Log.w(TAG, "Modo bateria: Firebase apontado para o projeto $PROJETO_DEMO")
        return true
    }

    /** Lê uma propriedade de sistema; vazio quando não existe. */
    @SuppressLint("PrivateApi")
    private fun propriedade(nome: String): String = runCatching {
        Class.forName("android.os.SystemProperties")
            .getMethod("get", String::class.java)
            .invoke(null, nome) as? String
    }.getOrNull().orEmpty()

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0

    private companion object {
        const val TAG = "BateriaFirebase"
        const val PROPRIEDADE = "debug.futeba.bateria"
        const val PROJETO_DEMO = "demo-futebadosparcas"
    }
}
