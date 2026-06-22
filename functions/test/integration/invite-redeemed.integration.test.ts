/**
 * TEST HARNESS #2531 — onInviteRedeemed + member-counter via emulador real.
 *
 * Fecha o gap das **0 invocações em prod** de `onInviteRedeemed` (#2518):
 * nenhum teste exercitava o disparo do trigger. Este suite roda contra o
 * **Firestore + Functions emulator** (sem mockar firebase-admin/functions),
 * importando os triggers reais via `lib/` e observando seus efeitos colaterais
 * pelo Admin SDK.
 *
 * Prova NÃO-TAUTOLÓGICA (DoD #2530/#2531): o member doc e o `member_count`
 * são criados/incrementados pelos TRIGGERS REAIS, não pelo corpo do teste.
 * Reverter o fix de #2518 (cliente recria member / trigger quebrado) faz o
 * cenário POSITIVO falhar.
 *
 * Para rodar:
 *   JAVA_HOME=<jdk21> firebase emulators:exec --only firestore,functions \
 *     'npx jest -c jest.integration.config.js test/integration'
 * (ou simplesmente `npm run test:integration` em functions/).
 *
 * Pré-requisito: JDK 21+ (firebase-tools >=15) e `npm run build` (gera lib/).
 *
 * Nota de ambiente (descoberto no spike #2531): dentro do sandbox do Functions
 * Emulator, `admin.firestore.FieldValue`/`.FieldPath` resolvem como `undefined`
 * (o namespace estático não é exposto via o require() do runtime emulado). Por
 * isso os triggers usam a API modular `import {FieldValue} from
 * "firebase-admin/firestore"`. Em produção (sem sandbox) ambos funcionam.
 */

import * as admin from "firebase-admin";

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8085";

let db: admin.firestore.Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  if (admin.apps.length === 0) {
    admin.initializeApp({projectId: "futebadosparcas"});
  }
  db = admin.firestore();
});

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Aguarda (poll a cada `intervalMs`, até `maxMs`) que o documento satisfaça
 * `predicate`. Retorna o snapshot satisfeito ou lança erro descritivo.
 * @param {admin.firestore.DocumentReference} docRef ref a observar
 * @param {Function} predicate teste sobre os dados
 * @param {number} maxMs timeout total
 * @param {number} intervalMs intervalo de poll
 * @return {Promise<admin.firestore.DocumentSnapshot>} snapshot satisfeito
 */
async function pollUntil(
  docRef: admin.firestore.DocumentReference,
  predicate: (data: admin.firestore.DocumentData | undefined) => boolean,
  maxMs = 30000,
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

/** @return {admin.firestore.Timestamp} timestamp ~5 min no futuro. */
function futureTimestamp(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);
}

/** @return {admin.firestore.Timestamp} timestamp ~5 min no passado. */
function pastTimestamp(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
}

/** @return {string} id único por execução (evita colisão entre reruns). */
function uid(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Limpa documentos criados. Falhas são silenciosas — o emulador descarta tudo
 * ao parar. NÃO deletamos `groups/{gid}` para não disparar `onGroupDeleted`
 * (cascade) e poluir o log; o teardown do emulador limpa.
 * @param {string[]} paths caminhos de documentos a deletar
 * @return {Promise<void>}
 */
async function cleanup(paths: string[]): Promise<void> {
  await Promise.allSettled(paths.map((p) => db.doc(p).delete()));
}

/**
 * Semeia grupo ATIVO/inativo + perfil de joiner. Retorna ids e refs.
 * @param {string} status status do grupo (ACTIVE/SUSPENDED/...)
 * @return {object} ids e refs do cenário
 */
async function seedScenario(status = "ACTIVE") {
  const groupId = uid();
  const userId = uid();
  const inviteCode = uid();

  await db.doc(`groups/${groupId}`).set({
    name: "Harness Group",
    status,
    is_public: true,
    member_count: 0,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${userId}`).set({name: "Harness Jogador", photo_url: null});

  return {
    groupId,
    userId,
    inviteCode,
    groupRef: db.doc(`groups/${groupId}`),
    inviteRef: db.doc(`invites/${inviteCode}`),
    memberRef: db.doc(`groups/${groupId}/members/${userId}`),
  };
}

// ─── testes ──────────────────────────────────────────────────────────────────

describe("Test Harness #2531 — onInviteRedeemed via emulador", () => {
  /**
   * POSITIVO — convite válido redimido cria member ACTIVE (via onInviteRedeemed)
   * e incrementa member_count 0→1 (via onMemberWritten). Prova central do DoD.
   */
  it(
    "POSITIVO: redimir convite válido cria member ACTIVE e member_count=1",
    async () => {
      const s = await seedScenario("ACTIVE");
      await s.inviteRef.set({
        group_id: s.groupId,
        group_name: "Harness Group",
        used: false,
        used_by: null,
        expires_at: futureTimestamp(),
      });

      // Act: cliente "redime" — exatamente o que web/Android fazem.
      await s.inviteRef.update({
        used: true,
        used_by: s.userId,
        used_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const memberSnap = await pollUntil(
        s.memberRef,
        (data) => data?.status === "ACTIVE",
        45000
      );
      const member = memberSnap.data()!;
      expect(member.status).toBe("ACTIVE");
      expect(member.role).toBe("MEMBER");
      expect(member.user_id).toBe(s.userId);
      expect(member.id).toBe(s.userId);
      expect(member.joined_via_invite).toBe(s.inviteCode);
      expect(member.joined_at).toBeDefined();
      // onMemberWritten é o dono do counter — trigger NÃO seta esta flag.
      expect(member._counted_by_join_request).toBeUndefined();

      const groupSnap = await pollUntil(
        s.groupRef,
        (data) => data?.member_count === 1,
        30000
      );
      expect(groupSnap.data()!.member_count).toBe(1);

      await cleanup([
        `groups/${s.groupId}/members/${s.userId}`,
        `invites/${s.inviteCode}`,
        `users/${s.userId}`,
        `users/${s.userId}/groups/${s.groupId}`,
      ]);
    }
  );

  /**
   * NEGATIVO (sanidade) — write em invites/ que NÃO faz a transição
   * used:false→true não dispara a criação de member. Prova que o trigger
   * reage só à redenção, não a qualquer update.
   */
  it(
    "NEGATIVO: write sem transição used→true não cria member",
    async () => {
      const s = await seedScenario("ACTIVE");
      await s.inviteRef.set({
        group_id: s.groupId,
        used: false,
        used_by: null,
        expires_at: futureTimestamp(),
      });

      // Update de campo irrelevante; used permanece false.
      await s.inviteRef.update({group_name: "Harness Updated"});

      await new Promise((res) => setTimeout(res, 5000));
      expect((await s.memberRef.get()).exists).toBe(false);

      await cleanup([`invites/${s.inviteCode}`, `users/${s.userId}`]);
    }
  );

  /**
   * IDEMPOTÊNCIA — uma segunda redenção (false→true) quando o member já existe
   * NÃO cria member duplicado nem incrementa member_count de novo. Exercita o
   * guard de idempotência do trigger (member já existe → skip).
   */
  it(
    "IDEMPOTÊNCIA: segunda redenção não duplica member nem re-incrementa count",
    async () => {
      const s = await seedScenario("ACTIVE");
      await s.inviteRef.set({
        group_id: s.groupId,
        group_name: "Harness Group",
        used: false,
        used_by: null,
        expires_at: futureTimestamp(),
      });

      // 1ª redenção → member criado, count 0→1.
      await s.inviteRef.update({
        used: true,
        used_by: s.userId,
        used_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      await pollUntil(s.memberRef, (d) => d?.status === "ACTIVE", 45000);
      await pollUntil(s.groupRef, (d) => d?.member_count === 1, 30000);

      // Reset sintético via Admin SDK (bypassa rules) para forçar uma nova
      // transição false→true e exercitar o guard de "member já existe".
      await s.inviteRef.update({used: false});
      await new Promise((res) => setTimeout(res, 1500));
      await s.inviteRef.update({
        used: true,
        used_by: s.userId,
        used_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Janela para um (indevido) re-processamento se manifestar.
      await new Promise((res) => setTimeout(res, 5000));

      const groupSnap = await s.groupRef.get();
      expect(groupSnap.data()!.member_count).toBe(1); // não re-incrementou

      const membersSnap = await db
        .collection(`groups/${s.groupId}/members`)
        .get();
      expect(membersSnap.size).toBe(1); // sem duplicata

      await cleanup([
        `groups/${s.groupId}/members/${s.userId}`,
        `invites/${s.inviteCode}`,
        `users/${s.userId}`,
        `users/${s.userId}/groups/${s.groupId}`,
      ]);
    }
  );

  /**
   * CONVITE EXPIRADO — redenção de convite com expires_at no passado não cria
   * member (defesa em profundidade, mesmo se a rule deixou passar).
   */
  it(
    "EXPIRADO: convite com expires_at no passado não cria member",
    async () => {
      const s = await seedScenario("ACTIVE");
      await s.inviteRef.set({
        group_id: s.groupId,
        used: false,
        used_by: null,
        expires_at: pastTimestamp(),
      });

      await s.inviteRef.update({
        used: true,
        used_by: s.userId,
        used_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await new Promise((res) => setTimeout(res, 5000));
      expect((await s.memberRef.get()).exists).toBe(false);
      expect((await s.groupRef.get()).data()!.member_count).toBe(0);

      await cleanup([`invites/${s.inviteCode}`, `users/${s.userId}`]);
    }
  );

  /**
   * GRUPO INATIVO — redenção válida mas grupo com status != ACTIVE não cria
   * member (trigger aborta em grupo inativo).
   */
  it(
    "GRUPO INATIVO: status != ACTIVE não cria member",
    async () => {
      const s = await seedScenario("SUSPENDED");
      await s.inviteRef.set({
        group_id: s.groupId,
        used: false,
        used_by: null,
        expires_at: futureTimestamp(),
      });

      await s.inviteRef.update({
        used: true,
        used_by: s.userId,
        used_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await new Promise((res) => setTimeout(res, 5000));
      expect((await s.memberRef.get()).exists).toBe(false);
      expect((await s.groupRef.get()).data()!.member_count).toBe(0);

      await cleanup([`invites/${s.inviteCode}`, `users/${s.userId}`]);
    }
  );
});

describe("Test Harness #2531 — member-counter (onMemberWritten) isolado", () => {
  /**
   * Cria member ACTIVE → +1; remove member → -1. Prova que o counter é
   * server-authoritative e simétrico, independente do caminho de invite.
   */
  it(
    "member ACTIVE incrementa e remoção decrementa member_count",
    async () => {
      const groupId = uid();
      const userId = uid();
      const groupRef = db.doc(`groups/${groupId}`);
      const memberRef = db.doc(`groups/${groupId}/members/${userId}`);

      await groupRef.set({
        name: "Counter Group",
        status: "ACTIVE",
        is_public: true,
        member_count: 0,
      });

      // CREATE ACTIVE → onMemberWritten faz +1.
      await memberRef.set({
        id: userId,
        user_id: userId,
        role: "MEMBER",
        status: "ACTIVE",
        joined_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      const afterCreate = await pollUntil(
        groupRef,
        (d) => d?.member_count === 1,
        30000
      );
      expect(afterCreate.data()!.member_count).toBe(1);

      // DELETE → onMemberWritten faz -1.
      await memberRef.delete();
      const afterDelete = await pollUntil(
        groupRef,
        (d) => d?.member_count === 0,
        30000
      );
      expect(afterDelete.data()!.member_count).toBe(0);

      await cleanup([`groups/${groupId}/members/${userId}`]);
    }
  );
});
