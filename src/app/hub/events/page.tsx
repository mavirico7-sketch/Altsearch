import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import "../hub.css";
import "./events.css";
import { getEventsByUserId } from "@/lib/events";
import DeleteEventForm from "./DeleteEventForm";

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

export default async function EventsPage() {
  const session = await auth();
  if (!session) {
    redirect("/hub/login");
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
            <Link href="/hub">Overview</Link>
            <Link className="active" href="/hub/events">My events</Link>
            <Link href="/hub/settings">Settings</Link>
          </nav>

          <div className="side-box">
            <div className="side-box__title">Events</div>
            <div className="plan-row">
              <span>Total</span>
              <b>{allEvents.length}</b>
            </div>
            <p>21 public, 6 private. 92 generated sites across all events.</p>
          </div>
        </aside>

        <section className="content" aria-label="My events">
          <div className="page-head">
            <div>
              <p className="crumb">AltSearch / Hub / My events</p>
              <h1>My events</h1>
            </div>
            <div className="head-actions">
              <Link className="button primary" href="/hub/events/new">Create event</Link>
              <button className="button" type="button">Export list</button>
            </div>
          </div>

          <section className="events-toolbar" aria-label="Event filters">
            <form className="events-search" action="#">
              <input type="search" placeholder="Search your events" aria-label="Search your events" />
              <button type="submit">Search</button>
            </form>
            <div className="filter-tabs" aria-label="Visibility filters">
              <button className="active" type="button">All</button>
              <button type="button">Public</button>
              <button type="button">Private</button>
              <button type="button">Drafts</button>
            </div>
          </section>

          <section className="panel events-table-panel">
            <div className="panel-head">
              <div>
                <h2>{allEvents.length} events</h2>
                <p>Sorted by last edited.</p>
              </div>
            </div>

            <table className="events-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Visibility</th>
                  <th>Sites</th>
                  <th>Last edited</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#5f6368" }}>
                      No events created yet.
                    </td>
                  </tr>
                ) : (
                  allEvents.map(event => (
                    <tr key={event.id}>
                      <td>
                        <Link className="event-name" href={`/hub/events/${event.id}`}>{event.title}</Link>
                      </td>
                      <td>
                        {event.isPrivate ? (
                          <span className="pill" style={{ background: "#f1f3f4", color: "#5f6368" }}>Private</span>
                        ) : (
                          <span className="pill public">Public</span>
                        )}
                      </td>
                      <td>
                        <b>0</b>
                        <span></span>
                      </td>
                      <td>
                        Today
                        <span>—</span>
                      </td>
                      <td><span className={`status ${event.status === "complete" ? "good" : "work"}`}>{event.status === "complete" ? "Ready" : event.status}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <Link href={`/hub/events/${event.id}`} className="button" style={{textDecoration:"none"}}>Open</Link>
                          <DeleteEventForm eventId={event.id} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </section>
    </div>
  );
}
