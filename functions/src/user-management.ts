import {auth} from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();

/**
 * Cloud Function: onUserCreate
 *
 * Trigger: Firebase Auth onCreate
 * Purpose: Initialize user document in Firestore with all required fields
 * and set default Custom Claims (role: PLAYER) for JWT-based authorization.
 *
 * This ensures all profile fields exist from user creation, preventing
 * update failures when users try to edit their profiles.
 *
 * @remarks
 * - Idempotente: verifica se documento já existe antes de criar
 * - Custom Claims: define role PLAYER no JWT token (PERF_001)
 * - Campos: inicializa TODOS os campos do perfil com defaults
 *
 * @see specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md
 */
export const onUserCreate = auth.user().onCreate(async (user: admin.auth.UserRecord) => {
  const userId = user.uid;
  const db = getDb();

  try {
    // Idempotência: verificar se documento já existe
    const existingDoc = await db.collection("users").doc(userId).get();

    if (existingDoc.exists) {
      logger.info(`[USER_MGMT] User ${userId} already exists, skipping creation.`);
      return;
    }

    // Validar dados mínimos do Firebase Auth
    if (!user.email && !user.phoneNumber) {
      logger.warn(`[USER_MGMT] User ${userId} created without email or phone. Proceeding with defaults.`);
    }

    // Initialize user document with all required fields
    const newUserDoc = {
      // Basic fields (from Firebase Auth)
      id: userId,
      email: user.email || "",
      name: user.displayName || "",
      photo_url: user.photoURL || null,

      // Profile fields (initialize with defaults)
      nickname: null,
      phone: null,
      is_searchable: true,
      is_profile_public: true,

      // Role and gamification (defaults)
      role: "PLAYER",
      level: 1,
      experience_points: 0,
      milestones_achieved: [],

      // Manual ratings (initialize to 0)
      striker_rating: 0.0,
      mid_rating: 0.0,
      defender_rating: 0.0,
      gk_rating: 0.0,

      // Auto ratings (initialize to 0)
      auto_striker_rating: 0.0,
      auto_mid_rating: 0.0,
      auto_defender_rating: 0.0,
      auto_gk_rating: 0.0,
      auto_rating_samples: 0,
      auto_rating_updated_at: null,

      // Preferences (defaults)
      preferred_field_types: ["SOCIETY"], // Default to Society
      preferred_position: null,

      // Personal information (initialize as null - user will fill)
      birth_date: null,
      gender: null,
      height_cm: null,
      weight_kg: null,
      dominant_foot: null,
      primary_position: null,
      secondary_position: null,
      play_style: null,
      experience_years: null,

      // Technical fields
      fcm_token: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userId).set(newUserDoc);

    // PERF_001: Setar Custom Claim padrão para o JWT token
    // Permite que Security Rules usem request.auth.token.role
    try {
      await admin.auth().setCustomUserClaims(userId, {role: "PLAYER"});
      logger.info(`[USER_MGMT] Custom Claims set for user ${userId}: role=PLAYER`);
    } catch (claimsError) {
      // Non-critical: o onNewUserCreated em custom-claims.ts também tenta setar
      logger.warn(`[USER_MGMT] Failed to set Custom Claims for ${userId} (will be retried by onNewUserCreated):`, claimsError);
    }

    logger.info(`[USER_MGMT] User ${userId} created successfully with all fields initialized.`);
  } catch (error) {
    logger.error(`[USER_MGMT] Error creating user document for ${userId}:`, error);
    throw error;
  }
});
