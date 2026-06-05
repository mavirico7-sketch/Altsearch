import { getDbClient } from "../src/lib/db";

async function main() {
  const client = await getDbClient();
  const res = await client.execute("DELETE FROM site_files WHERE site_name = 'Event Notes'");
  console.log(`Deleted ${res.rowsAffected} Event Notes from site_files`);
}

main().catch(console.error);
