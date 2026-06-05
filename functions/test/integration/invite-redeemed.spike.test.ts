/**
 * Spike #2531 — Integração com emulador Firebase.
 *
 * Objetivo: provar que o emulador dispara onInviteRedeemed quando
 * invites/{code} sofre a transição used:false→true, e que um teste Jest
 * pode observar deterministicamente o member doc resultante.
 *
 * Pré-requisito: emuladores firestore+functions rodando (chamado via
 * `firebase emulators:exec`), que seta FIRESTORE_EMULATOR_HOST e
 * FIREBASE_EMULATED_FUNCTION_REFERENCE.
 *
 * NÃO usa mocks de firebase-admin nem de firebase-functions — o ponto
 * é bater no emulador real e observar o efeito colateral.
 */

import * as admin from "firebase-admin";

// Emuladores setam estas env vars automaticamente via emulators:exec.
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8085";

// Inicializa Admin SDK apontando para o emulador.
// initializeApp é idempotente se já inicializado (ex: lib/index.js carregou antes).
let db: admin.firestore.Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  // Evita "app already exists" se outro test suite ou lib/index.js já inicializou.
  if (admin.apps.length === 0) {
    admin.initializeApp({projectId: "futebadosparcas"});
  }
  db = admin.firestore();
});

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Aguarda (poll a cada 400 ms, até maxMs) que o documento em `docRef`
 * satisfaça `predicate`. Retorna o snapshot quando satisfeito, ou lança
 * um erro descritivo no timeout.
 */
async function pollUntil(
  docRef: admin.firestore.DocumentReference,
  predicate: (data: admin.firestore.DocumentData | undefined) => boolean,
  maxMs = 15000,
  intervalMs = 400
): Promise<admin.firestore.DocumentSnapshot> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const snap = await docRef.get();
    if (predicate(snap.data())) return snap;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  const finalSnap = await docRef.get();
  throw new Error(
    `pollUntil timeout após ${maxMs}ms. Último dado: ` +
    JSON.stringify(finalSnap.data() ?? "(não existe)")
  );
}

/** Retorna timestamp de Firestore ~5 minutos no futuro (convite válido). */
function futureTimestamp(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);
}

/** Gera IDs únicos para cada execução para evitar colisões entre reruns. */
function uid(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── limpeza ─────────────────────────────────────────────────────────────────

/**
 * Limpa documentos criados durante os testes para permitir reruns limpos.
 * Falhas aqui são silenciosas — o emulador descarta tudo ao parar.
 */
async function cleanup(paths: string[]): Promise<void> {
  await Promise.allSettled(paths.map((p) => db.doc(p).delete()));
}

// ─── testes ──────────────────────────────────────────────────────────────────

describe("Spike #2531 — onInviteRedeemed via emulador", () => {
  /**
   * Cenário POSITIVO: convite válido redimido cria member doc com status ACTIVE
   * e dispara onMemberWritten que incrementa member_count no grupo.
   */
  it(
    "POSITIVO: redimir convite válido cria groups/{gid}/members/{uid} com status ACTIVE",
    async () => {
      const groupId = uid();
      const userId = uid();
      const inviteCode = uid();

      const groupRef = db.doc(`groups/${groupId}`);
      const inviteRef = db.doc(`invites/${inviteCode}`);
      const memberRef = db.doc(`groups/${groupId}/members/${userId}`);
      const userRef = db.doc(`users/${userId}`);

      // Seed: grupo ATIVO
      await groupRef.set({
        name: "Spike Test Group",
        status: "ACTIVE",
        is_public: true,
        member_count: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Seed: perfil do usuário (para popular user_name no member doc)
      await userRef.set({
        name: "Spike Jogador",
        photo_url: null,
      });

      // Seed: convite válido, não usado
      await inviteRef.set({
        group_id: groupId,
        group_name: "Spike Test Group",
        used: false,
        used_by: null,
        expires_at: futureTimestamp(),
      });

      // Act: cliente "redime" o convite — exatamente o que web/Android fazem
      const t0 = Date.now();
      await inviteRef.update({
        used: true,
        used_by: userId,
        used_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Assert: aguarda o member doc aparecer (trigger é assíncrono)
      let memberSnap: admin.firestore.DocumentSnapshot;
      try {
        memberSnap = await pollUntil(
          memberRef,
          (data) => data?.status === "ACTIVE",
          15000
        );
      } catch (e) {
        // Diagnóstico: verifica se o build existe e se o trigger está registrado
        console.error("[SPIKE] member doc NÃO apareceu. Diagnóstico:");
        console.error("  FIRESTORE_EMULATOR_HOST:", process.env.FIRESTORE_EMULATOR_HOST);
        console.error("  FUNCTIONS_EMULATOR_HOST:", process.env.FUNCTIONS_EMULATOR_HOST);
        throw e;
      }

      const latencyMs = Date.now() - t0;
      console.log(`[SPIKE] Trigger latência: ${latencyMs}ms`);

      // Verifica shape exato do member doc
      const memberData = memberSnap.data()!;
      console.log("[SPIKE] Member doc shape:", JSON.stringify(memberData, null, 2));

      expect(memberData.status).toBe("ACTIVE");
      expect(memberData.role).toBe("MEMBER");
      expect(memberData.user_id).toBe(userId);
      expect(memberData.id).toBe(userId);
      expect(memberData.joined_via_invite).toBe(inviteCode);
      expect(memberData.joined_at).toBeDefined(); // serverTimestamp
      // NÃO deve setar _counted_by_join_request (onMemberWritten é o dono do counter)
      expect(memberData._counted_by_join_request).toBeUndefined();

      // Verifica que onMemberWritten incrementou member_count
      const groupSnap = await pollUntil(
        groupRef,
        (data) => typeof data?.member_count === "number" && data.member_count >= 1,
        10000
      );
      const groupData = groupSnap.data()!;
      console.log(`[SPIKE] member_count após trigger: ${groupData.member_count}`);
      expect(groupData.member_count).toBe(1);

      // Cleanup
      await cleanup([
        `groups/${groupId}`,
        `groups/${groupId}/members/${userId}`,
        `invites/${inviteCode}`,
        `users/${userId}`,
        `users/${userId}/groups/${groupId}`,
      ]);
    }
  );

  /**
   * Cenário NEGATIVO (sanidade): convite que permanece used:false não
   * deve produzir member doc dentro da janela de timeout.
   *
   * Prova que o trigger só dispara na transição false→true, não em qualquer
   * write em invites/.
   */
  it(
    "NEGATIVO: convite que permanece used:false não cria member doc",
    async () => {
      const groupId = uid();
      const userId = uid();
      const inviteCode = uid();

      const groupRef = db.doc(`groups/${groupId}`);
      const inviteRef = db.doc(`invites/${inviteCode}`);
      const memberRef = db.doc(`groups/${groupId}/members/${userId}`);

      // Seed: grupo ATIVO
      await groupRef.set({
        name: "Spike Test Group Neg",
        status: "ACTIVE",
        is_public: true,
        member_count: 0,
      });

      // Seed: convite válido, não usado
      await inviteRef.set({
        group_id: groupId,
        used: false,
        used_by: null,
        expires_at: futureTimestamp(),
      });

      // Act: escrevemos no convite mas NÃO mudamos used para true
      // (apenas atualiza um campo irrelevante — simula write sem redenção)
      await inviteRef.update({
        group_name: "Spike Updated",
        // used permanece false
      });

      // Espera 5 s (janela menor que a do positivo — trigger não deve disparar)
      await new Promise((res) => setTimeout(res, 5000));

      const memberSnap = await memberRef.get();
      console.log("[SPIKE] Negativo — member doc exists:", memberSnap.exists);
      expect(memberSnap.exists).toBe(false);

      // Cleanup
      await cleanup([
        `groups/${groupId}`,
        `invites/${inviteCode}`,
      ]);
    }
  );
});
