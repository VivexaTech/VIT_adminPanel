import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/secure-admin/login", "/secure-admin/change-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/secure-admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Client-side Firebase Auth handles session; middleware ensures route structure only.
  // API routes verify Bearer tokens server-side.
  return NextResponse.next();
}

export const config = {
  matcher: ["/secure-admin/:path*"],
};
