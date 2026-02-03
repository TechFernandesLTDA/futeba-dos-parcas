import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import sharp from "sharp";

const storage = new Storage();
const db = admin.firestore();

/**
 * Gera thumbnails para imagens de perfil de usuários
 *
 * Trigger: Quando uma nova imagem é enviada para /profile_photos/
 *
 * Benefícios:
 * - Reduz consumo de banda em listas de jogadores
 * - Melhora performance de loading em telas com muitos usuários
 * - Reduz custos de Cloud Storage egress
 *
 * Dimensões do thumbnail: 200x200px
 */
export const generateProfileThumbnail = functions.storage.onObjectFinalized({
    region: "southamerica-east1",
    memory: "1GiB",
    timeoutSeconds: 120,
}, async (event) => {
    const object = event.data;
    const filePath = object.name;
    const contentType = object.contentType;

    console.log(`[THUMBNAIL] Processing file: ${filePath}`);

    // Validações
    if (!filePath) {
        console.log("[THUMBNAIL] No file path, skipping");
        return;
    }

    if (!contentType || !contentType.startsWith("image/")) {
        console.log(`[THUMBNAIL] Not an image (${contentType}), skipping`);
        return;
    }

    // Evitar loop infinito - não processar thumbnails
    if (filePath.includes("/thumbnails/") || filePath.includes("_thumb")) {
        console.log("[THUMBNAIL] Already a thumbnail, skipping");
        return;
    }

    // Apenas processar profile_photos
    if (!filePath.startsWith("profile_photos/")) {
        console.log("[THUMBNAIL] Not a profile photo, skipping");
        return;
    }

    const bucket = storage.bucket(object.bucket);
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);

    // Paths
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const tempThumbPath = path.join(os.tmpdir(), `thumb_${fileName}`);

    // Thumbnail path: profile_photos/thumbnails/{userId}_thumb.jpg
    const thumbFileName = fileName.replace(/\.\w+$/, "_thumb.jpg");
    const thumbFilePath = `${fileDir}/thumbnails/${thumbFileName}`;

    try {
        // Download original
        console.log(`[THUMBNAIL] Downloading ${filePath} to ${tempFilePath}`);
        await bucket.file(filePath).download({ destination: tempFilePath });

        // Generate thumbnail (200x200, cover mode, quality 80%)
        console.log(`[THUMBNAIL] Generating thumbnail 200x200`);
        await sharp(tempFilePath)
            .resize(200, 200, {
                fit: "cover",
                position: "center"
            })
            .jpeg({ quality: 80 })
            .toFile(tempThumbPath);

        // Upload thumbnail
        console.log(`[THUMBNAIL] Uploading to ${thumbFilePath}`);
        await bucket.upload(tempThumbPath, {
            destination: thumbFilePath,
            metadata: {
                contentType: "image/jpeg",
                metadata: {
                    originalFile: filePath,
                    thumbnailSize: "200x200",
                    generatedAt: new Date().toISOString()
                }
            }
        });

        // Extrair userId do filename (formato: {userId}.jpg ou {userId}_timestamp.jpg)
        const userIdMatch = fileName.match(/^([a-zA-Z0-9_-]+)/);
        if (userIdMatch) {
            const userId = userIdMatch[1];

            // Atualizar documento do usuário com URL do thumbnail
            const thumbUrl = `https://storage.googleapis.com/${object.bucket}/${thumbFilePath}`;

            await db.collection("users").doc(userId).update({
                photo_thumbnail_url: thumbUrl,
                photo_thumbnail_updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[THUMBNAIL] Updated user ${userId} with thumbnail URL`);
        }

        // Cleanup temp files
        await fs.unlink(tempFilePath);
        await fs.unlink(tempThumbPath);

        // Log metrics
        await db.collection("metrics").add({
            type: "thumbnail_generated",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            original_file: filePath,
            thumbnail_file: thumbFilePath,
            user_id: userIdMatch ? userIdMatch[1] : null
        });

        console.log(`[THUMBNAIL] Successfully generated thumbnail for ${filePath}`);

        return { success: true, thumbnailPath: thumbFilePath };
    } catch (error) {
        console.error(`[THUMBNAIL] Error generating thumbnail for ${filePath}:`, error);

        // Cleanup temp files on error
        try {
            await fs.unlink(tempFilePath).catch(() => { });
            await fs.unlink(tempThumbPath).catch(() => { });
        } catch { }

        // Log error
        await db.collection("metrics").add({
            type: "thumbnail_error",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            original_file: filePath,
            error: String(error)
        });

        throw error;
    }
});

/**
 * Gera thumbnails para imagens de grupos
 */
export const generateGroupThumbnail = functions.storage.onObjectFinalized({
    region: "southamerica-east1",
    memory: "1GiB",
    timeoutSeconds: 120,
}, async (event) => {
    const object = event.data;
    const filePath = object.name;
    const contentType = object.contentType;

    if (!filePath || !contentType || !contentType.startsWith("image/")) {
        return;
    }

    if (filePath.includes("/thumbnails/") || filePath.includes("_thumb")) {
        return;
    }

    // Apenas processar group_photos
    if (!filePath.startsWith("group_photos/")) {
        return;
    }

    const bucket = storage.bucket(object.bucket);
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);

    const tempFilePath = path.join(os.tmpdir(), fileName);
    const tempThumbPath = path.join(os.tmpdir(), `thumb_${fileName}`);

    const thumbFileName = fileName.replace(/\.\w+$/, "_thumb.jpg");
    const thumbFilePath = `${fileDir}/thumbnails/${thumbFileName}`;

    try {
        await bucket.file(filePath).download({ destination: tempFilePath });

        await sharp(tempFilePath)
            .resize(200, 200, {
                fit: "cover",
                position: "center"
            })
            .jpeg({ quality: 80 })
            .toFile(tempThumbPath);

        await bucket.upload(tempThumbPath, {
            destination: thumbFilePath,
            metadata: {
                contentType: "image/jpeg",
                metadata: {
                    originalFile: filePath,
                    thumbnailSize: "200x200",
                    generatedAt: new Date().toISOString()
                }
            }
        });

        const groupIdMatch = fileName.match(/^([a-zA-Z0-9_-]+)/);
        if (groupIdMatch) {
            const groupId = groupIdMatch[1];
            const thumbUrl = `https://storage.googleapis.com/${object.bucket}/${thumbFilePath}`;

            await db.collection("groups").doc(groupId).update({
                photo_thumbnail_url: thumbUrl,
                photo_thumbnail_updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[THUMBNAIL] Updated group ${groupId} with thumbnail URL`);
        }

        await fs.unlink(tempFilePath);
        await fs.unlink(tempThumbPath);

        await db.collection("metrics").add({
            type: "group_thumbnail_generated",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            original_file: filePath,
            thumbnail_file: thumbFilePath,
            group_id: groupIdMatch ? groupIdMatch[1] : null
        });

        console.log(`[THUMBNAIL] Successfully generated group thumbnail for ${filePath}`);

        return { success: true, thumbnailPath: thumbFilePath };
    } catch (error) {
        console.error(`[THUMBNAIL] Error generating group thumbnail for ${filePath}:`, error);

        try {
            await fs.unlink(tempFilePath).catch(() => { });
            await fs.unlink(tempThumbPath).catch(() => { });
        } catch { }

        await db.collection("metrics").add({
            type: "group_thumbnail_error",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            original_file: filePath,
            error: String(error)
        });

        throw error;
    }
});
