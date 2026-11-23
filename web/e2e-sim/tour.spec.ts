import { test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessao } from '../e2e-bateria/apoio';

/**
 * Percorre as telas principais como pessoas da simulação e guarda captura,
 * texto visível e erros de console de cada uma. Não altera dados.
 * SIM_IDS aponta para o `<saida>.ids.json` que o simulador grava no fim.
 */
const ids = JSON.parse(readFileSync(process.env.SIM_IDS!, 'utf8')) as { grupos: Record<string, string>; jogos: string[]; jogoDoGrupo: Record<string, string> };
const SAIDA = process.env.SIM_TOUR_SAIDA!;

const PESSOAS: { chave: string; papel: string; grupo: string }[] = [
  { chave: 'jogador02', papel: 'organizador da Pelada de Quinta', grupo: 'quinta' },
  { chave: 'jogador05', papel: 'jogador furão em 3 grupos', grupo: 'quinta' },
  { chave: 'jogador11', papel: 'novato que entrou por pedido', grupo: 'sabado' },
];

for (const pessoa of PESSOAS) {
  test(`tour ${pessoa.chave}`, async ({ browser }) => {
    const pasta = join(SAIDA, pessoa.chave);
    mkdirSync(pasta, { recursive: true });
    const { page, contexto, vigia } = await sessao(browser, pessoa.chave);
    // Além do vigia (permission-denied), guarda todo erro de console e resposta HTTP >= 400.
    page.on('console', (m) => { if (m.type() === 'error') vigia.erros.push(`console-erro: ${m.text().slice(0, 300)}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !/googleapis|google\.com/.test(r.url())) vigia.erros.push(`http ${r.status()}: ${r.url().slice(0, 200)}`); });
    const gid = ids.grupos[pessoa.grupo];
    const jogo = ids.jogoDoGrupo[pessoa.grupo] ?? ids.jogos[ids.jogos.length - 1];
    const telas: [string, string][] = [
      ['inicio', '/'], ['jogos', '/?tab=1'], ['grupos', '/?tab=2'], ['ranking', '/?tab=3'], ['perfil', '/?tab=4'],
      ['grupo', `/group/${gid}`], ['grupo-caixa', `/group/${gid}/cashbox`], ['grupo-liga', `/group/${gid}/league`],
      ['grupo-jogadores', `/group/${gid}/players`], ['jogo-finalizado', `/game/${jogo}`],
      ['estatisticas', '/statistics'], ['evolucao', '/evolution'], ['badges', '/badges'], ['liga', '/league'],
      ['resumo-semana', '/weekly-recap'], ['feed', '/feed'], ['jogos-publicos', '/public-games'],
    ];
    const resumo: unknown[] = [];
    for (const [nome, rota] of telas) {
      const antes = vigia.erros.length;
      await page.goto(rota);
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(pasta, `${nome}.png`), fullPage: true });
      const texto = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000);
      writeFileSync(join(pasta, `${nome}.txt`), texto);
      resumo.push({ nome, rota, url: page.url(), erros: vigia.erros.slice(antes) });
    }
    writeFileSync(join(pasta, 'resumo.json'), JSON.stringify({ pessoa, resumo }, null, 2));
    await contexto.close();
  });
}
