import { and, asc, desc, eq, gt, inArray, notInArray } from "drizzle-orm";
import { getConfig } from "./config";
import { getDb } from "./db";
import { getEventById } from "./events";
import { consoleFileChanges, consoleMessages, consoleRuns } from "./schema";

type ConsoleRole = "user" | "assistant" | "tool" | "summary";
type RunStatus = "queued" | "running" | "complete" | "failed";

export async function addMessage(eventId: string, role: ConsoleRole, content: string) {
  const db = await getDb();
  return db.insert(consoleMessages).values({
    eventId,
    role,
    content,
  }).returning().get();
}

export async function getConsoleMessages(eventId: string) {
  const db = await getDb();
  return db
    .select()
    .from(consoleMessages)
    .where(eq(consoleMessages.eventId, eventId))
    .orderBy(asc(consoleMessages.createdAt), asc(consoleMessages.id))
    .all();
}

export async function getConsoleMessagesAfter(eventId: string, afterId: number) {
  const db = await getDb();
  return db
    .select()
    .from(consoleMessages)
    .where(and(eq(consoleMessages.eventId, eventId), gt(consoleMessages.id, afterId)))
    .orderBy(asc(consoleMessages.createdAt), asc(consoleMessages.id))
    .all();
}

export async function getLatestConsoleRun(eventId: string) {
  const db = await getDb();
  return db
    .select()
    .from(consoleRuns)
    .where(eq(consoleRuns.eventId, eventId))
    .orderBy(desc(consoleRuns.createdAt), desc(consoleRuns.id))
    .get();
}

export async function getActiveConsoleRun(eventId: string) {
  const run = await getLatestConsoleRun(eventId);
  return run?.status === "queued" || run?.status === "running" ? run : null;
}

export async function createConsoleRun(eventId: string) {
  const db = await getDb();
  return db.insert(consoleRuns).values({
    eventId,
    status: "queued",
    cancelRequested: false,
  }).returning({ id: consoleRuns.id }).get();
}

export async function setRunStatus(runId: number, status: RunStatus, error?: string) {
  const db = await getDb();
  const values: Partial<typeof consoleRuns.$inferInsert> = {
    status,
    error: error ?? null,
    updatedAt: new Date(),
  };
  if (status === "running") values.heartbeatAt = new Date();
  if (status === "complete" || status === "failed") values.cancelRequested = false;

  await db.update(consoleRuns)
    .set(values)
    .where(eq(consoleRuns.id, runId))
    .run();

  if (status === "complete" || status === "failed") {
    await pruneConsoleRunsForEventByRunId(runId);
  }
}

export async function requestRunCancel(runId: number, error = "Cancellation requested.") {
  const db = await getDb();
  await db.update(consoleRuns)
    .set({ cancelRequested: true, error, updatedAt: new Date() })
    .where(eq(consoleRuns.id, runId))
    .run();
}

export async function heartbeatRun(runId: number) {
  const db = await getDb();
  await db.update(consoleRuns)
    .set({ heartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(consoleRuns.id, runId))
    .run();
}

async function pruneConsoleRunsForEventByRunId(runId: number) {
  const db = await getDb();
  const run = await db.select().from(consoleRuns).where(eq(consoleRuns.id, runId)).get();
  if (run) await pruneConsoleRuns(run.eventId);
}

export async function pruneConsoleRuns(eventId: string, keepTerminal = 5) {
  const db = await getDb();
  const terminalRuns = await db.select({ id: consoleRuns.id })
    .from(consoleRuns)
    .where(and(eq(consoleRuns.eventId, eventId), notInArray(consoleRuns.status, ["queued", "running"])))
    .orderBy(desc(consoleRuns.createdAt), desc(consoleRuns.id))
    .all();

  const deleteIds = terminalRuns.slice(keepTerminal).map((run) => run.id);
  if (deleteIds.length === 0) return;

  await db.delete(consoleRuns)
    .where(inArray(consoleRuns.id, deleteIds))
    .run();
}

export async function startConsoleRun(eventId: string, message: string) {
  const active = await getActiveConsoleRun(eventId);
  if (active) {
    throw new Error("Console is already processing another message.");
  }

  const userMessage = await addMessage(eventId, "user", message);
  const run = await createConsoleRun(eventId);
  
  // Dynamic import to avoid circular dependency
  import("./agent/index").then((agent) => {
    void agent.runConsoleAgent(eventId, run.id);
  });
  
  return { userMessage, runId: run.id };
}

export async function compactHistory(eventId: string) {
  const messages = await getConsoleMessages(eventId);
  const nonSummaryMessages = messages.filter((message) => message.role !== "summary");
  if (nonSummaryMessages.length < 60) return;

  const lastSummary = messages.filter((message) => message.role === "summary").at(-1);
  const unsummarizedMessages = lastSummary
    ? nonSummaryMessages.filter((message) => message.id > lastSummary.id)
    : nonSummaryMessages;
  const oldMessages = unsummarizedMessages.slice(0, Math.max(0, unsummarizedMessages.length - 30));
  if (oldMessages.length < 24) return;

  await addMessage(eventId, "summary", [
    "Older console history summary:",
    oldMessages.map((message) => `${message.role}: ${message.content}`).join("\n").slice(0, 7000),
    "",
    "Durable site content remains in files; read files before editing.",
  ].join("\n"));
}
