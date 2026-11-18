/**
 * Bateria de testes — conferência rápida (sem emulador, roda no pre-push).
 *
 * Garante que as peças da bateria continuam coerentes entre si. Leva menos de
 * dois segundos. O que ela pega:
 *   - lista de contas fora do combinado (20 jogadores, 3 donos, 1 admin; nomes
 *     e e-mails que deixam claro que são de teste; nada repetido);
 *   - cenário apontando para conta, grupo ou quadra que não existe, ou sem
 *     jogo em algum estado, ou sem os documentos legados com `id` gravado;
 *   - portas da bateria colidindo com as do CI, ou `firebase.bateria.json`
 *     divergindo de `portas.ts`;
 *   - constantes do Android (AmbienteBateria.kt) divergindo das contas;
 *   - teste marcado como falha esperada sem issue de verdade.
 *
 * Uso: scripts/bateria/rodar.sh rapida
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CONTAS, DONOS, JOGADORES, MARCA_TESTE, SENHA_EMULADOR } from './contas';
import { GRUPOS, JOGOS, QUADRAS, timesDoJogo } from './cenario';
import { PORTAS, PORTAS_PADRAO_DO_CI } from './portas';

const RAIZ = join(__dirname, '..', '..');
const falhas: string[] = [];
const exigir = (condicao: boolean, mensagem: string): void => {
  if (!condicao) falhas.push(mensagem);
};
const ler = (caminho: string): string => readFileSync(join(RAIZ, caminho), 'utf8');
const unicos = (valores: string[]): boolean => new Set(valores).size === valores.length;

// ── Contas ─────────────────────────────────────────────────────────────────
exigir(JOGADORES.length === 20, `esperados 20 jogadores, há ${JOGADORES.length}`);
exigir(DONOS.length === 3, `esperados 3 donos de quadra, há ${DONOS.length}`);
exigir(CONTAS.filter((c) => c.papel === 'ADMIN').length === 1, 'esperado exatamente 1 administrador');
exigir(CONTAS.length === 24, `esperadas 24 contas, há ${CONTAS.length}`);
exigir(unicos(CONTAS.map((c) => c.chave)), 'chave de conta repetida');
exigir(unicos(CONTAS.map((c) => c.emulador.uid)), 'uid de emulador repetido');
exigir(unicos(CONTAS.map((c) => c.emulador.email)), 'e-mail de emulador repetido');
exigir(unicos(CONTAS.map((c) => c.emulador.telefone)), 'telefone de emulador repetido');
exigir(unicos(CONTAS.map((c) => c.producao.uid)), 'uid de produção repetido');
exigir(unicos(CONTAS.map((c) => c.producao.email)), 'e-mail de produção repetido');
for (const c of CONTAS) {
  exigir(c.nome.startsWith('Teste '), `${c.chave}: nome não começa com "Teste"`);
  exigir(c.emulador.email.endsWith('@bateria.futeba.test'), `${c.chave}: e-mail de emulador fora do domínio .test`);
  exigir(
    /^techfernandesltda\+futeba-teste-\d{2}@gmail\.com$/.test(c.producao.email),
    `${c.chave}: e-mail de produção fora do padrão de teste`,
  );
  exigir(/^teste-futeba-\d{2}$/.test(c.producao.uid), `${c.chave}: uid de produção fora do padrão`);
  exigir(!c.producao.email.includes('revisor'), `${c.chave}: e-mail da conta de revisor não pode entrar na lista`);
}
exigir(MARCA_TESTE.isTestData === true, 'MARCA_TESTE precisa ter isTestData: true');

// ── Cenário ────────────────────────────────────────────────────────────────
const chaves = new Set(CONTAS.map((c) => c.chave));
const grupos = new Set(GRUPOS.map((g) => g.chave));
const quadras = new Set(QUADRAS.map((q) => q.chave));
for (const q of QUADRAS) exigir(chaves.has(q.dono), `quadra ${q.chave}: dono inexistente`);
for (const g of GRUPOS) {
  exigir(g.membros.includes(g.dono), `grupo ${g.chave}: dono fora dos membros`);
  for (const m of [...g.membros, ...g.admins, ...g.membrosLegados]) {
    exigir(chaves.has(m), `grupo ${g.chave}: conta inexistente ${m}`);
  }
  for (const m of g.membrosLegados) exigir(g.membros.includes(m), `grupo ${g.chave}: legado ${m} não é membro`);
}
exigir(
  GRUPOS.some((g) => g.membrosLegados.length > 0),
  'nenhum grupo com documentos legados (campo id gravado): a regressão de 15/11/2026 ficaria sem cobertura',
);
for (const j of JOGOS) {
  exigir(grupos.has(j.grupo), `jogo ${j.chave}: grupo inexistente`);
  exigir(quadras.has(j.quadra), `jogo ${j.chave}: quadra inexistente`);
  const grupo = GRUPOS.find((g) => g.chave === j.grupo);
  for (const c of j.confirmados) {
    exigir(grupo?.membros.includes(c) ?? false, `jogo ${j.chave}: confirmado ${c} não é membro do grupo`);
  }
  if (j.estado === 'LIVE' || j.estado === 'FINISHED') {
    const { timeA, timeB } = timesDoJogo(j);
    for (const gol of j.gols ?? []) {
      exigir([...timeA, ...timeB].includes(gol.autor), `jogo ${j.chave}: gol de quem não está em campo`);
    }
  }
}
for (const estado of ['SCHEDULED', 'CONFIRMED', 'LIVE', 'FINISHED'] as const) {
  exigir(JOGOS.some((j) => j.estado === estado), `nenhum jogo no estado ${estado}`);
}
exigir(JOGOS.some((j) => j.estado === 'FINISHED' && j.mvp), 'nenhum jogo finalizado com MVP');
exigir(JOGOS.some((j) => j.semCheckin), 'nenhum jogo com XP retido para a fila do admin');

// ── Portas ─────────────────────────────────────────────────────────────────
const emuladores = JSON.parse(ler('firebase.bateria.json')).emulators as Record<string, { port?: number; enabled?: boolean }>;
for (const servico of ['auth', 'firestore', 'functions', 'storage', 'hub', 'logging'] as const) {
  exigir(emuladores[servico]?.port === PORTAS[servico], `firebase.bateria.json: porta de ${servico} diverge de portas.ts`);
}
exigir(emuladores.ui?.enabled === false, 'firebase.bateria.json: a UI do emulador deve ficar desligada');
for (const porta of Object.values(PORTAS)) {
  exigir(!(PORTAS_PADRAO_DO_CI as readonly number[]).includes(porta), `porta ${porta} é padrão do CI: use outra`);
}
const padrao = JSON.parse(ler('firebase.json')).emulators as Record<string, { port?: number }>;
for (const servico of ['auth', 'firestore', 'functions', 'storage'] as const) {
  exigir(padrao[servico]?.port !== PORTAS[servico], `firebase.json e a bateria usam a mesma porta de ${servico}`);
}
const regrasBateria = JSON.parse(ler('firebase.bateria.json'));
const regrasPadrao = JSON.parse(ler('firebase.json'));
exigir(
  JSON.stringify(regrasBateria.firestore) === JSON.stringify(regrasPadrao.firestore) &&
    JSON.stringify(regrasBateria.storage) === JSON.stringify(regrasPadrao.storage),
  'firebase.bateria.json precisa usar as mesmas regras e índices do firebase.json',
);

// ── Android ────────────────────────────────────────────────────────────────
const ambiente = ler('app/src/androidTest/java/com/futebadosparcas/bateria/AmbienteBateria.kt');
exigir(ambiente.includes(`"${SENHA_EMULADOR}"`), 'AmbienteBateria.kt: senha do emulador diverge de contas.ts');
exigir(ambiente.includes('"bateria.futeba.test"'), 'AmbienteBateria.kt: domínio de e-mail diverge');
exigir(ambiente.includes('"bat-"'), 'AmbienteBateria.kt: prefixo de id diverge');
for (const [nome, porta] of [
  ['portaAuth', PORTAS.auth],
  ['portaFirestore', PORTAS.firestore],
  ['portaFunctions', PORTAS.functions],
  ['portaStorage', PORTAS.storage],
] as const) {
  exigir(new RegExp(`var ${nome}: Int = ${porta}\\b`).test(ambiente), `AmbienteBateria.kt: ${nome} diverge de portas.ts`);
}
const alfa = GRUPOS.find((g) => g.chave === 'grupo-alfa');
exigir(
  ambiente.includes(`MEMBROS_GRUPO_ALFA = ${alfa?.membros.length}`),
  'AmbienteBateria.kt: número de membros do grupo alfa diverge',
);
for (const legado of alfa?.membrosLegados ?? []) {
  exigir(ambiente.includes(`"${legado}"`), `AmbienteBateria.kt: legado ${legado} ausente`);
}

// ── Falhas esperadas precisam de issue ─────────────────────────────────────
const pendencias = ler('web/e2e-bateria/pendencias.ts');
exigir(!/issues\/0\b/.test(pendencias), 'pendencias.ts: falha esperada sem número de issue');
const pendenciasAndroid = ler('app/src/androidTest/java/com/futebadosparcas/bateria/PendenciasBateria.kt');
exigir(!/ISSUES\/0\b/.test(pendenciasAndroid), 'PendenciasBateria.kt: falha esperada sem número de issue');
exigir(!ler('app/build.gradle.kts').includes('BATERIA_ISSUE_'), 'app/build.gradle.kts: exclusão do androidTest sem issue');
const specs = readdirSync(join(RAIZ, 'web/e2e-bateria')).filter((f) => f.endsWith('.spec.ts'));
for (const spec of specs) {
  const texto = ler(`web/e2e-bateria/${spec}`);
  exigir(!/^_/.test(spec), `web/e2e-bateria/${spec}: spec de exploração não pode ser versionado`);
  exigir(!/test\.only\(|describe\.only\(/.test(texto), `web/e2e-bateria/${spec}: test.only esquecido`);
  for (const uso of texto.match(/test\.fail\([^)]*\)/g) ?? []) {
    exigir(uso.includes('PENDENCIAS.'), `web/e2e-bateria/${spec}: test.fail sem PENDENCIAS (${uso})`);
  }
}

if (falhas.length > 0) {
  console.error(`[bateria] conferência rápida: ${falhas.length} problema(s)`);
  for (const falha of falhas) console.error(`  - ${falha}`);
  process.exit(1);
}
console.log(`[bateria] conferência rápida OK: ${CONTAS.length} contas, ${GRUPOS.length} grupos, ${QUADRAS.length} quadras, ${JOGOS.length} jogos, ${specs.length} specs web.`);
