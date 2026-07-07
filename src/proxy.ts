import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth protection is handled at the page level via requireOrgSession()
// which uses Next.js redirect() to send unauthenticated users to login.
// This avoids a redirect loop that exhausted the browser's connection pool
// when the proxy redirected RSC prefetch requests.
//
// We only tag admin requests with `x-is-admin` so the root layout can swap the
// marketing header/footer for the authenticated app shell (persistent sidebar).
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-is-admin", "1");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/o/:orgSlug/admin/:path*"],
};
