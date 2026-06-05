import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import "./hub.css";
import { getEventsByUserId } from "@/lib/events";

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

export default async function HubPage() {
  const session = await auth();
  if (!session) {
    redirect("/hub/login");
  }

  if (session.user?.isNewUser) {
    redirect("/hub/onboarding");
  }

  let openrouterKey = null;
  try {
    if (session?.user?.providerSettings) {
      const settings = typeof session.user.providerSettings === "string" 
        ? JSON.parse(session.user.providerSettings) 
        : session.user.providerSettings;
      openrouterKey = settings?.openrouter?.key || null;
    }
  } catch {}

  const hasOpenRouter = !!openrouterKey;
  const providerName = session.user?.activeProvider || "None";
  
  let balanceDisplay = "$--";
  if (hasOpenRouter && openrouterKey) {
    const bal = await getOpenRouterBalance(openrouterKey);
    if (bal) balanceDisplay = `Balance: ${bal}`;
  }

  const allEvents = await getEventsByUserId(session.user.id);

  return (
    <div className="page">
        <aside className="sidebar" aria-label="Hub navigation">
          <div className="section-label">Creator Hub</div>
          <nav className="side-nav">
            <Link className="active" href="/hub">Overview</Link>
            <Link href="/hub/events">My events</Link>
            <Link href="/hub/settings">Settings</Link>
          </nav>

          <div className="side-box" style={{ marginTop: "16px", borderColor: "#ffcdd2", background: "#fffafa" }}>
            <div className="side-box__title" style={{ color: "#c62828" }}>Debug Tools</div>
            <form action={async () => {
              "use server";
              const session = await auth();
              if (session?.user?.id) {
                const { getDb } = await import("@/lib/db");
                const { users } = await import("@/lib/schema");
                const { eq } = await import("drizzle-orm");
                const db = await getDb();
                await db.delete(users).where(eq(users.id, session.user.id));
                await signOut({ redirectTo: "/" });
              }
            }}>
              <button type="submit" className="button" style={{ width: "100%", borderColor: "#ffcdd2", background: "#ffebee", color: "#c62828", justifyContent: "center" }}>
                Delete Account
              </button>
            </form>
          </div>
        </aside>

        <section className="content" aria-label="Overview">
          <div className="page-head">
            <div>
              <p className="crumb">AltSearch / Hub</p>
              <h1>Overview</h1>
            </div>
            <div className="head-actions">
              <Link className="button primary" href="/hub/events/new">Create event</Link>
              <button className="button" type="button">Export</button>
            </div>
          </div>

          <section className="summary-grid" aria-label="Account summary">
            <article className="summary-card">
              <span>AI Provider</span>
              <strong>{providerName}</strong>
              {hasOpenRouter ? (
                <p>OpenRouter key linked.</p>
              ) : providerName !== "openrouter" && providerName !== "None" ? (
                <p>{providerName} API key linked.</p>
              ) : (
                <p><a href="/api/auth/openrouter/login" style={{color: "#15c", fontWeight: "bold"}}>Connect OpenRouter</a></p>
              )}
            </article>
            <article className="summary-card">
              <span>Events</span>
              <strong>{allEvents.length}</strong>
              <p>Total events in the database.</p>
            </article>
          </section>

          <div className="main-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Recent events</h2>
                  <p>Short list for quick return. Full archive opens separately.</p>
                </div>
                <Link href="#">View all</Link>
              </div>

              <div className="event-list">
                {allEvents.length === 0 ? (
                  <p style={{ padding: "16px", color: "#5f6368" }}>No events created yet.</p>
                ) : (
                  allEvents.slice(0, 5).map(event => (
                    <article key={event.id} className="event-row">
                      <div>
                        <Link className="event-title" href={`/hub/events/${event.id}`}>{event.title}</Link>
                      </div>
                      <div className="event-meta">
                        <span className={`status ${event.status === "complete" ? "good" : "work"}`}>{event.status}</span>
                        <Link href={`/hub/events/${event.id}`} className="button" style={{textDecoration: "none"}}>Open</Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
    </div>
  );
}
