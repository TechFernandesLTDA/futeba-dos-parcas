/**
 * Test Harness — Web E2E: Domínio Grupos (#2532)
 *
 * Valida os fluxos críticos do domínio Grupos no browser real:
 * - Discover: listagem de grupos (grupos do usuário visíveis, soft-deleted ausentes)
 * - Preview público: visualização de grupo público por membro e não-membro
 * - Acesso negado: não-membro de grupo privado vê erro
 * - Invite-Join: convite → aceite → entrada no grupo (exercita trigger real)
 * - Convite expirado: convite com expires_at passado não pode ser aceito
 *
 * Testes NÃO-TAUTOLÓGICOS: o fluxo de invite-join exerce o trigger real
 * `onInviteRedeemed` ao gerar um convite via UI e aceitá-lo via /join/:code.
 * O teste de acesso negado executa ANTES do invite-join para garantir que
 * o player NÃO é membro do grupo privado no momento da verificação.
 *
 * Uso de serial: fullyParallel=true requer serial para evitar corrida entre
 * invite-join (escreve membership) e acesso-negado (precisa de não-membro).
 *
 * Pré-requisitos:
 * - Emuladores Firebase rodando (firestore, auth, functions)
 * - seed-e2e-users.ts executado (3 usuários: player, field_owner, admin)
 * - seed-e2e-groups.ts executado (4 grupos com membros e convites)
 * - Web app rodando com VITE_USE_EMULATOR=true
 *
 * Executar:
 *   npm run test:e2e -- --grep "grupos"
 */

import { test, expect } from './fixtures';

// ==========================================
// CONSTANTES
// ==========================================

const GROUPS = {
  public: {
    id: 'e2e-group-galaticos',
    name: 'Galáticos FC',
  },
  secret: {
    id: 'e2e-group-secreto',
    name: 'Clube Secreto',
  },
  deleted: {
    id: 'e2e-group-banidos',
    name: 'FC Banidos',
  },
};

// ==========================================
// DESCRIBE SERIAL — Grupos E2E
// ==========================================

test.describe.serial('E2E — Domínio Grupos', () => {
  // ==========================================
  // DISCOVER — listagem de grupos
  // ==========================================

  test.describe('Discover', () => {
    test('deve listar grupo público ativo no discover', async ({ playerPage }) => {
      await playerPage.goto('/?tab=2');

      // Page chrome loaded first: heading "Meus Grupos" visible
      await expect(
        playerPage.getByText(/meus grupos/i)
      ).toBeVisible({ timeout: 10000 });

      // Grupo público ativo (player é membro) deve estar visível
      await expect(
        playerPage.getByText(GROUPS.public.name)
      ).toBeVisible({ timeout: 5000 });

      // Grupo soft-deleted NÃO deve aparecer
      await expect(
        playerPage.getByText(GROUPS.deleted.name)
      ).toHaveCount(0);
    });
  });

  // ==========================================
  // PREVIEW — visualização de grupo
  // ==========================================

  test.describe('Preview', () => {
    test('membro deve ver grupo público sem erro', async ({ playerPage }) => {
      await playerPage.goto(`/group/${GROUPS.public.id}`);

      // Heading do grupo visível
      await expect(
        playerPage.getByRole('heading', { name: GROUPS.public.name })
      ).toBeVisible({ timeout: 10000 });

      // NÃO deve mostrar tela de erro
      await expect(
        playerPage.getByText(/algo deu errado/i)
      ).toHaveCount(0);
    });

    test('não-membro deve ver preview de grupo público com botão de entrada', async ({
      adminPage,
    }) => {
      // admin NÃO é membro de Galáticos FC mas é grupo público — deve ver preview
      await adminPage.goto(`/group/${GROUPS.public.id}`);

      // Grupo público permite visualização para não-membros
      await expect(
        adminPage.getByRole('heading', { name: GROUPS.public.name })
      ).toBeVisible({ timeout: 10000 });

      // NÃO deve mostrar tela de erro
      await expect(
        adminPage.getByText(/algo deu errado/i)
      ).toHaveCount(0);

      // Deve mostrar botão de entrada em grupo público
      const joinButton = adminPage.getByRole('button', { name: /pedir entrada|solicitar/i });
      await expect(joinButton).toBeVisible({ timeout: 5000 });
    });
  });

  // ==========================================
  // ACESSO NEGADO (executa ANTES do invite-join)
  // ==========================================

  test.describe('Acesso negado — guardas de permissão', () => {
    test('não-membro de grupo privado deve ver erro de acesso', async ({
      playerPage,
    }) => {
      // player NÃO é membro do Clube Secreto (grupo privado)
      await playerPage.goto(`/group/${GROUPS.secret.id}`);

      // Deve mostrar tela de erro (rule de leitura exige membership)
      await expect(
        playerPage.getByText(/algo deu errado/i)
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ==========================================
  // INVITE-JOIN — fluxo de convite e entrada
  // ==========================================

  test.describe('Invite-Join', () => {
    test('deve criar convite e ser aceito pelo convidado', async ({
      fieldOwnerPage,
      playerPage,
    }) => {
      // fieldOwner é admin do Clube Secreto (adicionado via seed)
      await fieldOwnerPage.goto(`/group/${GROUPS.secret.id}`);

      // Verifica que o grupo carregou
      await expect(
        fieldOwnerPage.getByRole('heading', { name: GROUPS.secret.name })
      ).toBeVisible({ timeout: 10000 });

      // Clica no botão "Convidar" (visível para admins na tab Membros)
      await fieldOwnerPage.getByRole('button', { name: /convidar/i }).click();

      // Aguarda o dialog abrir com título "Convidar Jogadores"
      await expect(
        fieldOwnerPage.getByRole('heading', { name: /convidar jogadores/i })
      ).toBeVisible({ timeout: 5000 });

      // Clica "Gerar Convite" dentro do dialog
      await fieldOwnerPage.getByRole('button', { name: /gerar convite/i }).click();

      // Aguarda o código de convite aparecer no TextField
      const codeInput = fieldOwnerPage.getByLabel(/código do convite/i);
      await expect(codeInput).toBeVisible({ timeout: 5000 });

      const inviteCode = await codeInput.inputValue();
      expect(inviteCode).toBeTruthy();
      expect(inviteCode.length).toBeGreaterThanOrEqual(6);

      // player NÃO é membro do Clube Secreto — vai aceitar o convite
      await playerPage.goto(`/join/${inviteCode}`);

      // Aguarda o preview do convite carregar
      await expect(
        playerPage.getByText(GROUPS.secret.name)
      ).toBeVisible({ timeout: 10000 });

      // Clica "Aceitar e entrar" — isso dispara joinByInviteCode que:
      // 1. Marca invites/{code}.used = true
      // 2. Aguarda o trigger onInviteRedeemed criar membership (até ~8s)
      // 3. Navega para /group/{groupId}
      await playerPage.getByRole('button', { name: /aceitar e entrar/i }).click();

      // Aguarda o redirecionamento para a página do grupo
      await playerPage.waitForURL(`/group/${GROUPS.secret.id}`, { timeout: 15000 });

      // player agora é membro — deve ver o grupo sem erro
      await expect(
        playerPage.getByRole('heading', { name: GROUPS.secret.name })
      ).toBeVisible({ timeout: 10000 });

      // NÃO deve mostrar tela de erro
      await expect(
        playerPage.getByText(/algo deu errado/i)
      ).toHaveCount(0);
    });

    test('convite expirado não pode ser aceito', async ({ playerPage }) => {
      // E2EEXP é um convite pré-seedado com expires_at no passado
      await playerPage.goto('/join/E2EEXP');

      // Deve mostrar mensagem de convite expirado
      await expect(
        playerPage.getByText(/convite expirado/i)
      ).toBeVisible({ timeout: 10000 });

      // O botão "Aceitar e entrar" NÃO deve estar visível
      await expect(
        playerPage.getByRole('button', { name: /aceitar e entrar/i })
      ).toHaveCount(0);
    });
  });
});
