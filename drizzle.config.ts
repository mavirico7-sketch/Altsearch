import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import type { Config } from "drizzle-kit";

const configPath = path.resolve(process.cwd(), "config.yaml");
let dbUrl = "file:/data/altsearch.db";
let dbAuthToken = process.env.DB_TOKEN;

if (fs.existsSync(configPath)) {
  const file = fs.readFileSync(configPath, "utf8");
  const parsed = yaml.load(file) as any;
  if (parsed?.database?.url) {
    dbUrl = parsed.database.url;
  } else if (parsed?.database?.path) {
    dbUrl = `file:${parsed.database.path}`;
  }
  if (parsed?.database?.auth_token) {
    dbAuthToken = parsed.database.auth_token;
  }
}

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: dbUrl,
    authToken: dbAuthToken,
  },
} satisfies Config;
