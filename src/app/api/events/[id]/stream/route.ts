import { NextRequest, NextResponse } from "next/server";
import { getOwnedEvent } from "@/lib/event-access";
import { agentEvents } from "@/lib/agent/state";

export const dynamic = "force-dynamic";

export async function GET(
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Keep alive interval
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);

      const onTyping = (data: { eventId: string; runId: number; tokens: number | null }) => {
        if (data.eventId !== eventId) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "typing", tokens: data.tokens })}\n\n`)
          );
        } catch (e) {}
      };

      const onRefresh = (data: { eventId: string }) => {
        if (data.eventId !== eventId) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "refresh" })}\n\n`)
          );
        } catch (e) {}
      };

      agentEvents.on("typing", onTyping);
      agentEvents.on("refresh", onRefresh);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        agentEvents.off("typing", onTyping);
        agentEvents.off("refresh", onRefresh);
        try { controller.close(); } catch (e) {}
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
