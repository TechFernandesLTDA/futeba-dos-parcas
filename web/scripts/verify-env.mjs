import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const envFiles = ['.env', '.env.production'];
const values = new Map();

for (const file of envFiles) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      values.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
    }
  } catch {
    // Vite also tolerates absent env files; validation below reports missing keys.
  }
}

for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('VITE_')) values.set(key, value);
}

const missing = requiredKeys.filter((key) => !values.get(key));
if (missing.length > 0) {
  console.error(`Missing required web env vars: ${missing.join(', ')}`);
  process.exit(1);
}
