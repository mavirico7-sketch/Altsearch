import { auth, signOut } from "@/auth";
import Link from "next/link";
import TopNav from "./TopNav";
import "./topbar.css";

async function getOpenRouterBalance(key: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { "Authorization": `Bearer ${key}` },
      next: { revalidate: 60 }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.data) {
      const credits = json.data.total_credits || 0;
      const usage = json.data.total_usage || 0;
      return `$${(credits - usage).toFixed(4)}`;
    }
    return null;
  } catch (e) {
    return null;
  }
}

import { cookies } from "next/headers";

export default async function Topbar() {
  const session = await auth();
  const cookieStore = await cookies();
  const initialScope = cookieStore.get("search_scope")?.value || "global";
  
  let balanceDisplay = "$--";
  let openrouterKey = null;
  try {
    if (session?.user?.providerSettings) {
      const settings = typeof session.user.providerSettings === "string" 
        ? JSON.parse(session.user.providerSettings) 
        : session.user.providerSettings;
      openrouterKey = settings?.openrouter?.key || null;
    }
  } catch {}

  if (openrouterKey) {
    const bal = await getOpenRouterBalance(openrouterKey);
    if (bal) balanceDisplay = bal;
  }

  return (
    <header className="global-topbar">
      <div className="global-topbar__inner">
        <Link className="global-brand" href="/" aria-label="AltSearch">
          <span className="blue">A</span><span className="red">l</span><span className="yellow">t</span><span className="blue">S</span><span className="green">e</span><span className="red">a</span><span className="yellow">r</span><span className="blue">c</span><span className="green">h</span>
        </Link>

        <TopNav isAuthenticated={!!session} initialScope={initialScope} />

        {session ? (
          <div className="global-account-group">
            <Link className="global-account" href="/hub">
              <span>
                <b>{session.user?.name}</b>
                {openrouterKey && (
                  <small style={{ display: "block", color: "#188038", marginTop: "2px" }}>{balanceDisplay}</small>
                )}
              </span>
              <span className="global-avatar">
                {session.user?.image ? <img src={session.user.image} alt="Avatar" referrerPolicy="no-referrer" /> : session.user?.name?.charAt(0) || "U"}
              </span>
            </Link>
            <form action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}>
              <button type="submit" className="global-button" style={{ height: "38px" }}>Sign Out</button>
            </form>
          </div>
        ) : (
          <Link href="/hub/login" className="global-button primary" style={{ height: "38px", display: "flex", alignItems: "center" }}>Sign In</Link>
        )}
      </div>
    </header>
  );
}
