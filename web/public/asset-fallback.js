/* eslint-disable no-undef */

const RELOAD_MARKER = 'futeba_asset_fallback_reload_at';
const RELOAD_WINDOW_MS = 15000;

async function clearInstallCache() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

function canReload(now) {
  try {
    const previous = Number(window.sessionStorage.getItem(RELOAD_MARKER) || 0);
    window.sessionStorage.setItem(RELOAD_MARKER, String(now));
    return !previous || now - previous > RELOAD_WINDOW_MS;
  } catch {
    return true;
  }
}

function reloadWithCacheBust(now) {
  const url = new URL(window.location.href);
  url.searchParams.set('cacheBust', String(now));
  window.location.replace(url.toString());
}

void (async function repairStaleAssetCache() {
  const now = Date.now();
  if (!canReload(now)) return;

  try {
    await clearInstallCache();
  } finally {
    reloadWithCacheBust(now);
  }
})();
