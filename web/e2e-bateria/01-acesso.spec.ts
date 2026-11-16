/**
 * Bateria — acesso: login das 24 contas, senha errada e primeiro acesso.
 */
import { expect, test } from '@playwright/test';
import {
  CONTAS,
  SENHA_EMULADOR,
  criarContaNova,
  esperarDocumento,
  preencherLogin,
  pularGuia,
  semAvisos,
  semErros,
  sessao,
  vigiarErros,
} from './apoio';

test.describe('acesso', () => {
  test('as 24 contas entram pela tela de login', async ({ browser }) => {
    test.setTimeout(8 * 60_000);
    for (const c of CONTAS) {
      await test.step(`${c.chave} (${c.papel})`, async () => {
        const { contexto, page, vigia } = await sessao(browser, c.chave);
        await expect(page).not.toHaveURL(/\/login/);
        // O menu mostra o nome da conta: prova de que o perfil foi lido.
        await expect(page.getByRole('button', { name: new RegExp(`^${c.nome}`) })).toBeVisible();
        semErros(vigia);
        await contexto.close();
      });
    }
  });

  test('senha errada não entra e mostra erro', async ({ page }) => {
    await preencherLogin(page, CONTAS[0].emulador.email, 'senha-errada-123');
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  /**
   * Regressão de 15/11/2026 (PR #4563): no primeiro acesso o perfil é criado
   * pelo gatilho `onUserCreate`. O cliente não pode depender de gravar
   * `users/{uid}` (as regras negam) nem quebrar enquanto o documento não chega.
   */
  test('primeiro acesso de conta nova não gera PERMISSION_DENIED', async ({ browser }) => {
    const email = `novo-${Date.now()}@bateria.futeba.test`;
    const uid = await criarContaNova(email, SENHA_EMULADOR);
    const perfil = await esperarDocumento(`users/${uid}`, (d) => d !== null);
    expect(perfil?.email).toBe(email);

    const contexto = await browser.newContext();
    const page = await contexto.newPage();
    const vigia = vigiarErros(page);
    await preencherLogin(page, email, SENHA_EMULADOR);
    await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 20_000 });
    await page.waitForTimeout(3_000);
    // Conta sem verificação cai no fluxo de cadastro, nunca em tela em branco.
    await expect(page.locator('body')).toContainText(/\S{3,}/);
    semErros(vigia);
    await contexto.close();
  });

  test('conta do seed vê o guia no primeiro acesso e chega à home ao pular', async ({ browser }) => {
    const contexto = await browser.newContext();
    const page = await contexto.newPage();
    const vigia = vigiarErros(page);
    const c = CONTAS.find((x) => x.chave === 'jogador18')!;
    await preencherLogin(page, c.emulador.email, SENHA_EMULADOR);
    await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 20_000 });
    await pularGuia(page);
    await semAvisos(contexto);
    await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });
});
