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
    expectedElement: 'Próximos Jogos',
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
    expectedElement: 'Novo Jogo',
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
    expectedElement: 'Novo Grupo',
    expectedElementSelector: 'text',
  },

  // Rotas de locais (FIELD_OWNER / ADMIN only)
  {
    route: '/locations',
    description: 'Lista de Locais — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Locais',
    expectedElementSelector: 'text',
  },
  {
    route: '/location/create',
    description: 'Criar Local — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Novo Local',
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
    expectedElement: 'Dashboard',
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

        const currentUrl = playerPage.url();

        if (entry.allowedRoles.includes('player')) {
          // Esperado: acesso permitido
          expect(currentUrl).toBe(
            `${playerPage.context().browser()?.contexts()[0]?.pages()[0]?.url().split(entry.route)[0] || 'http://localhost:5173'}${entry.route}`
          );

          if (entry.expectedElement) {
            const locator = selectLocator(playerPage, entry.expectedElement, entry.expectedElementSelector);
            await expect(locator).toBeVisible({ timeout: 5000 });
          }
        } else {
          // Esperado: redirect para / (acesso negado)
          expect(currentUrl).toMatch(/\/$|\/login/);
          // Se redirecionou para /login, é falha no fixture (não esperado)
          expect(currentUrl).not.toMatch(/\/login/);
        }
      });

      // FIELD_OWNER
      test(`FIELD_OWNER → ${entry.description}`, async ({ fieldOwnerPage }) => {
        await fieldOwnerPage.goto(entry.route);
        // Aguarda navegação finalizar
        await fieldOwnerPage.waitForURL(/.*/, { timeout: 5000 });

        const currentUrl = fieldOwnerPage.url();

        if (entry.allowedRoles.includes('fieldOwner')) {
          // Esperado: acesso permitido
          expect(currentUrl).toBe(
            `${fieldOwnerPage.context().browser()?.contexts()[0]?.pages()[0]?.url().split(entry.route)[0] || 'http://localhost:5173'}${entry.route}`
          );

          if (entry.expectedElement) {
            const locator = selectLocator(fieldOwnerPage, entry.expectedElement, entry.expectedElementSelector);
            await expect(locator).toBeVisible({ timeout: 5000 });
          }
        } else {
          // Esperado: redirect para / (acesso negado)
          expect(currentUrl).toMatch(/\/$|\/login/);
          expect(currentUrl).not.toMatch(/\/login/);
        }
      });

      // ADMIN
      test(`ADMIN → ${entry.description}`, async ({ adminPage }) => {
        await adminPage.goto(entry.route);
        // Aguarda navegação finalizar
        await adminPage.waitForURL(/.*/, { timeout: 5000 });

        const currentUrl = adminPage.url();

        if (entry.allowedRoles.includes('admin')) {
          // Esperado: acesso permitido
          expect(currentUrl).toBe(
            `${adminPage.context().browser()?.contexts()[0]?.pages()[0]?.url().split(entry.route)[0] || 'http://localhost:5173'}${entry.route}`
          );

          if (entry.expectedElement) {
            const locator = selectLocator(adminPage, entry.expectedElement, entry.expectedElementSelector);
            await expect(locator).toBeVisible({ timeout: 5000 });
          }
        } else {
          // Esperado: redirect para / (acesso negado)
          expect(currentUrl).toMatch(/\/$|\/login/);
          expect(currentUrl).not.toMatch(/\/login/);
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
function selectLocator(page: Page, selector: string, type: string | undefined) {
  switch (type) {
    case 'role':
      return page.getByRole(selector);
    case 'heading':
      return page.getByRole('heading', { name: selector });
    case 'text':
    default:
      return page.getByText(new RegExp(selector, 'i'));
  }
}
