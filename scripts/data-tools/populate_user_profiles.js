/**
 * Script para popular os perfis dos 4 usuarios cadastrados
 * com dados ficticios de teste
 *
 * Campos populados:
 * - birth_date (Data de nascimento)
 * - gender (Genero)
 * - height_cm (Altura em cm)
 * - weight_kg (Peso em kg)
 * - dominant_foot (Pe dominante)
 * - primary_position (Posicao principal)
 * - secondary_position (Posicao secundaria)
 * - play_style (Estilo de jogo)
 * - experience_years (Anos de experiencia)
 * - preferred_field_types (Tipos de campo preferidos)
 * - striker_rating, mid_rating, defender_rating, gk_rating (Notas por posicao)
 *
 * Uso: node scripts/populate_user_profiles.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Dados ficticios para cada usuario
// Os valores sao baseados nas opcoes do EditProfileScreen
// Emails obtidos do Firestore: ricardogf2004, rafaboumer, renankakinho69, techfernandesltda
const profileDataByEmail = {
  'renankakinho69@gmail.com': {
    nickname: 'Kaká',
    birth_date: new Date('1992-03-15'),
    gender: 'male',
    height_cm: 178,
    weight_kg: 75,
    dominant_foot: 'right',
    primary_position: 'midfielder',
    secondary_position: 'forward',
    play_style: 'balanced',
    experience_years: 15,
    preferred_field_types: ['SOCIETY', 'FUTSAL'],
    striker_rating: 3.8,
    mid_rating: 4.2,
    defender_rating: 3.0,
    gk_rating: 1.5
  },
  'ricardogf2004@gmail.com': {
    nickname: 'Ricardo',
    birth_date: new Date('1988-07-22'),
    gender: 'male',
    height_cm: 185,
    weight_kg: 82,
    dominant_foot: 'left',
    primary_position: 'defender',
    secondary_position: 'midfielder',
    play_style: 'defensive',
    experience_years: 18,
    preferred_field_types: ['SOCIETY', 'CAMPO'],
    striker_rating: 2.5,
    mid_rating: 3.5,
    defender_rating: 4.5,
    gk_rating: 2.0
  },
  'rafaboumer@gmail.com': {
    nickname: 'Boumer',
    birth_date: new Date('1990-11-08'),
    gender: 'male',
    height_cm: 175,
    weight_kg: 73,
    dominant_foot: 'right',
    primary_position: 'forward',
    secondary_position: 'midfielder',
    play_style: 'offensive',
    experience_years: 12,
    preferred_field_types: ['SOCIETY', 'FUTSAL', 'CAMPO'],
    striker_rating: 4.5,
    mid_rating: 3.2,
    defender_rating: 2.0,
    gk_rating: 1.0
  },
  'techfernandesltda@gmail.com': {
    nickname: 'Tech',
    birth_date: new Date('1995-01-25'),
    gender: 'male',
    height_cm: 180,
    weight_kg: 78,
    dominant_foot: 'both',
    primary_position: 'goalkeeper',
    secondary_position: 'defender',
    play_style: 'balanced',
    experience_years: 8,
    preferred_field_types: ['FUTSAL', 'SOCIETY'],
    striker_rating: 1.5,
    mid_rating: 2.5,
    defender_rating: 3.5,
    gk_rating: 4.2
  }
};

async function populateUserProfiles() {
  console.log('='.repeat(60));
  console.log('  POPULANDO PERFIS DE USUARIOS');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Listar todos os usuarios primeiro
    const usersSnapshot = await db.collection('users').get();

    console.log(`Total de usuarios encontrados: ${usersSnapshot.size}\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const email = userData.email;

      console.log(`-`.repeat(50));
      console.log(`Usuario: ${userData.name || 'Sem nome'}`);
      console.log(`Email: ${email}`);
      console.log(`ID: ${userDoc.id}`);

      // Verificar se temos dados para este usuario
      if (profileDataByEmail[email]) {
        const profileData = profileDataByEmail[email];

        console.log(`\nAtualizando com dados ficticios:`);
        console.log(`  - Apelido: ${profileData.nickname}`);
        console.log(`  - Data de nascimento: ${profileData.birth_date.toLocaleDateString('pt-BR')}`);
        console.log(`  - Genero: ${profileData.gender}`);
        console.log(`  - Altura: ${profileData.height_cm}cm`);
        console.log(`  - Peso: ${profileData.weight_kg}kg`);
        console.log(`  - Pe dominante: ${profileData.dominant_foot}`);
        console.log(`  - Posicao principal: ${profileData.primary_position}`);
        console.log(`  - Posicao secundaria: ${profileData.secondary_position}`);
        console.log(`  - Estilo de jogo: ${profileData.play_style}`);
        console.log(`  - Anos de experiencia: ${profileData.experience_years}`);
        console.log(`  - Tipos de campo: ${profileData.preferred_field_types.join(', ')}`);
        console.log(`  - Notas: ATK=${profileData.striker_rating} MID=${profileData.mid_rating} DEF=${profileData.defender_rating} GK=${profileData.gk_rating}`);

        // Atualizar o documento
        await db.collection('users').doc(userDoc.id).update({
          nickname: profileData.nickname,
          birth_date: admin.firestore.Timestamp.fromDate(profileData.birth_date),
          gender: profileData.gender,
          height_cm: profileData.height_cm,
          weight_kg: profileData.weight_kg,
          dominant_foot: profileData.dominant_foot,
          primary_position: profileData.primary_position,
          secondary_position: profileData.secondary_position,
          play_style: profileData.play_style,
          experience_years: profileData.experience_years,
          preferred_field_types: profileData.preferred_field_types,
          striker_rating: profileData.striker_rating,
          mid_rating: profileData.mid_rating,
          defender_rating: profileData.defender_rating,
          gk_rating: profileData.gk_rating,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`\n  [OK] Perfil atualizado com sucesso!`);
        updatedCount++;
      } else {
        console.log(`\n  [SKIP] Nenhum dado ficticio definido para este email`);
        skippedCount++;
      }

      console.log('');
    }

    console.log('='.repeat(60));
    console.log('RESUMO');
    console.log('='.repeat(60));
    console.log(`  Usuarios atualizados: ${updatedCount}`);
    console.log(`  Usuarios pulados: ${skippedCount}`);
    console.log(`  Total: ${usersSnapshot.size}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\nErro ao popular perfis:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar
populateUserProfiles();
