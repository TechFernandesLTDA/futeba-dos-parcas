import {getStorage} from "firebase-admin/storage";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FUNCTION_REGION} from "../constants";

/**
 * Valida se o path aponta para mídia gerenciada do mural do grupo.
 *
 * @param {string} groupId ID do grupo do post.
 * @param {unknown} mediaPath Path bruto salvo no documento.
 * @return {boolean} True quando o path é seguro para cleanup.
 */
export function isManagedWallMediaPath(
  groupId: string,
  mediaPath: unknown
): mediaPath is string {
  return typeof mediaPath === "string" &&
    mediaPath.startsWith(`groups/${groupId}/wall_media/`) &&
    !mediaPath.includes("..") &&
    /(^|\/)[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(mediaPath);
}

export const onGroupWallPostSoftDeletedCleanupMedia = onDocumentUpdated(
  {
    region: FUNCTION_REGION,
    document: "groups/{groupId}/wall_posts/{postId}",
    retry: true,
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!after) return;
    if (before?.deleted_at != null || after.deleted_at == null) return;

    const {groupId, postId} = event.params;
    const managedPaths = [after.media_path, after.thumbnail_path].filter((path) =>
      isManagedWallMediaPath(groupId, path)
    );

    for (const path of [after.media_path, after.thumbnail_path]) {
      if (
        typeof path === "string" &&
        path.length > 0 &&
        !isManagedWallMediaPath(groupId, path)
      ) {
        logger.warn("[GROUP_WALL_MEDIA] Ignorando path fora do escopo gerenciado", {groupId, postId, mediaPath: path});
      }
    }

    if (managedPaths.length === 0) return;

    try {
      const bucket = getStorage().bucket();
      await Promise.all(
        managedPaths.map((path) =>
          bucket.file(path).delete({ignoreNotFound: true})
        )
      );
      logger.info("[GROUP_WALL_MEDIA] Midia removida após soft-delete do post", {
        groupId,
        postId,
        managedPaths,
      });
    } catch (error) {
      logger.error("[GROUP_WALL_MEDIA] Falha ao remover mídia do mural", {
        groupId,
        postId,
        managedPaths,
        error,
      });
      throw error;
    }
  }
);
