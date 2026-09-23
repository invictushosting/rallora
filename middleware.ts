import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/maintenance", "/pilot", "/register-club"];

export function middleware(request: NextRequest) {
  // Preview deployments remain fully usable for development/testing.
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.next();
  }

  if (process.env.RALLORA_MAINTENANCE_MODE !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/brand/");

  if (isPublic) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api/).*)"],
};
