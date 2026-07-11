import {execFile} from "child_process";
import {promisify} from "util";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";
import {
  assertCurrentFfmpegVersion,
  currentFfmpegPath,
} from "../src/media/ffmpeg-runtime";

process.env.GCLOUD_PROJECT = "futebadosparcas-test";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "futebadosparcas-test",
  storageBucket: "futebadosparcas-test.appspot.com",
});

const {generateWallVideoPoster} = require(
  "../src/groups/wall-media-pipeline"
) as typeof import("../src/groups/wall-media-pipeline");
const execFileAsync = promisify(execFile);
const H264_MP4_FIXTURE_BASE64 = [
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAM5bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAfQAAQAA",
  "AQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "AAAAAgAAAmN0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAfQAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAA",
  "AAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAABaAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAH0AAAAAAABAAAAAAHb",
  "bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAFABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRl",
  "b0hhbmRsZXIAAAABhm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAA",
  "AQAAAUZzdGJsAAAAunN0c2QAAAAAAAAAAQAAAKphdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAWgBIAAAASAAAAAAA",
  "AAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAMGF2Y0MBQsAK/+EAGGdCwArZAo35MBEAAAMAAQAA",
  "AwAUDxImSAEABWjLg8sgAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAALkAAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAUA",
  "AAQAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAUA",
  "AAK7AAAACgAAAAsAAAAKAAAACgAAABRzdGNvAAAAAAAAAAEAAANpAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAA",
  "AAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2Mi4xMi4xMDIAAAAIZnJl",
  "ZQAAAuxtZGF0AAACcQYF//9t3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQv",
  "TVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRt",
  "bCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MToweDExMSBtZT1oZXggc3VibWU9",
  "NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4",
  "eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMg",
  "bG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5",
  "X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49",
  "MTAgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAg",
  "cWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAABCZYiED/EY",
  "oAAm+xwABGzjgACRnJycnJycnJycnXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXgAAAABkGaOB/g9gAA",
  "AAdBmlQH+D2AAAAABkGaYDvB7AAAAAZBmoA3wew=",
].join("");

describe("group wall media current ffmpeg", () => {
  jest.setTimeout(30_000);

  it("recusa versões abaixo do piso que corrige parsers vulneráveis", () => {
    expect(() => assertCurrentFfmpegVersion("ffmpeg version 6.1.1"))
      .toThrow("FFMPEG_VERSION_BELOW_SECURITY_FLOOR");
  });

  it("valida 8.1.2 e entrega poster WebP de um MP4 H.264 real", async () => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-ffmpeg-test-"));
    const sourcePath = path.join(workDir, "source.mp4");
    try {
      const ffmpegPath = await currentFfmpegPath();
      const {stdout} = await execFileAsync(ffmpegPath, ["-version"]);
      expect(() => assertCurrentFfmpegVersion(stdout)).not.toThrow();
      await fs.writeFile(sourcePath, Buffer.from(H264_MP4_FIXTURE_BASE64, "base64"));

      const posterPath = await generateWallVideoPoster(sourcePath, workDir, 0.5);
      const [posterStat, metadata] = await Promise.all([
        fs.stat(posterPath),
        sharp(posterPath).metadata(),
      ]);
      expect(posterStat.size).toBeGreaterThan(0);
      expect(metadata).toMatchObject({format: "webp", width: 160, height: 90});
    } finally {
      await fs.rm(workDir, {recursive: true, force: true});
    }
  });
});
