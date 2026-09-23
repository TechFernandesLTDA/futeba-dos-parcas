import {describe, expect, it} from "vitest";
import {readFileSync} from "fs";
import {dirname, resolve} from "path";
import {fileURLToPath} from "url";

type IndexField = {
  fieldPath: string;
  order?: "ASCENDING" | "DESCENDING";
  arrayConfig?: "CONTAINS";
};

type CompositeIndex = {
  collectionGroup: string;
  queryScope: "COLLECTION" | "COLLECTION_GROUP";
  fields: IndexField[];
};

type FieldOverride = {
  collectionGroup: string;
  fieldPath: string;
  ttl?: boolean;
  indexes: unknown[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(resolve(__dirname, "../../firestore.indexes.json"), "utf8"),
) as {indexes: CompositeIndex[]; fieldOverrides: FieldOverride[]};

function indexSignature(index: CompositeIndex): string {
  return [
    index.collectionGroup,
    index.queryScope,
    ...index.fields.map((field) =>
      `${field.fieldPath}:${field.order ?? field.arrayConfig}`),
  ].join("|");
}

describe("firestore.indexes.json — contratos operacionais", () => {
  it("mantém o índice exato do fallback de reminders para jogos legados", () => {
    expect(config.indexes.some((index) =>
      indexSignature(index) === [
        "games",
        "COLLECTION",
        "dateTime:ASCENDING",
        "date:ASCENDING",
        "__name__:ASCENDING",
      ].join("|"),
    )).toBe(true);
  });

  it("mantém os índices usados na reconstrução financeira mensal", () => {
    const requiredSignatures = [
      [
        "games",
        "COLLECTION",
        "group_id:ASCENDING",
        "date:ASCENDING",
      ].join("|"),
      [
        "games",
        "COLLECTION",
        "group_id:ASCENDING",
        "recurrence:ASCENDING",
        "date:DESCENDING",
      ].join("|"),
      [
        "schedules",
        "COLLECTION",
        "group_id:ASCENDING",
        "day_of_week:ASCENDING",
      ].join("|"),
      [
        "settlements",
        "COLLECTION",
        "payer_id:ASCENDING",
        "status:ASCENDING",
        "payment_sequence:DESCENDING",
      ].join("|"),
    ];
    const actualSignatures = new Set(config.indexes.map(indexSignature));

    for (const signature of requiredSignatures) {
      expect(actualSignatures.has(signature), signature).toBe(true);
    }
  });

  it("mantém o índice usado para validar grupos compartilhados em DMs", () => {
    expect(config.indexes.some((index) =>
      indexSignature(index) === [
        "members",
        "COLLECTION_GROUP",
        "status:ASCENDING",
        "user_id:ASCENDING",
      ].join("|"),
    )).toBe(true);
  });

  it("habilita TTL para claims de deduplicação de notificações", () => {
    expect(config.fieldOverrides).toContainEqual({
      collectionGroup: "notif_dedup",
      fieldPath: "expires_at",
      ttl: true,
      indexes: [],
    });
  });

  it("habilita collection-group para as queries de anonimização do onUserDeleted (#4113)", () => {
    // account-cleanup.ts consulta estes campos via collectionGroup(); sem o
    // índice COLLECTION_GROUP a query falha com FAILED_PRECONDITION e a PII
    // sobrevive à exclusão da conta. Os índices de COLLECTION são mantidos
    // para não desligar as queries por coleção que já existiam.
    for (const [collectionGroup, fieldPath] of [
      ["cashbox", "created_by"],
      ["reviews", "user_id"],
      ["activities", "targetUserId"],
    ]) {
      const override = config.fieldOverrides.find(
        (candidate) =>
          candidate.collectionGroup === collectionGroup &&
          candidate.fieldPath === fieldPath,
      );
      expect(override, `${collectionGroup}.${fieldPath}`).toBeDefined();
      const indexes = (override?.indexes ?? []) as Array<{
        queryScope?: string;
        order?: string;
        arrayConfig?: string;
      }>;
      const scopes = indexes.map(
        (index) => `${index.queryScope}:${index.order ?? index.arrayConfig}`,
      );
      expect(scopes).toEqual(expect.arrayContaining([
        "COLLECTION:ASCENDING",
        "COLLECTION:DESCENDING",
        "COLLECTION:CONTAINS",
        "COLLECTION_GROUP:ASCENDING",
      ]));
    }
  });

  it("não contém índices compostos duplicados", () => {
    const signatures = config.indexes.map(indexSignature);
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("não contém overrides duplicados para o mesmo campo", () => {
    const signatures = config.fieldOverrides.map(
      (override) => `${override.collectionGroup}|${override.fieldPath}`,
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});
