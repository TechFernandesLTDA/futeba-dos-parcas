/**
 * Simulação de uso — núcleo.
 *
 * Cada pessoa da simulação é uma conta de teste do emulador logada no SDK
 * cliente do Firebase (o mesmo do web). As gravações diretas no Firestore
 * passam pelas `firestore.rules` como passariam no app; as callables vão pelo
 * emulador de Functions com o ID token da pessoa. O Admin SDK só ajusta o
 * relógio dos jogos e lê os dados para conferir invariantes.
 *
 * Toda ação declara o resultado esperado. Achado = resultado diferente do
 * esperado, ou invariante quebrado. Tudo vai para um JSONL.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { chamar, ErroCallable, pausa } from '../emulador';
import { conta, SENHA_EMULADOR, type ContaTeste } from '../contas';
import { PORTAS, HOST_LOCAL } from '../portas';

// ───────────────────────── aleatório reproduzível ─────────────────────────

/** mulberry32: mesma semente, mesma simulação. */
export function criarRng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export let rng = criarRng(20261123);
export function semear(semente: number): void {
  rng = criarRng(semente);
}
export const chance = (p: number): boolean => rng() < p;
export const sortear = <T>(lista: readonly T[]): T => lista[Math.floor(rng() * lista.length)];
export function embaralhar<T>(lista: readonly T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
export const inteiro = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

// ───────────────────────── registro ─────────────────────────

export interface Evento {
  ts: string;
  semana: number;
  ator: string;
  persona?: string;
  acao: string;
  alvo?: string;
  esperado: string;
  obtido: string;
  msg?: string;
  ms: number;
  achado: boolean;
  /** Erro de ritmo do rate limiter: artefato da simulação acelerada. */
  ritmo?: boolean;
  dados?: unknown;
}

let arquivoLog = '';
let semanaAtual = 0;
export const contadores = { acoes: 0, achados: 0, ritmo: 0 };

export function abrirRegistro(caminho: string): void {
  mkdirSync(dirname(caminho), { recursive: true });
  arquivoLog = caminho;
}
export function definirSemana(n: number): void {
  semanaAtual = n;
}
export function semana(): number {
  return semanaAtual;
}

export function registrarEvento(evento: Omit<Evento, 'ts' | 'semana'>): void {
  const linha: Evento = { ts: new Date().toISOString(), semana: semanaAtual, ...evento };
  contadores.acoes++;
  if (linha.achado) contadores.achados++;
  if (linha.ritmo) contadores.ritmo++;
  if (arquivoLog) appendFileSync(arquivoLog, JSON.stringify(linha) + '\n');
}

/** Observação que não é ação de usuário (invariante, nota de cobertura). */
export function registrarAchado(acao: string, msg: string, dados?: unknown): void {
  registrarEvento({ ator: 'conferencia', acao, esperado: 'ok', obtido: 'violado', msg, ms: 0, achado: true, dados });
}

// ───────────────────────── pessoas ─────────────────────────

export interface Pessoa {
  chave: string;
  conta: ContaTeste;
  uid: string;
  nome: string;
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  persona: string;
}

const pessoas = new Map<string, Pessoa>();

export async function pessoa(chave: string, persona = 'padrao'): Promise<Pessoa> {
  const existente = pessoas.get(chave);
  if (existente) return existente;
  const c = conta(chave);
  const app = initializeApp(
    { apiKey: 'demo-key', projectId: process.env.GCLOUD_PROJECT || 'demo-futebadosparcas', appId: `sim-${chave}` },
    `sim-${chave}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST_LOCAL}:${PORTAS.auth}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST_LOCAL, PORTAS.firestore);
  await signInWithEmailAndPassword(auth, c.emulador.email, SENHA_EMULADOR);
  // Garante as claims (role, profileComplete) no token.
  await auth.currentUser!.getIdToken(true);
  const p: Pessoa = { chave, conta: c, uid: c.emulador.uid, nome: c.nome, app, auth, db, persona };
  pessoas.set(chave, p);
  return p;
}

export function todasAsPessoas(): Pessoa[] {
  return [...pessoas.values()];
}

// ───────────────────────── ações ─────────────────────────

/** Normaliza erro do SDK cliente (`permission-denied`, `functions/...`) e das callables REST. */
export function codigoDoErro(erro: unknown): { codigo: string; msg: string } {
  if (erro instanceof ErroCallable) {
    return { codigo: erro.status.toLowerCase().replace(/_/g, '-'), msg: erro.message };
  }
  const e = erro as { code?: string; message?: string };
  const codigo = (e?.code ?? 'erro').replace(/^(firestore|functions|auth)\//, '');
  return { codigo, msg: String(e?.message ?? erro).slice(0, 400) };
}

const RITMO = /muitas|too many|rate limit|aguarde|tente novamente em/i;

/**
 * Executa uma ação de usuário e registra o resultado.
 * `esperado` é 'ok' ou o código de erro esperado (ex.: 'resource-exhausted').
 * Devolve o resultado quando dá certo, senão `undefined`.
 */
export async function agir<T>(
  p: Pessoa | string,
  acao: string,
  esperado: string,
  executar: () => Promise<T>,
  extra: { alvo?: string; dados?: unknown } = {},
): Promise<T | undefined> {
  const ator = typeof p === 'string' ? p : p.chave;
  const persona = typeof p === 'string' ? undefined : p.persona;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const inicio = Date.now();
    try {
      const resultado = await executar();
      registrarEvento({
        ator, persona, acao, alvo: extra.alvo, esperado, obtido: 'ok', ms: Date.now() - inicio,
        achado: esperado !== 'ok', dados: extra.dados,
      });
      // Sucesso nunca devolve undefined (updateDoc/setDoc resolvem void).
      return (resultado === undefined ? true : resultado) as T;
    } catch (erro) {
      const { codigo, msg } = codigoDoErro(erro);
      const ritmo = codigo === 'resource-exhausted' && RITMO.test(msg);
      if (ritmo && tentativa < 2) {
        registrarEvento({ ator, persona, acao, alvo: extra.alvo, esperado, obtido: codigo, msg, ms: Date.now() - inicio, achado: false, ritmo: true });
        const segundos = Number(/(\d+)\s*s/.exec(msg)?.[1] ?? 30);
        await pausa(Math.min(70, segundos + 5) * 1000);
        continue;
      }
      registrarEvento({
        ator, persona, acao, alvo: extra.alvo, esperado, obtido: codigo, msg, ms: Date.now() - inicio,
        achado: !ritmo && esperado !== codigo, ritmo: ritmo || undefined, dados: extra.dados,
      });
      return undefined;
    }
  }
  return undefined;
}

/** Callable como a pessoa (token do SDK cliente, sempre atualizado). */
export async function chamarComo<T = unknown>(p: Pessoa, funcao: string, dados: unknown): Promise<T> {
  const token = await p.auth.currentUser!.getIdToken();
  return chamar<T>(funcao, token, dados);
}
