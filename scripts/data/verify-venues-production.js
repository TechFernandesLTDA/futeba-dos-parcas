/* Verificação somente-leitura das locations importadas (epic #4186 / #4195).
 * Uso: VENUES_PROJECT_ID=futebadosparcas NODE_PATH=functions/node_modules \
 *      node scripts/data/verify-venues-production.js [saida.json]
 * Escopo "importadas": external_data.imported_by == 'venue-dataset-import'.
 * Conta chaves camelCase em locations e fields, status de publicação, consistência de
 * field_count/has_active_fields e venues/quadras por cidade.
 */
const admin = require("firebase-admin");
const fs = require("fs");
admin.initializeApp({projectId: process.env.VENUES_PROJECT_ID || "futebadosparcas"});
const db = admin.firestore();
const hasUpper = (k) => /[A-Z]/.test(k);

(async () => {
  const snap = await db.collection("locations").where("external_data.imported_by", "==", "venue-dataset-import").get();
  const byCity = {};
  const report = {
    project: admin.app().options.projectId, imported_locations: snap.size, camel_location_docs: 0, camel_field_docs: 0,
    camel_keys: {}, status: {}, verified_true: [], with_fields: 0, fields_total: 0, field_count_mismatch: [],
    has_active_fields_mismatch: [], no_fields: 0, with_phone: 0, with_website: 0, with_sources: 0, closed_flagged: 0, with_price_table: 0,
  };
  for (const d of snap.docs) {
    const x = d.data();
    const camel = Object.keys(x).filter(hasUpper);
    if (camel.length) { report.camel_location_docs += 1; camel.forEach((k) => { report.camel_keys[k] = (report.camel_keys[k] || 0) + 1; }); }
    const fieldsSnap = await d.ref.collection("fields").get();
    if (fieldsSnap.docs.some((f) => Object.keys(f.data()).some(hasUpper))) report.camel_field_docs += 1;
    const st = x.publication_status || "(none)";
    report.status[st] = (report.status[st] || 0) + 1;
    if (x.is_verified === true) report.verified_true.push(`${d.id} ${x.name} [${st}]`);
    const n = fieldsSnap.size;
    report.fields_total += n;
    if (n > 0) report.with_fields += 1; else report.no_fields += 1;
    if ((x.field_count || 0) !== n) report.field_count_mismatch.push(`${d.id} ${x.name}: field_count=${x.field_count} docs=${n}`);
    if (Boolean(x.has_active_fields) !== (n > 0)) report.has_active_fields_mismatch.push(`${d.id} ${x.name}`);
    if (x.phone) report.with_phone += 1;
    if (x.website) report.with_website += 1;
    const ext = x.external_data || {};
    if (Array.isArray(ext.sources) && ext.sources.length) report.with_sources += 1;
    if (String(ext.operational_status || "").includes("fechado")) report.closed_flagged += 1;
    if (Array.isArray(ext.price_table) && ext.price_table.length) report.with_price_table += 1;
    const c = x.city || "(sem cidade)";
    byCity[c] = byCity[c] || {venues: 0, quadras: 0, venues_com_quadras: 0};
    byCity[c].venues += 1; byCity[c].quadras += n; if (n > 0) byCity[c].venues_com_quadras += 1;
  }
  report.by_city = Object.fromEntries(Object.entries(byCity).sort((a, b) => b[1].venues - a[1].venues));
  report.generated_at = new Date().toISOString();
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch((e) => { console.error(e.message); process.exit(1); });
