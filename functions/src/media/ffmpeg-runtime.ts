import {execFile} from "child_process";
import {promisify} from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execFileAsync = promisify(execFile);
const MINIMUM_VERSION = [8, 1, 2] as const;
export const MEDIA_PROCESSOR_SERVICE_ACCOUNT =
  "futeba-wall-media@futebadosparcas.iam.gserviceaccount.com";
let validatedRuntime: Promise<string> | null = null;

/**
 * Resolve e valida o FFmpeg usado por todos os parsers de mídia server-side.
 * Produção Linux usa somente o artefato pinado/checado no postinstall. macOS é
 * permitido apenas para testes/emulador e deve fornecer Homebrew >= 8.1.2.
 *
 * @return {Promise<string>} Caminho absoluto de um FFmpeg atual e executável.
 */
export async function currentFfmpegPath(): Promise<string> {
  if (!validatedRuntime) {
    validatedRuntime = validateRuntime(resolveFfmpegPath()).catch((error) => {
      validatedRuntime = null;
      throw error;
    });
  }
  return validatedRuntime;
}

/**
 * Valida a primeira linha de `ffmpeg -version` contra o piso de segurança.
 * @param {string} output Saída stdout do executável.
 * @return {void}
 */
export function assertCurrentFfmpegVersion(output: string): void {
  const match = output.match(/^ffmpeg version n?(\d+)\.(\d+)(?:\.(\d+))?/m);
  if (!match) throw new Error("FFMPEG_VERSION_UNREADABLE");
  const actual = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
  for (let index = 0; index < MINIMUM_VERSION.length; index++) {
    if (actual[index] > MINIMUM_VERSION[index]) return;
    if (actual[index] < MINIMUM_VERSION[index]) {
      throw new Error("FFMPEG_VERSION_BELOW_SECURITY_FLOOR");
    }
  }
}

/**
 * Opções defensivas para qualquer MP4 não confiável. Força demuxer/decoders,
 * desativa protocolos de rede/stdin e limita análise/alocação antes do `-i`.
 * @param {string} inputPath Arquivo local já baixado do Storage.
 * @param {number|null} seekSeconds Seek opcional anterior ao input.
 * @param {string} codecWhitelist Decoders permitidos para esse fluxo.
 * @return {string[]} Argumentos seguros terminando em `-i inputPath`.
 */
export function safeFfmpegMovInputArgs(
  inputPath: string,
  seekSeconds: number | null = null,
  codecWhitelist = "h264,aac"
): string[] {
  return [
    "-nostdin",
    "-max_alloc", "67108864",
    "-protocol_whitelist", "file",
    "-f", "mov",
    "-probesize", "5000000",
    "-analyzeduration", "5000000",
    "-codec_whitelist", codecWhitelist,
    "-threads", "1",
    ...(seekSeconds == null ? [] : ["-ss", String(seekSeconds)]),
    "-i", inputPath,
  ];
}

/**
 * Valida path, executabilidade e versão mínima do runtime.
 * @param {string} binaryPath Executável candidato.
 * @return {Promise<string>} Mesmo path após validação.
 */
async function validateRuntime(binaryPath: string): Promise<string> {
  if (!path.isAbsolute(binaryPath) || path.basename(binaryPath) !== "ffmpeg") {
    throw new Error("FFMPEG_PATH_INVALID");
  }
  await fs.access(binaryPath);
  const {stdout} = await execFileAsync(binaryPath, ["-version"], {
    timeout: 5_000,
    maxBuffer: 256 * 1024,
  });
  assertCurrentFfmpegVersion(stdout);
  return binaryPath;
}

/**
 * Resolve somente override explícito, Homebrew de teste ou vendor Linux.
 * @return {string} Path absoluto esperado.
 */
function resolveFfmpegPath(): string {
  const explicit = process.env.FUTEBA_FFMPEG_PATH?.trim();
  if (explicit) return explicit;
  if (process.platform === "darwin" &&
      (process.env.NODE_ENV === "test" ||
       process.env.FUNCTIONS_EMULATOR === "true")) {
    return "/opt/homebrew/bin/ffmpeg";
  }
  return path.resolve(__dirname, "../../vendor/ffmpeg/ffmpeg");
}
