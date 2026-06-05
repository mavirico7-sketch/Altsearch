import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);

  if (!session?.user?.id) {
    return NextResponse.redirect(`${url.origin}/hub/login?error=PleaseSignInFirst`);
  }

  const code = url.searchParams.get("code");
  const cookieStore = await cookies();
  const verifier = cookieStore.get("openrouter_code_verifier")?.value;

  if (!code || !verifier) {
    return NextResponse.redirect(`${url.origin}/hub?error=MissingCodeOrVerifier`);
  }

  // Exchange code for API key
  const tokenResponse = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      code_challenge_method: "S256"
    })
  });

  if (!tokenResponse.ok) {
    console.error("OpenRouter key exchange failed:", await tokenResponse.text());
    return NextResponse.redirect(`${url.origin}/hub?error=KeyExchangeFailed`);
  }

  const data = await tokenResponse.json();
  const apiKey = data.key;
  
  if (!apiKey) {
    return NextResponse.redirect(`${url.origin}/hub?error=NoApiKeyReturned`);
  }
  
  const db = await getDb();
  const dbUser = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  
  let settings: any = {};
  if (dbUser?.providerSettings) {
    // Drizzle json mode automatically parses it
    settings = typeof dbUser.providerSettings === "string" 
      ? JSON.parse(dbUser.providerSettings) 
      : dbUser.providerSettings;
  }

  settings.openrouter = {
    ...(settings.openrouter || {}),
    key: apiKey,
  };

  await db.update(users)
    .set({ 
      activeProvider: "openrouter",
      providerSettings: settings, 
      isNewUser: false 
    })
    .where(eq(users.id, session.user.id));

  // The session token might need to be refreshed for the UI to pick up the openrouterKey,
  // but NextAuth sessions are generally refreshed on page load if using server components.
  return NextResponse.redirect(`${url.origin}/hub`);
}
