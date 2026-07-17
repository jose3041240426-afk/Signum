import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Prevenir clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");

  // Forzar HTTPS (solo en producción)
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // Prevenir MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Protección contra XSS (legacy browser support)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Permissions Policy (restringir APIs del navegador)
  response.headers.set(
    "Permissions-Policy",
    "camera=self, microphone=self, geolocation=(), interest-cohort=()"
  );

  return response;
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto archivos estáticos y _next
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
