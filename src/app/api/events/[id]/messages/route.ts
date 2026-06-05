import { NextRequest, NextResponse } from "next/server";
import {
  getActiveConsoleRun,
  getConsoleMessagesAfter,
  getLatestConsoleRun,
  startConsoleRun,
} from "@/lib/console";
import { listSiteFiles, readEventFile } from "@/lib/event-files";
import { getOwnedEvent } from "@/lib/event-access";

export const dynamic = "force-dynamic";

function parseEventId(value: string) {
  return value && typeof value === "string" ? value : null;
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

  const after = Number(req.nextUrl.searchParams.get("after") ?? "0");
  const messages = await getConsoleMessagesAfter(eventId, Number.isFinite(after) ? after : 0);
  const run = await getLatestConsoleRun(eventId);

  return NextResponse.json({
    messages,
    sites: await listSiteFiles(eventId),
    notes: readEventFile(eventId, "event-notes.md"),
    runStatus: run?.status ?? "complete",
    updatedAt: event.updatedAt,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const eventId = parseEventId(idStr);
  const event = eventId ? await getOwnedEvent(eventId) : null;
  if (!eventId || !event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  if (await getActiveConsoleRun(eventId)) {
    return NextResponse.json(
      { error: "Console is already processing another message." },
      { status: 409 }
    );
  }

  let result: Awaited<ReturnType<typeof startConsoleRun>>;
  try {
    result = await startConsoleRun(eventId, message);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error }, { status: 409 });
  }

  return NextResponse.json({
    userMessage: result.userMessage,
    runId: result.runId,
    runStatus: "queued",
    sites: await listSiteFiles(eventId),
    notes: readEventFile(eventId, "event-notes.md"),
    updatedAt: event.updatedAt,
  });
}
