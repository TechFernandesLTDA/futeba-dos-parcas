/**
 * Bateria de testes — lista canônica das contas fictícias.
 *
 * 20 jogadores, 3 donos de quadra e 1 administrador. A mesma lista alimenta:
 *   - o seed do Firebase Emulator Suite (scripts/bateria/seed-emulador.ts);
 *   - o script de produção (scripts/bateria/contas-producao.ts);
 *   - os testes de web (Playwright), Android (instrumentado) e iOS (roteiro).
 *
 * Aqui só há nomes, e-mails e identificadores. A senha do emulador é pública de
 * propósito (o emulador não guarda dado real). A senha de produção NUNCA entra
 * no git: fica em ~/.config/futeba/contas-teste.env (0600).
 *
 * Spec: specs/feat-2026-11-15-bateria-de-testes.md
 */

export type Papel = 'PLAYER' | 'FIELD_OWNER' | 'ADMIN';

export type Posicao = 'GOALKEEPER' | 'FIELD';

export interface ContaTeste {
  /** Número sequencial de 1 a 24, estável entre emulador e produção. */
  n: number;
  /** Chave legível usada nos testes: jogador01..jogador20, dono01..dono03, admin. */
  chave: string;
  papel: Papel;
  /** Nome de exibição. Deixa claro que é conta de teste. */
  nome: string;
  apelido: string;
  /** Posição usada nas confirmações de presença. */
  posicao: Posicao;
  emulador: {
    uid: string;
    email: string;
    /** Telefone BR fictício: a claim profileComplete exige telefone no Auth. */
    telefone: string;
  };
  producao: {
    uid: string;
    email: string;
  };
}

/** Senha de todas as contas no EMULADOR. Não é usada em produção. */
export const SENHA_EMULADOR = 'Bateria#2026';

/** Marca gravada em todo documento criado pela bateria (emulador e produção). */
export const MARCA_TESTE = {
  isTestData: true,
  seed_id: 'bateria_2026_11',
} as const;

/** Prefixo dos UIDs e IDs de documento criados em produção. */
export const PREFIXO_PRODUCAO = 'teste-futeba';

/** Arquivo local com as senhas de produção (fora do git). */
export const ARQUIVO_SENHAS_PRODUCAO = '~/.config/futeba/contas-teste.env';

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

function montarConta(
  n: number,
  chave: string,
  papel: Papel,
  rotulo: string,
  posicao: Posicao,
): ContaTeste {
  const nn = doisDigitos(n);
  return {
    n,
    chave,
    papel,
    nome: `Teste ${nn} ${rotulo}`,
    apelido: `Teste ${nn}`,
    posicao,
    emulador: {
      uid: `bat-${chave}`,
      email: `${chave}@bateria.futeba.test`,
      telefone: `+55119${String(10000000 + n).padStart(8, '0')}`,
    },
    producao: {
      uid: `${PREFIXO_PRODUCAO}-${nn}`,
      email: `techfernandesltda+futeba-teste-${nn}@gmail.com`,
    },
  };
}

function montarContas(): ContaTeste[] {
  const contas: ContaTeste[] = [];
  for (let i = 1; i <= 20; i++) {
    // Jogadores 01 e 06 são goleiros: cada jogo da bateria tem um goleiro por time.
    const posicao: Posicao = i === 1 || i === 6 ? 'GOALKEEPER' : 'FIELD';
    contas.push(montarConta(i, `jogador${doisDigitos(i)}`, 'PLAYER', 'Jogador', posicao));
  }
  for (let i = 1; i <= 3; i++) {
    contas.push(montarConta(20 + i, `dono${doisDigitos(i)}`, 'FIELD_OWNER', 'Dono de Quadra', 'FIELD'));
  }
  contas.push(montarConta(24, 'admin', 'ADMIN', 'Administrador', 'FIELD'));
  return contas;
}

export const CONTAS: readonly ContaTeste[] = montarContas();

export function conta(chave: string): ContaTeste {
  const achada = CONTAS.find((c) => c.chave === chave);
  if (!achada) throw new Error(`[bateria] conta desconhecida: ${chave}`);
  return achada;
}

export const JOGADORES: readonly ContaTeste[] = CONTAS.filter((c) => c.papel === 'PLAYER');
export const DONOS: readonly ContaTeste[] = CONTAS.filter((c) => c.papel === 'FIELD_OWNER');
export const ADMIN: ContaTeste = conta('admin');
