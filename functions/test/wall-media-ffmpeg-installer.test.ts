import * as fs from "fs";
import * as path from "path";

const {canExecuteTargetBinary} = require(
  "../scripts/install-wall-media-ffmpeg.cjs"
) as {canExecuteTargetBinary: (platform: string, arch: string) => boolean};

describe("wall media ffmpeg packaging", () => {
  it("prepara sempre o artefato Linux e só o executa em linux-x64", () => {
    expect(canExecuteTargetBinary("linux", "x64")).toBe(true);
    expect(canExecuteTargetBinary("darwin", "arm64")).toBe(false);
    expect(canExecuteTargetBinary("linux", "arm64")).toBe(false);
  });

  it("instala o binário antes de lint e build no predeploy", () => {
    const firebaseConfig = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, "../../firebase.json"),
      "utf8"
    )) as {functions: Array<{source: string; predeploy: string[]}>};
    const functionConfig = firebaseConfig.functions.find((config) =>
      config.source === "functions"
    );
    expect(functionConfig).toBeDefined();
    const predeploy = functionConfig?.predeploy ?? [];
    const installIndex = predeploy.findIndex((command) =>
      command.includes("run install:ffmpeg")
    );

    expect(installIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeLessThan(predeploy.findIndex((command) =>
      command.includes("run lint")
    ));
    expect(installIndex).toBeLessThan(predeploy.findIndex((command) =>
      command.includes("run build")
    ));
  });
});
