import { defineConfig } from "nitro";

// O HTML é servido pelo worker; _headers sozinho cobre apenas arquivos estáticos.
export default defineConfig({
  routeRules: {
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
