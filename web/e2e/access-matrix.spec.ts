/**
 * Testes E2E da matriz de permissões — acesso por role.
 *
 * Cobre 10 rotas × 3 roles (PLAYER, FIELD_OWNER, ADMIN) = 30 testes.
 *
 * Assertion pattern:
 * - Navegação bem-sucedida (URL exata, elemento esperado visível) → PERMITIDO
 * - Redirect para `/` → NEGADO (sem error visível)
 * - Redirect para `/login` → FALHA no fixture (não esperado)
 *
 * Pré-requisito:
 *   - Emulador Firebase Auth rodando
 *   - VITE_USE_EMULATOR=true no web app
 *   - seed-e2e-users.ts executado
 *   Consulte web/e2e/README.md para instruções.
 *
 * Fonte: specs/PERMISSION_MATRIX.md (Seção 1 — Telas Web)
 */

import { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// ==========================================
// MATRIZ DE ACESSO
// ==========================================

interface AccessMatrixEntry {
  route: string;
  description: string;
  allowedRoles: ('player' | 'fieldOwner' | 'admin')[];
  /**
   * Elemento esperado quando acesso é permitido.
   * Selector de texto, role, ou locator.
   * Se null, apenas verifica URL.
   */
  expectedElement?: string | null;
  expectedElementSelector?: 'text' | 'role' | 'heading';
}

const accessMatrix: AccessMatrixEntry[] = [
  // Rotas públicas (autenticadas)
  {
    route: '/',
    description: 'Home — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    expectedElement: 'Tela atual: Início',
    expectedElementSelector: 'text',
  },

  // Rotas de jogos
  {
    route: '/games',
    description: 'Lista de Jogos — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    expectedElement: 'Jogos',
    expectedElementSelector: 'text',
  },
  {
    route: '/game/create',
    description: 'Criar Jogo — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    expectedElement: 'Tela atual: Criar',
    expectedElementSelector: 'text',
  },

  // Rotas de grupos
  {
    route: '/groups',
    description: 'Lista de Grupos — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    expectedElement: 'Grupos',
    expectedElementSelector: 'text',
  },
  {
    route: '/group/create',
    description: 'Criar Grupo — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    expectedElement: 'Tela atual: Criar',
    expectedElementSelector: 'text',
  },

  // Rotas de locais (FIELD_OWNER / ADMIN only)
  {
    route: '/locations',
    description: 'Lista de Locais — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Tela atual: Quadras',
    expectedElementSelector: 'text',
  },
  {
    route: '/location/create',
    description: 'Criar Local — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Tela atual: Criar',
    expectedElementSelector: 'text',
  },

  // Rotas administrativas
  {
    route: '/admin/users',
    description: 'Gestão de Usuários — ADMIN only',
    allowedRoles: ['admin'],
    expectedElement: 'Usuários',
    expectedElementSelector: 'text',
  },
  {
    route: '/settings/gamification',
    description: 'Configurações de Gamificação — ADMIN only',
    allowedRoles: ['admin'],
    expectedElement: 'Gamificação',
    expectedElementSelector: 'text',
  },

  // Dashboard do dono (FIELD_OWNER / ADMIN)
  {
    route: '/owner/dashboard',
    description: 'Dashboard do Dono — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Tela atual: Painel',
    expectedElementSelector: 'text',
  },
];

// ==========================================
// TESTES TABLE-DRIVEN
// ==========================================

test.describe('Access Matrix — Validação de Permissões por Role', () => {
  for (const entry of accessMatrix) {
    test.describe(`Rota: ${entry.route}`, () => {
      // PLAYER
      test(`PLAYER → ${entry.description}`, async ({ playerPage }) => {
        await playerPage.goto(entry.route);
        // Aguarda navegação finalizar (max 5s)
        await playerPage.waitForURL(/.*/, { timeout: 5000 });

        if (entry.allowedRoles.includes('player')) {
          // Esperado: acesso permitido — elemento distintivo visível, sem /login.
          await expect(playerPage).not.toHaveURL(/\/login/);
          if (entry.expectedElement) {
            const locator = selectLocator(playerPage, entry.expectedElement, entry.expectedElementSelector);
            await expect(locator).toBeVisible({ timeout: 5000 });
          }
        } else {
          // Esperado: redirect para a home (acesso negado). O guard de
          // permissões é assíncrono (carrega claims) — esperar a URL sair
          // da rota com polling; a home usa tabs, ex.: /?tab=1.
          await expect(async () => {
            expect(new URL(playerPage.url()).pathname).not.toBe(entry.route);
            expect(playerPage.url()).not.toMatch(/\/login/);
          }).toPass({ timeout: 8000 });
        }
      });

      // FIELD_OWNER
      test(`FIELD_OWNER → ${entry.description}`, async ({ fieldOwnerPage }) => {
        await fieldOwnerPage.goto(entry.route);
        // Aguarda navegação finalizar
        await fieldOwnerPage.waitForURL(/.*/, { timeout: 5000 });

        if (entry.allowedRoles.includes('fieldOwner')) {
          // Esperado: acesso permitido — elemento distintivo visível, sem /login.
          await expect(fieldOwnerPage).not.toHaveURL(/\/login/);
          if (entry.expectedElement) {
            const locator = selectLocator(fieldOwnerPage, entry.expectedElement, entry.expectedElementSelector);
            await expect(locator).toBeVisible({ timeout: 5000 });
          }
        } else {
          // Esperado: redirect para a home (acesso negado). O guard de
          // permissões é assíncrono (carrega claims) — esperar a URL sair
          // da rota com polling; a home usa tabs, ex.: /?tab=1.
          await expect(async () => {
            expect(new URL(fieldOwnerPage.url()).pathname).not.toBe(entry.route);
            expect(fieldOwnerPage.url()).not.toMatch(/\/login/);
          }).toPass({ timeout: 8000 });
        }
      });

      // ADMIN
      test(`ADMIN → ${entry.description}`, async ({ adminPage }) => {
        await adminPage.goto(entry.route);
        // Aguarda navegação finalizar
        await adminPage.waitForURL(/.*/, { timeout: 5000 });

        if (entry.allowedRoles.includes('admin')) {
          // Esperado: acesso permitido — elemento distintivo visível, sem /login.
          await expect(adminPage).not.toHaveURL(/\/login/);
          if (entry.expectedElement) {
            const locator = selectLocator(adminPage, entry.expectedElement, entry.expectedElementSelector);
            await expect(locator).toBeVisible({ timeout: 5000 });
          }
        } else {
          // Esperado: redirect para a home (acesso negado). O guard de
          // permissões é assíncrono (carrega claims) — esperar a URL sair
          // da rota com polling; a home usa tabs, ex.: /?tab=1.
          await expect(async () => {
            expect(new URL(adminPage.url()).pathname).not.toBe(entry.route);
            expect(adminPage.url()).not.toMatch(/\/login/);
          }).toPass({ timeout: 8000 });
        }
      });
    });
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Seleciona o locator apropriado baseado no tipo de selector.
 * @param page Página Playwright
 * @param selector String do selector (texto ou role)
 * @param type Tipo: 'text', 'role', ou 'heading'
 */
function selectLocator(
  page: Page,
  selector: string,
  type: AccessMatrixEntry['expectedElementSelector']
) {
  switch (type) {
    case 'role':
      return page.getByRole(selector as Parameters<Page['getByRole']>[0]);
    case 'heading':
      return page.getByRole('heading', { name: selector });
    case 'text':
    default:
      return page.getByText(new RegExp(selector, 'i'));
  }
}
