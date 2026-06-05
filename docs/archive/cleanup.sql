-- Drop tables in order to respect foreign key constraints (children first, then parents)
DROP TABLE IF EXISTS "console_file_changes";
DROP TABLE IF EXISTS "console_runs";
DROP TABLE IF EXISTS "console_messages";
DROP TABLE IF EXISTS "site_embeddings";
DROP TABLE IF EXISTS "site_files";
DROP TABLE IF EXISTS "events";
DROP TABLE IF EXISTS "users";

-- After running this, Drizzle ORM will automatically recreate the tables on the next startup.
