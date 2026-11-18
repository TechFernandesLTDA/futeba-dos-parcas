/**
 * Bateria — visão do dono de quadra e do administrador.
 */
import { expect, test } from '@playwright/test';
import { CONTAS, quadra, semErros, sessao } from './apoio';

test.describe('dono de quadra', () => {
  test('painel do proprietário mostra a quadra dele', async ({ browser }) => {
    const arena = quadra('quadra-01');
    const { contexto, page, vigia } = await sessao(browser, 'dono01');
    await page.goto('/owner');
    await expect(page).toHaveURL(/\/owner\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard do Proprietário' })).toBeVisible();
    await expect(page.getByRole('heading', { name: arena.nome })).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });

  test('dono gerencia só a própria quadra', async ({ browser }) => {
    const { contexto, page, vigia } = await sessao(browser, 'dono02');
    await page.goto('/locations');
    await expect(page.getByRole('heading', { name: 'Gerenciar Locais' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Editar ${quadra('quadra-02').nome}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Editar ${quadra('quadra-01').nome}` })).toHaveCount(0);
    semErros(vigia);
    await contexto.close();
  });

  test('jogador comum não abre o painel do proprietário', async ({ browser }) => {
    const { contexto, page } = await sessao(browser, 'jogador02');
    await page.goto('/owner/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard do Proprietário' })).toHaveCount(0);
    await contexto.close();
  });
});

test.describe('administrador', () => {
  test('lista as contas do seed', async ({ browser }) => {
    const { contexto, page, vigia } = await sessao(browser, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Gerenciar Usuários' })).toBeVisible();
    const resumo = page.getByText(/\d+ de \d+ usuários exibidos/);
    await expect(resumo).toBeVisible();
    // O seed tem 24 contas; os testes de primeiro acesso criam outras.
    expect(Number((await resumo.innerText()).match(/de (\d+) usuários/)?.[1])).toBeGreaterThanOrEqual(CONTAS.length);
    await page.getByRole('textbox', { name: 'Buscar usuário...' }).fill('dono01');
    await expect(page.getByRole('cell', { name: 'FIELD_OWNER' }).first()).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });

  test('jogador comum não abre a administração', async ({ browser }) => {
    const { contexto, page } = await sessao(browser, 'jogador02');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Gerenciar Usuários' })).toHaveCount(0);
    await contexto.close();
  });

  test('fila de revisão mostra o jogo com XP retido', async ({ browser }) => {
    // Regressão #4571: a regra de list de `games` negava a consulta do admin
    // (isAdmin() ficava depois de um ramo que dava erro de avaliação).
    const { contexto, page } = await sessao(browser, 'admin');
    await page.goto('/admin/game-reviews');
    await expect(page.getByRole('heading', { name: 'Revisão de jogos' })).toBeVisible();
    await expect(page.getByText('Não foi possível carregar a fila de revisão.')).toHaveCount(0, {
      timeout: 8_000,
    });
    await expect(page.getByText('Arena Teste 01').first()).toBeVisible({ timeout: 8_000 });
    await contexto.close();
  });
});
