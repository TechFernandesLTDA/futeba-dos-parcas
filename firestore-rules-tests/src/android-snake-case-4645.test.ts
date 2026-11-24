/**
 * #4645: o que o Android grava ao criar grupo e ao criar o perfil de reserva,
 * contra as regras reais.
 *
 * Os documentos "de antes" são a saída de `CustomClassMapper.convertToPlainJavaTypes`
 * (o mapper do SDK Android) para os modelos de `shared/domain/model`, que só têm
 * `@SerialName` e por isso saem em camelCase. Os documentos "de depois" são os
 * mapas montados por `AndroidEscritoresFirestore` (app/.../data/firestore), conferidos
 * no teste JVM `AndroidEscritoresFirestoreTest`: mudou um, mude o outro.
 */

import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import { asUser, initTestEnv, seedDoc, UID_PLAYER_A } from "./helpers.js";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// Mesmo dono com perfil completo (claim), como no app depois do cadastro.
function dono() {
  return testEnv
    .authenticatedContext(UID_PLAYER_A, {
      role: "PLAYER",
      verified: true,
      profileComplete: true,
    })
    .firestore();
}

// Membro dono e espelho: já saem em snake_case (modelos de data/model com @PropertyName).
function membroDono(joinedAt: unknown) {
  return {
    invited_by: null,
    joined_at: joinedAt,
    nickname: null,
    role: "OWNER",
    status: "ACTIVE",
    user_id: UID_PLAYER_A,
    user_name: "Ana",
    user_photo: null,
  };
}

function espelhoDono(groupId: string, joinedAt: unknown) {
  return {
    group_id: groupId,
    group_name: "Pelada de Quinta",
    group_photo: null,
    group_status: "ACTIVE",
    joined_at: joinedAt,
    member_count: 1,
    role: "OWNER",
  };
}

// Saída do mapper Android para domain.model.Group (buildPendingOwnerGroup), medida em 24/11/2026.
function grupoCamelCase(groupId: string) {
  return {
    autoCloseHours: null,
    createdAt: null,
    defaultDayOfWeek: null,
    defaultGender: null,
    defaultLocationId: null,
    defaultLocationName: null,
    defaultMaxPlayers: 14,
    defaultPrice: 0.0,
    defaultTime: null,
    description: "desc",
    gamesCount: 0,
    id: groupId,
    inviteCode: null,
    membersCount: 0,
    name: "Pelada de Quinta",
    ownerId: UID_PLAYER_A,
    ownerName: "Ana",
    photoUrl: null,
    pixKey: null,
    public: false,
    updatedAt: null,
    waitlistAutoPromoteMinutes: null,
  };
}

// O que AndroidEscritoresFirestore.novoGrupo monta (mesmas chaves do web, useGroups.createGroup).
function grupoSnakeCase() {
  return {
    name: "Pelada de Quinta",
    description: "desc",
    photo_url: null,
    type: "PRIVATE",
    is_public: false,
    owner_id: UID_PLAYER_A,
    owner_name: "Ana",
    member_count: 0,
    status: "ACTIVE",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
}

async function criarGrupo(groupId: string, grupo: Record<string, unknown>, joinedAt: unknown) {
  const db = dono();
  const lote = db.batch();
  lote.set(db.doc(`groups/${groupId}`), grupo);
  lote.set(db.doc(`groups/${groupId}/members/${UID_PLAYER_A}`), membroDono(joinedAt));
  lote.set(db.doc(`users/${UID_PLAYER_A}/groups/${groupId}`), espelhoDono(groupId, joinedAt));
  return lote.commit();
}

describe("#4645 criar grupo pelo Android", () => {
  it("o documento de hoje (camelCase, sem status) é negado e leva a transação inteira", async () => {
    await assertFails(criarGrupo("g-4645-camel", grupoCamelCase("g-4645-camel"), null));
  });

  it("controle: o mesmo lote com o grupo em snake_case passa", async () => {
    await assertSucceeds(criarGrupo("g-4645-snake", grupoSnakeCase(), serverTimestamp()));
  });

  it("controle: só trocar ownerId por owner_id não basta, falta o status", async () => {
    const grupo = { ...grupoCamelCase("g-4645-sem-status"), owner_id: UID_PLAYER_A };
    await assertFails(criarGrupo("g-4645-sem-status", grupo, null));
  });
});

// Saída do mapper Android para domain.model.User (AuthRepository.getCurrentUser), medida em 24/11/2026.
function perfilCamelCase(uid: string) {
  return {
    admin: false,
    autoDefenderRating: 0.0,
    autoGkRating: 0.0,
    autoMidRating: 0.0,
    autoRatingConfidence: 0.0,
    autoRatingSamples: 0,
    autoStrikerRating: 0.0,
    birthDate: null,
    createdAt: null,
    defenderRating: 0.0,
    defenderRatingSet: false,
    displayName: "Bia",
    dominantFoot: null,
    email: "bia@example.com",
    experiencePoints: 0,
    experienceYears: null,
    favoriteTeam: null,
    fcmToken: null,
    fieldOwner: false,
    followersCount: 0,
    followingCount: 0,
    gender: null,
    gkRating: 0.0,
    gkRatingSet: false,
    heightCm: null,
    id: uid,
    level: 0,
    midRating: 0.0,
    midRatingSet: false,
    milestonesAchieved: [],
    name: "Bia",
    nickname: null,
    overallRating: 0.0,
    phone: null,
    photoUrl: null,
    playStyle: null,
    preferredFieldTypes: [],
    preferredPosition: null,
    primaryPosition: null,
    profilePublic: true,
    role: "PLAYER",
    roleEnum: "PLAYER",
    searchable: true,
    secondaryPosition: null,
    strikerRating: 0.0,
    strikerRatingSet: false,
    updatedAt: null,
    weightKg: null,
  };
}

// O que AndroidEscritoresFirestore.perfilNovo monta (subconjunto do que o web grava em
// AuthContext.createUserDocument). Os quatro ratings precisam estar no documento: a regra
// os lê sem get() e um campo ausente nega a gravação.
function perfilSnakeCase(convite?: string) {
  return {
    email: "bia@example.com",
    name: "Bia",
    nickname: "",
    photo_url: null,
    role: "PLAYER",
    striker_rating: 0,
    mid_rating: 0,
    defender_rating: 0,
    gk_rating: 0,
    preferred_position: null,
    preferred_field_types: [],
    is_searchable: true,
    ...(convite ? { invited_by_code: convite } : {}),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
}

describe("#4645 perfil novo de reserva do Android", () => {
  const CONVITE = "ABC4645";

  beforeAll(async () => {
    await seedDoc(testEnv, `invite_codes/${CONVITE}`, { active: true, user_id: "uid-quem-convidou-4645" });
  });

  it("o documento de hoje (camelCase, com experiencePoints e level) é negado", async () => {
    const uid = "uid-4645-perfil-camel";
    await assertFails(asUser(testEnv, uid).doc(`users/${uid}`).set(perfilCamelCase(uid)));
  });

  it("o snake_case continua negado sem código de convite (o app não pede um)", async () => {
    const uid = "uid-4645-perfil-sem-convite";
    await assertFails(asUser(testEnv, uid).doc(`users/${uid}`).set(perfilSnakeCase()));
  });

  it("controle: o snake_case passa com um código de convite válido", async () => {
    const uid = "uid-4645-perfil-com-convite";
    await assertSucceeds(asUser(testEnv, uid).doc(`users/${uid}`).set(perfilSnakeCase(CONVITE)));
  });

  it("controle: o camelCase é negado mesmo com código de convite", async () => {
    const uid = "uid-4645-perfil-camel-convite";
    await assertFails(
      asUser(testEnv, uid).doc(`users/${uid}`).set({ ...perfilCamelCase(uid), invited_by_code: CONVITE })
    );
  });
});
