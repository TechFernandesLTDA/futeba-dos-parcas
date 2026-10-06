/**
 * Testes E2E da matriz de permissões — acesso por role.
 *
 * Cobre 10 rotas × 3 roles (PLAYER, FIELD_OWNER, ADMIN) = 30 testes.
 *
 * Semântica (fonte: App.tsx + specs/PERMISSION_MATRIX.md — Seção 1 — Telas Web):
 * - PERMITIDO: URL final casa com a rota (ou o redirect canônico dela — ex.
 *   /games → /?tab=1, /groups → /?tab=2) e o elemento esperado fica visível.
 * - NEGADO: o guarda de rota redireciona — AdminRoute → '/', FieldOwnerOrAdminRoute
 *   → '/' (ou fallbackTo informado, ex. /locations → /map/locations).
 *   - Redirect para /login = FALHA no fixture (não esperado).
 *
 * Lições da primeira execução completa em CI (triagem R1, 04/10/2026):
 * - `goto` recarrega o documento: a restauração de sessão no emulador pode
 *   levar >5s no runner. TODAS as asserções usam locators/toHaveURL com
 *   auto-retry — nunca assert de valor único nem waitForURL + comparação.
 * - A copy das telas mudou (ex. "Novo Jogo" → "Criar Jogo", "Locais" →
 *   "Gerenciar Locais") — elementos conferidos contra snapshots reais.
 * - getByText com regex ampla colide com o chrome (nav) — usar heading role.
 * - /group/create é FieldOwnerOrAdminRoute (FIX #1033): só FIELD_OWNER/ADMIN.
 *
 * Pré-requisito:
 *   - Emulador Firebase Auth rodando
 *   - VITE_USE_EMULATOR=true no web app
 *   - seed-e2e-users.ts executado (automático via globalSetup)
 *   Consulte web/e2e/README.md para instruções.
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
  /**
   * Regex da URL final quando a rota permitida redireciona para outro path
   * canônico (ex. /games → /?tab=1). Default: a própria rota.
   */
  allowedUrl?: RegExp;
  /**
   * Regex da URL esperada quando o acesso é NEGADO (destino do redirect do
   * guarda). Default: '/' ou '/login' (o /login é falha de fixture).
   */
  deniedUrl?: RegExp;
}

const accessMatrix: AccessMatrixEntry[] = [
  // Rotas públicas (autenticadas)
  {
    route: '/',
    description: 'Home — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    // Saudação sempre presente na HomeTab ("Olá, <nome>!")
    expectedElement: 'Olá,',
    expectedElementSelector: 'text',
  },

  // Rotas de jogos
  {
    route: '/games',
    description: 'Lista de Jogos — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    // /games é Navigate → /?tab=1 (mantém o menu de navegação da Home).
    // Sem elemento: o h6 "Jogos" fica DENTRO do botão do nav (ARIA presentational
    // para descendentes de button) — getByRole('heading') não o expõe.
    allowedUrl: /\/\?tab=1$/,
    expectedElement: null,
  },
  {
    route: '/game/create',
    description: 'Criar Jogo — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    expectedElement: 'Criar Jogo',
    expectedElementSelector: 'heading',
  },

  // Rotas de grupos
  {
    route: '/groups',
    description: 'Lista de Grupos — todos os autenticados',
    allowedRoles: ['player', 'fieldOwner', 'admin'],
    // /groups é Navigate → /?tab=2
    allowedUrl: /\/\?tab=2$/,
    expectedElement: 'Meus Grupos',
    expectedElementSelector: 'text',
  },
  {
    route: '/group/create',
    // FIX #1033: apenas FIELD_OWNER ou ADMIN podem criar grupos via URL direta
    description: 'Criar Grupo — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Criar Grupo',
    expectedElementSelector: 'heading',
  },

  // Rotas de locais (FIELD_OWNER / ADMIN only)
  {
    route: '/locations',
    description: 'Lista de Locais — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Gerenciar Locais',
    expectedElementSelector: 'heading',
    // PLAYER negado cai no mapa público (fallbackTo do guarda)
    deniedUrl: /\/map\/locations$/,
  },
  {
    route: '/location/create',
    description: 'Criar Local — FIELD_OWNER, ADMIN',
    allowedRoles: ['fieldOwner', 'admin'],
    expectedElement: 'Criar Local',
    expectedElementSelector: 'heading',
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

/** Escapa a rota para uso como regex de URL. */
function routeToUrlRegex(route: string): RegExp {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}$`);
}

/**
 * Valida o resultado da navegação para uma rota da matriz:
 * - Permitido: URL final (auto-retry) + elemento visível.
 * - Negado: URL final é o destino do redirect do guarda (auto-retry).
 *
 * O auto-retry é essencial: o `goto` recarrega o documento e a restauração
 * de sessão no emulador pode levar >5s no runner; o redirect do guarda
 * acontece DEPOIS dessa restauração.
 */
async function expectAccess(
  page: Page,
  entry: AccessMatrixEntry,
  role: 'player' | 'fieldOwner' | 'admin'
): Promise<void> {
  if (entry.allowedRoles.includes(role)) {
    await expect(page).toHaveURL(entry.allowedUrl ?? routeToUrlRegex(entry.route), {
      timeout: 15_000,
    });

    if (entry.expectedElement) {
      const locator = selectLocator(page, entry.expectedElement, entry.expectedElementSelector);
      await expect(locator).toBeVisible({ timeout: 10_000 });
    }
  } else {
    // Esperado: redirect do guarda para o destino de negação
    await expect(page).toHaveURL(entry.deniedUrl ?? /\/$|\/login/, { timeout: 15_000 });
    // Se redirecionou para /login, é falha no fixture (não esperado)
    await expect(page).not.toHaveURL(/\/login/);
  }
}

test.describe('Access Matrix — Validação de Permissões por Role', () => {
  for (const entry of accessMatrix) {
    test.describe(`Rota: ${entry.route}`, () => {
      // PLAYER
      test(`PLAYER → ${entry.description}`, async ({ playerPage }) => {
        await playerPage.goto(entry.route);
        await expectAccess(playerPage, entry, 'player');
      });

      // FIELD_OWNER
      test(`FIELD_OWNER → ${entry.description}`, async ({ fieldOwnerPage }) => {
        await fieldOwnerPage.goto(entry.route);
        await expectAccess(fieldOwnerPage, entry, 'fieldOwner');
      });

      // ADMIN
      test(`ADMIN → ${entry.description}`, async ({ adminPage }) => {
        await adminPage.goto(entry.route);
        await expectAccess(adminPage, entry, 'admin');
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
