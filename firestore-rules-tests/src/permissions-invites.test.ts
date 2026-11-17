/**
 * Permissões — convites de grupo (group_invites) e convites legados (invites).
 *
 * Fonte das regras: firestore.rules
 *   - group_invites: linhas 3084-3148
 *   - invites (código de convite): linhas 3042-3079
 *
 * Cobre (UC1):
 * - criar convite (dono, admin, membro, visitante, outro grupo, anônimo)
 * - aceitar, recusar, cancelar, reutilizar e expirar convite
 * - convite de outro grupo e de usuário já ativo/banido
 * - leitura e exclusão por papel
 * - convite legado: resgate único, expirado, de outro usuário e criação direta
 *
 * Cada negação vem acompanhada do teste positivo do mesmo papel quando a regra permite.
 * Dados fictícios: UIDs fixos e e-mails @example.test.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  seedDocs,
  asUser,
  asAnon,
} from "./helpers.js";

const DIA = 24 * 60 * 60 * 1000;

// UIDs fictícios
const UID_DONO = "user-owner";
const UID_ADMIN = "user-admin";
const UID_MEMBRO = "user-member";
const UID_BANIDO = "user-banned";
const UID_REMOVIDO = "user-removed";
const UID_CONVIDADO = "user-invitee";
const UID_NOVO = "user-novo";
const UID_VISITANTE = "user-visitor";
const UID_OUTRO_DONO = "user-outsider";
const UID_ADMIN_GLOBAL = "user-global-admin";

// Grupos fictícios
const GRUPO = "grp-convites-01";
const GRUPO_OUTRO = "grp-convites-02";

let testEnv: RulesTestEnvironment;

function convite(expiraEm: number, status: string, extra: Record<string, unknown> = {}) {
  return {
    group_id: GRUPO,
    group_name: "Grupo Convites",
    invited_by_id: UID_DONO,
    invited_user_id: UID_CONVIDADO,
    invited_user_name: "Convidado Teste",
    status,
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: new Date(expiraEm),
    ...extra,
  };
}

function novoConvite(sobrescrever: Record<string, unknown> = {}) {
  return convite(Date.now() + 3 * DIA, "PENDING", {
    invited_user_id: UID_NOVO,
    invited_user_name: "Novo Convidado",
    ...sobrescrever,
  });
}

async function seedBase() {
  const agora = Date.now();
  await seedDocs(testEnv, [
    {
      path: `groups/${GRUPO}`,
      data: {
        name: "Grupo Convites",
        owner_id: UID_DONO,
        is_public: false,
        status: "ACTIVE",
        member_count: 4,
        description: "Grupo de teste de convites",
        created_at: new Date(),
      },
    },
    { path: `groups/${GRUPO}/members/${UID_DONO}`, data: { user_id: UID_DONO, role: "OWNER", status: "ACTIVE" } },
    { path: `groups/${GRUPO}/members/${UID_ADMIN}`, data: { user_id: UID_ADMIN, role: "ADMIN", status: "ACTIVE" } },
    { path: `groups/${GRUPO}/members/${UID_MEMBRO}`, data: { user_id: UID_MEMBRO, role: "MEMBER", status: "ACTIVE" } },
    { path: `groups/${GRUPO}/members/${UID_BANIDO}`, data: { user_id: UID_BANIDO, role: "MEMBER", status: "BANNED" } },
    { path: `groups/${GRUPO}/members/${UID_REMOVIDO}`, data: { user_id: UID_REMOVIDO, role: "MEMBER", status: "REMOVED" } },
    {
      path: `groups/${GRUPO_OUTRO}`,
      data: {
        name: "Outro Grupo",
        owner_id: UID_OUTRO_DONO,
        is_public: false,
        status: "ACTIVE",
        member_count: 1,
        description: "",
        created_at: new Date(),
      },
    },
    {
      path: `groups/${GRUPO_OUTRO}/members/${UID_OUTRO_DONO}`,
      data: { user_id: UID_OUTRO_DONO, role: "OWNER", status: "ACTIVE" },
    },
    { path: "group_invites/inv-pendente", data: convite(agora + 3 * DIA, "PENDING") },
    { path: "group_invites/inv-expirado", data: convite(agora - DIA, "PENDING") },
    { path: "group_invites/inv-recusado", data: convite(agora + 3 * DIA, "DECLINED") },
    {
      path: "invites/COD-VALIDO",
      data: {
        code: "COD-VALIDO",
        group_id: GRUPO,
        inviter_id: UID_DONO,
        used: false,
        used_by: null,
        expires_at: new Date(agora + 3 * DIA),
        created_at: new Date(),
      },
    },
    {
      path: "invites/COD-EXPIRADO",
      data: {
        code: "COD-EXPIRADO",
        group_id: GRUPO,
        inviter_id: UID_DONO,
        used: false,
        used_by: null,
        expires_at: new Date(agora - DIA),
        created_at: new Date(),
      },
    },
    {
      path: "invites/COD-USADO",
      data: {
        code: "COD-USADO",
        group_id: GRUPO,
        inviter_id: UID_DONO,
        used: true,
        used_by: UID_MEMBRO,
        used_at: new Date(),
        expires_at: new Date(agora + 3 * DIA),
        created_at: new Date(),
      },
    },
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
// CRIAÇÃO DE CONVITE (group_invites)
// ============================================================

describe("convites de grupo — criação", () => {
  it("dono cria convite PENDING para usuário sem vínculo no grupo", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertSucceeds(db.doc("group_invites/inv-novo").set(novoConvite()));
  });

  it("dono cria convite para ex-membro REMOVIDO (reconvite permitido)", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertSucceeds(
      db.doc("group_invites/inv-reconvite").set(novoConvite({ invited_user_id: UID_REMOVIDO }))
    );
  });

  it("convite com expires_at acima de 7 dias é negado", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(
      db.doc("group_invites/inv-longo").set(
        novoConvite({ expires_at: new Date(Date.now() + 8 * DIA) })
      )
    );
  });

  it("convite criado já vencido é negado", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(
      db.doc("group_invites/inv-vencido").set(
        novoConvite({ expires_at: new Date(Date.now() - 60 * 60 * 1000) })
      )
    );
  });

  it("convite que nasce com status ACCEPTED é negado", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(db.doc("group_invites/inv-nasce-aceito").set(novoConvite({ status: "ACCEPTED" })));
  });

  it("convite para usuário já ACTIVE no grupo é negado", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(db.doc("group_invites/inv-ativo").set(novoConvite({ invited_user_id: UID_MEMBRO })));
  });

  it("convite para usuário BANIDO no grupo é negado", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(db.doc("group_invites/inv-banido").set(novoConvite({ invited_user_id: UID_BANIDO })));
  });

  it("dono não pode convidar a si mesmo", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(db.doc("group_invites/inv-si-mesmo").set(novoConvite({ invited_user_id: UID_DONO })));
  });

  it("convite com invited_by_id de outra pessoa (forjado) é negado", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(db.doc("group_invites/inv-forjado").set(novoConvite({ invited_by_id: UID_ADMIN })));
  });

  it("dono de um grupo não cria convite para outro grupo que não é dele", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(db.doc("group_invites/inv-grupo-alheio").set(novoConvite({ group_id: GRUPO_OUTRO })));
  });

  it("administrador do grupo (não dono) NÃO cria convite", async () => {
    const db = asUser(testEnv, UID_ADMIN);
    await assertFails(db.doc("group_invites/inv-admin").set(novoConvite({ invited_by_id: UID_ADMIN })));
  });

  it("membro comum NÃO cria convite", async () => {
    const db = asUser(testEnv, UID_MEMBRO);
    await assertFails(db.doc("group_invites/inv-membro").set(novoConvite({ invited_by_id: UID_MEMBRO })));
  });

  it("visitante sem vínculo NÃO cria convite", async () => {
    const db = asUser(testEnv, UID_VISITANTE);
    await assertFails(db.doc("group_invites/inv-visitante").set(novoConvite({ invited_by_id: UID_VISITANTE })));
  });

  it("anônimo não cria convite", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc("group_invites/inv-anon").set(novoConvite()));
  });
});

// ============================================================
// RESPOSTA AO CONVITE (aceitar, recusar, cancelar)
// ============================================================

describe("convites de grupo — aceitar, recusar e cancelar", () => {
  it("destinatário aceita convite PENDING válido", async () => {
    const db = asUser(testEnv, UID_CONVIDADO);
    await assertSucceeds(
      db.doc("group_invites/inv-pendente").update({ status: "ACCEPTED", updated_at: new Date() })
    );
  });

  it("destinatário recusa convite PENDING válido", async () => {
    const db = asUser(testEnv, UID_CONVIDADO);
    await assertSucceeds(
      db.doc("group_invites/inv-pendente").update({ status: "DECLINED", updated_at: new Date() })
    );
  });

  it("destinatário NÃO aceita convite expirado nem convite inexistente", async () => {
    const db = asUser(testEnv, UID_CONVIDADO);
    await assertFails(
      db.doc("group_invites/inv-expirado").update({ status: "ACCEPTED", updated_at: new Date() })
    );
    await assertFails(
      db.doc("group_invites/inv-inexistente").update({ status: "ACCEPTED", updated_at: new Date() })
    );
  });

  it("destinatário NÃO altera group_id junto com a resposta", async () => {
    const db = asUser(testEnv, UID_CONVIDADO);
    await assertFails(
      db.doc("group_invites/inv-pendente").update({
        status: "ACCEPTED",
        updated_at: new Date(),
        group_id: GRUPO_OUTRO,
      })
    );
  });

  it("destinatário NÃO marca o convite como CANCELLED", async () => {
    const db = asUser(testEnv, UID_CONVIDADO);
    await assertFails(
      db.doc("group_invites/inv-pendente").update({ status: "CANCELLED", updated_at: new Date() })
    );
  });

  it("destinatário NÃO reaproveita convite já recusado (reuso)", async () => {
    const db = asUser(testEnv, UID_CONVIDADO);
    await assertFails(
      db.doc("group_invites/inv-recusado").update({ status: "ACCEPTED", updated_at: new Date() })
    );
  });

  it("terceiro sem relação NÃO aceita convite alheio", async () => {
    const db = asUser(testEnv, UID_VISITANTE);
    await assertFails(
      db.doc("group_invites/inv-pendente").update({ status: "ACCEPTED", updated_at: new Date() })
    );
  });

  it("remetente NÃO marca como ACCEPTED no lugar do destinatário", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(
      db.doc("group_invites/inv-pendente").update({ status: "ACCEPTED", updated_at: new Date() })
    );
  });

  it("remetente cancela convite PENDING", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertSucceeds(
      db.doc("group_invites/inv-pendente").update({ status: "CANCELLED", updated_at: new Date() })
    );
  });
});

// ============================================================
// LEITURA E EXCLUSÃO DE CONVITE
// ============================================================

describe("convites de grupo — leitura e exclusão", () => {
  it("destinatário lê o próprio convite", async () => {
    await assertSucceeds(asUser(testEnv, UID_CONVIDADO).doc("group_invites/inv-pendente").get());
  });

  it("remetente lê o convite que enviou", async () => {
    await assertSucceeds(asUser(testEnv, UID_DONO).doc("group_invites/inv-pendente").get());
  });

  it("administrador do grupo lê convite de outra pessoa", async () => {
    await assertSucceeds(asUser(testEnv, UID_ADMIN).doc("group_invites/inv-pendente").get());
  });

  it("membro comum NÃO lê convite de outra pessoa", async () => {
    await assertFails(asUser(testEnv, UID_MEMBRO).doc("group_invites/inv-pendente").get());
  });

  it("visitante e anônimo NÃO leem convite", async () => {
    await assertFails(asUser(testEnv, UID_VISITANTE).doc("group_invites/inv-pendente").get());
    await assertFails(asAnon(testEnv).doc("group_invites/inv-pendente").get());
  });

  it("remetente apaga o convite que enviou", async () => {
    await assertSucceeds(asUser(testEnv, UID_DONO).doc("group_invites/inv-pendente").delete());
  });

  it("administrador do grupo apaga convite pendente", async () => {
    await assertSucceeds(asUser(testEnv, UID_ADMIN).doc("group_invites/inv-pendente").delete());
  });

  it("membro comum e destinatário NÃO apagam convite", async () => {
    await assertFails(asUser(testEnv, UID_MEMBRO).doc("group_invites/inv-pendente").delete());
    await assertFails(asUser(testEnv, UID_CONVIDADO).doc("group_invites/inv-pendente").delete());
  });
});

// ============================================================
// CONVITE LEGADO POR CÓDIGO (invites)
// ============================================================

describe("convites legados por código (invites)", () => {
  it("qualquer usuário autenticado resgata código válido e não usado", async () => {
    const db = asUser(testEnv, UID_NOVO);
    await assertSucceeds(
      db.doc("invites/COD-VALIDO").update({ used: true, used_by: UID_NOVO, used_at: new Date() })
    );
  });

  it("código já usado NÃO pode ser resgatado de novo (reuso)", async () => {
    const db = asUser(testEnv, UID_NOVO);
    await assertFails(
      db.doc("invites/COD-USADO").update({ used: true, used_by: UID_NOVO, used_at: new Date() })
    );
  });

  it("código expirado NÃO pode ser resgatado", async () => {
    const db = asUser(testEnv, UID_NOVO);
    await assertFails(
      db.doc("invites/COD-EXPIRADO").update({ used: true, used_by: UID_NOVO, used_at: new Date() })
    );
  });

  it("não é possível marcar used_by com o UID de outra pessoa", async () => {
    const db = asUser(testEnv, UID_NOVO);
    await assertFails(
      db.doc("invites/COD-VALIDO").update({ used: true, used_by: UID_MEMBRO, used_at: new Date() })
    );
  });

  it("resgate que também altera group_id é negado", async () => {
    const db = asUser(testEnv, UID_NOVO);
    await assertFails(
      db.doc("invites/COD-VALIDO").update({
        used: true,
        used_by: UID_NOVO,
        used_at: new Date(),
        group_id: GRUPO_OUTRO,
      })
    );
  });

  it("criação direta de convite legado por cliente é negada, inclusive pelo dono", async () => {
    const db = asUser(testEnv, UID_DONO);
    await assertFails(
      db.doc("invites/COD-NOVO").set({
        code: "COD-NOVO",
        group_id: GRUPO,
        inviter_id: UID_DONO,
        used: false,
        used_by: null,
        expires_at: new Date(Date.now() + DIA),
      })
    );
  });

  it("autenticado lê convite legado pelo próprio código (get)", async () => {
    await assertSucceeds(asUser(testEnv, UID_NOVO).doc("invites/COD-VALIDO").get());
  });

  it("anônimo NÃO lê convite legado", async () => {
    await assertFails(asAnon(testEnv).doc("invites/COD-VALIDO").get());
  });

  it("jogador comum NÃO lista a coleção invites", async () => {
    await assertFails(asUser(testEnv, UID_MEMBRO).collection("invites").get());
  });

  it("administrador global lista a coleção invites", async () => {
    await assertSucceeds(
      asUser(testEnv, UID_ADMIN_GLOBAL, { role: "ADMIN" }).collection("invites").get()
    );
  });

});
