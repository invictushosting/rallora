import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/maintenance", "/pilot", "/register-club"];

function pilotClubPaths() {
  return (process.env.RALLORA_PILOT_CLUB_SLUGS ?? "")
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    .flatMap((slug) => [`/clubs/${slug}`]);
}

export function middleware(request: NextRequest) {
  // Preview deployments remain fully usable for development/testing.
  if (process.env.VERCEL_ENV !== "production") {
    return NextResponse.next();
  }

  if (process.env.RALLORA_MAINTENANCE_MODE !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const allowedPaths = [...PUBLIC_PATHS, ...pilotClubPaths()];
  const isPublic =
    allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
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
