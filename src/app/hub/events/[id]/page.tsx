import { notFound } from "next/navigation";
import BodyClass from "@/components/BodyClass";
import ConsoleClient from "@/components/ConsoleClient";
import { getConsoleMessages, getLatestConsoleRun } from "@/lib/console";
import { listSiteFiles, readEventFile } from "@/lib/event-files";
import { requireEventOwnerPage } from "@/lib/event-access";

import "./editor.css";

export const dynamic = "force-dynamic";

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: eventId } = await params;
  if (!eventId || typeof eventId !== "string") notFound();

  const event = await requireEventOwnerPage(eventId);

  const messages = await getConsoleMessages(event.id);
  const sites = await listSiteFiles(event.id);
  const notes = readEventFile(event.id, "event-notes.md");
  const run = await getLatestConsoleRun(event.id);

  return (
    <div className="editor-shell" style={{ minHeight: "calc(100vh - 56px)" }}>
      <ConsoleClient
        eventId={event.id}
        initialMessages={messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        }))}
        initialSites={sites.map((site) => ({
          id: site.id,
          siteName: site.siteName,
          status: site.status,
          path: site.path,
          title: site.title,
          snippet: site.snippet,
          displayUrl: site.displayUrl,
        }))}
        initialNotes={notes}
        initialRunStatus={run?.status ?? "complete"}
        eventTitle={event.title}
        initialIsPrivate={event.isPrivate}
        initialUpdatedAt={event.updatedAt.toISOString()}
      />
    </div>
  );
}
