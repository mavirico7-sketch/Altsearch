import { NextRequest, NextResponse } from "next/server";
import { getOwnedEvent } from "@/lib/event-access";
import { getActiveConsoleRun, requestRunCancel, setRunStatus } from "@/lib/console";
import { runControllers } from "@/lib/agent/state";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  if (!eventId) {
    return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
  }

  const event = await getOwnedEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const activeRun = await getActiveConsoleRun(eventId);
  if (!activeRun) {
    return NextResponse.json({ message: "No active run to stop" });
  }

  await requestRunCancel(activeRun.id, "Stop requested by user.");
  const controller = runControllers.get(activeRun.id);
  if (controller) {
    controller.abort();
    return NextResponse.json({ message: "Abort signal sent" });
  }

  await setRunStatus(activeRun.id, "failed", "Stop requested but no active controller exists.");
  return NextResponse.json({ message: "Run stopped in database; no controller existed in memory" });
}
