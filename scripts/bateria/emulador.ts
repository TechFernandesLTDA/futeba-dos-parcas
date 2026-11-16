/**
 * Bateria de testes — acesso ao Firebase Emulator Suite.
 *
 * Tudo aqui fala só com 127.0.0.1. `exigirEmulador()` recusa rodar quando as
 * variáveis de emulador não estão definidas ou quando o projeto não é `demo-*`
 * (projeto `demo-` nunca alcança recurso real do Google).
 */

import * as admin from 'firebase-admin';
import { hostDe } from './portas';

export const PROJETO_EMULADOR = process.env.GCLOUD_PROJECT || 'demo-futebadosparcas';
export const REGIAO = 'southamerica-east1';

const HOST_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const HOST_FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST || '';
const HOST_FUNCTIONS = process.env.FUNCTIONS_EMULATOR_HOST || hostDe('functions');

export function exigirEmulador(): void {
  const faltando = [
    ['FIREBASE_AUTH_EMULATOR_HOST', HOST_AUTH],
    ['FIRESTORE_EMULATOR_HOST', HOST_FIRESTORE],
  ].filter(([, valor]) => !valor);
  if (faltando.length > 0) {
    throw new Error(
      `[bateria] ${faltando.map(([nome]) => nome).join(' e ')} não definido(s). ` +
        'O seed do emulador só roda contra o Firebase Emulator Suite. ' +
        'Use scripts/bateria/rodar.sh, que sobe os emuladores e define as variáveis.',
    );
  }
  for (const host of [HOST_AUTH, HOST_FIRESTORE, HOST_FUNCTIONS]) {
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) {
      throw new Error(`[bateria] host de emulador fora da máquina local: ${host}`);
    }
  }
  if (!PROJETO_EMULADOR.startsWith('demo-')) {
    throw new Error(
      `[bateria] projeto "${PROJETO_EMULADOR}" não começa com "demo-". ` +
        'O seed do emulador só aceita projeto demo, que não alcança produção.',
    );
  }
}

export function iniciarAdmin(): void {
  exigirEmulador();
  if (admin.apps.length === 0) {
    // Sem credencial: com as variáveis de emulador o Admin SDK não autentica.
    admin.initializeApp({ projectId: PROJETO_EMULADOR });
  }
}

export const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Repete `verificar` até devolver um valor (não nulo) ou estourar o prazo. */
export async function esperar<T>(
  descricao: string,
  verificar: () => Promise<T | null | undefined | false>,
  prazoMs = 45_000,
  intervaloMs = 400,
): Promise<T> {
  const fim = Date.now() + prazoMs;
  let ultimoErro: unknown;
  while (Date.now() < fim) {
    try {
      const valor = await verificar();
      if (valor) return valor;
    } catch (erro) {
      ultimoErro = erro;
    }
    await pausa(intervaloMs);
  }
  throw new Error(
    `[bateria] prazo esgotado esperando: ${descricao}` +
      (ultimoErro ? ` (último erro: ${(ultimoErro as Error).message})` : ''),
  );
}

/** Apaga todos os documentos e contas do projeto demo no emulador. */
export async function limparEmulador(): Promise<void> {
  exigirEmulador();
  const respostas = await Promise.all([
    fetch(
      `http://${HOST_FIRESTORE}/emulator/v1/projects/${PROJETO_EMULADOR}/databases/(default)/documents`,
      { method: 'DELETE' },
    ),
    fetch(`http://${HOST_AUTH}/emulator/v1/projects/${PROJETO_EMULADOR}/accounts`, {
      method: 'DELETE',
    }),
  ]);
  for (const resposta of respostas) {
    if (!resposta.ok) {
      throw new Error(`[bateria] falha ao limpar emulador: HTTP ${resposta.status}`);
    }
  }
}

const tokens = new Map<string, string>();

/** Login por e-mail e senha no emulador de Auth. Devolve o ID token. */
export async function entrar(email: string, senha: string, renovar = false): Promise<string> {
  if (!renovar) {
    const emCache = tokens.get(email);
    if (emCache) return emCache;
  }
  const resposta = await fetch(
    `http://${HOST_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    },
  );
  const corpo = (await resposta.json()) as { idToken?: string; error?: { message?: string } };
  if (!resposta.ok || !corpo.idToken) {
    throw new Error(`[bateria] login falhou para ${email}: ${corpo.error?.message ?? resposta.status}`);
  }
  tokens.set(email, corpo.idToken);
  return corpo.idToken;
}

export function esquecerTokens(): void {
  tokens.clear();
}

export class ErroCallable extends Error {
  constructor(
    public readonly funcao: string,
    public readonly status: string,
    mensagem: string,
  ) {
    super(`[bateria] ${funcao} → ${status}: ${mensagem}`);
  }
}

/** Chama uma Cloud Function callable no emulador, autenticada pelo ID token. */
export async function chamar<T = unknown>(
  funcao: string,
  idToken: string,
  dados: unknown,
): Promise<T> {
  const resposta = await fetch(
    `http://${HOST_FUNCTIONS}/${PROJETO_EMULADOR}/${REGIAO}/${funcao}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: dados }),
    },
  );
  const texto = await resposta.text();
  let corpo: { result?: T; error?: { status?: string; message?: string } } = {};
  try {
    corpo = JSON.parse(texto);
  } catch {
    throw new ErroCallable(funcao, `HTTP_${resposta.status}`, texto.slice(0, 300));
  }
  if (!resposta.ok || corpo.error) {
    throw new ErroCallable(
      funcao,
      corpo.error?.status ?? `HTTP_${resposta.status}`,
      corpo.error?.message ?? texto.slice(0, 300),
    );
  }
  return corpo.result as T;
}
