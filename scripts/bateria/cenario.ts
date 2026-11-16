/**
 * Bateria de testes — cenário fixo (quadras, grupos e jogos).
 *
 * Os IDs são determinísticos para que web, Android e iOS encontrem os mesmos
 * documentos. O prefixo muda por alvo: `bat-` no emulador e `teste-futeba-`
 * em produção (ver `idsDoAlvo`).
 *
 * Spec: specs/feat-2026-11-15-bateria-de-testes.md
 */

import { PREFIXO_PRODUCAO } from './contas';

export type Alvo = 'emulador' | 'producao';

export interface QuadraTeste {
  chave: string;
  nome: string;
  endereco: string;
  cidade: string;
  lat: number;
  lng: number;
  /** Chave da conta dona (dono01..dono03). */
  dono: string;
  campo: { nome: string; tipo: 'SOCIETY' | 'FUTSAL' | 'CAMPO'; precoHora: number };
}

export interface GrupoTeste {
  chave: string;
  nome: string;
  descricao: string;
  publico: boolean;
  /** Chave da conta dona do grupo. */
  dono: string;
  /** Chaves das contas ADMIN do grupo (além do dono). */
  admins: string[];
  /** Chaves de todos os membros, incluindo o dono. */
  membros: string[];
  /**
   * Membros cujos documentos (`groups/{id}/members/{uid}` e
   * `users/{uid}/groups/{id}`) são gravados no formato LEGADO, com o campo
   * `id` no corpo. É a forma que fechou o app Android em 15/11/2026.
   */
  membrosLegados: string[];
}

export type EstadoJogo = 'SCHEDULED' | 'CONFIRMED' | 'LIVE' | 'FINISHED';

export interface JogoTeste {
  chave: string;
  estado: EstadoJogo;
  grupo: string;
  quadra: string;
  /** Chave da conta dona do jogo (precisa ser dona do grupo). */
  dono: string;
  visibilidade: 'GROUP_ONLY' | 'PUBLIC_OPEN';
  /** Chaves das contas que confirmam presença pela callable real. */
  confirmados: string[];
  /** Escalação dos dois times (só para jogos CONFIRMED em diante). */
  timeA?: string[];
  timeB?: string[];
  /** Deslocamento do início em relação a "agora", em minutos, depois do seed. */
  inicioEmMinutos: number;
  /** Gols lançados pela callable `submitLiveGameEvent`: [autor, assistente?]. */
  gols?: Array<{ autor: string; assistente?: string }>;
  /** Voto de MVP esperado (todas as cédulas votam nesta conta). */
  mvp?: string;
  /**
   * Sem check-in o validador de jogo retém o XP (HELD_FOR_REVIEW) e o jogo
   * entra na fila de revisão do administrador.
   */
  semCheckin?: boolean;
}

const j = (inicio: number, fim: number): string[] =>
  Array.from({ length: fim - inicio + 1 }, (_, i) => `jogador${String(inicio + i).padStart(2, '0')}`);

export const QUADRAS: readonly QuadraTeste[] = [
  {
    chave: 'quadra-01',
    nome: 'Arena Teste 01',
    endereco: 'Rua dos Testes, 101',
    cidade: 'Curitiba',
    lat: -25.4284,
    lng: -49.2733,
    dono: 'dono01',
    campo: { nome: 'Campo Teste A', tipo: 'SOCIETY', precoHora: 200 },
  },
  {
    chave: 'quadra-02',
    nome: 'Arena Teste 02',
    endereco: 'Rua dos Testes, 202',
    cidade: 'Curitiba',
    lat: -25.4411,
    lng: -49.2769,
    dono: 'dono02',
    campo: { nome: 'Quadra Teste B', tipo: 'FUTSAL', precoHora: 150 },
  },
  {
    chave: 'quadra-03',
    nome: 'Arena Teste 03',
    endereco: 'Rua dos Testes, 303',
    cidade: 'Curitiba',
    lat: -25.4500,
    lng: -49.2300,
    dono: 'dono03',
    campo: { nome: 'Campo Teste C', tipo: 'SOCIETY', precoHora: 250 },
  },
];

export const GRUPOS: readonly GrupoTeste[] = [
  {
    chave: 'grupo-alfa',
    nome: 'Pelada Teste Alfa',
    descricao: 'Grupo público da bateria de testes. Dono: Teste 01.',
    publico: true,
    dono: 'jogador01',
    admins: ['jogador02'],
    membros: j(1, 12),
    membrosLegados: ['jogador01', 'jogador02', 'jogador03'],
  },
  {
    chave: 'grupo-beta',
    nome: 'Pelada Teste Beta',
    descricao: 'Grupo privado da bateria de testes. Dono: Teste 11.',
    publico: false,
    dono: 'jogador11',
    admins: [],
    membros: [...j(11, 19), 'dono01'],
    membrosLegados: ['jogador11', 'jogador12'],
  },
  {
    chave: 'grupo-aberto',
    nome: 'Pelada Teste Aberta',
    descricao: 'Grupo público com vaga: a conta Teste 20 encontra e entra por aqui.',
    publico: true,
    dono: 'jogador03',
    admins: [],
    membros: j(3, 6),
    membrosLegados: [],
  },
];

const TIME_A = ['jogador01', 'jogador02', 'jogador03', 'jogador04', 'jogador05'];
const TIME_B = ['jogador06', 'jogador07', 'jogador08', 'jogador09', 'jogador10'];
const TIME_C = ['jogador11', 'jogador12', 'jogador13', 'jogador14'];
const TIME_D = ['jogador15', 'jogador16', 'jogador17', 'jogador18'];

export const JOGOS: readonly JogoTeste[] = [
  {
    chave: 'jogo-agendado',
    estado: 'SCHEDULED',
    grupo: 'grupo-alfa',
    quadra: 'quadra-01',
    dono: 'jogador01',
    visibilidade: 'GROUP_ONLY',
    confirmados: ['jogador01', 'jogador02', 'jogador03'],
    inicioEmMinutos: 3 * 24 * 60,
  },
  {
    chave: 'jogo-confirmado',
    estado: 'CONFIRMED',
    grupo: 'grupo-alfa',
    quadra: 'quadra-01',
    dono: 'jogador01',
    visibilidade: 'GROUP_ONLY',
    confirmados: [...TIME_A, ...TIME_B],
    inicioEmMinutos: 24 * 60,
  },
  {
    chave: 'jogo-ao-vivo',
    estado: 'LIVE',
    grupo: 'grupo-alfa',
    quadra: 'quadra-02',
    dono: 'jogador01',
    visibilidade: 'GROUP_ONLY',
    confirmados: [...TIME_A, ...TIME_B],
    inicioEmMinutos: -20,
    gols: [{ autor: 'jogador02', assistente: 'jogador03' }, { autor: 'jogador07' }],
  },
  {
    chave: 'jogo-finalizado',
    estado: 'FINISHED',
    grupo: 'grupo-alfa',
    quadra: 'quadra-03',
    dono: 'jogador01',
    visibilidade: 'GROUP_ONLY',
    confirmados: [...TIME_A, ...TIME_B],
    // Janela [-150, -90] min: não encosta na do jogo ao vivo (o detector de
    // sobreposição usa 30 min de folga de cada lado).
    inicioEmMinutos: -150,
    gols: [
      { autor: 'jogador02', assistente: 'jogador03' },
      { autor: 'jogador02' },
      { autor: 'jogador04', assistente: 'jogador02' },
      { autor: 'jogador07' },
    ],
    mvp: 'jogador02',
  },
  {
    chave: 'jogo-retido',
    estado: 'FINISHED',
    grupo: 'grupo-beta',
    quadra: 'quadra-01',
    dono: 'jogador11',
    visibilidade: 'GROUP_ONLY',
    confirmados: [...TIME_C, ...TIME_D],
    timeA: TIME_C,
    timeB: TIME_D,
    // Começou há 5 minutos e foi encerrado em seguida: sem check-in e curto
    // demais, o validador retém o XP (REVIEW_REQUIRED). Usa outros jogadores
    // para não sobrepor o jogo ao vivo.
    inicioEmMinutos: -5,
    gols: [{ autor: 'jogador16' }],
    semCheckin: true,
  },
  {
    chave: 'jogo-publico',
    estado: 'SCHEDULED',
    grupo: 'grupo-aberto',
    quadra: 'quadra-02',
    dono: 'jogador03',
    visibilidade: 'PUBLIC_OPEN',
    confirmados: ['jogador03', 'jogador04'],
    inicioEmMinutos: 2 * 24 * 60,
  },
];

/** Escalação de um jogo: a própria, ou a padrão (jogadores 01-05 contra 06-10). */
export function timesDoJogo(jogo: JogoTeste): { timeA: string[]; timeB: string[] } {
  return { timeA: jogo.timeA ?? TIME_A, timeB: jogo.timeB ?? TIME_B };
}

/** Convite fixo do grupo privado, usado no fluxo "entrar por convite". */
export const CONVITE_GRUPO_BETA = 'BATBETA1';

/** Resolve o ID de documento de uma chave do cenário para o alvo escolhido. */
export function idsDoAlvo(alvo: Alvo): (chave: string) => string {
  const prefixo = alvo === 'emulador' ? 'bat' : PREFIXO_PRODUCAO;
  return (chave: string) => `${prefixo}-${chave}`;
}
