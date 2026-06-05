CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  image TEXT,
  active_provider TEXT NOT NULL DEFAULT 'openrouter',
  provider_settings TEXT,
  is_new_user INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete', 'failed')),
  is_private INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS site_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  display_url TEXT NOT NULL,
  snippet TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('empty', 'complete')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS site_files_event_idx
  ON site_files (event_id);

CREATE TABLE IF NOT EXISTS site_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_file_id INTEGER NOT NULL REFERENCES site_files(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  embedding_text_hash TEXT NOT NULL,
  title_embedding F32_BLOB,
  description_embedding F32_BLOB,
  site_name_embedding F32_BLOB,
  status TEXT NOT NULL CHECK (status IN ('complete', 'failed')),
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS site_embeddings_site_file_idx
  ON site_embeddings (site_file_id);

CREATE INDEX IF NOT EXISTS site_embeddings_event_idx
  ON site_embeddings (event_id);

CREATE TABLE IF NOT EXISTS console_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'summary')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS console_messages_event_idx
  ON console_messages (event_id);

CREATE TABLE IF NOT EXISTS console_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  heartbeat_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS console_runs_event_idx
  ON console_runs (event_id);

CREATE INDEX IF NOT EXISTS console_runs_event_status_created_idx
  ON console_runs (event_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS console_file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES console_messages(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  previous_content TEXT NOT NULL,
  new_content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
