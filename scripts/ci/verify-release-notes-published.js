#!/usr/bin/env node
'use strict';

/**
 * Le de volta (somente leitura) os documentos `release_notes/<plataforma>_<versao>`
 * do Firestore e confirma published=true e version correta.
 *
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=sa.json \
 *   node scripts/ci/verify-release-notes-published.js web 1.57.0 1.58.0
 */

function isPublishedDoc(data, version) {
  return Boolean(data) && data.published === true && data.version === version;
}

async function main() {
  const [platform, ...versions] = process.argv.slice(2);
  if (!platform || versions.length === 0) {
    console.error('uso: verify-release-notes-published.js <plataforma> <versao...>');
    process.exit(2);
  }
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  let bad = 0;
  for (const v of versions) {
    const id = `${platform}_${v}`;
    const snap = await admin.firestore().collection('release_notes').doc(id).get();
    const d = snap.exists ? snap.data() : undefined;
    const headline = (d && d.content && d.content['pt-BR'] && d.content['pt-BR'].headline) || '';
    console.log(`${id}: exists=${snap.exists} published=${d && d.published} version=${d && d.version} headline=${headline}`);
    if (!isPublishedDoc(d, v)) bad += 1;
  }
  process.exit(bad ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`verify-release-notes-published falhou: ${err.message}`);
    process.exit(2);
  });
}

module.exports = { isPublishedDoc };
