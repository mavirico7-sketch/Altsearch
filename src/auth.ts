import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getConfig } from "@/lib/config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      activeProvider?: string;
      providerSettings?: string | null;
      isNewUser?: boolean;
    }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google, 
    GitHub,
    Credentials({
      id: "local",
      name: "Local Development",
      credentials: {},
      async authorize() {
        const config = getConfig();
        if (process.env.NODE_ENV !== "development" && !config.server.allow_local_login) {
          return null; // Deny if not explicitly enabled in production
        }
        return {
          id: "local-user",
          email: "local@altsearch.local",
          name: "Local User",
          image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%234A90E2'/><text x='50' y='50' font-family='Arial' font-size='40' fill='white' text-anchor='middle' dominant-baseline='central'>LU</text></svg>",
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        const db = await getDb();
        const existingUser = await db.select().from(users).where(eq(users.email, user.email)).get();
        if (!existingUser) {
          const newId = crypto.randomUUID();
          await db.insert(users).values({
            id: newId,
            email: user.email,
            name: user.name || "",
            image: user.image || "",
          });
          user.id = newId;
        } else {
          user.id = existingUser.id;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      if (token.id) {
        const db = await getDb();
        const dbUser = await db.select().from(users).where(eq(users.id, token.id as string)).get();
        if (!dbUser) return null as any; // Invalidate session if user was deleted
        
        token.activeProvider = dbUser.activeProvider;
        token.providerSettings = dbUser.providerSettings;
        token.isNewUser = dbUser.isNewUser;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
        session.user.activeProvider = token.activeProvider as string;
        session.user.providerSettings = token.providerSettings as string | null;
        session.user.isNewUser = token.isNewUser as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/hub/login",
  },
  secret: process.env.AUTH_SECRET || "super_secret_mock_key_for_testing",
  trustHost: true,
});
