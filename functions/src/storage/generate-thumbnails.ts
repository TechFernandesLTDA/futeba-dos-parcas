import * as functions from "firebase-functions/v2";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {Storage} from "@google-cloud/storage";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import sharp from "sharp";

const storage = new Storage();
const db = admin.firestore();

/**
 * Tamanho máximo permitido para upload de imagem
 * (10 MB). Imagens maiores são rejeitadas para
 * evitar abuso de memória e storage.
 */
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Tipos MIME de imagem aceitos para thumbnail.
 * Rejeitar formatos não-imagem que passaram
 * pela validação de contentType.
 */
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Gera thumbnails para imagens de perfil de
 * usuários.
 *
 * Trigger: Quando uma nova imagem é enviada para
 * /profile_photos/
 *
 * Benefícios:
 * - Reduz consumo de banda em listas de jogadores
 * - Melhora performance de loading
 * - Reduz custos de Cloud Storage egress
 *
 * Dimensões do thumbnail: 200x200px
 *
 * @return {Promise<object|void>} Resultado
 */
export const generateProfileThumbnail =
  functions.storage.onObjectFinalized(
    {
      region: "southamerica-east1",
      memory: "1GiB",
      timeoutSeconds: 120,
    },
    async (event) => {
      const object = event.data;
      const filePath = object.name;
      const contentType = object.contentType;

      logger.info(
        "[THUMBNAIL] Processing file: " +
        `${filePath}`
      );

      // Validações
      if (!filePath) {
        logger.info(
          "[THUMBNAIL] No file path, skipping"
        );
        return;
      }

      if (
        !contentType ||
        !contentType.startsWith("image/")
      ) {
        logger.info(
          "[THUMBNAIL] Not an image " +
          `(${contentType}), skipping`
        );
        return;
      }

      // Evitar loop infinito - não processar thumbs
      if (
        filePath.includes("/thumbnails/") ||
        filePath.includes("_thumb")
      ) {
        logger.info(
          "[THUMBNAIL] Already a thumbnail, " +
          "skipping"
        );
        return;
      }

      // Apenas processar profile_photos
      if (!filePath.startsWith("profile_photos/")) {
        logger.info(
          "[THUMBNAIL] Not a profile photo, " +
          "skipping"
        );
        return;
      }

      // Validar tipo MIME aceito
      if (!ACCEPTED_IMAGE_TYPES.includes(contentType)) {
        logger.warn(
          "[THUMBNAIL] Unsupported image type: " +
          `${contentType}. Accepted: ` +
          ACCEPTED_IMAGE_TYPES.join(", ")
        );
        return;
      }

      // Validar tamanho do arquivo
      const fileSize = parseInt(
        String(object.size || "0"),
        10
      );
      if (fileSize > MAX_IMAGE_SIZE_BYTES) {
        const fileSizeMb =
          (fileSize / 1024 / 1024).toFixed(2);
        const maxMb =
          MAX_IMAGE_SIZE_BYTES / 1024 / 1024;
        logger.error(
          "[THUMBNAIL] File too large: " +
          `${fileSizeMb} MB (max: ${maxMb} MB).` +
          ` Skipping: ${filePath}`
        );
        return;
      }

      const bucket = storage.bucket(object.bucket);
      const fileName = path.basename(filePath);
      const fileDir = path.dirname(filePath);

      // Paths
      const tempFilePath = path.join(
        os.tmpdir(),
        fileName
      );
      const tempThumbPath = path.join(
        os.tmpdir(),
        `thumb_${fileName}`
      );

      // Thumbnail path:
      // profile_photos/thumbnails/{userId}_thumb.jpg
      const thumbFileName = fileName.replace(
        /\.\w+$/,
        "_thumb.jpg"
      );
      const thumbFilePath =
        `${fileDir}/thumbnails/${thumbFileName}`;

      // Extrair userId antes do try/catch
      const userIdMatch = fileName.match(
        /^([a-zA-Z0-9_-]+)/
      );

      try {
        // Download original
        logger.info(
          "[THUMBNAIL] Downloading " +
          `${filePath} to ${tempFilePath}`
        );
        await bucket.file(filePath).download(
          {destination: tempFilePath}
        );

        // Generate thumbnail (200x200, cover, 80%)
        console.log(
          "[THUMBNAIL] Generating thumbnail 200x200"
        );
        await sharp(tempFilePath)
          .resize(200, 200, {
            fit: "cover",
            position: "center",
          })
          .jpeg({quality: 80})
          .toFile(tempThumbPath);

        // Upload thumbnail
        logger.info(
          "[THUMBNAIL] Uploading to " +
          `${thumbFilePath}`
        );
        await bucket.upload(tempThumbPath, {
          destination: thumbFilePath,
          metadata: {
            contentType: "image/jpeg",
            metadata: {
              originalFile: filePath,
              thumbnailSize: "200x200",
              generatedAt:
                new Date().toISOString(),
            },
          },
        });

        if (userIdMatch) {
          const userId = userIdMatch[1];

          // Atualizar documento do usuário
          const thumbUrl =
            "https://storage.googleapis.com/" +
            `${object.bucket}/${thumbFilePath}`;

          await db
            .collection("users")
            .doc(userId)
            .update({
              photo_thumbnail_url: thumbUrl,
              photo_thumbnail_updated_at:
                admin.firestore.FieldValue
                  .serverTimestamp(),
            });

          logger.info(
            "[THUMBNAIL] Updated user " +
            `${userId} with thumbnail URL`
          );
        }

        // Cleanup temp files
        await fs.unlink(tempFilePath);
        await fs.unlink(tempThumbPath);

        // Log metrics
        await db.collection("metrics").add({
          type: "thumbnail_generated",
          timestamp:
            admin.firestore.FieldValue
              .serverTimestamp(),
          original_file: filePath,
          thumbnail_file: thumbFilePath,
          user_id: userIdMatch ?
            userIdMatch[1] :
            null,
        });

        logger.info(
          "[THUMBNAIL] Successfully generated " +
          `thumbnail for ${filePath}`
        );

        return {
          success: true,
          thumbnailPath: thumbFilePath,
        };
      } catch (error) {
        logger.error(
          "[THUMBNAIL] Error generating " +
          `thumbnail for ${filePath}:`,
          error
        );

        // Cleanup temp files on error
        try {
          await fs.unlink(tempFilePath)
            .catch(() => {/* noop */});
          await fs.unlink(tempThumbPath)
            .catch(() => {/* noop */});
        } catch {
          // Ignorar erros de cleanup
        }

        // Log error
        await db.collection("metrics").add({
          type: "thumbnail_error",
          timestamp:
            admin.firestore.FieldValue
              .serverTimestamp(),
          original_file: filePath,
          error: String(error),
        });

        throw error;
      }
    }
  );

/**
 * Gera thumbnails para imagens de grupos.
 *
 * @return {Promise<object|void>} Resultado
 */
export const generateGroupThumbnail =
  functions.storage.onObjectFinalized(
    {
      region: "southamerica-east1",
      memory: "1GiB",
      timeoutSeconds: 120,
    },
    async (event) => {
      const object = event.data;
      const filePath = object.name;
      const contentType = object.contentType;

      if (
        !filePath ||
        !contentType ||
        !contentType.startsWith("image/")
      ) {
        return;
      }

      if (
        filePath.includes("/thumbnails/") ||
        filePath.includes("_thumb")
      ) {
        return;
      }

      // Apenas processar group_photos
      if (!filePath.startsWith("group_photos/")) {
        return;
      }

      // Validar tipo MIME aceito
      if (
        !ACCEPTED_IMAGE_TYPES.includes(
          contentType || ""
        )
      ) {
        logger.warn(
          "[THUMBNAIL] Unsupported group " +
          `image type: ${contentType}`
        );
        return;
      }

      // Validar tamanho do arquivo
      const fileSize = parseInt(
        String(object.size || "0"),
        10
      );
      if (fileSize > MAX_IMAGE_SIZE_BYTES) {
        const fileSizeMb =
          (fileSize / 1024 / 1024).toFixed(2);
        logger.error(
          "[THUMBNAIL] Group file too large: " +
          `${fileSizeMb} MB. ` +
          `Skipping: ${filePath}`
        );
        return;
      }

      const bucket = storage.bucket(object.bucket);
      const fileName = path.basename(filePath);
      const fileDir = path.dirname(filePath);

      const tempFilePath = path.join(
        os.tmpdir(),
        fileName
      );
      const tempThumbPath = path.join(
        os.tmpdir(),
        `thumb_${fileName}`
      );

      const thumbFileName = fileName.replace(
        /\.\w+$/,
        "_thumb.jpg"
      );
      const thumbFilePath =
        `${fileDir}/thumbnails/${thumbFileName}`;

      const groupIdMatch = fileName.match(
        /^([a-zA-Z0-9_-]+)/
      );

      try {
        await bucket.file(filePath).download(
          {destination: tempFilePath}
        );

        await sharp(tempFilePath)
          .resize(200, 200, {
            fit: "cover",
            position: "center",
          })
          .jpeg({quality: 80})
          .toFile(tempThumbPath);

        await bucket.upload(tempThumbPath, {
          destination: thumbFilePath,
          metadata: {
            contentType: "image/jpeg",
            metadata: {
              originalFile: filePath,
              thumbnailSize: "200x200",
              generatedAt:
                new Date().toISOString(),
            },
          },
        });

        if (groupIdMatch) {
          const groupId = groupIdMatch[1];
          const thumbUrl =
            "https://storage.googleapis.com/" +
            `${object.bucket}/${thumbFilePath}`;

          await db
            .collection("groups")
            .doc(groupId)
            .update({
              photo_thumbnail_url: thumbUrl,
              photo_thumbnail_updated_at:
                admin.firestore.FieldValue
                  .serverTimestamp(),
            });

          logger.info(
            "[THUMBNAIL] Updated group " +
            `${groupId} with thumbnail URL`
          );
        }

        await fs.unlink(tempFilePath);
        await fs.unlink(tempThumbPath);

        await db.collection("metrics").add({
          type: "group_thumbnail_generated",
          timestamp:
            admin.firestore.FieldValue
              .serverTimestamp(),
          original_file: filePath,
          thumbnail_file: thumbFilePath,
          group_id: groupIdMatch ?
            groupIdMatch[1] :
            null,
        });

        logger.info(
          "[THUMBNAIL] Successfully generated " +
          `group thumbnail for ${filePath}`
        );

        return {
          success: true,
          thumbnailPath: thumbFilePath,
        };
      } catch (error) {
        logger.error(
          "[THUMBNAIL] Error generating group " +
          `thumbnail for ${filePath}:`,
          error
        );

        try {
          await fs.unlink(tempFilePath)
            .catch(() => {/* noop */});
          await fs.unlink(tempThumbPath)
            .catch(() => {/* noop */});
        } catch {
          // Ignorar erros de cleanup
        }

        await db.collection("metrics").add({
          type: "group_thumbnail_error",
          timestamp:
            admin.firestore.FieldValue
              .serverTimestamp(),
          original_file: filePath,
          error: String(error),
        });

        throw error;
      }
    }
  );
