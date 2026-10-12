/**
 * Testes de Firestore Security Rules — consultas de LISTA em locations (#4370)
 *
 * O seletor de quadras do web (CreateGameScreen) deixou de ler
 * `orderBy('name') limit(200)` e agora consulta por cidade/UF (igualdade) e,
 * para descobrir a cidade pela posição, por intervalo de latitude. Estes testes
 * provam que as REGRAS aceitam essas consultas para usuário autenticado
 * (inclusive quadras importadas em DRAFT/não verificadas) e que a leitura
 * anônima continua restrita.
 */

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initTestEnv, asAnon, asPlayerA, seedDoc, UID_FIELD_OWNER } from "./helpers.js";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();
  // Contagens determinísticas, mesmo com dados de outras suites no emulador.
  await testEnv.clearFirestore();

  await seedDoc(testEnv, "locations/pub-curitiba", {
    name: "Arena Pública",
    city: "Curitiba",
    state: "PR",
    owner_id: UID_FIELD_OWNER,
    is_active: true,
    is_verified: true,
    publication_status: "PUBLISHED",
    subscription_status: "ACTIVE",
    latitude: -25.43,
    longitude: -49.27,
  });
  // Importada em rascunho, sem dono real e não verificada.
  await seedDoc(testEnv, "locations/draft-curitiba", {
    name: "Quadra Importada",
    city: "Curitiba",
    state: "PR",
    owner_id: "system-venue-import",
    is_active: true,
    is_verified: false,
    publication_status: "DRAFT",
    latitude: -25.44,
    longitude: -49.28,
  });
  await seedDoc(testEnv, "locations/draft-londrina", {
    name: "Quadra Londrina",
    city: "Londrina",
    state: "PR",
    owner_id: "system-venue-import",
    is_active: true,
    is_verified: false,
    publication_status: "DRAFT",
    latitude: -23.31,
    longitude: -51.16,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("locations — consultas de lista do seletor de quadras", () => {
  it("autenticado lista por cidade + UF e enxerga rascunhos não verificados", async () => {
    const db = asPlayerA(testEnv);
    const snapshot = await assertSucceeds(
      db.collection("locations").where("city", "==", "Curitiba").where("state", "==", "PR").get(),
    );
    expect(snapshot.docs.map((d) => d.id).sort()).toEqual(["draft-curitiba", "pub-curitiba"]);
  });

  it("autenticado lista todas as quadras de uma UF", async () => {
    const db = asPlayerA(testEnv);
    const snapshot = await assertSucceeds(db.collection("locations").where("state", "==", "PR").get());
    expect(snapshot.size).toBe(3);
  });

  it("autenticado lista por intervalo de latitude (cidade pela posição)", async () => {
    const db = asPlayerA(testEnv);
    const snapshot = await assertSucceeds(
      db.collection("locations").where("latitude", ">=", -26).where("latitude", "<=", -25).get(),
    );
    expect(snapshot.docs.map((d) => d.id).sort()).toEqual(["draft-curitiba", "pub-curitiba"]);
  });

  it("autenticado pagina a coleção por cursor (busca em outras cidades)", async () => {
    const db = asPlayerA(testEnv);
    const first = await assertSucceeds(db.collection("locations").limit(2).get());
    const second = await assertSucceeds(
      db.collection("locations").startAfter(first.docs[first.docs.length - 1]).limit(2).get(),
    );
    expect(first.size + second.size).toBe(3);
  });

  it("anônimo NÃO lista rascunho por cidade (leitura pública continua restrita)", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("locations").where("city", "==", "Curitiba").where("state", "==", "PR").get());
  });

  it("anônimo NÃO lista a coleção inteira", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.collection("locations").limit(10).get());
  });
});
