package com.futebadosparcas.navigation

external fun jsPushState(data: Int, title: String?, url: String?)
external fun jsReplaceState(data: Int, title: String?, url: String?)
external fun jsGetPathname(): String
external fun jsGetLocationHref(): String
external fun jsHistoryBack()
external fun jsCanGoBack(): Boolean
external fun jsInitPopStateListener(callback: (String) -> Unit)
