import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import "../../hub.css";
import { createEvent } from "@/actions/create-event";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/hub/login");
  
  const params = await searchParams;
  const initialTitle = params.title || "";

  return (
    <div className="page">
        <aside className="sidebar" aria-label="Hub navigation">
          <div className="section-label">Creator Hub</div>
          <nav className="side-nav">
            <Link href="/hub">Overview</Link>
            <Link className="active" href="/hub/events">My events</Link>
            <Link href="/hub/settings">Settings</Link>
          </nav>
        </aside>

        <section className="content" aria-label="Create event">
          <div className="page-head">
            <div>
              <p className="crumb">AltSearch / Hub / My events / Create</p>
              <h1>Create new event</h1>
            </div>
            <div className="head-actions">
              <Link className="button" href="/hub/events">Cancel</Link>
            </div>
          </div>

          <section className="panel" style={{ maxWidth: "600px", padding: "24px" }}>
            <form action={createEvent} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label htmlFor="title" style={{ display: "block", fontWeight: "bold", marginBottom: "8px", color: "#202124" }}>
                  Event Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Harran Necrotic Fever outbreak"
                  defaultValue={initialTitle}
                  style={{ width: "100%", padding: "10px", border: "1px solid #dadce0", borderRadius: "4px", fontSize: "15px" }}
                  maxLength={255}
                />
              </div>
              


              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="submit" className="button primary">
                  Start Event Editor
                </button>
              </div>
            </form>
          </section>
        </section>
    </div>
  );
}
