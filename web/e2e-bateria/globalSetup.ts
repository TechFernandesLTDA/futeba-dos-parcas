/**
 * Bateria de testes — conferência antes do Playwright.
 *
 * Não semeia nada: só confirma que os emuladores estão no ar e que o seed da
 * bateria foi aplicado. Quem sobe os emuladores e semeia é
 * `scripts/bateria/rodar.sh`.
 */
const PROJETO = 'demo-futebadosparcas';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:18085';

export default async function globalSetup(): Promise<void> {
  const url =
    `http://${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents/bateria_meta/seed`;
  let resposta: Response;
  try {
    // "Bearer owner" faz o emulador do Firestore ignorar as regras nesta leitura.
    resposta = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
  } catch {
    throw new Error(
      `[bateria] emulador do Firestore fora do ar em ${FIRESTORE}. ` +
        'Rode `scripts/bateria/rodar.sh web` na raiz do repositório.',
    );
  }
  if (!resposta.ok) {
    throw new Error(
      '[bateria] o seed da bateria não foi aplicado neste emulador. ' +
        'Rode `scripts/bateria/rodar.sh web` na raiz do repositório.',
    );
  }
}
