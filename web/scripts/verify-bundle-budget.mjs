import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Orçamento do grafo estático de boot (Onda F — F3):
// Garante em tempo de build que o entrypoint (`index-*.js`) e todos os chunks
// importados estaticamente no boot fiquem abaixo de 1,5 MB (1500 KB) e que
// chunks frios (outros idiomas, ícones de rotas internas, componentes MUI pesados,
// Firebase Functions/Storage/Messaging/Analytics, gráficos, mapas) não regressem
// para o grafo síncrono de inicialização.

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../dist/assets');

const MAX_STATIC_BOOT_BYTES = 1500 * 1024; // 1.500 KB (~1,46 MiB / 1,5 MB)
const MAX_ENTRY_CHUNK_BYTES = 300 * 1024; // 300 KB para o chunk index-*.js isolado

const FORBIDDEN_BOOT_CHUNK_PREFIXES = [
  'i18n-en-',
  'i18n-es-',
  'vendor-firebase-functions-',
  'vendor-firebase-storage-',
  'vendor-firebase-messaging-',
  'vendor-firebase-analytics-',
  'vendor-mui-icons-',
  'vendor-mui-extra-',
  'vendor-charts-',
  'vendor-google-maps-',
];

if (!existsSync(assetsDir)) {
  console.error(`[bundle-budget] Pasta não encontrada: ${assetsDir}`);
  process.exit(1);
}

const files = readdirSync(assetsDir);
const entryFile = files.find((f) => /^index-[^.]+\.js$/.test(f));

if (!entryFile) {
  console.error('[bundle-budget] Chunk de entrada index-*.js não encontrado em dist/assets.');
  process.exit(1);
}

const visited = new Set();
const queue = [entryFile];
const bootChunks = [];

while (queue.length > 0) {
  const current = queue.shift();
  if (!current || visited.has(current)) continue;
  visited.add(current);

  const fullPath = resolve(assetsDir, current);
  if (!existsSync(fullPath)) {
    console.error(`[bundle-budget] Chunk referenciado não encontrado: ${current}`);
    process.exit(1);
  }

  const size = statSync(fullPath).size;
  bootChunks.push({ name: current, size });

  const code = readFileSync(fullPath, 'utf8');
  const staticImports = [...code.matchAll(/from\s*["']\.\/([^"']+)["']/g)].map((m) => m[1]);
  for (const imp of staticImports) {
    if (!visited.has(imp)) {
      queue.push(imp);
    }
  }
}

const totalBootBytes = bootChunks.reduce((acc, c) => acc + c.size, 0);
const entryBytes = bootChunks[0].size;
const totalBootKB = (totalBootBytes / 1024).toFixed(1);
const maxBootKB = (MAX_STATIC_BOOT_BYTES / 1024).toFixed(1);
const entryKB = (entryBytes / 1024).toFixed(1);

const leakedColdChunks = bootChunks
  .map((c) => c.name)
  .filter((name) => FORBIDDEN_BOOT_CHUNK_PREFIXES.some((prefix) => name.startsWith(prefix)));

console.log(
  `[bundle-budget] Boot estático: ${totalBootKB} KB / limite ${maxBootKB} KB (${bootChunks.length} chunks, entry ${entryKB} KB)`,
);

if (leakedColdChunks.length > 0) {
  console.error(
    `[bundle-budget] FALHA: chunks frios vazaram para o boot estático: ${leakedColdChunks.join(', ')}`,
  );
  process.exit(1);
}

if (entryBytes > MAX_ENTRY_CHUNK_BYTES) {
  console.error(
    `[bundle-budget] FALHA: chunk de entrada ${entryFile} (${entryKB} KB) excede o limite de ${(MAX_ENTRY_CHUNK_BYTES / 1024).toFixed(1)} KB.`,
  );
  process.exit(1);
}

if (totalBootBytes > MAX_STATIC_BOOT_BYTES) {
  console.error(
    `[bundle-budget] FALHA: grafo estático de boot (${totalBootKB} KB) excede o limite de ${maxBootKB} KB.`,
  );
  for (const chunk of bootChunks.sort((a, b) => b.size - a.size)) {
    console.error(`  - ${chunk.name}: ${(chunk.size / 1024).toFixed(1)} KB`);
  }
  process.exit(1);
}
