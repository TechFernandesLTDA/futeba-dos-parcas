/**
 * Bateria — jogos: presença, estados, jogo ao vivo e finalização.
 *
 * Os testes mudam o seed (confirmam presença, finalizam o jogo ao vivo), por
 * isso rodam em série e a bateria sempre parte de um seed novo.
 */
import { expect, test } from '@playwright/test';
import { esperarDocumento, id, jogo, quadra, semErros, sessao } from './apoio';

test.describe.configure({ mode: 'serial' });

test.describe('jogos', () => {
  test('membro confirma presença em jogo agendado', async ({ browser }) => {
    const agendado = jogo('jogo-agendado');
    const { contexto, page, conta, vigia } = await sessao(browser, 'jogador05');
    await page.goto(`/game/${id(agendado.chave)}`);
    await page.getByRole('button', { name: 'Confirmar Presença' }).click();
    await page.getByRole('dialog', { name: 'Escolha sua posição' }).getByRole('button', { name: 'Jogador de Linha' }).click();
    await expect(page.getByRole('button', { name: 'Cancelar Presença' })).toBeVisible();
    const confirmacao = await esperarDocumento(
      `confirmations/${id(agendado.chave)}_${conta.emulador.uid}`,
      (d) => d?.status === 'CONFIRMED',
    );
    expect(confirmacao?.game_id).toBe(id(agendado.chave));
    await expect(page.getByRole('heading', { name: `${agendado.confirmados.length + 1}/12` })).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });

  test('membro que ainda não confirmou vê quem já confirmou', async ({ browser }) => {
    // Regressão #4573: as regras só deixavam listar confirmações para dono do
    // jogo, admin e quem já tinha confirmado; o membro via 4/12 e lista vazia.
    const { contexto, page } = await sessao(browser, 'jogador08');
    await page.goto(`/game/${id('jogo-agendado')}`);
    await expect(page.getByRole('button', { name: 'Confirmar Presença' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Teste 01 Jogador' })).toBeVisible({ timeout: 8_000 });
    await contexto.close();
  });

  test('dono do jogo vê o jogo em cada estado', async ({ browser }) => {
    const { contexto, page, vigia } = await sessao(browser, 'jogador01');
    for (const [chave, rotulo] of [
      ['jogo-agendado', 'Aberto'],
      ['jogo-confirmado', 'Confirmado'],
      ['jogo-finalizado', 'Finalizado'],
    ] as const) {
      await page.goto(`/game/${id(chave)}`);
      await expect(page.getByRole('heading', { level: 1, name: quadra(jogo(chave).quadra).nome })).toBeVisible();
      await expect(page.locator('main').getByText(rotulo, { exact: false }).first()).toBeVisible();
    }
    // Jogo finalizado com XP já processado pelo gatilho real.
    await expect(page.getByText('Recompensas processadas')).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });

  test('aba Jogos lista o jogo público, que não tem o campo deleted_at', async ({ browser }) => {
    // Regressão #4572: a consulta filtrava `deleted_at == null` e nenhum
    // escritor grava esse campo, então a aba ficava vazia para todo mundo.
    // A aba lista os jogos públicos; os do grupo aparecem na tela do grupo.
    const { contexto, page } = await sessao(browser, 'jogador01');
    await page.goto('/?tab=1');
    await expect(page.getByRole('heading', { name: 'Jogos' })).toBeVisible();
    await expect(page.getByText(quadra(jogo('jogo-publico').quadra).nome).first()).toBeVisible({ timeout: 8_000 });
    await contexto.close();
  });

  test('dono registra gol no jogo ao vivo e finaliza', async ({ browser }) => {
    const aoVivo = jogo('jogo-ao-vivo');
    const { contexto, page, vigia } = await sessao(browser, 'jogador01');
    await page.goto(`/game/${id(aoVivo.chave)}/live`);
    const placar = page.getByRole('group', { name: 'Placar do jogo ao vivo' });
    await expect(placar).toContainText('Time Azul 1, Time Laranja 1');

    await page.getByRole('button', { name: 'Adicionar Evento' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Adicionar Evento' });
    await dialogo.getByRole('combobox', { name: 'Jogadores' }).click();
    await page.getByRole('option', { name: /Teste 08 Jogador/ }).click();
    await dialogo.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(placar).toContainText('Time Azul 1, Time Laranja 2');

    await page.getByRole('button', { name: 'Finalizar Jogo' }).click();
    await page.getByRole('dialog', { name: 'Finalizar Jogo' }).getByRole('button', { name: 'Finalizar' }).click();
    const finalizado = await esperarDocumento(`games/${id(aoVivo.chave)}`, (d) => d?.status === 'FINISHED');
    expect(finalizado?.team2_score).toBe('2');
    semErros(vigia);
    await contexto.close();
  });

  test('jogador vota no MVP do jogo recém-finalizado', async ({ browser }) => {
    const { contexto, page, vigia } = await sessao(browser, 'jogador02');
    await page.goto(`/game/${id('jogo-ao-vivo')}/vote`);
    await expect(page.getByRole('heading', { level: 1, name: 'Votação MVP' })).toBeVisible();
    await page.getByRole('group', { name: 'Melhor Jogador (MVP)' }).getByRole('radio', { name: 'Teste 08 Jogador' }).check();
    await page.getByRole('group', { name: 'Melhor Goleiro' }).getByRole('radio', { name: 'Teste 06 Jogador' }).check();
    await page.getByRole('group', { name: 'Bola Murcha' }).getByRole('radio', { name: 'Teste 09 Jogador' }).check();
    await page.getByRole('button', { name: 'Enviar Voto' }).click();
    await expect(page.getByText('Voto Registrado!')).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });
});
