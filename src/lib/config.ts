import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { z } from "zod";

const ConfigSchema = z.object({
  openrouter_presets: z.record(z.string(), z.object({
    model: z.string(),
    label: z.string(),
    description: z.string(),
    temperature: z.number().optional(),
    reasoning: z.string().optional(),
  })).optional(),
  openrouter_default_preset: z.string().default("balanced"),
  embeddings: z.object({
    enabled: z.boolean().default(true),
    local: z.boolean().default(false),
    model: z.string().default("text-embedding-3-small"),
  }).default({
    enabled: true,
    local: false,
    model: "text-embedding-3-small",
  }),
  reddit: z.object({
    post_count: z.number().int().min(1).max(5).default(5),
  }).default({
    post_count: 5,
  }),
  search: z.object({
    min_score: z.number().default(1.0),
  }).default({
    min_score: 1.0,
  }),
  server: z.object({
    port: z.number().int().positive(),
    allow_local_login: z.boolean().default(false),
  }),
  database: z.object({
    path: z.string().default("/data/altsearch.db"),
    url: z.string().optional(),
    auth_token: z.string().optional(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

function interpolateEnv(raw: string): string {
  return raw.replace(/\$\{([^}]+)\}/g, (_, name) => {
    const val = process.env[name];
    if (!val) throw new Error(`Missing environment variable: ${name}`);
    return val;
  });
}

let _config: Config | null = null;
let _lastMtime: number = 0;

export function getConfig(): Config {
  const configPath = path.resolve(process.cwd(), "config.yaml");
  try {
    const stat = fs.statSync(configPath);
    if (!_config || stat.mtimeMs > _lastMtime) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const interpolated = interpolateEnv(raw);
      const parsed = yaml.load(interpolated);
      _config = ConfigSchema.parse(parsed);
      _lastMtime = stat.mtimeMs;
    }
  } catch (err) {
    if (!_config) throw err; // Fallback to cached config if file is temporarily unreadable
  }
  return _config!;
}
