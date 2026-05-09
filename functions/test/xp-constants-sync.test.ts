/**
 * #730: XP Constants Sync Validation
 *
 * Ensures functions/src/_constants/xp-constants.json (local copy)
 * stays in sync with shared/xp-constants.json (KMP source of truth).
 *
 * The functions copy exists because tsc rootDir=src forbids imports
 * outside src/. This test fails if values diverge, alerting developers
 * to copy changes from the shared source of truth.
 */
import * as fs from "fs";
import * as path from "path";

const SHARED_PATH = path.resolve(
  __dirname,
  "../../shared/xp-constants.json"
);
const FUNCTIONS_PATH = path.resolve(
  __dirname,
  "../src/_constants/xp-constants.json"
);

function loadJson(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("XP Constants Sync (#730)", () => {
  it("shared/xp-constants.json exists", () => {
    expect(fs.existsSync(SHARED_PATH)).toBe(true);
  });

  it("functions/src/_constants/xp-constants.json exists", () => {
    expect(fs.existsSync(FUNCTIONS_PATH)).toBe(true);
  });

  it("both files have the same content (in sync)", () => {
    const shared = loadJson(SHARED_PATH);
    const functions = loadJson(FUNCTIONS_PATH);

    // Strip _comment fields before comparing — they differ intentionally
    // (the functions copy documents why the duplication exists).
    delete shared._comment;
    delete functions._comment;

    const sharedStr = JSON.stringify(shared, null, 2);
    const funcStr = JSON.stringify(functions, null, 2);

    if (sharedStr !== funcStr) {
      // Compute a diff-like message to help developers
      const sharedParsed = JSON.parse(sharedStr) as Record<string, unknown>;
      const funcParsed = JSON.parse(funcStr) as Record<string, unknown>;

      const diffs: string[] = [];
      const allKeys = new Set([
        ...Object.keys(sharedParsed),
        ...Object.keys(funcParsed),
      ]);

      for (const key of allKeys) {
        const sv = JSON.stringify(sharedParsed[key]);
        const fv = JSON.stringify(funcParsed[key]);
        if (sv !== fv) {
          diffs.push(
            `  ${key}:\n` +
            `    shared:    ${sv}\n` +
            `    functions: ${fv}`
          );
        }
      }

      throw new Error(
        "XP constants out of sync!\n\n" +
        "shared/xp-constants.json (source of truth) differs from\n" +
        "functions/src/_constants/xp-constants.json (local copy).\n\n" +
        "ACTION: Copy values from shared/xp-constants.json to\n" +
        "functions/src/_constants/xp-constants.json.\n\n" +
        "Differences:\n" +
        diffs.join("\n")
      );
    }
  });

  it("functions constants.ts imports from _constants/xp-constants.json", () => {
    const constantsPath = path.resolve(
      __dirname,
      "../src/constants.ts"
    );
    const content = fs.readFileSync(constantsPath, "utf-8");
    expect(content).toContain("./_constants/xp-constants.json");
  });
});
