/* eslint-disable no-console */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const {Readable} = require("stream");
const {pipeline} = require("stream/promises");
const {execFileSync} = require("child_process");

const RELEASE_TAG = "autobuild-2026-07-11-13-13";
const ARCHIVE_NAME =
  "ffmpeg-n8.1.2-22-g94138f6973-linux64-lgpl-8.1.tar.xz";
const ARCHIVE_SHA256 =
  "0102dad4a83b266f740a50db7cd5131a8e5266cde8f0937ec3f3cb4a8c3641fa";
const BINARY_SHA256 =
  "13c2088bdbf4f1baa529d537c37872c810872b8ffab4fa74d39aea4d0332a9b7";
const DOWNLOAD_URL =
  "https://storage.googleapis.com/" +
  "futebadosparcas.firebasestorage.app/" +
  "system-artifacts/ffmpeg/8.1.2/" + ARCHIVE_NAME;
const TARGET_DIR = path.resolve(__dirname, "../vendor/ffmpeg");
const TARGET_PATH = path.join(TARGET_DIR, "ffmpeg");
const TARGET_PLATFORM = "linux";
const TARGET_ARCH = "x64";

async function main() {
  const canExecuteTarget = canExecuteTargetBinary(
    process.platform,
    process.arch
  );
  if (await hasCurrentBinary(TARGET_PATH, canExecuteTarget)) {
    console.log("FFmpeg vendor: artefato 8.1.2 já validado.");
    return;
  }

  const temporaryDir = await fsp.mkdtemp(path.join(os.tmpdir(), "futeba-ffmpeg-"));
  const archivePath = path.join(temporaryDir, ARCHIVE_NAME);
  const extractDir = path.join(temporaryDir, "extract");
  try {
    await fsp.mkdir(extractDir, {recursive: true});
    const response = await fetch(DOWNLOAD_URL, {redirect: "follow"});
    if (!response.ok || !response.body) {
      throw new Error(`FFMPEG_DOWNLOAD_FAILED_${response.status}`);
    }
    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(archivePath, {flags: "wx"})
    );
    const digest = await sha256File(archivePath);
    if (digest !== ARCHIVE_SHA256) throw new Error("FFMPEG_ARCHIVE_HASH_MISMATCH");

    execFileSync("tar", ["-xJf", archivePath, "-C", extractDir], {
      stdio: "ignore",
    });
    const extractedBinary = await findFile(extractDir, (candidate) =>
      candidate.endsWith(`${path.sep}bin${path.sep}ffmpeg`)
    );
    if (!extractedBinary) throw new Error("FFMPEG_BINARY_NOT_FOUND");
    await fsp.mkdir(TARGET_DIR, {recursive: true});
    await fsp.copyFile(extractedBinary, `${TARGET_PATH}.tmp`);
    await fsp.chmod(`${TARGET_PATH}.tmp`, 0o755);
    const binaryDigest = await sha256File(`${TARGET_PATH}.tmp`);
    if (binaryDigest !== BINARY_SHA256) {
      throw new Error("FFMPEG_BINARY_HASH_MISMATCH");
    }
    if (canExecuteTarget) {
      verifyVersion(`${TARGET_PATH}.tmp`);
    } else {
      console.log(
        "FFmpeg vendor: execução será validada no runtime linux-x64; " +
        "hash do binário validado no host de empacotamento."
      );
    }
    await fsp.rename(`${TARGET_PATH}.tmp`, TARGET_PATH);
    await fsp.writeFile(
      path.join(TARGET_DIR, "install-manifest.json"),
      `${JSON.stringify({
        releaseTag: RELEASE_TAG,
        archive: ARCHIVE_NAME,
        archiveSha256: ARCHIVE_SHA256,
        binarySha256: BINARY_SHA256,
      }, null, 2)}\n`,
      "utf8"
    );
    console.log(`FFmpeg vendor: ${ARCHIVE_NAME} instalado e validado.`);
  } finally {
    await fsp.rm(temporaryDir, {recursive: true, force: true});
  }
}

async function hasCurrentBinary(binaryPath, verifyExecutable) {
  try {
    const digest = await sha256File(binaryPath);
    if (digest !== BINARY_SHA256) {
      await fsp.rm(binaryPath, {force: true});
      return false;
    }
    await fsp.chmod(binaryPath, 0o755);
    if (verifyExecutable) verifyVersion(binaryPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * O artefato empacotado sempre é linux-x64, ainda que o deploy parta do
 * macOS. Somente o host compatível pode executá-lo; os demais validam os dois
 * SHA-256 antes de incluí-lo no source bundle.
 * @param {string} platform Plataforma Node do host atual.
 * @param {string} arch Arquitetura Node do host atual.
 * @return {boolean} Se o binário alvo pode ser executado neste host.
 */
function canExecuteTargetBinary(platform, arch) {
  return platform === TARGET_PLATFORM && arch === TARGET_ARCH;
}

function verifyVersion(binaryPath) {
  const output = execFileSync(binaryPath, ["-version"], {
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 256 * 1024,
  });
  if (!/^ffmpeg version n?8\.1\.2(?:-|\s)/m.test(output)) {
    throw new Error("FFMPEG_VENDOR_VERSION_MISMATCH");
  }
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function findFile(directory, predicate) {
  const entries = await fsp.readdir(directory, {withFileTypes: true});
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(candidate, predicate);
      if (nested) return nested;
    } else if (predicate(candidate)) {
      return candidate;
    }
  }
  return null;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {canExecuteTargetBinary};
