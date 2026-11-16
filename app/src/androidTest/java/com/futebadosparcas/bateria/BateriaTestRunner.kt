package com.futebadosparcas.bateria

import android.app.Application
import android.os.Bundle
import androidx.test.runner.AndroidJUnitRunner
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage

/**
 * Runner dos testes instrumentados do app.
 *
 * Sem nada ligado é um AndroidJUnitRunner comum (o `connectedDebugAndroidTest`
 * de sempre; os testes da bateria se pulam sozinhos).
 *
 * No modo bateria (scripts/bateria/android.sh) o app inteiro fala com o
 * Firebase Emulator Suite, em dois passos:
 *
 * 1. `BateriaFirebaseProvider` (só no build de debug, `app/src/debug`): com a
 *    propriedade de sistema `debug.futeba.bateria=1`, cria o `FirebaseApp`
 *    padrão com o projeto `demo-futebadosparcas` ANTES do `FirebaseInitProvider`,
 *    que então não lê o `google-services.json` de produção. Projeto demo não
 *    alcança recurso real. Trocar o app padrão depois não serve: `delete()`
 *    derruba o Firebase Sessions ("FirebaseApp was deleted") e criar no
 *    `newApplication` é cedo demais para o App Check.
 * 2. [callApplicationOnCreate] (aqui): liga `useEmulator` em cada SDK antes do
 *    `Application.onCreate`. Daí em diante o Koin e as telas usam as mesmas
 *    instâncias, sem saber do teste.
 *
 * O argumento `-e bateria true` traz host e portas. Se ele vier sem o passo 1,
 * o runner para com mensagem clara em vez de testar contra produção.
 *
 * O AGP só aceita um `<instrumentation>` por APK de teste, por isso o modo da
 * bateria é uma chave e não um segundo runner.
 */
class BateriaTestRunner : AndroidJUnitRunner() {

    private var modoBateria = false

    override fun onCreate(arguments: Bundle?) {
        modoBateria = arguments?.getString("bateria") == "true"
        if (modoBateria) AmbienteBateria.lerArgumentos(arguments)
        super.onCreate(arguments)
    }

    override fun callApplicationOnCreate(app: Application) {
        if (modoBateria) apontarParaEmuladores()
        super.callApplicationOnCreate(app)
    }

    private fun apontarParaEmuladores() {
        check(FirebaseApp.getInstance().options.projectId == AmbienteBateria.PROJETO) {
            "O app padrão do Firebase não é o projeto demo: a bateria não roda contra produção. " +
                "Rode por scripts/bateria/rodar.sh android (ele liga debug.futeba.bateria)."
        }
        val host = AmbienteBateria.host
        FirebaseAuth.getInstance().useEmulator(host, AmbienteBateria.portaAuth)
        FirebaseFirestore.getInstance().useEmulator(host, AmbienteBateria.portaFirestore)
        FirebaseFunctions.getInstance(AmbienteBateria.REGIAO).useEmulator(host, AmbienteBateria.portaFunctions)
        FirebaseStorage.getInstance().useEmulator(host, AmbienteBateria.portaStorage)
        AmbienteBateria.ativo = true
    }
}
