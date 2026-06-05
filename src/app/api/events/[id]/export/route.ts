import { NextRequest, NextResponse } from "next/server";
import { listCompleteSiteFiles, readEventFile } from "@/lib/event-files";
import { getViewableEvent } from "@/lib/event-access";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  if (!eventId) {
    return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
  }

  const event = await getViewableEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    const zip = new JSZip();

    // Read notes
    const notes = readEventFile(event.id, "event-notes.md");
    if (notes) {
      zip.file("event-notes.md", notes);
    }

    // Read complete sites
    const sites = await listCompleteSiteFiles(event.id);
    for (const site of sites) {
      if (site.path) {
        const content = readEventFile(event.id, site.path);
        if (content) {
          zip.file(site.path, content);
        }
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    // Sanitize title for filename
    // Replace any file-system unsafe characters with an underscore
    let safeTitle = (event.title || "event").replace(/[\/\?<>\\:\*\|":]/g, "_");
    // Fallback if the title is empty after some weird replacements
    if (!safeTitle.trim()) safeTitle = "event";
    
    // We URI-encode the filename in the Content-Disposition header
    // so that Cyrillic characters are properly handled by all modern browsers.
    return new NextResponse(zipBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.zip`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
