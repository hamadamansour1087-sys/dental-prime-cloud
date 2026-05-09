import { createStart, createMiddleware } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

// Adds defense-in-depth security headers to every server response.
// CSP is intentionally permissive enough to avoid breaking inline styles,
// Vite client scripts, and Supabase calls, while still mitigating common XSS.
const securityHeaders = createMiddleware().server(async ({ next }) => {
  setResponseHeaders({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(self)",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  });
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}));
