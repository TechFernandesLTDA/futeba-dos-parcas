import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asUser,
  asAnon,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GROUP_ID = "group-wall-test";
const LEGACY_OWNER_GROUP_ID = "group-wall-legacy-owner";
const UID_OUTSIDER = "uid-wall-outsider";
const UID_WALL_OWNER = "uid-wall-owner-001";
const UID_WALL_MEMBER = "uid-wall-member-001";
const UID_WALL_LEGACY_MEMBER = "uid-wall-legacy-member-001";
const UID_WALL_INACTIVE = "uid-wall-inactive-001";
const UID_WALL_ADMIN = "uid-wall-admin-001";
const ANDROID_TEXT_REQUEST_ID = "0190c2d4-90c2-7b1d-a43d-4f7e05bdb999";

function webAutoPostId(label: string): string {
  return `${label.replace(/[^A-Za-z0-9]/g, "")}00000000000000000000`
    .slice(0, 20);
}

function asWallOwner() {
  return asUser(testEnv, UID_WALL_OWNER);
}

function asWallMember() {
  return asUser(testEnv, UID_WALL_MEMBER);
}

function asWallLegacyMember() {
  return asUser(testEnv, UID_WALL_LEGACY_MEMBER);
}

function asWallInactiveMember() {
  return asUser(testEnv, UID_WALL_INACTIVE);
}

function asWallAdmin() {
  return asUser(testEnv, UID_WALL_ADMIN);
}

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

  await seedDoc(testEnv, `users/${UID_WALL_OWNER}`, {
    name: "Player A",
    photo_url: null,
    role: "PLAYER",
  });
  await seedDoc(testEnv, `users/${UID_WALL_MEMBER}`, {
    name: "Player B",
    photo_url: null,
    role: "PLAYER",
  });
  await seedDoc(testEnv, `users/${UID_WALL_ADMIN}`, {
    name: "Player C",
    photo_url: null,
    role: "PLAYER",
  });
  await seedDoc(testEnv, `users/${UID_WALL_LEGACY_MEMBER}`, {
    name: "Legacy Member",
    photo_url: null,
    role: "PLAYER",
  });
  await seedDoc(testEnv, `users/${UID_WALL_INACTIVE}`, {
    name: "Inactive Member",
    photo_url: null,
    role: "PLAYER",
  });

  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    name: "Wall Test Group",
    owner_id: UID_WALL_OWNER,
    is_public: true,
    status: "ACTIVE",
    member_count: 3,
  });
  await seedDoc(testEnv, "system_config/group_wall_media_compat", {
    enabled: true,
    disable_after: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_WALL_OWNER}`, {
    user_id: UID_WALL_OWNER,
    role: "OWNER",
    status: "ACTIVE",
  });

  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_WALL_MEMBER}`, {
    user_id: UID_WALL_MEMBER,
    role: "MEMBER",
    status: "ACTIVE",
  });

  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_WALL_ADMIN}`, {
    user_id: UID_WALL_ADMIN,
    role: "ADMIN",
    status: "ACTIVE",
  });

  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_WALL_LEGACY_MEMBER}`, {
    user_id: UID_WALL_LEGACY_MEMBER,
    role: "MEMBER",
  });

  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_WALL_INACTIVE}`, {
    user_id: UID_WALL_INACTIVE,
    role: "MEMBER",
    status: "INACTIVE",
  });

  await seedDoc(testEnv, `groups/${LEGACY_OWNER_GROUP_ID}`, {
    name: "Legacy Owner Wall Test Group",
    owner_id: UID_WALL_OWNER,
    is_public: false,
    status: "ACTIVE",
    member_count: 1,
  });

  await seedDoc(testEnv, `groups/${LEGACY_OWNER_GROUP_ID}/members/${UID_WALL_OWNER}`, {
    user_id: UID_WALL_OWNER,
    role: "OWNER",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("groups/{groupId}/wall_post_drafts", () => {
  const postId = "a".repeat(40);
  const draftPath = `groups/${GROUP_ID}/wall_post_drafts/${postId}`;

  beforeAll(async () => {
    await seedDoc(testEnv, draftPath, {
      pipeline_version: 1,
      post_id: postId,
      group_id: GROUP_ID,
      author_id: UID_WALL_MEMBER,
      status: "AWAITING_UPLOAD",
      error_code: null,
      error_message: null,
      expires_at: new Date(Date.now() + 60_000),
    });
  });

  it("autor pode observar o próprio draft e admin pode moderar", async () => {
    await assertSucceeds(asWallMember().doc(draftPath).get());
    await assertSucceeds(asWallAdmin().doc(draftPath).get());
    await assertSucceeds(asWallMember()
      .collection(`groups/${GROUP_ID}/wall_post_drafts`)
      .where("author_id", "==", UID_WALL_MEMBER)
      .get());
  });

  it("outro membro, outsider e anônimo não leem o draft", async () => {
    await assertFails(asWallLegacyMember().doc(draftPath).get());
    await assertFails(asUser(testEnv, UID_OUTSIDER).doc(draftPath).get());
    await assertFails(asAnon(testEnv).doc(draftPath).get());
  });

  it("clientes não criam, alteram nem removem estado do pipeline", async () => {
    const forged = `groups/${GROUP_ID}/wall_post_drafts/${"b".repeat(40)}`;
    await assertFails(asWallMember().doc(forged).set({
      post_id: "b".repeat(40),
      group_id: GROUP_ID,
      author_id: UID_WALL_MEMBER,
      status: "READY",
    }));
    await assertFails(asWallMember().doc(draftPath).update({status: "READY"}));
    await assertFails(asWallMember().doc(draftPath).delete());
  });
});

describe("groups/{groupId}/wall_posts", () => {
  it("membro pode ler posts do mural", async () => {
    await assertSucceeds(
      asWallMember().collection(`groups/${GROUP_ID}/wall_posts`).get()
    );
  });

  it("membro legado sem status pode ler e criar post", async () => {
    await assertSucceeds(
      asWallLegacyMember().collection(`groups/${GROUP_ID}/wall_posts`).get()
    );
    await assertSucceeds(
      asWallLegacyMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-legacy-member")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_LEGACY_MEMBER,
        author_name: "Legacy Member",
        text: "Post de membro legado",
        created_at: serverTimestamp(),
      })
    );
  });

  it("membro INACTIVE não pode ler nem criar post", async () => {
    await assertFails(
      asWallInactiveMember().collection(`groups/${GROUP_ID}/wall_posts`).get()
    );
    await assertFails(
      asWallInactiveMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-inactive")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_INACTIVE,
        author_name: "Inactive Member",
        text: "Post bloqueado",
        created_at: serverTimestamp(),
      })
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
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-1")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        created_at: serverTimestamp(),
      })
    );
  });

  it("aceita UUID Android idempotente e bloqueia IDs arbitrários", async () => {
    await assertSucceeds(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${ANDROID_TEXT_REQUEST_ID}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asWallMember().doc(`groups/${GROUP_ID}/wall_posts/request-arbitrario`).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/0190c2d4-90c2-9b1d-a43d-4f7e05bdb999`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        created_at: serverTimestamp(),
      })
    );
  });

  it("post READY do pipeline mantém leitura e edição social legadas", async () => {
    const postPath = `groups/${GROUP_ID}/wall_posts/post-pipeline-ready`;
    await seedDoc(testEnv, postPath, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      text: "",
      media_url: "https://firebasestorage.googleapis.com/media.mp4",
      media_path: `groups/${GROUP_ID}/wall_media/post-pipeline-ready/original/hash.mp4`,
      media_type: "video/mp4",
      thumbnail_path: `groups/${GROUP_ID}/wall_media/post-pipeline-ready/poster/hash.webp`,
      thumbnail_url: "https://firebasestorage.googleapis.com/poster.webp",
      media_status: "READY",
      media_pipeline_version: 1,
      media_pipeline_draft_id: "post-pipeline-ready",
      media_sha256: "a".repeat(64),
      media_source_type: "video/mp4",
      media_duration_sec: 12.3,
      media_video_codec: "h264",
      media_audio_codec: "aac",
      media_container: "mp4",
      media_width: 1280,
      media_height: 720,
      created_at: new Date(),
    });
    await assertSucceeds(asWallMember().doc(postPath).get());
    await assertSucceeds(asWallMember().doc(postPath).update({
      text: "Legenda depois do processamento",
      edited_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }));
  });

  it("admin do grupo pode criar post", async () => {
    await assertSucceeds(
      asWallAdmin().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-admin")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_ADMIN,
        author_name: "Player C",
        text: "Aviso oficial",
        created_at: serverTimestamp(),
      })
    );
  });

  it("owner legado sem status ACTIVE no member doc pode criar post", async () => {
    await assertSucceeds(
      asWallOwner().doc(
        `groups/${LEGACY_OWNER_GROUP_ID}/wall_posts/${webAutoPostId("post-legacy-owner")}`
      ).set({
        ...validPost,
        group_id: LEGACY_OWNER_GROUP_ID,
        author_id: UID_WALL_OWNER,
        author_name: "Player A",
        text: "Post do owner legado",
        created_at: serverTimestamp(),
      })
    );
  });

  it("bloqueia forjar autoria", async () => {
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-forge")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_OWNER,
        created_at: serverTimestamp(),
      })
    );
  });

  it("bloqueia texto vazio ou muito longo", async () => {
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-empty")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        text: "",
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-long")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        text: "x".repeat(501),
        created_at: serverTimestamp(),
      })
    );
  });

  it("mantém mídia client-side somente na janela legada e path do autor", async () => {
    await assertSucceeds(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-media-empty")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        text: "",
        media_url: "https://firebasestorage.googleapis.com/v0/b/futebadosparcas.firebasestorage.app/o/groups%2Fgroup-wall-test%2Fwall_media%2F__draft__%2Fuid-wall-member-001%2Fmedia.jpg?alt=media",
        media_path: "groups/group-wall-test/wall_media/__draft__/uid-wall-member-001/media.jpg",
        media_type: "image/jpeg",
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-media-copied")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        text: "",
        media_url: "https://firebasestorage.googleapis.com/v0/b/futebadosparcas.firebasestorage.app/o/groups%2Fgroup-wall-test%2Fwall_media%2F__draft__%2Fuid-wall-owner-001%2Fmedia.jpg?alt=media",
        media_path: "groups/group-wall-test/wall_media/__draft__/uid-wall-owner-001/media.jpg",
        media_type: "image/jpeg",
        created_at: serverTimestamp(),
      })
    );
  });

  it("mantém vídeo MP4 legado até o gate ser desligado", async () => {
    await assertSucceeds(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-video")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        text: "",
        media_url: "https://firebasestorage.googleapis.com/v0/b/futebadosparcas.firebasestorage.app/o/groups%2Fgroup-wall-test%2Fwall_media%2F__draft__%2Fuid-wall-member-001%2Fclip.mp4?alt=media",
        media_path: "groups/group-wall-test/wall_media/__draft__/uid-wall-member-001/clip.mp4",
        media_type: "video/mp4",
        created_at: serverTimestamp(),
      })
    );
  });

  it("bloqueia mídia legada quando o gate operacional é desligado", async () => {
    await seedDoc(testEnv, "system_config/group_wall_media_compat", {
      enabled: false,
      disable_after: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-media-disabled")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        text: "",
        media_url: "https://firebasestorage.googleapis.com/v0/b/futebadosparcas.firebasestorage.app/o/groups%2Fgroup-wall-test%2Fwall_media%2F__draft__%2Fuid-wall-member-001%2Fdisabled.jpg?alt=media",
        media_path: "groups/group-wall-test/wall_media/__draft__/uid-wall-member-001/disabled.jpg",
        media_type: "image/jpeg",
        created_at: serverTimestamp(),
      })
    );
    await seedDoc(testEnv, "system_config/group_wall_media_compat", {
      enabled: true,
      disable_after: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  it("não permite que post client-side ocupe id reservado pelo pipeline", async () => {
    const postId = "a".repeat(40);
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_post_drafts/${postId}`, {
      group_id: GROUP_ID,
      post_id: postId,
      author_id: UID_WALL_MEMBER,
      status: "AWAITING_UPLOAD",
    });
    await assertFails(
      asWallMember().doc(`groups/${GROUP_ID}/wall_posts/${postId}`).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        created_at: serverTimestamp(),
      })
    );
  });

  it("bloqueia backdate", async () => {
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-backdate")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
    );
  });

  it("bloqueia pinned=true no create", async () => {
    await assertFails(
      asWallMember().doc(
        `groups/${GROUP_ID}/wall_posts/${webAutoPostId("post-pinned")}`
      ).set({
        ...validPost,
        author_id: UID_WALL_MEMBER,
        pinned: true,
        created_at: serverTimestamp(),
      })
    );
  });

  it("autor pode editar proprio texto", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-edit-self`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertSucceeds(
      asWallMember().doc(`groups/${GROUP_ID}/wall_posts/post-edit-self`).update({
        text: "Texto atualizado",
        edited_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("outro membro nao pode editar texto de terceiro", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-edit-other`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertFails(
      asWallAdmin().doc(`groups/${GROUP_ID}/wall_posts/post-edit-other`).update({
        text: "Texto alterado",
        edited_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("owner/admin pode fixar/desfixar post", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-pin`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertSucceeds(
      asWallOwner().doc(`groups/${GROUP_ID}/wall_posts/post-pin`).update({
        pinned: true,
        pinned_by: UID_WALL_OWNER,
        pinned_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
    await assertSucceeds(
      asWallOwner().doc(`groups/${GROUP_ID}/wall_posts/post-pin`).update({
        pinned: false,
        pinned_by: null,
        pinned_at: null,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("owner/admin nao pode atribuir pin a outro uid", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-pin-forged`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertFails(
      asWallOwner().doc(`groups/${GROUP_ID}/wall_posts/post-pin-forged`).update({
        pinned: true,
        pinned_by: UID_WALL_ADMIN,
        pinned_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("membro comum nao pode fixar post", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-pin-denied`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertFails(
      asWallMember().doc(`groups/${GROUP_ID}/wall_posts/post-pin-denied`).update({
        pinned: true,
        pinned_by: UID_WALL_MEMBER,
        pinned_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
    );
  });

  it("membro pode reagir ao post alterando apenas reactions", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-react`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertSucceeds(
      asWallOwner().doc(`groups/${GROUP_ID}/wall_posts/post-react`).update({
        "reactions.🔥": [UID_WALL_OWNER],
      })
    );
  });

  it("nao-membro nao pode reagir ao post", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-react-outsider`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc(`groups/${GROUP_ID}/wall_posts/post-react-outsider`).update({
        "reactions.🔥": [UID_OUTSIDER],
      })
    );
  });

  it("membro nao pode misturar reacao com edicao de texto", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-react-extra`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertFails(
      asWallMember().doc(`groups/${GROUP_ID}/wall_posts/post-react-extra`).update({
        "reactions.🔥": [UID_WALL_MEMBER],
        text: "Tentando misturar alteracoes",
      })
    );
  });

  it("autor pode soft-deletar proprio post", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-delete-self`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertSucceeds(
      asWallMember().doc(`groups/${GROUP_ID}/wall_posts/post-delete-self`).update({
        deleted_at: serverTimestamp(),
        deleted_by: UID_WALL_MEMBER,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("admin do grupo pode soft-deletar post de terceiro", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-delete-admin`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertSucceeds(
      asWallAdmin().doc(`groups/${GROUP_ID}/wall_posts/post-delete-admin`).update({
        deleted_at: serverTimestamp(),
        deleted_by: UID_WALL_ADMIN,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("owner pode soft-deletar post de terceiro", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-delete-owner`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertSucceeds(
      asWallOwner().doc(`groups/${GROUP_ID}/wall_posts/post-delete-owner`).update({
        deleted_at: serverTimestamp(),
        deleted_by: UID_WALL_OWNER,
        updated_at: serverTimestamp(),
      })
    );
  });

  it("hard delete e bloqueado", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-hard-delete`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });
    await assertFails(
      asWallMember().doc(`groups/${GROUP_ID}/wall_posts/post-hard-delete`).delete()
    );
  });

  it("membro pode listar mural via collection group filtrado por group_id", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-feed-member`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });

    await assertSucceeds(
      asWallMember()
        .collectionGroup("wall_posts")
        .where("group_id", "in", [GROUP_ID])
        .orderBy("created_at", "desc")
        .get()
    );
  });

  it("nao-membro nao pode listar mural via collection group", async () => {
    await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-feed-outsider`, {
      ...validPost,
      author_id: UID_WALL_MEMBER,
      created_at: new Date(),
    });

    await assertFails(
      asUser(testEnv, UID_OUTSIDER)
        .collectionGroup("wall_posts")
        .where("group_id", "in", [GROUP_ID])
        .orderBy("created_at", "desc")
        .get()
    );
  });

  it("anonimo nao pode listar mural via collection group", async () => {
    await assertFails(
      asAnon(testEnv)
        .collectionGroup("wall_posts")
        .where("group_id", "in", [GROUP_ID])
        .orderBy("created_at", "desc")
        .get()
    );
  });

  it("usuario pode ocultar post do proprio feed", async () => {
    await assertSucceeds(
      asWallMember()
        .doc(`users/${UID_WALL_MEMBER}/hidden_feed_posts/${GROUP_ID}_post-feed-member`)
        .set({
          user_id: UID_WALL_MEMBER,
          group_id: GROUP_ID,
          post_id: "post-feed-member",
          post_key: `${GROUP_ID}_post-feed-member`,
          target_path: `groups/${GROUP_ID}/wall_posts/post-feed-member`,
          hidden_at: serverTimestamp(),
        })
    );
  });

  it("usuario nao pode ocultar post no feed de outro usuario", async () => {
    await assertFails(
      asWallMember()
        .doc(`users/${UID_WALL_OWNER}/hidden_feed_posts/${GROUP_ID}_post-feed-member`)
        .set({
          user_id: UID_WALL_OWNER,
          group_id: GROUP_ID,
          post_id: "post-feed-member",
          post_key: `${GROUP_ID}_post-feed-member`,
          target_path: `groups/${GROUP_ID}/wall_posts/post-feed-member`,
          hidden_at: serverTimestamp(),
        })
    );
  });

  it("usuario nao cria denuncia diretamente; envio passa por Cloud Function", async () => {
    await assertFails(
      asWallMember()
        .collection("reports")
        .add({
          reporter_id: UID_WALL_MEMBER,
          target_type: "group_wall_post",
          group_id: GROUP_ID,
          post_id: "post-feed-member",
          target_path: `groups/${GROUP_ID}/wall_posts/post-feed-member`,
          reason: "inappropriate_content",
          status: "OPEN",
          created_at: serverTimestamp(),
        })
    );
  });

  it("usuario nao pode forjar reporter_id em denuncia", async () => {
    await assertFails(
      asWallMember()
        .collection("reports")
        .add({
          reporter_id: UID_WALL_OWNER,
          target_type: "group_wall_post",
          group_id: GROUP_ID,
          post_id: "post-feed-member",
          target_path: `groups/${GROUP_ID}/wall_posts/post-feed-member`,
          reason: "inappropriate_content",
          status: "OPEN",
          created_at: serverTimestamp(),
        })
    );
        });
  });

  it("bloqueia ocultacao com hidden_at fora do request.time", async () => {
    await assertFails(
      asWallMember()
        .doc(`users/${UID_WALL_MEMBER}/hidden_feed_posts/${GROUP_ID}_post-feed-member`)
        .set({
          user_id: UID_WALL_MEMBER,
          group_id: GROUP_ID,
          post_id: "post-feed-member",
          post_key: `${GROUP_ID}_post-feed-member`,
          target_path: `groups/${GROUP_ID}/wall_posts/post-feed-member`,
          hidden_at: new Date(),
        })
    );
  });

  it("bloqueia ocultacao com target_path com formato invalido", async () => {
    await assertFails(
      asWallMember()
        .doc(`users/${UID_WALL_MEMBER}/hidden_feed_posts/${GROUP_ID}_post-feed-member`)
        .set({
          user_id: UID_WALL_MEMBER,
          group_id: GROUP_ID,
          post_id: "post-feed-member",
          post_key: `${GROUP_ID}_post-feed-member`,
          target_path: 123,
          hidden_at: serverTimestamp(),
        })
    );
  });

  it("bloqueia ocultacao com post_key divergente do documentId", async () => {
    await assertFails(
      asWallMember()
        .doc(`users/${UID_WALL_MEMBER}/hidden_feed_posts/${GROUP_ID}_post-feed-member`)
        .set({
          user_id: UID_WALL_MEMBER,
          group_id: GROUP_ID,
          post_id: "post-feed-member",
          post_key: `${GROUP_ID}_other`,
          target_path: `groups/${GROUP_ID}/wall_posts/post-feed-member`,
          hidden_at: serverTimestamp(),
        })
    );
  });
