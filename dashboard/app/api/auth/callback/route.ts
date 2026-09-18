import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchCurrentUser } from "@/lib/discord";
import { encodeSession, SESSION_COOKIE } from "@/lib/session";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request: NextRequest) {
  const origin = getAppOrigin();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = request.cookies.get("oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=state", origin));
  }

  try {
    const token = await exchangeCode(code);
    const user = await fetchCurrentUser(token.access_token);

    const session = encodeSession({
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    });

    const res = NextResponse.redirect(new URL("/", origin));
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: token.expires_in,
      path: "/",
    });
    res.cookies.delete("oauth_state");
    return res;
  } catch (err) {
    console.error("[auth/callback]", err);
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }
}
