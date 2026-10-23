import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "./src/lib/content-security-policy";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(
    nonce, process.env.NODE_ENV === "development", process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const headers = new Headers(request.headers);
  // Sobrescrever valores recebidos: nonce e CSP sao definidos pelo servidor.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
