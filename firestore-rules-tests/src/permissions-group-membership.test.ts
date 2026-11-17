/**
 * Permissões — criação de grupo, entrada, pedido de entrada, saída e gestão de membros.
 *
 * Fonte das regras: firestore.rules
 *   - groups (criação e update): linhas 2381-2502
 *   - groups/{id}/members: linhas 2505-2620
 *   - groups/{id}/join_requests: linhas 2627-2665
 *
 * Cobre (UC2 e UC3):
 * - criar grupo (dono, anônimo, perfil incompleto, contadores e status iniciais)
 * - entrada direta em grupo público e negada em privado; bloqueado e banido
 * - pedido de entrada, aprovação e cancelamento
 * - saída do membro, dono que tenta sair sem transferir, transferência de titularidade
 * - promoção, remoção e alteração de papéis
 *
 * Cada negação vem com o teste positivo do mesmo papel quando a regra permite.
 * Dados fictícios: UIDs fixos e e-mails @example.test.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initTestEnv, seedDocs, asUser } from "./helpers.js";

const UID_DONO = "user-owner";
const UID_ADMIN = "user-admin";
const UID_MEMBRO = "user-member";
const UID_BANIDO = "user-banned";
const UID_REMOVIDO = "user-removed";
const UID_BLOQUEADO = "user-blocked";
const UID_VISITANTE = "user-visitor";
const UID_NOVO = "user-novo";
const UID_OUTRO_DONO = "user-outsider";
const UID_ADMIN_GLOBAL = "user-global-admin";

const PUBLICO = "grp-mem-publico";
const PRIVADO = "grp-mem-privado";
const OUTRO = "grp-mem-outro";

let testEnv: RulesTestEnvironment;

const dono = () => asUser(testEnv, UID_DONO);
const admin = () => asUser(testEnv, UID_ADMIN);
const membro = () => asUser(testEnv, UID_MEMBRO);
const visitante = () => asUser(testEnv, UID_VISITANTE);
const novo = () => asUser(testEnv, UID_NOVO);
const adminGlobal = () => asUser(testEnv, UID_ADMIN_GLOBAL, { role: "ADMIN" });

function grupo(nome: string, dono_id: string, publico: boolean, extra: Record<string, unknown> = {}) {
  return {
    name: nome,
    owner_id: dono_id,
    is_public: publico,
    status: "ACTIVE",
    member_count: 3,
    description: "Grupo de teste",
    created_at: new Date(),
    ...extra,
  };
}

function membroDoc(uid: string, role: string, status = "ACTIVE") {
  return { user_id: uid, role, status };
}

async function seedBase() {
  await seedDocs(testEnv, [
    { path: `groups/${PUBLICO}`, data: grupo("Grupo Publico", UID_DONO, true) },
    { path: `groups/${PUBLICO}/members/${UID_DONO}`, data: membroDoc(UID_DONO, "OWNER") },
    { path: `groups/${PUBLICO}/members/${UID_ADMIN}`, data: membroDoc(UID_ADMIN, "ADMIN") },
    { path: `groups/${PUBLICO}/members/${UID_MEMBRO}`, data: membroDoc(UID_MEMBRO, "MEMBER") },
    { path: `groups/${PUBLICO}/members/${UID_BANIDO}`, data: membroDoc(UID_BANIDO, "MEMBER", "BANNED") },
    { path: `groups/${PUBLICO}/members/${UID_REMOVIDO}`, data: membroDoc(UID_REMOVIDO, "MEMBER", "REMOVED") },
    { path: `groups/${PUBLICO}/blocked_players/${UID_BLOQUEADO}`, data: { user_id: UID_BLOQUEADO } },
    {
      path: `groups/${PUBLICO}/join_requests/${UID_VISITANTE}`,
      data: {
        user_id: UID_VISITANTE,
        status: "PENDING",
        created_at: new Date(),
      },
    },
    { path: `groups/${PRIVADO}`, data: grupo("Grupo Privado", UID_DONO, false) },
    { path: `groups/${PRIVADO}/members/${UID_DONO}`, data: membroDoc(UID_DONO, "OWNER") },
    { path: `groups/${PRIVADO}/members/${UID_ADMIN}`, data: membroDoc(UID_ADMIN, "ADMIN") },
    { path: `groups/${PRIVADO}/members/${UID_MEMBRO}`, data: membroDoc(UID_MEMBRO, "MEMBER") },
    { path: `groups/${OUTRO}`, data: grupo("Outro Grupo", UID_OUTRO_DONO, false) },
    { path: `groups/${OUTRO}/members/${UID_OUTRO_DONO}`, data: membroDoc(UID_OUTRO_DONO, "OWNER") },
  ]);
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBase();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// CRIAÇÃO DE GRUPO
// ============================================================

describe("criação de grupo", () => {
  it("usuário com perfil completo cria grupo como dono, com contador zerado", async () => {
    await assertSucceeds(
      novo().doc("groups/grp-novo-1").set(grupo("Novo Grupo", UID_NOVO, true, { member_count: 0 }))
    );
  });

  it("não cria grupo com owner_id de outra pessoa; anônimo e perfil incompleto também são negados", async () => {
    await assertFails(
      novo().doc("groups/grp-novo-2").set(grupo("Grupo Alheio", UID_DONO, true, { member_count: 0 }))
    );
    const anonimo = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      anonimo.doc("groups/grp-novo-3").set(grupo("Grupo Anonimo", UID_NOVO, true, { member_count: 0 }))
    );
    const semPerfil = asUser(testEnv, UID_NOVO, { profileComplete: false });
    await assertFails(
      semPerfil.doc("groups/grp-novo-4").set(grupo("Grupo Incompleto", UID_NOVO, true, { member_count: 0 }))
    );
  });

  it("grupo que nasce com member_count 5, status SUSPENDED ou nome de 2 caracteres é negado", async () => {
    const db = novo();
    await assertFails(db.doc("groups/grp-n-1").set(grupo("Grupo Ok", UID_NOVO, true, { member_count: 5 })));
    await assertFails(
      db.doc("groups/grp-n-2").set(grupo("Grupo Ok", UID_NOVO, true, { member_count: 0, status: "SUSPENDED" }))
    );
    await assertFails(db.doc("groups/grp-n-3").set(grupo("Gr", UID_NOVO, true, { member_count: 0 })));
  });

  it("criador grava o próprio membro OWNER no mesmo batch do grupo", async () => {
    const db = novo();
    const lote = db.batch();
    lote.set(db.doc("groups/grp-novo-5"), grupo("Grupo Batch", UID_NOVO, true, { member_count: 0 }));
    lote.set(db.doc(`groups/grp-novo-5/members/${UID_NOVO}`), membroDoc(UID_NOVO, "OWNER"));
    await assertSucceeds(lote.commit());
  });

  it("visitante NÃO grava membro OWNER em grupo de outro dono", async () => {
    await assertFails(
      visitante().doc(`groups/${OUTRO}/members/${UID_VISITANTE}`).set(membroDoc(UID_VISITANTE, "OWNER"))
    );
  });
});

// ============================================================
// ENTRADA DIRETA E PEDIDO DE ENTRADA
// ============================================================

describe("entrada em grupo", () => {
  it("visitante entra em grupo público como MEMBER ACTIVE", async () => {
    await assertSucceeds(
      novo().doc(`groups/${PUBLICO}/members/${UID_NOVO}`).set(membroDoc(UID_NOVO, "MEMBER"))
    );
  });

  it("visitante NÃO entra em grupo privado sem convite", async () => {
    await assertFails(
      visitante().doc(`groups/${PRIVADO}/members/${UID_VISITANTE}`).set(membroDoc(UID_VISITANTE, "MEMBER"))
    );
  });

  it("auto-inscrição com role ADMIN ou status PENDING é negada no grupo público", async () => {
    await assertFails(
      novo().doc(`groups/${PUBLICO}/members/${UID_NOVO}`).set(membroDoc(UID_NOVO, "ADMIN"))
    );
    await assertFails(
      novo().doc(`groups/${PUBLICO}/members/${UID_NOVO}`).set(membroDoc(UID_NOVO, "MEMBER", "PENDING"))
    );
  });

  it("usuário bloqueado (blocked_players) NÃO entra em grupo público", async () => {
    await assertFails(
      asUser(testEnv, UID_BLOQUEADO).doc(`groups/${PUBLICO}/members/${UID_BLOQUEADO}`).set(
        membroDoc(UID_BLOQUEADO, "MEMBER")
      )
    );
  });

  it("banido NÃO reativa o próprio vínculo alterando o status", async () => {
    await assertFails(
      asUser(testEnv, UID_BANIDO).doc(`groups/${PUBLICO}/members/${UID_BANIDO}`).update({ status: "ACTIVE" })
    );
  });

  it("visitante cria pedido de entrada em grupo público", async () => {
    await assertSucceeds(
      novo().doc(`groups/${PUBLICO}/join_requests/${UID_NOVO}`).set({
        user_id: UID_NOVO,
        status: "PENDING",
        created_at: new Date(),
      })
    );
  });

  it("pedido de entrada em grupo privado, ou já criado como APPROVED, é negado", async () => {
    await assertFails(
      novo().doc(`groups/${PRIVADO}/join_requests/${UID_NOVO}`).set({
        user_id: UID_NOVO,
        status: "PENDING",
        created_at: new Date(),
      })
    );
    await assertFails(
      novo().doc(`groups/${PUBLICO}/join_requests/${UID_NOVO}`).set({
        user_id: UID_NOVO,
        status: "APPROVED",
        created_at: new Date(),
      })
    );
  });
});

// ============================================================
// APROVAÇÃO DO PEDIDO
// ============================================================

describe("aprovação de pedido de entrada", () => {
  const aprovacao = (quem: string) => ({ status: "APPROVED", responded_at: new Date(), responded_by: quem });

  it("dono aprova pedido PENDING; administrador do grupo também aprova", async () => {
    await assertSucceeds(
      dono().doc(`groups/${PUBLICO}/join_requests/${UID_VISITANTE}`).update(aprovacao(UID_DONO))
    );
    await seedDocs(testEnv, [
      {
        path: `groups/${PUBLICO}/join_requests/user-pedido-2`,
        data: { user_id: "user-pedido-2", status: "PENDING", created_at: new Date() },
      },
    ]);
    await assertSucceeds(
      admin().doc(`groups/${PUBLICO}/join_requests/user-pedido-2`).update(aprovacao(UID_ADMIN))
    );
  });

  it("membro comum e o próprio solicitante NÃO aprovam o pedido", async () => {
    await assertFails(
      membro().doc(`groups/${PUBLICO}/join_requests/${UID_VISITANTE}`).update(aprovacao(UID_MEMBRO))
    );
    await assertFails(
      visitante().doc(`groups/${PUBLICO}/join_requests/${UID_VISITANTE}`).update(aprovacao(UID_VISITANTE))
    );
  });

  it("dono NÃO registra responded_by de outra pessoa", async () => {
    await assertFails(
      dono().doc(`groups/${PUBLICO}/join_requests/${UID_VISITANTE}`).update(aprovacao(UID_ADMIN))
    );
  });
});

// ============================================================
// SAÍDA DO GRUPO
// ============================================================

describe("saída do grupo", () => {
  it("membro comum sai do grupo apagando o próprio vínculo", async () => {
    await assertSucceeds(membro().doc(`groups/${PUBLICO}/members/${UID_MEMBRO}`).delete());
  });

  it("dono NÃO sai sem transferir a titularidade; banido NÃO apaga o próprio vínculo", async () => {
    await assertFails(dono().doc(`groups/${PUBLICO}/members/${UID_DONO}`).delete());
    await assertFails(asUser(testEnv, UID_BANIDO).doc(`groups/${PUBLICO}/members/${UID_BANIDO}`).delete());
  });

  it("solicitante cancela o próprio pedido; membro comum NÃO apaga pedido alheio", async () => {
    await assertSucceeds(visitante().doc(`groups/${PUBLICO}/join_requests/${UID_VISITANTE}`).delete());
    await assertFails(membro().doc(`groups/${PUBLICO}/join_requests/${UID_VISITANTE}`).delete());
  });
});

// ============================================================
// PAPÉIS E REMOÇÃO DE MEMBROS
// ============================================================

describe("papéis e remoção de membros", () => {
  it("administrador do grupo NÃO promove membro; dono promove membro comum a ADMIN", async () => {
    await assertFails(admin().doc(`groups/${PUBLICO}/members/${UID_MEMBRO}`).update({ role: "ADMIN" }));
    await assertSucceeds(dono().doc(`groups/${PUBLICO}/members/${UID_MEMBRO}`).update({ role: "ADMIN" }));
  });

  it("administrador remove membro comum; administrador NÃO altera o doc do dono", async () => {
    await assertSucceeds(
      admin().doc(`groups/${PUBLICO}/members/${UID_MEMBRO}`).update({ status: "REMOVED" })
    );
    await assertFails(admin().doc(`groups/${PUBLICO}/members/${UID_DONO}`).update({ status: "REMOVED" }));
  });

  it("membro comum NÃO remove outro membro, mas o administrador apaga o vínculo", async () => {
    await assertFails(
      membro().doc(`groups/${PUBLICO}/members/${UID_BANIDO}`).update({ status: "REMOVED" })
    );
    await assertFails(membro().doc(`groups/${PUBLICO}/members/${UID_REMOVIDO}`).delete());
    await assertSucceeds(admin().doc(`groups/${PUBLICO}/members/${UID_MEMBRO}`).delete());
  });

  it("dono transfere a titularidade em um batch; transferir para quem não é membro é negado", async () => {
    const db = dono();
    const lote = db.batch();
    lote.update(db.doc(`groups/${PUBLICO}`), { owner_id: UID_MEMBRO });
    lote.update(db.doc(`groups/${PUBLICO}/members/${UID_MEMBRO}`), { role: "OWNER" });
    lote.update(db.doc(`groups/${PUBLICO}/members/${UID_DONO}`), { role: "ADMIN" });
    await assertSucceeds(lote.commit());

    const invalido = db.batch();
    invalido.update(db.doc(`groups/${PRIVADO}`), { owner_id: UID_NOVO });
    invalido.update(db.doc(`groups/${PRIVADO}/members/${UID_DONO}`), { role: "ADMIN" });
    await assertFails(invalido.commit());
  });
});

// ============================================================
// METADADOS DO GRUPO E EXCLUSÃO
// ============================================================

describe("visibilidade do grupo", () => {
  it("membro lê grupo privado; visitante e dono de outro grupo NÃO leem; visitante lê público e anônimo não", async () => {
    await assertSucceeds(membro().doc(`groups/${PRIVADO}`).get());
    await assertFails(visitante().doc(`groups/${PRIVADO}`).get());
    await assertFails(asUser(testEnv, UID_OUTRO_DONO).doc(`groups/${PRIVADO}`).get());
    await assertSucceeds(visitante().doc(`groups/${PUBLICO}`).get());
    await assertFails(testEnv.unauthenticatedContext().firestore().doc(`groups/${PUBLICO}`).get());
  });
});

describe("metadados do grupo e exclusão", () => {
  it("dono atualiza o nome; membro comum e dono NÃO alteram member_count", async () => {
    await assertSucceeds(dono().doc(`groups/${PUBLICO}`).update({ name: "Nome Novo" }));
    await assertFails(membro().doc(`groups/${PUBLICO}`).update({ name: "Nome Pirata" }));
    await assertFails(dono().doc(`groups/${PUBLICO}`).update({ member_count: 99 }));
  });

  it("dono NÃO apaga o grupo fisicamente; administrador global apaga", async () => {
    await assertFails(dono().doc(`groups/${OUTRO}`).delete());
    await assertSucceeds(adminGlobal().doc(`groups/${OUTRO}`).delete());
  });

  it("administrador de grupo (não dono) faz soft delete, como a callable softDeleteGroup (soft-delete.ts:304-310)", async () => {
    // Paridade: a regra (firestore.rules:2445) e a callable aceitam OWNER e ADMIN.
    await assertSucceeds(
      admin().doc(`groups/${PUBLICO}`).update({ deleted_at: new Date(), deleted_by: UID_ADMIN })
    );
  });
});
