/**
 * Testes de Firestore Security Rules — Colecao: invites
 *
 * Issue #514: collection invites usada pelo web pra codigos de convite
 * compartilhaveis (link /join/:code). Antes do fix, NAO tinha rule —
 * todas writes caiam no catch-all deny.
 *
 * Schema (web/src/hooks/useGroups.ts useInvitePlayers):
 * - code, group_id, group_name, inviter_id, inviter_name,
 *   created_at, expires_at, used
 *
 * Cobertura:
 * - Read: qualquer auth (lookup por code)
 * - Create: apenas group admin (role OWNER/ADMIN no grupo) com inviter_id == self
 * - Update: marcar used=true (qualquer auth, somente campos used/used_by/used_at)
 * - Delete: criador ou admin global
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asAnon,
  seedDoc,
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GROUP_ID = "group-with-invites";
const ADMIN_GROUP_ID = "group-with-admin-invites";
const PRIVATE_GROUP_ID = "group-private-invites";
const VALID_INVITE = "invite-valid";
const USED_INVITE = "invite-used";

beforeAll(async () => {
  testEnv = await initTestEnv();

  // Seed: grupo onde Player A é OWNER, Player B é MEMBER, Player C nao membro
  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    name: "Grupo Convites",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
    status: "ACTIVE",
  });

  // #3613: Player C administra este grupo; Player B tem o mesmo papel,
  // mas inativo. A UI e as Rules devem distinguir os dois estados.
  await seedDoc(testEnv, `groups/${ADMIN_GROUP_ID}`, {
    name: "Grupo com Admin",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    description: "",
  });
  await seedDoc(testEnv, `groups/${ADMIN_GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${ADMIN_GROUP_ID}/members/${UID_PLAYER_C}`, {
    user_id: UID_PLAYER_C,
    role: "ADMIN",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${ADMIN_GROUP_ID}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "ADMIN",
    status: "INACTIVE",
  });

  // Convite valido criado por Player A
  await seedDoc(testEnv, `invites/${VALID_INVITE}`, {
    code: "ABC123",
    group_id: GROUP_ID,
    group_name: "Grupo Convites",
    inviter_id: UID_PLAYER_A,
    inviter_name: "Player A",
    used: false,
    expires_at: new Date(Date.now() + 86400000),
  });

  // Convite ja usado
  await seedDoc(testEnv, `invites/${USED_INVITE}`, {
    code: "USED01",
    group_id: GROUP_ID,
    group_name: "Grupo Convites",
    inviter_id: UID_PLAYER_A,
    inviter_name: "Player A",
    used: true,
    used_by: UID_PLAYER_C,
  });

  // #2517: grupo PRIVADO (is_public=false) — Player A é OWNER. Usado para
  // provar (a) que o self-create MEMBER pelo cliente continua BLOQUEADO em
  // grupo privado (proteção de #2153) e (b) que o convite redime corretamente
  // só pelo trigger (não testável aqui; coberto em functions/test).
  await seedDoc(testEnv, `groups/${PRIVATE_GROUP_ID}`, {
    name: "Grupo Privado",
    owner_id: UID_PLAYER_A,
    is_public: false,
    status: "ACTIVE",
    description: "",
  });
  await seedDoc(testEnv, `groups/${PRIVATE_GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// READ
// ============================================================

describe("invites — leitura", () => {
  it("Qualquer auth pode GET invite por doc-id (lookup por code = doc-id)", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(`invites/${VALID_INVITE}`).get());
    await assertSucceeds(asPlayerB(testEnv).doc(`invites/${VALID_INVITE}`).get());
    await assertSucceeds(asPlayerC(testEnv).doc(`invites/${VALID_INVITE}`).get());
    await assertSucceeds(asAdmin(testEnv).doc(`invites/${VALID_INVITE}`).get());
  });

  it("Nao-autenticado NAO pode ler invite", async () => {
    await assertFails(asAnon(testEnv).doc(`invites/${VALID_INVITE}`).get());
  });

  // #2351: list (enumeracao) bloqueado p/ nao-admin
  it("(NOVO #2351) Player NAO pode LIST a colecao invites (enumeracao)", async () => {
    await assertFails(asPlayerA(testEnv).collection("invites").get());
    await assertFails(asPlayerC(testEnv).collection("invites").get());
  });

  it("(NOVO #2351) Admin PODE LIST a colecao invites", async () => {
    await assertSucceeds(asAdmin(testEnv).collection("invites").get());
  });
});

// ============================================================
// CREATE
// ============================================================

describe("invites — criacao", () => {
  // #2351: doc-id DEVE ser igual ao code
  it("Group OWNER pode criar invite com inviter_id == self e doc-id == code", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(
      db.doc("invites/OWN001").set({
        code: "OWN001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Group ADMIN ativo pode criar invite (#3613)", async () => {
    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc("invites/ADM001").set({
        code: "ADM001",
        group_id: ADMIN_GROUP_ID,
        group_name: "Grupo com Admin",
        inviter_id: UID_PLAYER_C,
        inviter_name: "Player C",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Group ADMIN inativo nao pode criar invite (#3613)", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc("invites/INA001").set({
        code: "INA001",
        group_id: ADMIN_GROUP_ID,
        group_name: "Grupo com Admin",
        inviter_id: UID_PLAYER_B,
        inviter_name: "Player B",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("(NOVO #2351) Owner NAO pode criar invite com doc-id != code", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("invites/MISMATCH").set({
        code: "OTHER9",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Member SIMPLES (sem role admin) NAO pode criar invite", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc("invites/MEM001").set({
        code: "MEM001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_B,
        inviter_name: "Player B",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Nao-membro NAO pode criar invite pra grupo", async () => {
    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("invites/STR001").set({
        code: "STR001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_C,
        inviter_name: "Player C",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Owner NAO pode criar invite com inviter_id de OUTRO usuario (spoof)", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("invites/SPF001").set({
        code: "SPF001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_B, // tenta atribuir a outro
        inviter_name: "Spoofed",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });

  it("Owner NAO pode criar invite ja marcado como usado", async () => {
    const db = asPlayerA(testEnv);
    await assertFails(
      db.doc("invites/USD001").set({
        code: "USD001",
        group_id: GROUP_ID,
        group_name: "Grupo Convites",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: true, // nao pode comecar usado
        expires_at: new Date(Date.now() + 86400000),
      })
    );
  });
});

// ============================================================
// UPDATE — marcar como usado
// ============================================================

describe("invites — uso (update)", () => {
  it("Qualquer auth pode marcar invite como usado (used=true + used_by + used_at)", async () => {
    await seedDoc(testEnv, "invites/to-use-1", {
      code: "USE001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });

    const db = asPlayerC(testEnv);
    await assertSucceeds(
      db.doc("invites/to-use-1").update({
        used: true,
        used_by: UID_PLAYER_C,
        used_at: new Date(),
      })
    );
  });

  it("NAO pode reusar invite ja usado", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(
      db.doc(`invites/${USED_INVITE}`).update({
        used: true,
        used_by: UID_PLAYER_B,
        used_at: new Date(),
      })
    );
  });

  it("NAO pode alterar campos alem de used/used_by/used_at", async () => {
    await seedDoc(testEnv, "invites/to-tamper", {
      code: "TMP001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });

    const db = asPlayerC(testEnv);
    await assertFails(
      db.doc("invites/to-tamper").update({
        group_id: "outro-grupo", // tenta redirecionar
        used: true,
        used_by: UID_PLAYER_C,
        used_at: new Date(),
      })
    );
  });
});

// ============================================================
// REDENÇÃO DE CONVITE — self-create de membership (#2517 / regressão #2153)
//
// Arquitetura Opção A: o cliente NÃO cria mais o member doc na redenção; ele
// apenas marca invites/{code}.used=true e o trigger `onInviteRedeemed` cria a
// membership via admin SDK (testado em functions/test/invite-redeemed.test.ts,
// pois rules-unit-testing não executa triggers).
//
// Aqui provamos que a REGRA de self-create MEMBER continua intacta:
//  - SEM convite, em grupo PRIVADO → BLOQUEIA (proteção de #2153 preservada).
//  - SEM convite, em grupo PÚBLICO → permite (discovery direto, comportamento
//    legítimo já existente).
// ============================================================

describe("membership self-create — proteção #2153 (gate is_public)", () => {
  it(
    "(#2153) NÃO-membro NÃO pode self-create MEMBER em grupo PRIVADO " +
    "(sem convite) — proteção contra escalada de acesso",
    async () => {
      const db = asPlayerC(testEnv);
      await assertFails(
        db.doc(`groups/${PRIVATE_GROUP_ID}/members/${UID_PLAYER_C}`).set({
          user_id: UID_PLAYER_C,
          role: "MEMBER",
          status: "ACTIVE",
          joined_at: new Date(),
        })
      );
    }
  );

  it(
    "(#2153) self-create MEMBER em grupo privado falha MESMO com status ACTIVE " +
    "e campos válidos — o gate is_public é a barreira",
    async () => {
      const db = asPlayerB(testEnv);
      await assertFails(
        db.doc(`groups/${PRIVATE_GROUP_ID}/members/${UID_PLAYER_B}`).set({
          id: UID_PLAYER_B,
          user_id: UID_PLAYER_B,
          user_name: "Player B",
          role: "MEMBER",
          status: "ACTIVE",
          joined_at: new Date(),
        })
      );
    }
  );

  it(
    "NÃO-membro PODE self-create MEMBER em grupo PÚBLICO ativo " +
    "(discovery direto — comportamento legítimo preservado)",
    async () => {
      const db = asPlayerC(testEnv);
      await assertSucceeds(
        db.doc(`groups/${GROUP_ID}/members/${UID_PLAYER_C}`).set({
          id: UID_PLAYER_C,
          user_id: UID_PLAYER_C,
          user_name: "Player C",
          role: "MEMBER",
          status: "ACTIVE",
          joined_at: new Date(),
        })
      );
    }
  );

  it(
    "(#2153) self-create em grupo público SEM status ACTIVE falha",
    async () => {
      const db = asPlayerB(testEnv);
      await assertFails(
        db.doc(`groups/${GROUP_ID}/members/${UID_PLAYER_B}-x`).set({
          user_id: UID_PLAYER_B,
          role: "MEMBER",
          // status ausente → null != 'ACTIVE'
          joined_at: new Date(),
        })
      );
    }
  );
});

describe("redenção de convite — guards do update (#2517)", () => {
  it(
    "(c) convite EXPIRADO não pode ser redimido (used update falha)",
    async () => {
      await seedDoc(testEnv, "invites/expired-priv", {
        code: "EXP001",
        group_id: PRIVATE_GROUP_ID,
        group_name: "Grupo Privado",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: false,
        expires_at: new Date(Date.now() - 86400000), // expirado ontem
      });
      const db = asPlayerC(testEnv);
      await assertFails(
        db.doc("invites/expired-priv").update({
          used: true,
          used_by: UID_PLAYER_C,
          used_at: new Date(),
        })
      );
    }
  );

  it(
    "convite VÁLIDO de grupo PRIVADO pode ser marcado usado pelo joiner " +
    "(o trigger cria a membership — testado em functions/test)",
    async () => {
      await seedDoc(testEnv, "invites/valid-priv", {
        code: "PRV001",
        group_id: PRIVATE_GROUP_ID,
        group_name: "Grupo Privado",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      });
      const db = asPlayerC(testEnv);
      await assertSucceeds(
        db.doc("invites/valid-priv").update({
          used: true,
          used_by: UID_PLAYER_C,
          used_at: new Date(),
        })
      );
    }
  );

  it(
    "convite não pode ser marcado usado por OUTRO usuário (used_by != self)",
    async () => {
      await seedDoc(testEnv, "invites/spoof-priv", {
        code: "SPF002",
        group_id: PRIVATE_GROUP_ID,
        group_name: "Grupo Privado",
        inviter_id: UID_PLAYER_A,
        inviter_name: "Player A",
        used: false,
        expires_at: new Date(Date.now() + 86400000),
      });
      const db = asPlayerC(testEnv);
      await assertFails(
        db.doc("invites/spoof-priv").update({
          used: true,
          used_by: UID_PLAYER_B, // tenta atribuir a outro
          used_at: new Date(),
        })
      );
    }
  );
});

// ============================================================
// DELETE
// ============================================================

describe("invites — delecao", () => {
  it("Criador pode deletar proprio invite", async () => {
    await seedDoc(testEnv, "invites/to-delete-by-creator", {
      code: "DEL001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });
    await assertSucceeds(asPlayerA(testEnv).doc("invites/to-delete-by-creator").delete());
  });

  it("Admin global pode deletar qualquer invite", async () => {
    await seedDoc(testEnv, "invites/to-delete-by-admin", {
      code: "ADM001",
      group_id: GROUP_ID,
      group_name: "Grupo",
      inviter_id: UID_PLAYER_A,
      inviter_name: "A",
      used: false,
      expires_at: new Date(Date.now() + 86400000),
    });
    await assertSucceeds(asAdmin(testEnv).doc("invites/to-delete-by-admin").delete());
  });

  it("Player aleatorio NAO pode deletar invite alheio", async () => {
    await assertFails(asPlayerC(testEnv).doc(`invites/${VALID_INVITE}`).delete());
  });
});
