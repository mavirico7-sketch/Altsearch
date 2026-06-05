import { NextRequest, NextResponse } from "next/server";
import { getOwnedEvent } from "@/lib/event-access";
import { getActiveConsoleRun } from "@/lib/console";
import {
  hashContent,
  hashSiteMetadata,
  isEditableEventPath,
} from "@/lib/event-files";

export const dynamic = "force-dynamic";

function parseEventId(value: string) {
  return value && typeof value === "string" ? value : null;
}

async function appendSystemAction(eventId: string, action: string) {
  const { getConsoleMessages, addMessage } = await import("@/lib/console");
  const { getDb } = await import("@/lib/db");
  const { consoleMessages } = await import("@/lib/schema");
  const { eq } = await import("drizzle-orm");

  const messages = await getConsoleMessages(eventId);
  const last = messages[messages.length - 1];

  if (last && last.role === "user" && last.content.startsWith("[System:\n- ")) {
    const existingLines = last.content.slice(0, -1).split("\n");
    if (!existingLines.includes(`- ${action}`)) {
      const newContent = last.content.slice(0, -1) + `\n- ${action}]`;
      const db = await getDb();
      await db.update(consoleMessages)
        .set({ content: newContent })
        .where(eq(consoleMessages.id, last.id))
        .run();
    }
  } else {
    await addMessage(eventId, "user", `[System:\n- ${action}]`);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const eventId = parseEventId(idStr);
  const event = eventId ? await getOwnedEvent(eventId) : null;
  if (!eventId || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Path is required." }, { status: 400 });
  }
  if (!isEditableEventPath(path)) {
    return NextResponse.json({ error: "Path is not editable." }, { status: 400 });
  }

  try {
    const { readEventFile, listSiteFiles } = await import("@/lib/event-files");
    const content = readEventFile(eventId, path);
    const site = (await listSiteFiles(eventId)).find((item) => item.path === path);
    return NextResponse.json({
      content,
      contentHash: hashContent(content),
      metadataHash: site ? hashSiteMetadata(site) : null,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const eventId = parseEventId(idStr);
  const event = eventId ? await getOwnedEvent(eventId) : null;
  if (!eventId || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (await getActiveConsoleRun(eventId)) {
    return NextResponse.json({ error: "Stop the agent before editing files." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({})) as {
    path?: string;
    content?: string;
    siteName?: string;
    title?: string;
    snippet?: string;
    displayUrl?: string;
    baseContentHash?: string;
    baseMetadataHash?: string;
  };
  const path = typeof body.path === "string" ? body.path : "";
  const content = typeof body.content === "string" ? body.content : "";

  if (!path) {
    return NextResponse.json({ error: "Path is required." }, { status: 400 });
  }
  if (!isEditableEventPath(path)) {
    return NextResponse.json({ error: "Path is not editable." }, { status: 400 });
  }

  try {
    const { readEventFile, writeEventFile, markSiteComplete, getSiteFile } = await import("@/lib/event-files");
    const { touchEvent } = await import("@/lib/events");
    
    const existingContent = readEventFile(eventId, path);
    const currentContentHash = hashContent(existingContent);
    if (body.baseContentHash && body.baseContentHash !== currentContentHash) {
      return NextResponse.json({
        error: "File changed since it was opened.",
        contentHash: currentContentHash,
      }, { status: 409 });
    }
    const contentChanged = existingContent !== content;

    let metadataChanged = false;
    if (body.siteName && typeof body.siteName === "string") {
      const existingMeta = await getSiteFile(eventId, body.siteName);
      if (existingMeta && body.baseMetadataHash) {
        const currentMetadataHash = hashSiteMetadata(existingMeta);
        if (body.baseMetadataHash !== currentMetadataHash) {
          return NextResponse.json({
            error: "Site metadata changed since it was opened.",
            metadataHash: currentMetadataHash,
          }, { status: 409 });
        }
      }
      if (
        !existingMeta ||
        (body.title !== undefined && existingMeta.title !== body.title) ||
        (body.snippet !== undefined && existingMeta.snippet !== body.snippet) ||
        (body.displayUrl !== undefined && existingMeta.displayUrl !== body.displayUrl)
      ) {
        metadataChanged = true;
      }
    }

    writeEventFile(eventId, path, content);
    await touchEvent(eventId);

    if (body.siteName && typeof body.siteName === "string") {
      await markSiteComplete({
        eventId,
        siteName: body.siteName,
        path,
        title: body.title,
        snippet: body.snippet,
        displayUrl: body.displayUrl,
      });
    }

    if (contentChanged) {
      await appendSystemAction(eventId, `The user manually edited content for ${path}`);
    }

    if (metadataChanged) {
      await appendSystemAction(eventId, `The user manually edited metadata for ${body.siteName || path}`);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const eventId = parseEventId(idStr);
  const event = eventId ? await getOwnedEvent(eventId) : null;
  if (!eventId || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  if (await getActiveConsoleRun(eventId)) {
    return NextResponse.json({ error: "Stop the agent before deleting site content." }, { status: 409 });
  }

  const siteName = req.nextUrl.searchParams.get("siteName");
  if (!siteName) {
    return NextResponse.json({ error: "siteName is required." }, { status: 400 });
  }

  try {
    const { resetSiteFile } = await import("@/lib/event-files");
    await resetSiteFile(eventId, siteName);

    await appendSystemAction(eventId, `The user deleted ${siteName} and reset its metadata`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
