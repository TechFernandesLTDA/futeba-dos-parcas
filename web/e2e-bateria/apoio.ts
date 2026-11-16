/**
 * Bateria de testes — apoio dos specs do Playwright.
 *
 * As contas e o cenário vêm de scripts/bateria (a mesma fonte do seed).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, BrowserContext, Page, expect } from '@playwright/test';
import { CONTAS, ContaTeste, SENHA_EMULADOR, conta } from '../../scripts/bateria/contas';
import { GRUPOS, JOGOS, QUADRAS, idsDoAlvo } from '../../scripts/bateria/cenario';
import { PORTAS } from '../../scripts/bateria/portas';

export { CONTAS, GRUPOS, JOGOS, QUADRAS, SENHA_EMULADOR, conta };
export type { ContaTeste };

export const PROJETO = 'demo-futebadosparcas';
export const URL_AUTH = `http://127.0.0.1:${PORTAS.auth}`;
export const URL_FIRESTORE = `http://127.0.0.1:${PORTAS.firestore}`;

/** ID de documento no emulador para uma chave do cenário. */
export const id = idsDoAlvo('emulador');

export const grupo = (chave: string) => GRUPOS.find((g) => g.chave === chave)!;
export const jogo = (chave: string) => JOGOS.find((j) => j.chave === chave)!;
export const quadra = (chave: string) => QUADRAS.find((q) => q.chave === chave)!;

const versaoWeb = (JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string })
  .version;

/**
 * Marca o guia e as novidades como já vistos neste navegador. Sem isso o
 * diálogo de novidades reabre em cada visita à home e cobre a tela.
 */
export async function semAvisos(contexto: BrowserContext): Promise<void> {
  await contexto.addInitScript((versao: string) => {
    try {
      window.localStorage.setItem('appGuideShown', 'true');
      window.localStorage.setItem('whats_new_last_seen_version', JSON.stringify(versao));
    } catch {
      // Página sem localStorage (about:blank): nada a fazer.
    }
  }, versaoWeb);
}

/** Fecha avisos que cobrem a tela (novidades, permissão de notificação). */
export async function fecharAvisos(page: Page): Promise<void> {
  for (const rotulo of ['Entendi', 'Agora não', 'Não, obrigado']) {
    const botao = page.getByRole('button', { name: new RegExp(`^${rotulo}$`, 'i') });
    if (await botao.first().isVisible({ timeout: 400 }).catch(() => false)) {
      await botao.first().click().catch(() => {});
    }
  }
}

/** No primeiro acesso de cada conta o app abre o guia; "Pular" leva à home. */
export async function pularGuia(page: Page): Promise<boolean> {
  const pular = page.getByRole('button', { name: 'Pular onboarding' });
  if (await pular.isVisible({ timeout: 2_500 }).catch(() => false)) {
    await pular.click();
    await page.waitForURL((url) => !/\/guide/.test(url.pathname), { timeout: 15_000 });
    return true;
  }
  return false;
}

/** Preenche e envia a tela real de login por e-mail e senha. */
export async function preencherLogin(page: Page, email: string, senha: string): Promise<void> {
  await page.goto('/login');
  const formulario = page.locator('form[aria-label="Entrar"]');
  await formulario.waitFor({ state: 'visible' });
  await formulario.getByRole('textbox', { name: 'Email' }).fill(email);
  await formulario.getByRole('textbox', { name: 'Senha' }).fill(senha);
  await formulario.getByRole('button', { name: 'Entrar' }).click();
}

/** Login pela tela real. Termina fora de /login, com a sessão ativa. */
export async function entrarComo(page: Page, chave: string): Promise<ContaTeste> {
  const c = conta(chave);
  await preencherLogin(page, c.emulador.email, SENHA_EMULADOR);
  await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 20_000 });
  await pularGuia(page);
  await fecharAvisos(page);
  return c;
}

/** Abre um contexto novo (sessão isolada) já autenticado como a conta. */
export async function sessao(
  browser: Browser,
  chave: string,
): Promise<{ contexto: BrowserContext; page: Page; conta: ContaTeste; vigia: { erros: string[] } }> {
  const contexto = await browser.newContext();
  await semAvisos(contexto);
  const page = await contexto.newPage();
  const vigia = vigiarErros(page);
  const c = await entrarComo(page, chave);
  return { contexto, page, conta: c, vigia };
}

/**
 * Erros que derrubam um fluxo sem aparecer na tela: exceção não tratada e
 * PERMISSION_DENIED do Firestore no console.
 */
export function vigiarErros(page: Page): { erros: string[] } {
  const erros: string[] = [];
  page.on('pageerror', (erro) => erros.push(`pageerror: ${erro.message}`));
  page.on('console', (mensagem) => {
    if (mensagem.type() !== 'error') return;
    const texto = mensagem.text();
    if (/permission[-_ ]denied|Missing or insufficient permissions/i.test(texto)) {
      erros.push(`console: ${texto.slice(0, 300)}`);
    }
  });
  return { erros };
}

export function semErros(vigia: { erros: string[] }): void {
  expect(vigia.erros, vigia.erros.join('\n')).toEqual([]);
}

/** Cria uma conta nova direto no emulador do Auth (como faz o login social). */
export async function criarContaNova(email: string, senha: string): Promise<string> {
  const resposta = await fetch(`${URL_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
  });
  if (!resposta.ok) throw new Error(`[bateria] signUp falhou: ${resposta.status}`);
  return ((await resposta.json()) as { localId: string }).localId;
}

/** Lê um documento do emulador do Firestore sem passar pelas regras. */
export async function lerDocumento(caminho: string): Promise<Record<string, unknown> | null> {
  const resposta = await fetch(
    `${URL_FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents/${caminho}`,
    { headers: { Authorization: 'Bearer owner' } },
  );
  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error(`[bateria] leitura de ${caminho} falhou: ${resposta.status}`);
  const corpo = (await resposta.json()) as { fields?: Record<string, Record<string, unknown>> };
  const saida: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(corpo.fields ?? {})) {
    saida[campo] = Object.values(valor)[0];
  }
  return saida;
}

/** Espera um documento satisfazer a condição (gatilhos são assíncronos). */
export async function esperarDocumento(
  caminho: string,
  condicao: (dados: Record<string, unknown> | null) => boolean,
  prazoMs = 30_000,
): Promise<Record<string, unknown> | null> {
  const fim = Date.now() + prazoMs;
  let dados: Record<string, unknown> | null = null;
  while (Date.now() < fim) {
    dados = await lerDocumento(caminho);
    if (condicao(dados)) return dados;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`[bateria] ${caminho} não chegou ao estado esperado: ${JSON.stringify(dados)?.slice(0, 300)}`);
}
