import { notFound } from "next/navigation";
import Link from "next/link";
import { listCompleteSiteFiles, readEventFile } from "@/lib/event-files";
import { getEventById } from "@/lib/events";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import PublicEventView from "./PublicEventView";
import "./public.css";

export const dynamic = "force-dynamic";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await getEventById(eventId);
  if (!event || event.isPrivate) notFound();

  const db = await getDb();
  const author = event.userId ? await db.select().from(users).where(eq(users.id, event.userId)).get() : null;

  const sites = await listCompleteSiteFiles(event.id);
  const notes = readEventFile(event.id, "event-notes.md");

  // Format date
  const updateDate = new Date(event.updatedAt);
  const formattedDate = updateDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <>
      <main className="event-page">
        <section className="event-head">
          <div>
            <p className="crumb">AltSearch / Public event</p>
            <h1>{event.title}</h1>
            <p className="summary">
              An alternative internet event. Contains sites spanning different perspectives and mediums.
            </p>
          </div>
          <aside className="author-card" aria-label="Author">
            <span className="avatar">
              {author?.image ? (
                <img src={author.image} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                author?.name ? author.name.charAt(0).toUpperCase() : (author?.email ? author.email.charAt(0).toUpperCase() : "S")
              )}
            </span>
            <div>
              <span>Created by</span>
              <b>{author?.name || author?.email?.split('@')[0] || "skoolz"}</b>
            </div>
            <a href={`/api/events/${eventId}/export`} className="button" style={{ marginLeft: "16px" }} download>
              Export ZIP
            </a>
          </aside>
        </section>

        <section className="meta-row" aria-label="Event metadata">
          <div><span>Visibility</span><b>Public</b></div>
          <div><span>Sites</span><b>{sites.length} generated</b></div>
          <div><span>Last updated</span><b>{formattedDate}</b></div>
          <div><span>Status</span><b>{event.status.charAt(0).toUpperCase() + event.status.slice(1)}</b></div>
        </section>

        <PublicEventView eventId={event.id} notes={notes} sites={sites} />
      </main>
    </>
  );
}
