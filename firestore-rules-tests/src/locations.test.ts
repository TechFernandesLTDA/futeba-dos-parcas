/**
 * Testes de Firestore Security Rules — Coleção: locations
 *
 * Cobre:
 * - Leitura pública: locais ativos + verificados
 * - Criação: qualquer autenticado (owner_id = próprio), FIELD_OWNER e ADMIN
 * - Atualização: owner pode editar campos básicos; NÃO pode mudar is_verified/owner_id
 * - Deleção: APENAS admin
 * - Player NÃO cria local em nome de outro (owner_id != próprio)
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asFieldOwner,
  asUser,
  asAnon,
  seedDoc,
  UID_ADMIN,
  UID_FIELD_OWNER,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const LOC_ACTIVE_VERIFIED = "loc-active-verified-001";
const LOC_INACTIVE = "loc-inactive-001";
const LOC_PLAYER_A_OWNED = "loc-player-a-owned-001";
const LOC_FIELD_OWNER_OWNED = "loc-field-owner-owned-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Local ativo + verificado — legível publicamente
  await seedDoc(testEnv, `locations/${LOC_ACTIVE_VERIFIED}`, {
    name: "Quadra Pública",
    owner_id: UID_FIELD_OWNER,
    is_active: true,
    is_verified: true,
    rating: 4.5,
    latitude: -23.5,
    longitude: -46.6,
    created_at: new Date(),
  });

  // Local inativo — não legível publicamente
  await seedDoc(testEnv, `locations/${LOC_INACTIVE}`, {
    name: "Quadra Inativa",
    owner_id: UID_FIELD_OWNER,
    is_active: false,
    is_verified: false,
    rating: null,
    latitude: -23.5,
    longitude: -46.6,
    created_at: new Date(),
  });

  // Local do player A — para testes de update/delete
  await seedDoc(testEnv, `locations/${LOC_PLAYER_A_OWNED}`, {
    name: "Quadra Player A",
    owner_id: UID_PLAYER_A,
    is_active: true,
    is_verified: false,
    rating: null,
    latitude: -23.5,
    longitude: -46.6,
    created_at: new Date(),
  });

  // Local do FIELD_OWNER — para testes de atualização
  await seedDoc(testEnv, `locations/${LOC_FIELD_OWNER_OWNED}`, {
    name: "Quadra FieldOwner",
    owner_id: UID_FIELD_OWNER,
    is_active: true,
    is_verified: false,
    rating: null,
    latitude: -23.5,
    longitude: -46.6,
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA (READ)
// ============================================================

describe("locations — leitura", () => {
  it("Anônimo pode ler local ativo + verificado", async () => {
    const db = asAnon(testEnv);
    await assertSucceeds(db.doc(`locations/${LOC_ACTIVE_VERIFIED}`).get());
  });

  it("Anônimo NÃO pode ler local inativo", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`locations/${LOC_INACTIVE}`).get());
  });

  it("Usuário autenticado pode ler qualquer local não-deletado", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`locations/${LOC_INACTIVE}`).get());
  });

  it("Admin pode ler local soft-deleted", async () => {
    await seedDoc(testEnv, "locations/loc-soft-deleted", {
      name: "Deletado",
      owner_id: UID_FIELD_OWNER,
      is_active: false,
      is_verified: false,
      deleted_at: new Date(),
      latitude: null,
      longitude: null,
      rating: null,
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("locations/loc-soft-deleted").get());
  });

  it("Player NÃO pode ler local soft-deleted", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc("locations/loc-soft-deleted").get());
  });
});

// ============================================================
// CRIAÇÃO (CREATE)
// ============================================================

describe("locations — criação", () => {
  it("Player NÃO pode criar local — apenas FIELD_OWNER ou ADMIN (#1026)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("locations/loc-new-player-a").set({
        name: "Meu Campo",
        owner_id: UID_PLAYER_A,
        is_active: true,
        is_verified: false,
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
      })
    );
  });

  it("FIELD_OWNER pode criar local com owner_id próprio", async () => {
    const db = asFieldOwner(testEnv);
    await assertSucceeds(
      db.doc("locations/loc-new-field-owner").set({
        name: "Minha Quadra",
        owner_id: UID_FIELD_OWNER,
        is_active: true,
        is_verified: false,
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
      })
    );
  });

  it("FIELD_OWNER pode criar local com fuso IANA explícito", async () => {
    const db = asFieldOwner(testEnv);
    await assertSucceeds(
      db.doc("locations/loc-new-with-time-zone").set({
        name: "Arena com Fuso",
        owner_id: UID_FIELD_OWNER,
        is_active: true,
        is_verified: false,
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
        time_zone: "America/Sao_Paulo",
      })
    );
  });

  it("FIELD_OWNER NÃO pode gravar fuso com tipo inválido", async () => {
    const db = asFieldOwner(testEnv);
    await assertFails(
      db.doc("locations/loc-new-invalid-time-zone").set({
        name: "Arena sem Fuso Válido",
        owner_id: UID_FIELD_OWNER,
        is_active: true,
        is_verified: false,
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
        time_zone: 123,
      })
    );
  });

  it("Player NÃO pode criar local com is_verified=true (apenas admin altera)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("locations/loc-fake-verified").set({
        name: "Fraude Verificada",
        owner_id: UID_PLAYER_A,
        is_active: true,
        is_verified: true, // proibido na criação
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
      })
    );
  });

  it("Player NÃO pode criar local com owner_id de outro usuário", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("locations/loc-fraud-owner").set({
        name: "Fraude",
        owner_id: UID_PLAYER_B, // escalação
        is_active: true,
        is_verified: false,
        rating: null,
        latitude: null,
        longitude: null,
      })
    );
  });

  it("Não-autenticado NÃO pode criar local", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.doc("locations/loc-anon").set({
        name: "Anon",
        owner_id: "qualquer",
        is_active: true,
        is_verified: false,
      })
    );
  });
});

// ============================================================
// ATUALIZAÇÃO (UPDATE)
// ============================================================

describe("locations — atualização", () => {
  it("Owner pode adicionar fuso explícito a local legado", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}`).update({
        time_zone: "America/Manaus",
      })
    );
  });

  it("Owner pode atualizar campos básicos do próprio local", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}`).update({
        name: "Quadra Atualizada",
        owner_id: UID_PLAYER_A, // unchanged
        is_active: true,        // unchanged
        is_verified: false,     // unchanged
        rating: 4.0,
        latitude: -23.5,
        longitude: -46.6,
      })
    );
  });

  it("Owner NÃO pode alterar 'is_verified'", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}`).update({
        name: "Campo",
        owner_id: UID_PLAYER_A,
        is_active: true,
        is_verified: true, // proibido
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
      })
    );
  });

  it("Owner NÃO pode alterar 'owner_id'", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}`).update({
        name: "Campo",
        owner_id: UID_PLAYER_B, // transferência proibida
        is_active: true,
        is_verified: false,
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
      })
    );
  });

  it("Owner NÃO pode alterar 'managers' diretamente — deve usar convite via Function", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}`).update({
        name: "Campo",
        owner_id: UID_PLAYER_A,
        is_active: true,
        is_verified: false,
        rating: null,
        latitude: -23.5,
        longitude: -46.6,
        managers: [UID_PLAYER_B],
      })
    );
  });

  it("Admin pode atualizar is_verified (verificar local)", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db
        .doc(`locations/${LOC_PLAYER_A_OWNED}`)
        .update({ is_verified: true, name: "Campo Verificado", owner_id: UID_PLAYER_A })
    );
  });

  it("Player NÃO pode atualizar local de outro usuário", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}`).update({ name: "Invasão" })
    );
  });
});

// ============================================================
// REVIEWS
// ============================================================

describe("locations — avaliações", () => {
  const reviewsPath = `locations/${LOC_ACTIVE_VERIFIED}/reviews`;

  it("autor cria a primeira avaliação com created_at do servidor", async () => {
    const db = asPlayerA(testEnv);

    await assertSucceeds(
      db.doc(`${reviewsPath}/${UID_PLAYER_A}`).set({
        user_id: UID_PLAYER_A,
        user_name: "Player A",
        user_photo: null,
        rating: 5,
        comment: "Quadra excelente",
        created_at: serverTimestamp(),
      })
    );
  });

  it("autor atualiza avaliação preservando created_at e usando updated_at do servidor", async () => {
    const reviewPath = `${reviewsPath}/${UID_PLAYER_B}`;
    const createdAt = new Date(Date.now() - 5 * 60 * 1000);
    await seedDoc(testEnv, reviewPath, {
      user_id: UID_PLAYER_B,
      user_name: "Player B",
      user_photo: null,
      rating: 3,
      comment: "Avaliação original",
      created_at: createdAt,
    });

    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.doc(reviewPath).update({
        rating: 4,
        comment: "Avaliação atualizada",
        updated_at: serverTimestamp(),
      })
    );
  });

  it("nega nova atualização antes do cooldown de 60 segundos", async () => {
    const reviewPath = `${reviewsPath}/${UID_PLAYER_C}`;
    await seedDoc(testEnv, reviewPath, {
      user_id: UID_PLAYER_C,
      user_name: "Player C",
      user_photo: null,
      rating: 4,
      comment: "Avaliação recente",
      created_at: new Date(Date.now() - 5 * 60 * 1000),
      updated_at: new Date(),
    });

    const db = asUser(testEnv, UID_PLAYER_C);
    await assertFails(
      db.doc(reviewPath).update({
        rating: 5,
        comment: "Tentativa precoce",
        updated_at: serverTimestamp(),
      })
    );
  });
});

// ============================================================
// MANAGER INVITES
// ============================================================

describe("locations — convites de managers", () => {
  const INVITE_PATH = `locations/${LOC_PLAYER_A_OWNED}/manager_invites/invite-001`;

  beforeAll(async () => {
    await seedDoc(testEnv, INVITE_PATH, {
      manager_uid: UID_PLAYER_B,
      manager_email: "manager@example.com",
      status: "PENDING",
      created_by: UID_PLAYER_A,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 86400000),
    });
  });

  it("Owner, admin e destinatario podem ler convite de manager", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(INVITE_PATH).get());
    await assertSucceeds(asAdmin(testEnv).doc(INVITE_PATH).get());
    await assertSucceeds(asPlayerB(testEnv).doc(INVITE_PATH).get());
  });

  it("Destinatario por email pode ler convite mesmo sem manager_uid", async () => {
    const inviteByEmailPath =
      `locations/${LOC_PLAYER_A_OWNED}/manager_invites/invite-email`;
    await seedDoc(testEnv, inviteByEmailPath, {
      manager_uid: null,
      manager_email: "playerc@example.com",
      status: "PENDING",
      created_by: UID_PLAYER_A,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 86400000),
    });

    const db = asUser(testEnv, UID_PLAYER_C, {
      email: "PlayerC@Example.com",
    });
    await assertSucceeds(db.doc(inviteByEmailPath).get());
  });

  it("Usuario sem vinculo nao pode ler convite de manager", async () => {
    const db = asUser(testEnv, "uid-outsider-001");
    await assertFails(db.doc(INVITE_PATH).get());
  });

  it("Clientes nao criam, aceitam nem deletam convite direto", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}/manager_invites/new`).set({
        manager_uid: UID_PLAYER_B,
        status: "PENDING",
      })
    );
    await assertFails(db.doc(INVITE_PATH).update({status: "ACCEPTED"}));
    await assertFails(db.doc(INVITE_PATH).delete());
  });
});

describe("locations — ledger financeiro", () => {
  const LEDGER_PATH =
    `locations/${LOC_PLAYER_A_OWNED}/subscription_ledger/entry-001`;

  beforeAll(async () => {
    await seedDoc(testEnv, LEDGER_PATH, {
      type: "PAYMENT_REGISTERED",
      actor_user_id: UID_ADMIN,
      amount_cents: 19990,
      period_key: "2026-07",
      review_status: "APPROVED",
      created_at: new Date(),
    });
  });

  it("Owner e admin podem ler o ledger financeiro", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(LEDGER_PATH).get());
    await assertSucceeds(asAdmin(testEnv).doc(LEDGER_PATH).get());
  });

  it("Usuario sem vinculo nao pode ler o ledger financeiro", async () => {
    await assertFails(asPlayerB(testEnv).doc(LEDGER_PATH).get());
  });

  it("Clientes nao escrevem nem alteram ledger financeiro direto", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc(`locations/${LOC_PLAYER_A_OWNED}/subscription_ledger/new`).set({
        type: "PAYMENT_REGISTERED",
        amount_cents: 1,
      })
    );
    await assertFails(db.doc(LEDGER_PATH).update({amount_cents: 1}));
    await assertFails(db.doc(LEDGER_PATH).delete());
  });
});

// ============================================================
// DELEÇÃO (DELETE)
// ============================================================

describe("locations — deleção", () => {
  it("Admin pode deletar qualquer local", async () => {
    await seedDoc(testEnv, "locations/loc-for-delete", {
      name: "Para Deletar",
      owner_id: UID_FIELD_OWNER,
      is_active: true,
      is_verified: false,
      rating: null,
      latitude: null,
      longitude: null,
    });
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc("locations/loc-for-delete").delete());
  });

  it("FIELD_OWNER NÃO pode deletar local (apenas admin pode)", async () => {
    const db = asFieldOwner(testEnv);
    await assertFails(db.doc(`locations/${LOC_FIELD_OWNER_OWNED}`).delete());
  });

  it("Player NÃO pode deletar local", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(db.doc(`locations/${LOC_PLAYER_A_OWNED}`).delete());
  });

  it("Não-autenticado NÃO pode deletar local", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`locations/${LOC_ACTIVE_VERIFIED}`).delete());
  });
});

// ============================================================
// FIELDS — COLLECTION GROUP (#3955)
// ============================================================
// A query collectionGroup("fields") (web LocationsMapScreen e shared
// FirebaseDataSource) exige um match /{path=**}/fields/{id}. O match dentro
// de locations/{locationId}/fields e o root /fields nao cobrem o aggregate.
describe("fields — collection group", () => {
  const FIELD_CG_PATH = `locations/${LOC_ACTIVE_VERIFIED}/fields/field-cg-001`;

  beforeAll(async () => {
    await seedDoc(testEnv, FIELD_CG_PATH, {
      name: "Quadra CG",
      location_id: LOC_ACTIVE_VERIFIED,
      is_active: true,
      type: "SOCIETY",
      price_per_hour: 120,
      created_at: new Date(),
    });
  });

  it("Player autenticado pode listar fields via collection group", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(
      db.collectionGroup("fields").where("is_active", "==", true).limit(500).get()
    );
  });

  it("Admin pode listar fields via collection group", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.collectionGroup("fields").where("is_active", "==", true).limit(500).get()
    );
  });

  it("FIELD_OWNER autenticado pode listar fields via collection group", async () => {
    const db = asFieldOwner(testEnv);
    await assertSucceeds(
      db.collectionGroup("fields").where("is_active", "==", true).limit(500).get()
    );
  });

  it("Não-autenticado NÃO pode listar fields via collection group", async () => {
    const db = asAnon(testEnv);
    await assertFails(
      db.collectionGroup("fields").where("is_active", "==", true).limit(500).get()
    );
  });
});
