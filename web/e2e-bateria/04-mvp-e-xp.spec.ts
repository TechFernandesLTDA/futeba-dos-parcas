/**
 * Bateria — MVP e XP: resultado da votação, XP processado pelos gatilhos
 * reais e XP retido pelo portão de validação.
 */
import { expect, test } from '@playwright/test';
import { conta, id, lerDocumento, semErros, sessao } from './apoio';

test.describe('MVP e XP', () => {
  test('resultado da votação mostra placar e MVP do jogo finalizado', async ({ browser }) => {
    const { contexto, page, vigia } = await sessao(browser, 'jogador03');
    await page.goto(`/game/${id('jogo-finalizado')}/results`);
    await expect(page.getByRole('heading', { level: 1, name: 'Resultado da Votação' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Teste 02 Jogador' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/3\s*Time A\s*X\s*1\s*Time B/);
    semErros(vigia);
    await contexto.close();
  });

  test('votação já encerrada leva ao resultado', async ({ browser }) => {
    const { contexto, page } = await sessao(browser, 'jogador03');
    await page.goto(`/game/${id('jogo-finalizado')}/vote`);
    await expect(page.getByText('A votação foi encerrada e o resultado já está disponível.')).toBeVisible();
    await page.getByRole('button', { name: 'Ver resultados' }).click();
    await expect(page).toHaveURL(/\/results$/);
    await contexto.close();
  });

  test('MVP recebe XP, sobe de nível e o perfil mostra', async ({ browser }) => {
    const mvp = conta('jogador02');
    const perfil = await lerDocumento(`users/${mvp.emulador.uid}`);
    // 2 gols, vitória, participação e MVP no jogo finalizado do seed.
    expect(Number(perfil?.experience_points)).toBeGreaterThanOrEqual(200);

    const { contexto, page, vigia } = await sessao(browser, 'jogador02');
    await page.goto('/?tab=4');
    await expect(page.getByRole('heading', { name: mvp.nome })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nível [2-9]/ })).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });

  test('jogo sem check-in fica com o XP retido para revisão', async () => {
    const retido = await lerDocumento(`games/${id('jogo-retido')}`);
    expect(retido?.status).toBe('FINISHED');
    expect(retido?.xp_reward_status).toBe('HELD_FOR_REVIEW');
    // Quem fez o gol do jogo retido não recebeu XP.
    const artilheiro = await lerDocumento(`users/${conta('jogador16').emulador.uid}`);
    expect(Number(artilheiro?.experience_points ?? 0)).toBe(0);
  });
});
