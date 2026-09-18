import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAuthorizeUrl } from "@/lib/discord";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
