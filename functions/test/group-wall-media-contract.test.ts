import {
  WALL_MEDIA_MAX_IMAGE_BYTES,
  WALL_MEDIA_MAX_VIDEO_BYTES,
  buildWallMediaMetric,
  detectWallMediaContentType,
  normalizeWallMediaIntent,
  parseWallMediaStagingPath,
  parseWallVideoProbe,
  stripFfmpegMetadataBlocks,
  validateWallVideoProbe,
  wallMediaErrorMessage,
  wallMediaIntentHash,
  wallMediaPostId,
  wallMediaUploadPath,
} from "../src/groups/wall-media-contract";

const REQUEST_ID = "0190c2d4-90c2-7b1d-a43d-4f7e05bdb999";

describe("group wall media contract", () => {
  it("normaliza intenção, highlight camel/snake e limites", () => {
    const camel = normalizeWallMediaIntent({
      clientRequestId: REQUEST_ID,
      text: "  Gol da rodada  ",
      declaredContentType: "video/mp4",
      sizeBytes: 1_000_000,
      highlightRef: {gameId: "game-1", highlightId: "goal-2"},
    });
    expect(camel).toEqual({
      clientRequestId: REQUEST_ID,
      text: "Gol da rodada",
      declaredContentType: "video/mp4",
      declaredSizeBytes: 1_000_000,
      highlightRef: {game_id: "game-1", highlight_id: "goal-2"},
    });
    expect(normalizeWallMediaIntent({
      clientRequestId: REQUEST_ID,
      text: "",
      declaredContentType: "image/jpeg",
      sizeBytes: WALL_MEDIA_MAX_IMAGE_BYTES - 1,
      highlightRef: {game_id: "game-1", highlight_id: "goal-2"},
    }).highlightRef).toEqual({game_id: "game-1", highlight_id: "goal-2"});
    expect(() => normalizeWallMediaIntent({
      clientRequestId: "not-a-uuid",
      declaredContentType: "video/mp4",
      sizeBytes: 10,
    })).toThrow(/UUID/);
    expect(() => normalizeWallMediaIntent({
      clientRequestId: REQUEST_ID,
      declaredContentType: "video/quicktime",
      sizeBytes: 10,
    })).toThrow(/não suportado/);
    expect(() => normalizeWallMediaIntent({
      clientRequestId: REQUEST_ID,
      declaredContentType: "video/mp4",
      sizeBytes: WALL_MEDIA_MAX_VIDEO_BYTES,
    })).toThrow(/excede/);
  });

  it("mantém post/path determinísticos e detecta conflito de intenção", () => {
    const intent = normalizeWallMediaIntent({
      clientRequestId: REQUEST_ID,
      text: "Teste",
      declaredContentType: "image/png",
      sizeBytes: 123,
    });
    const postId = wallMediaPostId("group-1", "user-1", REQUEST_ID);
    expect(postId).toMatch(/^[a-f0-9]{40}$/);
    expect(wallMediaPostId("group-1", "user-1", REQUEST_ID)).toBe(postId);
    expect(wallMediaUploadPath(
      "group-1",
      postId,
      "user-1",
      "image/png"
    )).toBe(
      `groups/group-1/wall_media_staging/${postId}/user-1/source.png`
    );
    expect(wallMediaIntentHash({...intent, text: "Outro"}))
      .not.toBe(wallMediaIntentHash(intent));
  });

  it("aceita somente path de staging estrito", () => {
    const postId = "a".repeat(40);
    expect(parseWallMediaStagingPath(
      `groups/g-1/wall_media_staging/${postId}/u-1/source.mp4`
    )).toEqual({
      groupId: "g-1",
      postId,
      ownerId: "u-1",
      fileName: "source.mp4",
    });
    expect(parseWallMediaStagingPath(
      `groups/g-1/wall_media_staging/${postId}/u-1/../source.mp4`
    )).toBeNull();
    expect(parseWallMediaStagingPath(
      "groups/g-1/wall_media/__draft__/u-1/source.mp4"
    )).toBeNull();
  });

  it("detecta JPEG, PNG, WebP e MP4 por magic bytes", () => {
    expect(detectWallMediaContentType(
      Buffer.from([0xff, 0xd8, 0xff, 0x00])
    )).toBe("image/jpeg");
    expect(detectWallMediaContentType(Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]))).toBe("image/png");
    expect(detectWallMediaContentType(Buffer.from("RIFF0000WEBP", "ascii")))
      .toBe("image/webp");
    expect(detectWallMediaContentType(Buffer.from("0000ftypisom", "ascii")))
      .toBe("video/mp4");
    expect(detectWallMediaContentType(Buffer.from("<svg></svg>"))).toBeNull();
  });

  it("aceita MP4 H.264/AAC e rejeita container/codec/duração incompatíveis", () => {
    const valid = parseWallVideoProbe(`
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'clip.mp4':
  Duration: 00:00:12.34, start: 0.000000, bitrate: 1200 kb/s
  Stream #0:0: Video: h264 (High), yuv420p, 1280x720, 30 fps
  Stream #0:1: Audio: aac (LC), 48000 Hz, stereo
`);
    expect(valid).toMatchObject({
      durationSec: 12.34,
      videoCodec: "h264",
      audioCodec: "aac",
      width: 1280,
      height: 720,
    });
    expect(validateWallVideoProbe(valid)).toBeNull();
    expect(validateWallVideoProbe({...valid, audioCodec: null})).toBeNull();
    expect(validateWallVideoProbe({...valid, videoCodec: "hevc"}))
      .toBe("UNSUPPORTED_VIDEO_CODEC");
    expect(validateWallVideoProbe({...valid, audioCodec: "mp3"}))
      .toBe("UNSUPPORTED_AUDIO_CODEC");
    expect(validateWallVideoProbe({...valid, durationSec: 31}))
      .toBe("DURATION_TOO_LONG");
    expect(validateWallVideoProbe({...valid, width: 9000}))
      .toBe("VIDEO_TOO_LARGE");
    expect(validateWallVideoProbe({...valid, width: 8000, height: 6000}))
      .toBe("VIDEO_TOO_LARGE");
    expect(validateWallVideoProbe({...valid, width: null}))
      .toBe("VIDEO_TOO_LARGE");
    expect(validateWallVideoProbe({
      ...valid,
      videoCodec: null,
      width: null,
      height: null,
    })).toBe("UNSUPPORTED_VIDEO_CODEC");
    expect(validateWallVideoProbe({...valid, container: "matroska"}))
      .toBe("UNSUPPORTED_CONTAINER");
    expect(wallMediaErrorMessage("UNSUPPORTED_VIDEO_CODEC")).toMatch(/H\.264/);
  });

  // Fixtures verbatim de ffmpeg 8.1.2 (piso MINIMUM_VERSION do projeto),
  // capturadas com o argv real de safeFfmpegMovInputArgs. Ver issue #3878.
  // Vetor 1: tag `comment` forja Duration/Video/Audio; real = 40s/320x240/sem
  // áudio. NÃO indentar: a indentação faz parte do payload.
  const FORGED_DURATION_RES = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'evil.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    encoder         : Lavf62.12.102
    comment         : Duration: 00:00:05.00, start: 0.000000, bitrate: 120 kb/s Video: h264 (High), yuv420p, 640x360 Audio: aac (LC)
  Duration: 00:00:40.00, start: 0.000000, bitrate: 21 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 320x240 [SAR 1:1 DAR 4:3], 21 kb/s, 5 fps, 5 tbr, 10240 tbn (default)
    Metadata:
      handler_name    : VideoHandler
      encoder         : Lavc62.28.102 libx264
At least one output file must be specified
`;

  // Vetor 2: newline injetado no valor da tag; ffmpeg reindenta a continuação
  // muito mais fundo que o cabeçalho `Metadata:`, então também é descartada.
  const FORGED_NEWLINE_INJECTION = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'evil2.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomiso2avc1mp41
    encoder         : Lavf62.12.102
    comment         : x
                    :   Duration: 00:00:05.00
                    :   Stream #0:0: Video: h264, 640x360
  Duration: 00:00:40.00, start: 0.000000, bitrate: 21 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 320x240 [SAR 1:1 DAR 4:3], 21 kb/s, 5 fps, 5 tbr, 10240 tbn (default)
    Metadata:
      handler_name    : VideoHandler
      encoder         : Lavc62.28.102 libx264
At least one output file must be specified
`;

  // Vetor 3: tag forja `aac`, mas o stream real é ac3 (fora da whitelist).
  const FORGED_AUDIO_CODEC = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'evil3.mp4':
  Metadata:
    major_brand     : isom
    minor_version   : 512
    compatible_brands: isomdby1iso2avc1mp41
    encoder         : Lavf62.12.102
    comment         : Audio: aac (LC)
  Duration: 00:00:08.00, start: 0.000000, bitrate: 123 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 320x240 [SAR 1:1 DAR 4:3], 24 kb/s, 5 fps, 5 tbr, 10240 tbn (default)
    Metadata:
      handler_name    : VideoHandler
      encoder         : Lavc62.28.102 libx264
  Stream #0:1[0x2](und): Audio: ac3 (ac-3 / 0x332D6361), 44100 Hz, mono, fltp, 96 kb/s (default)
    Metadata:
      handler_name    : SoundHandler
    Side data:
      Audio Service Type: main
At least one output file must be specified
`;

  it("descarta blocos Metadata do dump do ffmpeg (issue #3878)", () => {
    const clean = stripFfmpegMetadataBlocks(FORGED_DURATION_RES);
    // O texto controlado pelo atacante some por completo.
    expect(clean).not.toContain("comment");
    expect(clean).not.toContain("640x360");
    expect(clean).not.toContain("00:00:05.00");
    // As linhas estruturais reais permanecem.
    expect(clean).toContain("Duration: 00:00:40.00");
    expect(clean).toContain("320x240");
  });

  it("ignora Duration/resolução forjadas na metadata e lê os valores reais", () => {
    const probe = parseWallVideoProbe(FORGED_DURATION_RES);
    expect(probe).toMatchObject({
      durationSec: 40, // real (era forjado como 5)
      videoCodec: "h264",
      width: 320, // real (era forjado como 640)
      height: 240, // real (era forjado como 360)
      audioCodec: null, // não há áudio real (forjado como aac)
    });
    expect(validateWallVideoProbe(probe)).toBe("DURATION_TOO_LONG");
  });

  it("rejeita vídeo de 40s com Duration forjada via newline na tag", () => {
    const probe = parseWallVideoProbe(FORGED_NEWLINE_INJECTION);
    expect(probe.durationSec).toBe(40);
    expect(probe.width).toBe(320);
    expect(probe.height).toBe(240);
    expect(validateWallVideoProbe(probe)).toBe("DURATION_TOO_LONG");
  });

  it("rejeita áudio ac3 real disfarçado de aac na tag comment", () => {
    const probe = parseWallVideoProbe(FORGED_AUDIO_CODEC);
    expect(probe.audioCodec).toBe("ac3"); // real (forjado como aac)
    expect(probe.durationSec).toBe(8);
    expect(validateWallVideoProbe(probe)).toBe("UNSUPPORTED_AUDIO_CODEC");
  });

  it("gera métricas úteis sem IDs, paths, URLs, nomes ou emails", () => {
    const metric = buildWallMediaMetric({
      event: "READY",
      mediaKind: "VIDEO",
      latencyMs: 4_321,
      sourceBytes: 8_000_000,
      egressBytes: 8_100_000,
      durationSec: 12.4,
      attempt: 2,
    });
    expect(metric).toMatchObject({
      event: "READY",
      latency_bucket: "1_5S",
      size_bucket: "5_10MB",
      duration_bucket: "5_15S",
      attempt: 2,
    });
    expect(Object.keys(metric).join(" ")).not.toMatch(
      /user|author|group|post|path|url|email|name/i
    );
  });
});
