import {
  buildWallMediaMetric,
  normalizeWallMediaIntent,
  wallMediaIntentHash,
  wallMediaPostId,
  wallMediaUploadPath,
} from "../../src/groups/wall-media-contract";

function requestId(index: number): string {
  return `0190c2d4-90c2-7b1d-a43d-${index.toString(16).padStart(12, "0")}`;
}

describe("group wall media pipeline load contract", () => {
  test.each([10, 100, 1000])(
    "mantém %i uploads concorrentes determinísticos e sem colisão",
    async (users: number) => {
      const startedAt = performance.now();
      const operations = await Promise.all(
        Array.from({length: users}, async (_value, index) => {
          const uid = `load-user-${index}`;
          const intent = normalizeWallMediaIntent({
            clientRequestId: requestId(index),
            text: `Post ${index}`,
            declaredContentType: index % 2 === 0 ? "video/mp4" : "image/jpeg",
            sizeBytes: 1024 + index,
          });
          const postId = wallMediaPostId("load-group", uid, intent.clientRequestId);
          return {
            postId,
            intentHash: wallMediaIntentHash(intent),
            uploadPath: wallMediaUploadPath(
              "load-group",
              postId,
              uid,
              intent.declaredContentType,
            ),
            metric: buildWallMediaMetric({
              event: "READY",
              mediaKind: intent.declaredContentType === "video/mp4" ?
                "VIDEO" : "IMAGE",
              sourceBytes: intent.declaredSizeBytes,
              egressBytes: intent.declaredSizeBytes,
              attempt: 1,
            }),
          };
        }),
      );
      const elapsedMs = performance.now() - startedAt;
      expect(new Set(operations.map(({postId}) => postId)).size).toBe(users);
      expect(new Set(operations.map(({uploadPath}) => uploadPath)).size).toBe(users);
      expect(new Set(operations.map(({intentHash}) => intentHash)).size).toBe(users);
      expect(operations.every(({metric}) =>
        !Object.keys(metric).some((key) => /user|group|post|path|url/i.test(key))
      )).toBe(true);
      // O teste mede apenas o hot path síncrono do contrato. I/O real é
      // limitado no runtime por concurrency=2/maxInstances=100.
      expect(elapsedMs).toBeLessThan(2_000);
    },
  );
});
