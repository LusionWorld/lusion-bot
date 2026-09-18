import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", getAppOrigin()));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
