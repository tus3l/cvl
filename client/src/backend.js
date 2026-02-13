// Backend base discovery for dev and prod (Vercel/Render)
let cachedBase = null;

function sanitizeBase(url) {
  if (!url) return '';
  try {
    // Remove trailing slash if present
    return url.endsWith('/') ? url.slice(0, -1) : url;
  } catch {
    return url;
  }
}

export async function getBackendBase() {
  if (cachedBase) return cachedBase;

  // 1) Prefer environment configuration (Vite on Vercel)
  const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : (typeof window !== 'undefined' && window.__API_BASE__ ? window.__API_BASE__ : null);

  if (envBase) {
    cachedBase = sanitizeBase(envBase);
    window.BACKEND_BASE = cachedBase;
    return cachedBase;
  }

  // 2) Fallback: try local dev discovery
  const candidates = [5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010];
  for (const port of candidates) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`, { credentials: 'include' });
      if (res.ok) {
        cachedBase = `http://localhost:${port}`;
        window.BACKEND_BASE = cachedBase;
        return cachedBase;
      }
    } catch {}
  }

  // 3) Final fallback: production default Render URL
  cachedBase = sanitizeBase('https://cvl-backend-n5p6.onrender.com');
  window.BACKEND_BASE = cachedBase;
  return cachedBase;
}

export function getCachedBackendBase() {
  // Try env first for immediate availability without async
  if (!cachedBase) {
    const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
      ? import.meta.env.VITE_API_BASE_URL
      : (typeof window !== 'undefined' && window.__API_BASE__ ? window.__API_BASE__ : null);
    if (envBase) {
      cachedBase = sanitizeBase(envBase);
      window.BACKEND_BASE = cachedBase;
    }
  }
  return cachedBase || window.BACKEND_BASE || '';
}