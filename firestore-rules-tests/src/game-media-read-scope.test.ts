/**
 * FIX #4393 — escopo de leitura de game_photos, game_videos e
 * games/{gameId}/waitlist.
 *
 * Antes: `allow read: if isAuthenticated()` cobria GET e LIST, então
 * `getDocs(collection(db, 'game_photos'))` devolvia a mídia (URL tokenizada)
 * de jogos privados para qualquer conta, e a fila expunha nome/foto.
 *
 * Agora só lê quem pode ver o jogo (canViewGameById): admin, jogo público,
 * ou (não soft-deleted) dono/coorganizador, membro ativo do grupo ou
 * participante (PENDING/CONFIRMED/ON_THE_WAY/CHECKED_IN).
 *
 * Cada bloco tem as queries de CONTROLE com o shape EXATO usado pelos
 * clientes (arquivo:linha no nome do teste) para provar que o fluxo legítimo
 * continua passando, e as negativas em GET e em LIST (com e sem filtro).
 */
import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asUser,
  asAnon,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GROUP_ID = "gm4393-group";
const UID_OWNER = "gm4393-owner";
const UID_CO = "gm4393-co";
const UID_MEMBER = "gm4393-member";
const UID_REMOVED_MEMBER = "gm4393-removed";
const UID_PARTICIPANT = "gm4393-participant"; // confirmado, não-membro
const UID_CHECKED_IN = "gm4393-checked-in"; // check-in, não-membro
const UID_CANCELLED = "gm4393-cancelled"; // confirmação cancelada, não-membro
const UID_OUTSIDER = "gm4393-outsider";

const PRIVATE_GAME = "gm4393-private";
const PUBLIC_GAME = "gm4393-public";
const DELETED_GAME = "gm4393-deleted";
const NO_GROUP_GAME = "gm4393-no-group"; // privado sem grupo (legado)
const MISSING_GAME = "gm4393-missing"; // mídia órfã: jogo apagado
// 10 jogos do mesmo grupo para o controle `in` do GroupDetailScreen.
const GROUP_GAMES = Array.from({ length: 10 }, (_, i) => `gm4393-group-game-${i}`);

function media(gameId: string, extra: Record<string, unknown> = {}) {
  return {
    game_id: gameId,
    url: `https://firebasestorage.googleapis.com/v0/b/x/o/${gameId}.jpg?token=t`,
    storage_path: `games/${gameId}/photos/${UID_OWNER}/a.jpg`,
    uploaded_by: UID_OWNER,
    uploaded_by_name: "Owner",
    reactions: {},
    status: "ACTIVE",
    created_at: new Date(),
    ...extra,
  };
}

function game(extra: Record<string, unknown>) {
  return {
    owner_id: UID_OWNER,
    co_organizers: [UID_CO],
    status: "FINISHED",
    group_id: GROUP_ID,
    visibility: "GROUP_ONLY",
    ...extra,
  };
}

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `groups/${GROUP_ID}`, { owner_id: UID_OWNER, name: "G" });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_MEMBER}`, {
    user_id: UID_MEMBER,
    role: "MEMBER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_REMOVED_MEMBER}`, {
    user_id: UID_REMOVED_MEMBER,
    role: "MEMBER",
    status: "REMOVED",
  });

  await seedDoc(testEnv, `games/${PRIVATE_GAME}`, game({}));
  await seedDoc(testEnv, `games/${PUBLIC_GAME}`, game({ visibility: "PUBLIC_OPEN", group_id: null }));
  await seedDoc(testEnv, `games/${DELETED_GAME}`, game({ deleted_at: new Date() }));
  await seedDoc(testEnv, `games/${NO_GROUP_GAME}`, game({ group_id: null }));
  for (const id of GROUP_GAMES) {
    await seedDoc(testEnv, `games/${id}`, game({}));
  }

  const confirmations: Array<[string, string, string]> = [
    [PRIVATE_GAME, UID_PARTICIPANT, "CONFIRMED"],
    [PRIVATE_GAME, UID_CHECKED_IN, "CHECKED_IN"],
    [PRIVATE_GAME, UID_CANCELLED, "CANCELLED"],
    [NO_GROUP_GAME, UID_PARTICIPANT, "CONFIRMED"],
  ];
  for (const [gameId, uid, status] of confirmations) {
    await seedDoc(testEnv, `confirmations/${gameId}_${uid}`, {
      game_id: gameId,
      user_id: uid,
      status,
    });
  }

  await seedDoc(testEnv, "game_photos/p-private", media(PRIVATE_GAME));
  await seedDoc(testEnv, "game_photos/p-public", media(PUBLIC_GAME));
  await seedDoc(testEnv, "game_photos/p-deleted", media(DELETED_GAME));
  await seedDoc(testEnv, "game_photos/p-no-group", media(NO_GROUP_GAME));
  await seedDoc(testEnv, "game_photos/p-orphan", media(MISSING_GAME));
  for (const id of GROUP_GAMES) {
    await seedDoc(testEnv, `game_photos/p-${id}`, media(id));
  }

  await seedDoc(testEnv, "game_videos/v-private", media(PRIVATE_GAME, { status: "READY" }));
  await seedDoc(testEnv, "game_videos/v-public", media(PUBLIC_GAME, { status: "READY" }));
  await seedDoc(testEnv, "game_videos/v-orphan", media(MISSING_GAME, { status: "READY" }));

  for (const gameId of [PRIVATE_GAME, PUBLIC_GAME]) {
    await seedDoc(testEnv, `games/${gameId}/waitlist/${UID_MEMBER}`, {
      user_id: UID_MEMBER,
      game_id: gameId,
      user_name: "Membro",
      user_photo: "https://example.com/m.jpg",
      status: "WAITING",
      queue_position: 1,
    });
  }
  // Ex-membro que entrou na fila antes de sair do grupo: continua vendo a
  // própria entrada, mas não a fila dos outros.
  await seedDoc(testEnv, `games/${PRIVATE_GAME}/waitlist/${UID_REMOVED_MEMBER}`, {
    user_id: UID_REMOVED_MEMBER,
    game_id: PRIVATE_GAME,
    user_name: "Ex-membro",
    status: "WAITING",
    queue_position: 2,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

/** Query do GamePhotosTab.tsx:123 / GameVideosTab.tsx:142 / GameVideosRepository.kt:41. */
function byGameQuery(uid: string | null, collection: string, gameId: string) {
  const db = uid ? asUser(testEnv, uid) : asAnon(testEnv);
  return db.collection(collection)
    .where("game_id", "==", gameId)
    .orderBy("created_at", "desc")
    .get();
}

describe("game_photos — leitura restrita a quem vê o jogo (#4393)", () => {
  it("CONTROLE GamePhotosTab.tsx:123 — membro do grupo lista fotos do jogo privado", async () => {
    await assertSucceeds(byGameQuery(UID_MEMBER, "game_photos", PRIVATE_GAME));
  });

  it("dono, coorganizador, membro, confirmado e check-in fazem GET da foto do jogo privado", async () => {
    for (const uid of [UID_OWNER, UID_CO, UID_MEMBER, UID_PARTICIPANT, UID_CHECKED_IN]) {
      await assertSucceeds(asUser(testEnv, uid).doc("game_photos/p-private").get());
    }
  });

  it("participante não-membro também lista (filtro game_id)", async () => {
    await assertSucceeds(byGameQuery(UID_PARTICIPANT, "game_photos", PRIVATE_GAME));
    await assertSucceeds(byGameQuery(UID_PARTICIPANT, "game_photos", NO_GROUP_GAME));
  });

  it("estranho é negado no GET e na LIST filtrada do jogo privado", async () => {
    await assertFails(asUser(testEnv, UID_OUTSIDER).doc("game_photos/p-private").get());
    await assertFails(byGameQuery(UID_OUTSIDER, "game_photos", PRIVATE_GAME));
  });

  it("membro REMOVED e confirmação CANCELLED não dão acesso", async () => {
    await assertFails(asUser(testEnv, UID_REMOVED_MEMBER).doc("game_photos/p-private").get());
    await assertFails(asUser(testEnv, UID_CANCELLED).doc("game_photos/p-private").get());
    await assertFails(byGameQuery(UID_CANCELLED, "game_photos", PRIVATE_GAME));
  });

  it("LIST sem filtro é negada para estranho E para membro (o vetor da issue)", async () => {
    await assertFails(asUser(testEnv, UID_OUTSIDER).collection("game_photos").get());
    await assertFails(asUser(testEnv, UID_MEMBER).collection("game_photos").get());
    await assertFails(asUser(testEnv, UID_MEMBER).collection("game_photos").limit(5).get());
  });

  it("jogo público: qualquer autenticado faz GET e LIST filtrada", async () => {
    await assertSucceeds(asUser(testEnv, UID_OUTSIDER).doc("game_photos/p-public").get());
    await assertSucceeds(byGameQuery(UID_OUTSIDER, "game_photos", PUBLIC_GAME));
  });

  it("anônimo é negado mesmo em jogo público", async () => {
    await assertFails(asAnon(testEnv).doc("game_photos/p-public").get());
    await assertFails(byGameQuery(null, "game_photos", PUBLIC_GAME));
  });

  it("jogo privado soft-deleted: membro negado, admin lê", async () => {
    await assertFails(asUser(testEnv, UID_MEMBER).doc("game_photos/p-deleted").get());
    await assertFails(byGameQuery(UID_MEMBER, "game_photos", DELETED_GAME));
    await assertSucceeds(asAdmin(testEnv).doc("game_photos/p-deleted").get());
  });

  it("mídia órfã (jogo apagado): admin lê para poder limpar (#4049), demais negados", async () => {
    await assertSucceeds(asAdmin(testEnv).doc("game_photos/p-orphan").get());
    await assertSucceeds(
      asAdmin(testEnv).collection("game_photos").where("game_id", "==", MISSING_GAME).get()
    );
    await assertFails(asUser(testEnv, UID_OWNER).doc("game_photos/p-orphan").get());
    await assertFails(byGameQuery(UID_OWNER, "game_photos", MISSING_GAME));
  });

  it("admin lista sem filtro (moderação)", async () => {
    await assertSucceeds(asAdmin(testEnv).collection("game_photos").limit(20).get());
  });

  it("CONTROLE GroupDetailScreen.tsx:242 — membro com `in` de 10 jogos visíveis do grupo", async () => {
    await assertSucceeds(
      asUser(testEnv, UID_MEMBER).collection("game_photos")
        .where("game_id", "in", GROUP_GAMES)
        .limit(60)
        .get()
    );
  });

  it("`in` misturando um jogo invisível é negado por inteiro (LIST é tudo-ou-nada)", async () => {
    await assertFails(
      asUser(testEnv, UID_MEMBER).collection("game_photos")
        .where("game_id", "in", [...GROUP_GAMES.slice(0, 9), DELETED_GAME])
        .limit(60)
        .get()
    );
  });

  it("estranho é negado no `in` dos jogos do grupo", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).collection("game_photos")
        .where("game_id", "in", GROUP_GAMES)
        .limit(60)
        .get()
    );
  });
});

describe("game_videos — leitura restrita a quem vê o jogo (#4393)", () => {
  it("CONTROLE GameVideosTab.tsx:142 / GameVideosRepository.kt:41 — membro lista vídeos", async () => {
    await assertSucceeds(byGameQuery(UID_MEMBER, "game_videos", PRIVATE_GAME));
  });

  it("participante não-membro faz GET e LIST filtrada", async () => {
    await assertSucceeds(asUser(testEnv, UID_PARTICIPANT).doc("game_videos/v-private").get());
    await assertSucceeds(byGameQuery(UID_PARTICIPANT, "game_videos", PRIVATE_GAME));
  });

  it("estranho é negado no GET e na LIST filtrada", async () => {
    await assertFails(asUser(testEnv, UID_OUTSIDER).doc("game_videos/v-private").get());
    await assertFails(byGameQuery(UID_OUTSIDER, "game_videos", PRIVATE_GAME));
  });

  it("LIST sem filtro é negada para estranho e para membro", async () => {
    await assertFails(asUser(testEnv, UID_OUTSIDER).collection("game_videos").get());
    await assertFails(asUser(testEnv, UID_MEMBER).collection("game_videos").get());
  });

  it("jogo público: estranho autenticado lê", async () => {
    await assertSucceeds(asUser(testEnv, UID_OUTSIDER).doc("game_videos/v-public").get());
    await assertSucceeds(byGameQuery(UID_OUTSIDER, "game_videos", PUBLIC_GAME));
  });

  it("mídia órfã: só admin", async () => {
    await assertSucceeds(asAdmin(testEnv).doc("game_videos/v-orphan").get());
    await assertFails(asUser(testEnv, UID_OWNER).doc("game_videos/v-orphan").get());
  });
});

/** Query do useWaitlist.ts:91 (web). */
function webWaitlistQuery(uid: string | null, gameId: string) {
  const db = uid ? asUser(testEnv, uid) : asAnon(testEnv);
  return db.collection(`games/${gameId}/waitlist`)
    .orderBy("queue_position", "asc")
    .limit(50)
    .get();
}

/** Query do WaitlistRepositoryImpl.kt:101/124/194 (Android). */
function androidWaitlistQuery(uid: string, gameId: string) {
  return asUser(testEnv, uid).collection(`games/${gameId}/waitlist`)
    .where("status", "in", ["WAITING", "NOTIFIED"])
    .orderBy("queue_position", "asc")
    .limit(50)
    .get();
}

describe("games/{gameId}/waitlist — leitura restrita a quem vê o jogo (#4393)", () => {
  it("CONTROLE useWaitlist.ts:91 — membro lista a fila do jogo privado", async () => {
    await assertSucceeds(webWaitlistQuery(UID_MEMBER, PRIVATE_GAME));
  });

  it("CONTROLE WaitlistRepositoryImpl.kt:101/124/194 — dono e participante listam a fila", async () => {
    await assertSucceeds(androidWaitlistQuery(UID_OWNER, PRIVATE_GAME));
    await assertSucceeds(androidWaitlistQuery(UID_PARTICIPANT, PRIVATE_GAME));
  });

  it("estranho é negado no GET da entrada e na LIST da fila do jogo privado", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc(`games/${PRIVATE_GAME}/waitlist/${UID_MEMBER}`).get()
    );
    await assertFails(webWaitlistQuery(UID_OUTSIDER, PRIVATE_GAME));
    await assertFails(androidWaitlistQuery(UID_OUTSIDER, PRIVATE_GAME));
  });

  it("CONTROLE WaitlistRepositoryImpl.kt:74/150/174 — ex-membro lê só a própria entrada", async () => {
    const db = asUser(testEnv, UID_REMOVED_MEMBER);
    await assertSucceeds(db.doc(`games/${PRIVATE_GAME}/waitlist/${UID_REMOVED_MEMBER}`).get());
    await assertSucceeds(
      db.collection(`games/${PRIVATE_GAME}/waitlist`)
        .where("user_id", "==", UID_REMOVED_MEMBER)
        .where("status", "in", ["WAITING", "NOTIFIED"])
        .limit(1)
        .get()
    );
    // ...mas não a fila inteira nem a entrada de outro jogador.
    await assertFails(webWaitlistQuery(UID_REMOVED_MEMBER, PRIVATE_GAME));
    await assertFails(db.doc(`games/${PRIVATE_GAME}/waitlist/${UID_MEMBER}`).get());
  });

  it("jogo público: qualquer autenticado lista a fila; anônimo negado", async () => {
    await assertSucceeds(webWaitlistQuery(UID_OUTSIDER, PUBLIC_GAME));
    await assertFails(webWaitlistQuery(null, PUBLIC_GAME));
  });

  it("admin lista a fila do jogo privado", async () => {
    await assertSucceeds(
      asAdmin(testEnv).collection(`games/${PRIVATE_GAME}/waitlist`).get()
    );
  });
});
