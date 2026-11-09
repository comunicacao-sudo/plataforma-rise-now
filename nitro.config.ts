import { defineConfig } from "nitro";

// O HTML é servido pelo worker; _headers sozinho cobre apenas arquivos estáticos.
export default defineConfig({
  routeRules: {
    "/app-version.json": {
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
    },
    "/sw.js": {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Service-Worker-Allowed": "/",
        "Content-Type": "text/javascript; charset=utf-8",
      },
    },
    "/manifest.webmanifest": {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/manifest+json; charset=utf-8",
      },
    },
    "/**": {
      headers: {
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy":
          "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev; object-src 'none'; base-uri 'self'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  },
});
