import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  name: text("name"),
  image: text("image"),
  activeProvider: text("active_provider").notNull().default("openrouter"),
  providerSettings: text("provider_settings", { mode: "json" }),
  isNewUser: integer("is_new_user", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status", { enum: ["complete", "failed"] }).notNull(),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const siteFiles = sqliteTable("site_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  siteName: text("site_name").notNull(),
  path: text("path").notNull(),
  title: text("title").notNull(),
  displayUrl: text("display_url").notNull(),
  snippet: text("snippet").notNull(),
  status: text("status", { enum: ["empty", "complete"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const siteEmbeddings = sqliteTable("site_embeddings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteFileId: integer("site_file_id").notNull().references(() => siteFiles.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  embeddingTextHash: text("embedding_text_hash").notNull(),
  titleEmbedding: blob("title_embedding"),
  descriptionEmbedding: blob("description_embedding"),
  siteNameEmbedding: blob("site_name_embedding"),
  status: text("status", { enum: ["complete", "failed"] }).notNull(),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const consoleMessages = sqliteTable("console_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "tool", "summary"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const consoleRuns = sqliteTable("console_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["queued", "running", "complete", "failed"] }).notNull(),
  cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false),
  error: text("error"),
  heartbeatAt: integer("heartbeat_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const consoleFileChanges = sqliteTable("console_file_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").notNull().references(() => consoleMessages.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  previousContent: text("previous_content").notNull(),
  newContent: text("new_content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type SiteFile = typeof siteFiles.$inferSelect;
export type SiteEmbedding = typeof siteEmbeddings.$inferSelect;
export type ConsoleMessage = typeof consoleMessages.$inferSelect;
export type ConsoleRun = typeof consoleRuns.$inferSelect;
