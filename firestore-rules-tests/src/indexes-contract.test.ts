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

  it("habilita TTL para claims de deduplicação de notificações", () => {
    expect(config.fieldOverrides).toContainEqual({
      collectionGroup: "notif_dedup",
      fieldPath: "expires_at",
      ttl: true,
      indexes: [],
    });
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
