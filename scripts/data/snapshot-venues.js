/* Snapshot somente-leitura de locations + fields (produção). Uso:
 *   VENUES_PROJECT_ID=futebadosparcas NODE_PATH=functions/node_modules node scripts/data/snapshot-venues.js <saida.json>
 */
const admin = require("firebase-admin");
const fs = require("fs");
admin.initializeApp({projectId: process.env.VENUES_PROJECT_ID || "futebadosparcas"});
const db = admin.firestore();
(async () => {
  const snap = await db.collection("locations").get();
  const out = [];
  for (const d of snap.docs) {
    const f = await d.ref.collection("fields").get();
    out.push({id: d.id, data: JSON.parse(JSON.stringify(d.data())), fields: f.docs.map((x) => ({id: x.id, data: JSON.parse(JSON.stringify(x.data()))}))});
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
  console.log("locations:", out.length, "fields:", out.reduce((a, l) => a + l.fields.length, 0));
})().catch((e) => { console.error(e.message); process.exit(1); });
