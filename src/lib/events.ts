import fs from "fs/promises";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";
import { getConfig } from "./config";
import { getDb } from "./db";
import { initEventWorkspace } from "./event-files";
import { runControllers } from "./agent/state";
import { consoleRuns, events } from "./schema";

export async function createEditableEvent(input: {
  userId: string;
  title: string;
}) {
  const db = await getDb();
  const eventId = crypto.randomUUID();
  const event = await db.insert(events).values({
    id: eventId,
    userId: input.userId,
    title: input.title,
    status: "complete",
    isPrivate: true,
  }).returning({ id: events.id }).get();

  await initEventWorkspace({
    eventId: event.id,
    title: input.title,
  });

  return event.id;
}

export async function getEventById(id: string) {
  const db = await getDb();
  return db.select().from(events).where(eq(events.id, id)).get();
}

export async function getEventsByUserId(userId: string) {
  const db = await getDb();
  return db.select().from(events).where(eq(events.userId, userId)).all();
}

export async function setEventPrivacyForUser(id: string, userId: string, isPrivate: boolean) {
  const db = await getDb();
  await db.update(events)
    .set({ isPrivate, updatedAt: new Date() })
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .run();
}

function eventWorkspacePath(eventId: string) {
  const cfg = getConfig();
  return path.join(path.dirname(cfg.database.path), "events", String(eventId));
}

export async function deleteEventForUser(id: string, userId: string) {
  const db = await getDb();
  const event = await db.select().from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .get();
  if (!event) return false;

  const activeRuns = await db.select().from(consoleRuns)
    .where(and(eq(consoleRuns.eventId, id), inArray(consoleRuns.status, ["queued", "running"])))
    .all();

  for (const run of activeRuns) {
    runControllers.get(run.id)?.abort();
  }

  if (activeRuns.length > 0) {
    await db.update(consoleRuns)
      .set({
        status: "failed",
        error: "Event was deleted by owner.",
        updatedAt: new Date(),
      })
      .where(and(eq(consoleRuns.eventId, id), inArray(consoleRuns.status, ["queued", "running"])))
      .run();
  }

  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId))).run();

  try {
    await fs.rm(eventWorkspacePath(id), { recursive: true, force: true });
  } catch (err) {
    console.warn(`Failed to remove event workspace for ${id}:`, err);
  }

  return true;
}

export async function touchEvent(id: string) {
  const db = await getDb();
  await db.update(events).set({ updatedAt: new Date() }).where(eq(events.id, id)).run();
}
