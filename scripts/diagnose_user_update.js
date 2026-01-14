/**
 * Diagnostic script to check user profile update issues
 *
 * This script:
 * 1. Fetches a sample user document from Firestore
 * 2. Compares field names with what's being sent from the app
 * 3. Checks for security rule violations
 * 4. Validates data types and structure
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Usage: node diagnose_user_update.js <userId>
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function diagnoseUserUpdate(userId) {
  console.log('=== USER PROFILE UPDATE DIAGNOSTIC ===\n');

  try {
    // 1. Fetch the user document
    console.log('1. Fetching user document from Firestore...');
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log(`❌ User document not found for ID: ${userId}`);
      return;
    }

    const userData = userDoc.data();
    console.log(`✅ User document found: ${userData.name || '(no name)'}\n`);

    // 2. Display current field structure
    console.log('2. Current Firestore document fields:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(userData).forEach(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      console.log(`   ${key.padEnd(30)} (${typeof value}) = ${displayValue}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 3. Expected fields from UserRepositoryImpl.kt (lines 162-187)
    console.log('3. Expected fields from UserRepositoryImpl.kt:');
    const expectedFields = {
      // Basic fields
      'name': 'string',
      'nickname': 'string?',
      'photo_url': 'string?',

      // Preferences
      'preferred_field_types': 'array<string>',

      // Manual ratings
      'striker_rating': 'double',
      'mid_rating': 'double',
      'defender_rating': 'double',
      'gk_rating': 'double',

      // Personal info
      'birth_date': 'long?',
      'gender': 'string?',
      'height_cm': 'int?',
      'weight_kg': 'int?',
      'dominant_foot': 'string?',
      'primary_position': 'string?',
      'secondary_position': 'string?',
      'play_style': 'string?',
      'experience_years': 'int?'
    };

    Object.entries(expectedFields).forEach(([field, type]) => {
      const exists = field in userData;
      const actualType = typeof userData[field];
      const match = exists ? '✅' : '❌';
      console.log(`   ${match} ${field.padEnd(30)} expected: ${type.padEnd(20)} actual: ${actualType}`);
    });
    console.log('');

    // 4. Check for field name mismatches
    console.log('4. Checking for field name mismatches:');
    const fieldsInDoc = Object.keys(userData);
    const fieldsExpected = Object.keys(expectedFields);

    const missingInDoc = fieldsExpected.filter(f => !fieldsInDoc.includes(f));
    if (missingInDoc.length > 0) {
      console.log('   ⚠️  Fields missing in Firestore document:');
      missingInDoc.forEach(f => console.log(`      - ${f}`));
    } else {
      console.log('   ✅ All expected fields exist in document');
    }

    const extraInDoc = fieldsInDoc.filter(f => !fieldsExpected.includes(f) && !['id', 'email', 'phone', 'fcm_token', 'is_searchable', 'is_profile_public', 'role', 'created_at', 'updated_at', 'level', 'experience_points', 'milestones_achieved', 'auto_striker_rating', 'auto_mid_rating', 'auto_defender_rating', 'auto_gk_rating', 'auto_rating_samples'].includes(f));
    if (extraInDoc.length > 0) {
      console.log('   ℹ️  Extra fields in document (not in update):');
      extraInDoc.forEach(f => console.log(`      - ${f}`));
    }
    console.log('');

    // 5. Check protected fields that should NOT be updated by client
    console.log('5. Checking protected fields (should NOT be updated by client):');
    const protectedFields = [
      'id',
      'created_at',
      'role',
      'experience_points',
      'level',
      'milestones_achieved',
      'auto_striker_rating',
      'auto_mid_rating',
      'auto_defender_rating',
      'auto_gk_rating',
      'auto_rating_samples',
      'fcm_token',
      'updated_at'
    ];

    protectedFields.forEach(field => {
      const exists = field in userData;
      const status = exists ? '🔒' : 'ℹ️ ';
      console.log(`   ${status} ${field.padEnd(30)} ${exists ? '(exists - protected by security rules)' : '(not set)'}`);
    });
    console.log('');

    // 6. Test security rules (simulate update)
    console.log('6. Simulating update payload (what UserRepositoryImpl sends):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const updatePayload = {};

    // Build update payload (simulating UserRepositoryImpl lines 162-187)
    if (userData.name) updatePayload['name'] = userData.name || 'Test Name';
    if (userData.nickname) updatePayload['nickname'] = userData.nickname;
    if (userData.photo_url) updatePayload['photo_url'] = userData.photo_url;
    updatePayload['preferred_field_types'] = userData.preferred_field_types || ['SOCIETY'];
    updatePayload['striker_rating'] = userData.striker_rating || 0.0;
    updatePayload['mid_rating'] = userData.mid_rating || 0.0;
    updatePayload['defender_rating'] = userData.defender_rating || 0.0;
    updatePayload['gk_rating'] = userData.gk_rating || 0.0;
    if (userData.birth_date) updatePayload['birth_date'] = userData.birth_date;
    if (userData.gender) updatePayload['gender'] = userData.gender;
    if (userData.height_cm) updatePayload['height_cm'] = userData.height_cm;
    if (userData.weight_kg) updatePayload['weight_kg'] = userData.weight_kg;
    if (userData.dominant_foot) updatePayload['dominant_foot'] = userData.dominant_foot;
    if (userData.primary_position) updatePayload['primary_position'] = userData.primary_position;
    if (userData.secondary_position) updatePayload['secondary_position'] = userData.secondary_position;
    if (userData.play_style) updatePayload['play_style'] = userData.play_style;
    if (userData.experience_years) updatePayload['experience_years'] = userData.experience_years;

    Object.entries(updatePayload).forEach(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      console.log(`   ${key.padEnd(30)} = ${displayValue}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 7. Try the actual update
    console.log('7. Testing actual update operation...');
    try {
      const testUserRef = db.collection('users').doc(userId);

      // Add a test field to verify update works
      await testUserRef.update({
        '_last_update_test': admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('   ✅ Update operation succeeded!');
      console.log('   ℹ️  Test field _last_update_test added');

      // Clean up test field
      await testUserRef.update({
        _last_update_test: admin.firestore.FieldValue.delete()
      });
      console.log('   ✅ Test field cleaned up');

    } catch (error) {
      console.log('   ❌ Update operation FAILED!');
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);

      // Security rule violations
      if (error.code === 'permission-denied') {
        console.log('\n   🔒 SECURITY RULE VIOLATION DETECTED!');
        console.log('   Check firestore.rules lines 144-164 for user update rules.');
        console.log('   Common issues:');
        console.log('      - User is not authenticated');
        console.log('      - Trying to update protected fields (id, role, experience_points, etc.)');
        console.log('      - Field does not exist in document (use set with merge instead of update)');
      }
    }
    console.log('');

    // 8. Recommendations
    console.log('8. RECOMMENDATIONS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (missingInDoc.length > 0) {
      console.log('⚠️  Missing fields detected:');
      console.log('   Solution: Initialize missing fields when creating user documents.');
      console.log('   Check Cloud Function onUserCreate to ensure all fields are initialized.');
      console.log('');
    }

    const hasRatings = userData.striker_rating !== undefined || userData.mid_rating !== undefined;
    if (!hasRatings) {
      console.log('⚠️  Rating fields missing:');
      console.log('   Solution: Initialize ratings to 0.0 in onUserCreate Cloud Function.');
      console.log('');
    }

    console.log('✅ SUCCESS CRITERIA:');
    console.log('   1. All expected fields exist in document');
    console.log('   2. Field names match exactly (case-sensitive)');
    console.log('   3. No protected fields are being updated by client');
    console.log('   4. Security rules allow update for authenticated user');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('   1. Check Firebase Console for this user document');
    console.log('   2. Verify firestore.rules deployment');
    console.log('   3. Run: firebase deploy --only firestore:rules');
    console.log('   4. Check Android logs for exact error messages');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  } finally {
    process.exit(0);
  }
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node diagnose_user_update.js <userId>');
  console.log('Example: node diagnose_user_update.js abc123xyz456');
  console.log('\nTo get a userId, check Firebase Console or run:');
  console.log('  node scripts/list_users.js');
  process.exit(1);
}

diagnoseUserUpdate(userId);
