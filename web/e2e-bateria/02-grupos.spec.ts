/**
 * Bateria — grupos: documentos legados, entrar por convite, pedir entrada e
 * criar grupo.
 */
import { expect, test } from '@playwright/test';
import { esperarDocumento, grupo, id, semErros, sessao } from './apoio';

test.describe('grupos', () => {
  /**
   * Regressão de 15/11/2026 (PR #4566): o seed grava o campo `id` dentro de
   * `users/{uid}/groups/*` e `groups/{id}/members/*` de algumas contas, como
   * os documentos antigos de produção. Ler esses documentos não pode quebrar.
   */
  test('grupo com documentos legados (campo id gravado) abre com os membros', async ({ browser }) => {
    const alfa = grupo('grupo-alfa');
    const { contexto, page, vigia } = await sessao(browser, 'jogador01');
    await page.goto('/?tab=2');
    await expect(page.getByText(alfa.nome).first()).toBeVisible();
    await page.goto(`/group/${id(alfa.chave)}`);
    await expect(page.getByRole('heading', { level: 1, name: alfa.nome })).toBeVisible();
    await page.getByRole('tab', { name: 'Membros' }).click();
    const painel = page.getByRole('tabpanel', { name: 'Membros' });
    await expect(painel.getByText(`${alfa.membros.length} membros`)).toBeVisible();
    // jogador02 e jogador03 têm documento de membro legado.
    await expect(painel.getByRole('heading', { name: 'Teste 02 Jogador' })).toBeVisible();
    await expect(painel.getByRole('heading', { name: 'Teste 03 Jogador' })).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });

  test('jogador entra em grupo privado pelo link de convite', async ({ browser }) => {
    const beta = grupo('grupo-beta');
    const { contexto, page, conta, vigia } = await sessao(browser, 'jogador20');
    await page.goto('/join/BATBETA1');
    await expect(page.getByRole('heading', { name: beta.nome })).toBeVisible();
    await page.getByRole('button', { name: 'Aceitar e entrar' }).click();
    await esperarDocumento(
      `groups/${id(beta.chave)}/members/${conta.emulador.uid}`,
      (d) => d?.status === 'ACTIVE',
    );
    await page.goto('/?tab=2');
    await expect(page.getByText(beta.nome).first()).toBeVisible();
    semErros(vigia);
    await contexto.close();
  });

  test('jogador pede entrada em grupo público', async ({ browser }) => {
    const aberto = grupo('grupo-aberto');
    const { contexto, page } = await sessao(browser, 'jogador19');
    await page.goto(`/group/${id(aberto.chave)}`);
    await expect(page.getByRole('heading', { level: 1, name: aberto.nome })).toBeVisible();
    const pedir = page.getByRole('button', { name: 'Pedir entrada' });
    await pedir.click();
    // Depois do pedido o botão deixa de oferecer "Pedir entrada".
    await expect(pedir).toBeHidden();
    await contexto.close();
  });

  for (const [chave, papel] of [['dono03', 'dono de quadra'], ['jogador17', 'jogador']] as const) {
    test(`${papel} cria um grupo e vira dono`, async ({ browser }) => {
      // Regressão #4574: o web barrava o jogador depois de mostrar o
      // formulário; as regras e o Android deixam qualquer perfil completo.
      const nome = `Pelada Teste Criada ${Date.now() % 100000}`;
      const { contexto, page, vigia } = await sessao(browser, chave);
      await page.goto('/group/create');
      const dialogo = page.getByRole('dialog', { name: 'Criar Grupo' });
      await dialogo.getByRole('textbox', { name: /Nome do Grupo/ }).fill(nome);
      await dialogo.getByRole('textbox', { name: 'Descrição' }).fill('Grupo criado pela bateria de testes.');
      await dialogo.getByRole('button', { name: 'Criar Grupo' }).click();
      await page.waitForURL(/\/group\/(?!create)[^/]+/, { timeout: 10_000 });
      await expect(page.getByRole('heading', { level: 1, name: nome })).toBeVisible();
      await page.goto('/?tab=2');
      await expect(page.getByText(nome).first()).toBeVisible();
      semErros(vigia);
      await contexto.close();
    });
  }
});
