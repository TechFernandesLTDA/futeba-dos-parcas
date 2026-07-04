import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asUser,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GROUP_ID = "group-wall-test";
const LEGACY_OWNER_GROUP_ID = "group-wall-legacy-owner";
const UID_OUTSIDER = "uid-wall-outsider";

const validPost = {
  group_id: GROUP_ID,
  author_name: "Player B",
  author_photo_url: null,
  text: "Bora pra resenha!",
  media_url: null,
  media_path: null,
  media_type: null,
  thumbnail_path: null,
  highlight_ref: null,
  pinned: false,
  pinned_by: null,
  pinned_at: null,
  reactions: {},
  comments_count: 0,
  deleted_by: null,
  deleted_at: null,
  edited_at: null,
  updated_at: serverTimestamp(),
};

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    name: "Wall Test Group",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
    member_count: 3,
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

  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_C}`, {
    user_id: UID_PLAYER_C,
    role: "ADMIN",
    status: "ACTIVE",
  });

  await seedDoc(testEnv, `groups/${LEGACY_OWNER_GROUP_ID}`, {
    name: "Legacy Owner Wall Test Group",
    owner_id: UID_PLAYER_A,
    is_public: false,
    status: "ACTIVE",
    member_count: 1,
  });

  await seedDoc(testEnv, `groups/${LEGACY_OWNER_GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("groups/{groupId}/wall_posts", () => {
  it("membro pode ler posts do mural", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).collection(`groups/${GROUP_ID}/wall_posts`).get()
    );
  });

  it("admin global pode ler posts do mural", async () => {
    await assertSucceeds(
      asAdmin(testEnv).collection(`groups/${GROUP_ID}/wall_posts`).get()
    );
  });

  it("nao-membro nao pode ler posts", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).collection(`groups/${GROUP_ID}/wall_posts`).get()
    );
  });

  it("anonimo nao pode ler posts", async () => {
    await assertFails(
      asAnon(testEnv).collection(`groups/${GROUP_ID}/wall_posts`).get()
    );
  });

  it("membro pode criar post", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-1`).set({
        ...validPost,
        author_id: UID_PLAYER_B,
        created_at: serverTimestamp(),
      })
    );
  });

  it("admin do grupo pode criar post", async () => {
    await assertSucceeds(
      asPlayerC(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-admin`).set({
        ...validPost,
        author_id: UID_PLAYER_C,
        text: "Aviso oficial",
        created_at: serverTimestamp(),
      })
    );
  });

  it("owner legado sem status ACTIVE no member doc pode criar post", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`groups/${LEGACY_OWNER_GROUP_ID}/wall_posts/post-legacy-owner`).set({
        ...validPost,
        group_id: LEGACY_OWNER_GROUP_ID,
        author_id: UID_PLAYER_A,
        text: "Post do owner legado",
        created_at: serverTimestamp(),
      })
    );
  });

  it("bloqueia forjar autoria", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-forge`).set({
        ...validPost,
        author_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("bloqueia texto vazio ou muito longo", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-empty`).set({
        ...validPost,
        author_id: UID_PLAYER_B,
        text: "",
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-long`).set({
        ...validPost,
        author_id: UID_PLAYER_B,
        text: "x".repeat(501),
        created_at: serverTimestamp(),
      })
    );
  });

  it("bloqueia backdate", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-backdate`).set({
        ...validPost,
        author_id: UID_PLAYER_B,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
    );
  });

  it("bloqueia pinned=true no create", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-pinned`).set({
        ...validPost,
        author_id: UID_PLAYER_B,
        pinned: true,
        created_at: serverTimestamp(),
      })
    );
  });

  it("autor pode editar proprio texto", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-edit-self`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertSucceeds(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-edit-self`).update({
        text: "Texto atualizado",
        edited_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("outro membro nao pode editar texto de terceiro", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-edit-other`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertFails(
      asPlayerC(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-edit-other`).update({
        text: "Texto alterado",
        edited_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("owner/admin pode fixar/desfixar post", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-pin`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertSucceeds(
      asPlayerA(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-pin`).update({
        pinned: true,
        pinned_by: UID_PLAYER_A,
        pinned_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("membro comum nao pode fixar post", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-pin-denied`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertFails(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-pin-denied`).update({
        pinned: true,
        pinned_by: UID_PLAYER_B,
        pinned_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("autor pode soft-deletar proprio post", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-delete-self`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertSucceeds(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-delete-self`).update({
        deleted_at: serverTimestamp(),
        deleted_by: UID_PLAYER_B,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("admin do grupo pode soft-deletar post de terceiro", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-delete-admin`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertSucceeds(
      asPlayerC(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-delete-admin`).update({
        deleted_at: serverTimestamp(),
        deleted_by: UID_PLAYER_C,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("owner pode soft-deletar post de terceiro", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-delete-owner`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertSucceeds(
      asPlayerA(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-delete-owner`).update({
        deleted_at: serverTimestamp(),
        deleted_by: UID_PLAYER_A,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("hard delete e bloqueado", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-hard-delete`, {
      ...validPost,
      author_id: UID_PLAYER_B,
      created_at: new Date(),
    });
    await assertFails(
      asPlayerB(testEnv).doc(`groups/${GROUP_ID}/wall_posts/post-hard-delete`).delete()
    );
  });
});
