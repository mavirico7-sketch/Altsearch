import { createClient } from "@libsql/client";
import fs from "fs";

try {
  const envFile = fs.readFileSync(".env", "utf8");
  for (const line of envFile.split("\\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
} catch (e: any) {
  console.warn("Could not load .env file manually:", e.message);
}

const url = "libsql://altsearch-mavirico.aws-eu-west-1.turso.io";
const authToken = process.env.DB_TOKEN;

if (!authToken) {
  console.error("DB_TOKEN missing from .env");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function resetDb() {
  console.log("Dropping tables...");
  
  await client.execute("PRAGMA foreign_keys = OFF");
  
  const tables = [
    "site_files",
    "site_embeddings",
    "console_messages",
    "console_runs",
    "events",
    "users",
    "__drizzle_migrations"
  ];

  for (const table of tables) {
    console.log(`Dropping ${table}...`);
    await client.execute(`DROP TABLE IF EXISTS ${table}`).catch(e => console.warn(e.message));
  }
  
  await client.execute("PRAGMA foreign_keys = ON");

  console.log("Database cleared! You can now run `npx drizzle-kit push` to recreate the schema.");
}

resetDb().catch(console.error);
