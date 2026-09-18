import { createHmac, timingSafeEqual } from "crypto";

export interface SessionData {
  userId: string;
  username: string;
  avatar: string | null;
  accessToken: string;
  expiresAt: number; // epoch ms
}

const SECRET = process.env.SESSION_SECRET;

function sign(payload: string): string {
  if (!SECRET) throw new Error("SESSION_SECRET não configurado.");
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function decodeSession(cookieValue: string | undefined): SessionData | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data: SessionData = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.expiresAt < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "lusion_session";
