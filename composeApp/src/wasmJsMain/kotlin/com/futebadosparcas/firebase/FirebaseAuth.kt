package com.futebadosparcas.firebase

external interface User : JsAny {
    val uid: String
    val email: String?
    val displayName: String?
    val photoURL: String?
    val emailVerified: Boolean
}

external interface UserCredential : JsAny {
    val user: User?
    val additionalUserInfo: AdditionalUserInfo?
}

external interface AdditionalUserInfo : JsAny {
    val isNewUser: Boolean
}

external fun firebaseAuthGetUser(): User?
external fun firebaseAuthOnStateChanged(callback: (User?) -> Unit)
external fun dateNow(): Double
