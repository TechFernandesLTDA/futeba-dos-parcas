const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'futebadosparcas.firebasestorage.app'
});

const db = admin.firestore();
const storage = admin.storage();

async function checkUserPhotos() {
  try {
    console.log('=== Checking User Photos in Firestore ===\n');

    const usersSnapshot = await db.collection('users').limit(5).get();

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`Name: ${data.name || 'N/A'}`);
      console.log(`PhotoURL: ${data.photoUrl || 'NO PHOTO'}`);
      console.log(`---`);
    });

    console.log('\n=== Checking Storage bucket for profile_images ===\n');

    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'profile_images/' });

    if (files.length === 0) {
      console.log('No profile images found in storage');
    } else {
      console.log(`Found ${files.length} profile image(s):`);
      files.forEach(file => {
        console.log(`- ${file.name}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUserPhotos();
