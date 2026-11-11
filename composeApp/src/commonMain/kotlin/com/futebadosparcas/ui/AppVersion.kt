package com.futebadosparcas.ui

/**
 * Número da versão exibido no rodapé do login. No iOS vem do `CFBundleShortVersionString` do app;
 * onde não há leitura disponível devolve vazio e o rodapé omite a linha.
 */
expect fun appVersionName(): String
