/**
 * Testes de Firestore Security Rules — Coleção: notifications
 *
 * Regras (firestore.rules):
 * - read: apenas o destinatário (resource.data.user_id == userId())
 * - create: criador != destinatário; destinatário deve existir; campos obrigatórios
 * - update: apenas o destinatário; apenas campos ['read', 'read_at']
 * - delete: destinatário ou admin
 *
 * Cobre:
 * - Apenas destinatário lê próprias notificações
 * - Remetente NÃO lê notificações do destinatário
 * - Criação com campos obrigatórios + created_by != user_id
 * - Update restrito a ['read', 'read_at']
 * - Admin pode deletar notificações alheias
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDoc,
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

// IDs das notificações
const NOTIF_FOR_PLAYER_B = "notif-for-player-b-001";
const NOTIF_FOR_ADMIN = "notif-for-admin-001";
const GAME_FOR_INVITE = "game-notification-invite-001";
const GROUP_FOR_INVITE = "group-notification-invite-001";
const CHALLENGE_FOR_SYSTEM = "challenge-notification-system-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Seed: perfis para existência de destinatário (notifications verifica exists)
  await seedDoc(testEnv, `users/${UID_PLAYER_B}`, {
    name: "Jogador B",
    email: "player.b@test.com",
    role: "PLAYER",
    is_searchable: false,
    experience_points: 100,
    level: 1,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: 2.0,
    mid_rating: 2.0,
    defender_rating: 2.0,
    gk_rating: 2.0,
  });
	  await seedDoc(testEnv, `users/${UID_ADMIN}`, {
    name: "Admin",
    email: "admin@test.com",
    role: "ADMIN",
    is_searchable: false,
    experience_points: 0,
    level: 1,
    milestones_achieved: [],
    created_at: new Date(),
    striker_rating: null,
    mid_rating: null,
    defender_rating: null,
    gk_rating: null,
	  });

	  await seedDoc(testEnv, `games/${GAME_FOR_INVITE}`, {
	    owner_id: UID_PLAYER_A,
	    group_id: GROUP_FOR_INVITE,
	    status: "SCHEDULED",
	  });
	  await seedDoc(testEnv, `groups/${GROUP_FOR_INVITE}`, {
	    owner_id: UID_PLAYER_A,
	    status: "ACTIVE",
	  });
	  await seedDoc(testEnv, `groups/${GROUP_FOR_INVITE}/members/${UID_PLAYER_A}`, {
	    user_id: UID_PLAYER_A,
	    role: "OWNER",
	    status: "ACTIVE",
	  });
	  await seedDoc(testEnv, `groups/${GROUP_FOR_INVITE}/members/${UID_PLAYER_B}`, {
	    user_id: UID_PLAYER_B,
	    role: "MEMBER",
	    status: "ACTIVE",
	  });
	  await seedDoc(testEnv, `game_rides/${GAME_FOR_INVITE}_${UID_PLAYER_B}`, {
	    game_id: GAME_FOR_INVITE,
	    user_id: UID_PLAYER_B,
	    type: "REQUEST",
	    status: "ACTIVE",
	  });
	  await seedDoc(testEnv, `group-challenges/${CHALLENGE_FOR_SYSTEM}`, {
	    created_by: UID_PLAYER_A,
	    responded_by: UID_PLAYER_B,
	    completed_by: UID_PLAYER_A,
	    status: "FINISHED",
	  });

  // Notificação para player B (enviada por player A)
  await seedDoc(testEnv, `notifications/${NOTIF_FOR_PLAYER_B}`, {
    user_id: UID_PLAYER_B, // destinatário
    created_by: UID_PLAYER_A, // remetente
    type: "GAME_INVITE",
    title: "Convite para jogo",
    read: false,
  });

  // Notificação para admin
  await seedDoc(testEnv, `notifications/${NOTIF_FOR_ADMIN}`, {
    user_id: UID_ADMIN,
    created_by: UID_PLAYER_A,
    type: "SYSTEM",
    title: "Notificação admin",
    read: false,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA (READ)
// ============================================================

describe("notifications — leitura", () => {
  it("Destinatário pode ler própria notificação", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).get());
  });

  it("Remetente NÃO pode ler notificação do destinatário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).get());
  });

  it("Admin pode ler próprias notificações (como destinatário)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`notifications/${NOTIF_FOR_ADMIN}`).get());
  });

  // NOTA: As rules atuais NÃO dão ao admin acesso para ler notificações de outros.
  // rule: allow read: if isAuthenticated() && resource.data.user_id == userId()
  // Admin só lê se for o destinatário — comportamento esperado conforme rules.
  it("Admin NÃO pode ler notificação de outro usuário (rule não prevê isso)", async () => {
    const db = asAdmin(testEnv);
    await assertFails(db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).get());
  });

  it("Não-autenticado NÃO pode ler notificações", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).get());
  });
});

// ============================================================
// CRIAÇÃO (CREATE)
// ============================================================

describe("notifications — criação", () => {
	  it("NÃO permite SYSTEM arbitrário para outro usuário existente (#3595)", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("notifications/notif-new-valid").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_PLAYER_B, // destinatário diferente
	        type: "SYSTEM",
	        title: "Aviso",
	        body: "Clique aqui para reativar sua conta.",
	      })
	    );
	  });

	  it("NÃO permite tipo de sistema gerado por trigger no client (#3595)", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("notifications/notif-client-achievement").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_PLAYER_B,
	        type: "ACHIEVEMENT",
	        title: "Conquista falsa",
	        body: "Conteúdo arbitrário.",
	      })
	    );
	  });

	  it("Permite SYSTEM somente entre participantes do desafio concluído", async () => {
	    const db = asPlayerA(testEnv);
	    await assertSucceeds(
	      db.doc("notifications/notif-challenge-system-valid").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_PLAYER_B,
	        type: "SYSTEM",
	        title: "Desafio concluído",
	        body: "O desafio entre os grupos foi concluído.",
	        reference_id: CHALLENGE_FOR_SYSTEM,
	        reference_type: "group_challenge",
	      })
	    );
	  });

	  it("NÃO permite GAME_SUMMON sem game_id", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("notifications/notif-game-summon-no-game").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_PLAYER_B,
	        sender_id: UID_PLAYER_A,
	        type: "GAME_SUMMON",
	        title: "Venha jogar!",
	        body: "Convite para a proxima partida.",
	      })
	    );
	  });

	  it("Player dono do jogo pode criar GAME_SUMMON com game_id", async () => {
	    const db = asPlayerA(testEnv);
	    await assertSucceeds(
	      db.doc("notifications/notif-game-summon-valid").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_PLAYER_B,
	        sender_id: UID_PLAYER_A,
	        type: "GAME_SUMMON",
	        title: "Venha jogar!",
	        body: "Convite para a proxima partida.",
	        game_id: GAME_FOR_INVITE,
	        group_id: GROUP_FOR_INVITE,
	      })
	    );
	  });

	  it("NÃO permite GAME_SUMMON para usuário sem vínculo com o jogo", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("notifications/notif-game-summon-unrelated-target").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_ADMIN,
	        sender_id: UID_PLAYER_A,
	        type: "GAME_SUMMON",
	        title: "Venha jogar!",
	        body: "Convite para a proxima partida.",
	        game_id: GAME_FOR_INVITE,
	        group_id: GROUP_FOR_INVITE,
	      })
	    );
	  });

	  it("Permite GAME_RIDE apenas entre caronas opostas e ativas do mesmo jogo", async () => {
	    const db = asPlayerA(testEnv);
	    const batch = db.batch();
	    batch.set(db.doc(`game_rides/${GAME_FOR_INVITE}_${UID_PLAYER_A}`), {
	      game_id: GAME_FOR_INVITE,
	      group_id: GROUP_FOR_INVITE,
	      user_id: UID_PLAYER_A,
	      user_name: "Jogador A",
	      user_photo: "",
	      type: "OFFER",
	      origin_label: "Centro",
	      destination_label: "Campo",
	      seats: 2,
	      note: "",
	      status: "ACTIVE",
	      created_at: serverTimestamp(),
	      updated_at: serverTimestamp(),
	    });
	    batch.set(db.doc("notifications/notif-game-ride-valid"), {
	      created_by: UID_PLAYER_A,
	      user_id: UID_PLAYER_B,
	      type: "GAME_RIDE",
	      title: "Carona oferecida",
	      body: "Tenho duas vagas.",
	      game_id: GAME_FOR_INVITE,
	    });
	    await assertSucceeds(batch.commit());
	  });

	  it("NÃO permite GAME_RIDE para destinatário sem carona oposta", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("notifications/notif-game-ride-unrelated-target").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_ADMIN,
	        type: "GAME_RIDE",
	        title: "Carona oferecida",
	        body: "Conteúdo arbitrário.",
	        game_id: GAME_FOR_INVITE,
	      })
	    );
	  });

	  it("NÃO permite GROUP_INVITE sem group_id", async () => {
	    const db = asPlayerA(testEnv);
	    await assertFails(
	      db.doc("notifications/notif-group-invite-no-group").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_PLAYER_B,
	        sender_id: UID_PLAYER_A,
	        type: "GROUP_INVITE",
	        title: "Convite para grupo",
	        body: "Entre no grupo.",
	      })
	    );
	  });

	  it("Admin do grupo pode criar GROUP_INVITE com group_id", async () => {
	    const db = asPlayerA(testEnv);
	    await assertSucceeds(
	      db.doc("notifications/notif-group-invite-valid").set({
	        created_by: UID_PLAYER_A,
	        user_id: UID_PLAYER_B,
	        sender_id: UID_PLAYER_A,
	        type: "GROUP_INVITE",
	        title: "Convite para grupo",
	        body: "Entre no grupo.",
	        group_id: GROUP_FOR_INVITE,
	      })
	    );
	  });

  it("Player NÃO pode criar notificação para si mesmo (created_by == user_id)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("notifications/notif-self").set({
        created_by: UID_PLAYER_A,
        user_id: UID_PLAYER_A, // mesmo usuário = proibido
        type: "GAME_INVITE",
        title: "Auto notificação",
      })
    );
  });

  it("Player NÃO pode criar notificação com created_by de outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("notifications/notif-fake-sender").set({
        created_by: UID_PLAYER_B, // falsificação do remetente
        user_id: UID_PLAYER_A,
        type: "GAME_INVITE",
        title: "Fraude",
      })
    );
  });

  it("Player NÃO pode criar notificação sem campos obrigatórios", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("notifications/notif-missing-fields").set({
        created_by: UID_PLAYER_A,
        user_id: UID_PLAYER_B,
        // type e title ausentes
      })
    );
  });

  it("Não-autenticado NÃO pode criar notificação", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("notifications/notif-anon").set({
        created_by: "anon",
        user_id: UID_PLAYER_B,
        type: "SYSTEM",
        title: "Invasão",
      })
    );
  });

  // #1037.5: admin pode criar notificação mesmo para user soft-deleted (exists() não bloqueia admin)
  it("Admin pode criar notificação para qualquer usuário (#1037.5)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("notifications/notif-admin-created").set({
        created_by: UID_ADMIN,
        user_id: UID_PLAYER_B,
        type: "SYSTEM",
        title: "Notificação administrativa",
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO (UPDATE)
// ============================================================

describe("notifications — atualização", () => {
  it("Destinatário pode marcar notificação como lida", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).update({
        read: true,
        read_at: new Date(),
      })
    );
  });

  it("Destinatário NÃO pode alterar campos além de ['read', 'read_at']", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).update({
        title: "Título alterado pelo destinatário", // campo proibido
      })
    );
  });

  it("Remetente NÃO pode atualizar notificação do destinatário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).update({
        read: true,
      })
    );
  });
});

// ============================================================
// DELEÇÃO (DELETE)
// ============================================================

describe("notifications — deleção", () => {
  it("Destinatário pode deletar própria notificação", async () => {
    await seedDoc(testEnv, "notifications/notif-for-delete-player-b", {
      user_id: UID_PLAYER_B,
      created_by: UID_PLAYER_A,
      type: "GAME_INVITE",
      title: "Para deletar",
      read: false,
    });
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc("notifications/notif-for-delete-player-b").delete()
    );
  });

  it("Admin pode deletar qualquer notificação", async () => {
    await seedDoc(testEnv, "notifications/notif-admin-delete", {
      user_id: UID_PLAYER_B,
      created_by: UID_PLAYER_A,
      type: "GAME_INVITE",
      title: "Admin vai deletar",
      read: false,
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("notifications/notif-admin-delete").delete()
    );
  });

  it("Remetente NÃO pode deletar notificação do destinatário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`notifications/${NOTIF_FOR_PLAYER_B}`).delete()
    );
  });
});
