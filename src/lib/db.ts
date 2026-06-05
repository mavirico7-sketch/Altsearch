import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "fs";
import path from "path";
import { getConfig } from "./config";
import * as schema from "./schema";

type DbClient = ReturnType<typeof createClient>;

function databaseUrl() {
  const cfg = getConfig();
  if (!cfg.database.url && cfg.database.path.endsWith("/altsearch.db")) {
    const legacyPath = path.join(path.dirname(cfg.database.path), "wikigen.db");
    if (!fs.existsSync(cfg.database.path) && fs.existsSync(legacyPath)) {
      console.warn(`[DB] Using legacy database path ${legacyPath}. Rename it to ${cfg.database.path} when convenient.`);
      return `file:${legacyPath}`;
    }
  }
  return cfg.database.url || `file:${cfg.database.path}`;
}

function createDbClient() {
  const cfg = getConfig();
  return createClient({
    url: databaseUrl(),
    authToken: cfg.database.auth_token || process.env.DB_TOKEN,
  });
}

async function tableSql(client: DbClient, table: string) {
  const result = await client.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [table],
  });
  return result.rows[0]?.sql as string | undefined;
}

async function tableColumns(client: DbClient, table: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.map((row) => String(row.name));
}

async function tryExecute(client: DbClient, sql: string) {
  try {
    await client.execute(sql);
  } catch (err) {
    console.warn(`DB migration skipped/failed for: ${sql}`, err);
  }
}

async function dropColumnIfExists(client: DbClient, table: string, column: string) {
  const columns = await tableColumns(client, table);
  if (!columns.includes(column)) return;
  await tryExecute(client, `ALTER TABLE ${table} DROP COLUMN ${column}`);
}

async function migrateDb(client: DbClient) {
  const consoleRunColumns = await tableColumns(client, "console_runs");
  if (!consoleRunColumns.includes("cancel_requested")) {
    await tryExecute(client, "ALTER TABLE console_runs ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0");
  }
  if (!consoleRunColumns.includes("heartbeat_at")) {
    await tryExecute(client, "ALTER TABLE console_runs ADD COLUMN heartbeat_at INTEGER");
  }

  await dropColumnIfExists(client, "events", "model");
  await dropColumnIfExists(client, "users", "balance");
  await dropColumnIfExists(client, "site_embeddings", "title_embedding_json");
  await dropColumnIfExists(client, "site_embeddings", "description_embedding_json");
  await dropColumnIfExists(client, "site_embeddings", "site_name_embedding_json");

  await tryExecute(client, "CREATE INDEX IF NOT EXISTS console_runs_event_status_created_idx ON console_runs (event_id, status, created_at DESC)");
}

async function initDb() {
  const cfg = getConfig();
  if (!cfg.database.url) {
    const dir = path.dirname(cfg.database.path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const client = createDbClient();
  g._altsearchDbClient = client;
  const initSql = fs.readFileSync(
    path.resolve(process.cwd(), "drizzle/0000_init.sql"),
    "utf-8"
  );

  await client.executeMultiple(initSql);
  await migrateDb(client);

  return drizzle(client, { schema });
}

const g = globalThis as typeof globalThis & {
  _altsearchDb?: Awaited<ReturnType<typeof initDb>>;
  _altsearchDbPromise?: Promise<Awaited<ReturnType<typeof initDb>>>;
  _altsearchDbClient?: DbClient;
  _altsearchDbPingInterval?: ReturnType<typeof setInterval>;
};

function startKeepAlivePing(client: DbClient) {
  if (g._altsearchDbPingInterval) return;
  // Ping every 3 minutes to keep serverless DB awake
  g._altsearchDbPingInterval = setInterval(() => {
    client.execute("SELECT 1").catch((err) => {
      console.warn("DB keep-alive ping failed:", err);
    });
  }, 3 * 60 * 1000);
  
  if (g._altsearchDbPingInterval.unref) {
    g._altsearchDbPingInterval.unref();
  }
}

export async function getDb() {
  if (g._altsearchDb) return g._altsearchDb;
  if (!g._altsearchDbPromise) {
    g._altsearchDbPromise = initDb().then((db) => {
      g._altsearchDb = db;
      if (g._altsearchDbClient) startKeepAlivePing(g._altsearchDbClient);
      return db;
    });
  }
  return g._altsearchDbPromise;
}

export async function getDbClient() {
  await getDb();
  if (!g._altsearchDbClient) {
    throw new Error("Database client was not initialized.");
  }
  return g._altsearchDbClient;
}
