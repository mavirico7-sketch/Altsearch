import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/hub/login");
  }

  if (!session.user.isNewUser) {
    redirect("/hub");
  }

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "550px", margin: "0 auto", marginTop: "100px", border: "1px solid #ccc", background: "#fbfbfb", borderRadius: "8px" }}>
      <h2 style={{ marginTop: 0, textAlign: "center" }}>Welcome to Creator Hub</h2>
      <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.5", textAlign: "center", marginBottom: "30px" }}>
        Before you can start generating events, you need to connect an AI provider.
        We recommend OpenRouter for the best experience.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <a 
          href="/api/auth/openrouter/login" 
          style={{ display: "block", textAlign: "center", padding: "14px", background: "#0056b3", color: "white", textDecoration: "none", cursor: "pointer", fontWeight: "bold", fontSize: "16px", borderRadius: "4px" }}
        >
          Connect OpenRouter (Recommended)
        </a>
        
        <form action={async () => {
          "use server";
          const db = await getDb();
          await db.update(users)
            .set({ isNewUser: false })
            .where(eq(users.id, session.user.id));
          redirect("/hub");
        }}>
          <button type="submit" style={{ width: "100%", padding: "14px", background: "#f1f1f1", color: "#333", border: "1px solid #ccc", cursor: "pointer", fontWeight: "bold", fontSize: "16px", borderRadius: "4px" }}>
            Skip for now
          </button>
        </form>
      </div>
      
      <div style={{ marginTop: "30px", fontSize: "13px", color: "#888", textAlign: "center" }}>
        You can always connect a provider later in the Hub settings.
      </div>
    </div>
  );
}
