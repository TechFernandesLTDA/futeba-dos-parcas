/**
 * Configuração global do ambiente de testes Vitest.
 * Define variáveis de ambiente para o emulador Firestore.
 *
 * Porta 8085 conforme definido em firebase.json:
 *   "emulators": { "firestore": { "port": 8085 } }
 */

// Aponta o SDK do Firebase para o emulador local (não produção)
process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8085";
