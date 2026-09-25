import { NextRequest, NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  // Rallora is open for live end-to-end pilot testing.
  // Authentication, platform-admin checks and tenant RLS continue to protect
  // private/admin areas. Reintroduce a maintenance gate only for a deliberate
  // production incident or planned maintenance window.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/).*)"],
};
