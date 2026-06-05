export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getDb } = await import("./lib/db");
      const { consoleRuns, events, users } = await import("./lib/schema");
      const { inArray, like } = await import("drizzle-orm");
      const { getConfig } = await import("./lib/config");
      const { pruneConsoleRuns } = await import("./lib/console");

      const db = await getDb();

      if (process.env.PROXY_ENABLED !== "true") {
        await db
          .update(users)
          .set({ activeProvider: "openrouter" })
          .where(like(users.activeProvider, "%-web"))
          .run();
        console.log("[Instrumentation] Proxy disabled: reset web subscription users to openrouter.");
      }

      // "Kill switch": marks all running or queued agents as failed on server startup
      await db
        .update(consoleRuns)
        .set({
          status: "failed",
          cancelRequested: false,
          error: "Agent process terminated (server restarted).",
          updatedAt: new Date(),
        })
        .where(inArray(consoleRuns.status, ["queued", "running"]))
        .run();

      console.log("[Instrumentation] Kill switch: Terminated all pending agents in database.");

      const allEvents = await db.select({ id: events.id }).from(events).all();
      for (const event of allEvents) {
        await pruneConsoleRuns(event.id);
      }
    } catch (err) {
      console.error("[Instrumentation] Failed to run kill switch:", err);
    }
  }
}
