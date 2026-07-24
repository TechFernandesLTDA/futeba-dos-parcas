/**
 * TESTES — Ranking de Liga por grupo (#3879)
 *
 * Cobre os dois defeitos corrigidos em conjunto:
 *
 *   Defeito 1 — indice composto ausente: a query de ranking por grupo em
 *   fetchLeagueParticipations usa `orderBy("user_id")` como tie-break, o que
 *   exige o campo no indice. Faltavam os indices por grupo, entao a callable
 *   sempre lancava FAILED_PRECONDITION. O teste de CONTRATO abaixo enumera
 *   as formas de query de season_participation e afirma que cada combinacao
 *   (filtros + orderBy) tem um indice correspondente em
 *   firestore.indexes.json — pega essa classe inteira de regressao.
 *
 *   Defeito 2 — group_id escalar sobrescrito: o doc de participacao e unico
 *   por (temporada, usuario) e o campo escalar group_id guardava apenas o
 *   ULTIMO grupo jogado, fazendo o usuario sumir do ranking dos demais
 *   grupos. A correcao acumula todos os grupos jogados num array group_ids
 *   (via arrayUnion) e o ranking filtra por `group_ids array-contains X`.
 *
 * SEMANTICA ESCOLHIDA (importante): array-contains torna o usuario VISIVEL
 * no ranking de todo grupo em que jogou, exibindo os pontos da TEMPORADA
 * (nao por grupo). Atribuicao de pontos por grupo e um modelo de dados
 * distinto (subdocs por grupo + backfill) deixado para outra issue.
 */

// Mock firebase-admin: sentinels inspecionaveis para increment/arrayUnion.
jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    increment: jest.fn((n: number) => ({operand: n})),
    arrayUnion: jest.fn((...vals: unknown[]) => ({arrayUnion: vals})),
  };
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({})),
    initializeApp: jest.fn(),
  };
  (mockAdmin.firestore as Record<string, unknown>).FieldValue =
    mockFieldValue;
  return mockAdmin;
});

const docMock = jest.fn((id: string) => ({_path: id}));
const collectionMock = jest.fn(() => ({doc: docMock}));
jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({collection: collectionMock})),
}));

import {updateSeasonParticipation} from "../src/game/helpers";
import {GameConfirmation} from "../src/models";
import {FieldValue} from "firebase-admin/firestore";
import indexesJson from "../../firestore.indexes.json";

// helpers.ts usa o FieldValue REAL de "firebase-admin/firestore" (o mock de
// "firebase-admin" acima nao o intercepta). O sentinel real de arrayUnion
// expoe `.elements` e `.isEqual()` — asserimos por esses (mesmo padrao do
// teste season-participation-gender que le `.operand` do increment real).
type ArrayUnionSentinel = {
  elements: string[];
  isEqual: (other: unknown) => boolean;
};

/** Cria um batch mock que registra as chamadas set(). */
function createBatch() {
  const calls: Array<{ref: unknown; data: Record<string, unknown>}> = [];
  const batch = {
    set: jest.fn((ref: unknown, data: Record<string, unknown>) => {
      calls.push({ref, data});
    }),
  };
  return {batch, calls};
}

const baseConf = {goals: 1, assists: 0} as unknown as GameConfirmation;

describe("updateSeasonParticipation — group_ids (#3879 Defeito 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("com groupId escreve group_id escalar E group_ids via arrayUnion", () => {
    const {batch, calls} = createBatch();
    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uidA",
      "2026-06",
      "WIN",
      baseConf,
      false,
      "grpA",
      "MIXED"
    );

    expect(calls).toHaveLength(1);
    const data = calls[0].data;

    // Doc unico por (temporada, usuario) — grupo NAO entra na chave.
    expect(docMock).toHaveBeenCalledWith("2026-06_uidA");

    // Retrocompat: group_id escalar preservado (indices/leitores legados).
    expect(data.group_id).toBe("grpA");

    // Novo: group_ids acumulado idempotentemente via arrayUnion(grupo).
    const gids = data.group_ids as ArrayUnionSentinel;
    expect(gids).toBeDefined();
    expect(gids.isEqual(FieldValue.arrayUnion("grpA"))).toBe(true);
    expect(gids.elements).toEqual(["grpA"]);
  });

  it("sem groupId nao escreve group_id nem group_ids", () => {
    const {batch, calls} = createBatch();
    updateSeasonParticipation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch as any,
      "uidB",
      "2026-06",
      "DRAW",
      baseConf,
      false,
      null,
      "MALE"
    );
    const data = calls[0].data;
    expect(data.group_id).toBeUndefined();
    expect(data.group_ids).toBeUndefined();
  });

  it(
    "usuario que joga em 2 grupos: cada write faz arrayUnion do seu grupo " +
    "→ o doc acumula ambos e ele aparece no ranking dos dois grupos",
    () => {
      // Simula 2 jogos (grupo A, depois grupo B) e aplica os arrayUnion
      // sobre o mesmo array acumulado, replicando o merge do Firestore.
      const accumulated: string[] = [];
      const applyUnion = (data: Record<string, unknown>) => {
        const s = data.group_ids as ArrayUnionSentinel;
        for (const v of s.elements) {
          if (!accumulated.includes(v)) {
            accumulated.push(v);
          }
        }
      };

      const first = createBatch();
      updateSeasonParticipation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        first.batch as any,
        "uidU", "2026-06", "WIN", baseConf, false, "grpA", "MIXED"
      );
      applyUnion(first.calls[0].data);

      const second = createBatch();
      updateSeasonParticipation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        second.batch as any,
        "uidU", "2026-06", "WIN", baseConf, false, "grpB", "MIXED"
      );
      applyUnion(second.calls[0].data);

      // Ambos os grupos presentes → `group_ids array-contains` casa nos dois.
      expect(accumulated).toEqual(["grpA", "grpB"]);
      expect(accumulated.includes("grpA")).toBe(true);
      expect(accumulated.includes("grpB")).toBe(true);
    }
  );
});

// ==========================================================================
// TESTE DE CONTRATO — queries de season_participation ↔ indices versionados
// ==========================================================================

type IndexField = {
  fieldPath: string;
  order?: string;
  arrayConfig?: string;
};
type IndexDef = {
  collectionGroup: string;
  fields: IndexField[];
};

/** Normaliza um field de indice para um token "campo:MODO". */
function tokenize(f: IndexField): string {
  return `${f.fieldPath}:${f.order || f.arrayConfig}`;
}

/**
 * Forma esperada de indice para uma query de ranking.
 * Ordem Firestore: igualdade → array-contains → orderBy (na ordem dada).
 */
function expectedTokens(
  segmented: boolean,
  gender: string,
  byGroup: boolean
): string[] {
  const orderField = segmented ?
    `by_gender.${gender}.points` :
    "points";
  const tokens = ["season_id:ASCENDING"];
  if (byGroup) tokens.push("group_ids:CONTAINS");
  tokens.push(`${orderField}:DESCENDING`, "user_id:ASCENDING");
  return tokens;
}

describe("Contrato: indices cobrem as queries de ranking (#3879 Defeito 1)", () => {
  const spIndexes: IndexDef[] = (indexesJson.indexes as IndexDef[]).filter(
    (i) => i.collectionGroup === "season_participation"
  );

  const indexTokenSets = spIndexes.map((i) => i.fields.map(tokenize).join(" | "));

  const hasIndex = (tokens: string[]): boolean =>
    indexTokenSets.includes(tokens.join(" | "));

  // Todas as combinacoes produziveis por fetchLeagueParticipations:
  //   { global | por-grupo } x { combinado | MALE | FEMALE | MIXED }
  const GENDERS = ["MALE", "FEMALE", "MIXED"];

  it("global combinado (season_id, points, user_id)", () => {
    expect(hasIndex(expectedTokens(false, "", false))).toBe(true);
  });

  it.each(GENDERS)("global segmentado por %s", (g) => {
    expect(hasIndex(expectedTokens(true, g, false))).toBe(true);
  });

  it("por grupo combinado (season_id, group_ids CONTAINS, points, user_id)", () => {
    expect(hasIndex(expectedTokens(false, "", true))).toBe(true);
  });

  it.each(GENDERS)("por grupo segmentado por %s", (g) => {
    expect(hasIndex(expectedTokens(true, g, true))).toBe(true);
  });
});
