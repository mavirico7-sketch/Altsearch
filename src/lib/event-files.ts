import fs from "fs";
import path from "path";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { getConfig } from "./config";
import { getDb } from "./db";
import { siteEmbeddings, siteFiles } from "./schema";
import { SITES, getSiteByName } from "./sites-config";
import { touchEvent } from "./events";
import { refreshSiteEmbedding } from "./global-search";

function dataRoot() {
  const dbPath = getConfig().database.path;
  return path.dirname(dbPath);
}

export function eventRoot(eventId: string) {
  return path.join(dataRoot(), "events", String(eventId));
}

function resolveEventPath(eventId: string, relativePath: string) {
  const root = eventRoot(eventId);
  const fullPath = path.resolve(root, relativePath);
  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Invalid event file path: ${relativePath}`);
  }
  return fullPath;
}

export function hashContent(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function hashSiteMetadata(input: {
  title: string;
  displayUrl: string;
  snippet: string;
}) {
  return hashContent(JSON.stringify({
    title: input.title,
    displayUrl: input.displayUrl,
    snippet: input.snippet,
  }));
}

export function isEditableEventPath(relativePath: string) {
  return relativePath === "event-notes.md" || SITES.some((site) => site.contentPath === relativePath);
}

export function listEventFiles(eventId: string) {
  return SITES.map((site) => ({
    path: site.contentPath,
    description: site.description,
  }));
}

export function readEventFile(eventId: string, relativePath: string) {
  const fullPath = resolveEventPath(eventId, relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf-8");
}

export function writeEventFile(eventId: string, relativePath: string, content: string) {
  const fullPath = resolveEventPath(eventId, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const tempPath = `${fullPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content, "utf-8");
  fs.renameSync(tempPath, fullPath);
}

export async function initEventWorkspace(input: {
  eventId: string;
  title: string;
}) {
  fs.mkdirSync(path.join(eventRoot(input.eventId), "sites"), { recursive: true });
  writeEventFile(input.eventId, "event-notes.md", `# ${input.title}\n\nInitial notes and scratchpad for the event.`);

  const db = await getDb();
  const rows = [];

  for (const site of SITES) {
    writeEventFile(input.eventId, site.contentPath, "");

    rows.push({
      eventId: input.eventId,
      siteName: site.name,
      path: site.contentPath,
      title: `${input.title} - ${site.name}`,
      displayUrl: `${site.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.example/${encodeURIComponent(input.title)}`,
      snippet: `${site.name} content about ${input.title}.`,
      status: "empty" as const,
    });
  }

  await db.insert(siteFiles).values(rows).run();
}

export async function getSiteFile(eventId: string, siteName: string) {
  const db = await getDb();
  return db
    .select()
    .from(siteFiles)
    .where(and(eq(siteFiles.eventId, eventId), eq(siteFiles.siteName, siteName)))
    .get();
}

export async function listCompleteSiteFiles(eventId: string) {
  const db = await getDb();
  return db
    .select()
    .from(siteFiles)
    .where(and(eq(siteFiles.eventId, eventId), eq(siteFiles.status, "complete")))
    .all();
}

export async function listSiteFiles(eventId: string) {
  const db = await getDb();
  return db
    .select()
    .from(siteFiles)
    .where(eq(siteFiles.eventId, eventId))
    .all();
}

export async function markSiteComplete(input: {
  eventId: string;
  siteName: string;
  path?: string;
  title?: string;
  displayUrl?: string;
  snippet?: string;
}) {
  const db = await getDb();
  const existing = await getSiteFile(input.eventId, input.siteName);
  
  if (!existing) {
    const siteConfig = getSiteByName(input.siteName);
    if (!siteConfig) throw new Error(`Unknown site name: ${input.siteName}`);

    const inserted = await db.insert(siteFiles).values({
      eventId: input.eventId,
      siteName: input.siteName,
      path: input.path ?? siteConfig.contentPath,
      title: input.title ?? siteConfig.name,
      displayUrl: input.displayUrl ?? siteConfig.name.toLowerCase() + ".example",
      snippet: input.snippet ?? siteConfig.description,
      status: "complete",
    }).returning().get();
    
    void refreshSiteEmbedding({
      ...inserted,
      eventTitle: input.title ?? siteConfig.name,
      eventDescription: input.snippet ?? siteConfig.description,
    });
    return;
  }

  const nextSite = {
    ...existing,
    path: input.path ?? existing.path,
    title: input.title ?? existing.title,
    displayUrl: input.displayUrl ?? existing.displayUrl,
    snippet: input.snippet ?? existing.snippet,
    status: "complete" as const,
    updatedAt: new Date(),
  };

  const metadataChanged =
    nextSite.title !== existing.title ||
    nextSite.displayUrl !== existing.displayUrl ||
    nextSite.snippet !== existing.snippet ||
    nextSite.status !== existing.status;

  await db.update(siteFiles)
    .set(nextSite)
    .where(eq(siteFiles.id, existing.id))
    .run();

  if (metadataChanged) {
    void refreshSiteEmbedding({
      ...nextSite,
      eventTitle: nextSite.title,
      eventDescription: nextSite.snippet,
    });
  }
}

export async function resetSiteFile(eventId: string, siteName: string) {
  const db = await getDb();
  const existing = await getSiteFile(eventId, siteName);
  
  if (!existing) return; // Nothing to reset
  
  // Wipe file locally
  writeEventFile(eventId, existing.path, "");

  // Update DB status
  await db.update(siteFiles)
    .set({ status: "empty", updatedAt: new Date() })
    .where(eq(siteFiles.id, existing.id))
    .run();

  // Remove embeddings since it's now missing
  await db.delete(siteEmbeddings)
    .where(eq(siteEmbeddings.siteFileId, existing.id))
    .run();

  await touchEvent(eventId);
}
