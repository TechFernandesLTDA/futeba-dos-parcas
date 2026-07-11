import {
  assertCurrentFfmpegVersion,
  safeFfmpegMovInputArgs,
} from "../src/media/ffmpeg-runtime";

describe("ffmpeg runtime security contract", () => {
  it("aceita o piso atual ou superior e rejeita runtimes vulneráveis", () => {
    expect(() => assertCurrentFfmpegVersion("ffmpeg version n8.1.2-22-gabc"))
      .not.toThrow();
    expect(() => assertCurrentFfmpegVersion("ffmpeg version 9.0"))
      .not.toThrow();
    expect(() => assertCurrentFfmpegVersion("ffmpeg version 8.1.1"))
      .toThrow("FFMPEG_VERSION_BELOW_SECURITY_FLOOR");
  });

  it("força arquivo local, demuxer MOV, limites e whitelist estrita", () => {
    const args = safeFfmpegMovInputArgs("/tmp/source.mp4", 1);
    expect(args).toEqual(expect.arrayContaining([
      "-nostdin",
      "-protocol_whitelist",
      "file",
      "-f",
      "mov",
      "-codec_whitelist",
      "h264,aac",
      "-threads",
      "1",
      "-i",
      "/tmp/source.mp4",
    ]));
    expect(args.join(" ")).not.toMatch(/https?|tcp|udp|concat/);
  });

  it("torna codecs legados uma exceção explícita por fluxo", () => {
    const args = safeFfmpegMovInputArgs(
      "/tmp/legacy.mp4",
      null,
      "h264,hevc,mpeg4,aac,mp3,opus"
    );
    const whitelistIndex = args.indexOf("-codec_whitelist");
    expect(args[whitelistIndex + 1]).toBe("h264,hevc,mpeg4,aac,mp3,opus");
  });
});
