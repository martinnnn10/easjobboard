import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The proxy now simply passes all requests through.
// Auth protection is handled at the page level via requireOrgSession()
// which uses Next.js redirect() to send unauthenticated users to login.
// This avoids a redirect loop that exhausted the browser's connection pool
// when the proxy redirected RSC prefetch requests.
export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/o/:orgSlug/admin/:path*"],
};
