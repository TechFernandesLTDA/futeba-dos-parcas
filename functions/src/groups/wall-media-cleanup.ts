import {getStorage} from "firebase-admin/storage";
import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FUNCTION_REGION} from "../constants";

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
    const mediaPath = after.media_path;

    if (!isManagedWallMediaPath(groupId, mediaPath)) {
      if (typeof mediaPath === "string" && mediaPath.length > 0) {
        logger.warn("[GROUP_WALL_MEDIA] Ignorando path fora do escopo gerenciado", {groupId, postId, mediaPath});
      }
      return;
    }

    try {
      await getStorage().bucket().file(mediaPath).delete({ignoreNotFound: true});
      logger.info("[GROUP_WALL_MEDIA] Midia removida após soft-delete do post", {groupId, postId, mediaPath});
    } catch (error) {
      logger.error("[GROUP_WALL_MEDIA] Falha ao remover mídia do mural", {groupId, postId, mediaPath, error});
      throw error;
    }
  }
);
