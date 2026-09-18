import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
