// Dynamic backend discovery: find the server port when proxy isn't aligned.
let cachedBase = null;

export async function getBackendBase() {
  if (cachedBase) return cachedBase;
  const candidates = [5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010];
  for (const port of candidates) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`, { credentials: 'include' });
      if (res.ok) {
        cachedBase = `http://localhost:${port}`;
        // Store globally for reuse
        window.BACKEND_BASE = cachedBase;
        return cachedBase;
      }
    } catch {}
  }
  // Fallback to proxy default
  cachedBase = '';
  return cachedBase;
}

export function getCachedBackendBase() {
  return cachedBase || window.BACKEND_BASE || '';
}