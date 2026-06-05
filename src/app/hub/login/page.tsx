import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session) {
    redirect("/hub");
  }

  const { error } = await searchParams;

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "450px", margin: "0 auto", marginTop: "100px", border: "1px solid #ccc", background: "#fbfbfb", borderRadius: "8px" }}>
      <h2 style={{ marginTop: 0, textAlign: "center" }}>Creator Hub</h2>
      <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.5", textAlign: "center" }}>
        Sign in to manage your events, generate alternative internet sites, and configure your AI agents.
      </p>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "30px" }}>
        {process.env.AUTH_GOOGLE_ID && (
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/hub" }); }}>
            <button type="submit" style={{ width: "100%", padding: "12px", background: "#4285F4", color: "white", border: "1px solid #ccc", cursor: "pointer", fontWeight: "bold", fontSize: "16px", borderRadius: "4px" }}>
              Sign in with Google
            </button>
          </form>
        )}
        
        {process.env.AUTH_GITHUB_ID && (
          <form action={async () => { "use server"; await signIn("github", { redirectTo: "/hub" }); }}>
            <button type="submit" style={{ width: "100%", padding: "12px", background: "#24292e", color: "white", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "16px", borderRadius: "4px" }}>
              Sign in with GitHub
            </button>
          </form>
        )}

        {(process.env.NODE_ENV === "development" || getConfig().server.allow_local_login) && (
          <form action={async () => { "use server"; await signIn("local", { redirectTo: "/hub" }); }}>
            <button type="submit" style={{ width: "100%", padding: "12px", background: "#4CAF50", color: "white", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "16px", borderRadius: "4px" }}>
              Sign in as Local User
            </button>
          </form>
        )}
        
        {error && (
          <div style={{ marginTop: "10px", padding: "10px", background: "#fdecea", color: "#d32f2f", border: "1px solid #f5c6cb", fontSize: "14px", borderRadius: "4px" }}>
            <b>Authentication Error:</b> {error}
          </div>
        )}
      </div>
    </div>
  );
}
