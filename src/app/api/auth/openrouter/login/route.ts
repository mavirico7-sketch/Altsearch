import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

function base64URLEncode(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest();
}

export async function GET(request: Request) {
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(sha256(Buffer.from(verifier)));

  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const callbackUrl = `${origin}/api/auth/openrouter/callback`;

  const cookieStore = await cookies();
  cookieStore.set("openrouter_code_verifier", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15, // 15 minutes
  });

  const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${challenge}&code_challenge_method=S256`;

  return NextResponse.redirect(authUrl);
}
