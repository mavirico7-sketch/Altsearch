const { createClient } = require("@libsql/client");
async function main() {
  const client = createClient({ url: "file:test.db" });
  await client.execute("CREATE TABLE IF NOT EXISTS v (id INT, e F32_BLOB)");
  await client.execute("INSERT INTO v (id, e) VALUES (1, vector('[1,2,3]'))");
  const res = await client.execute("SELECT id, vector_distance_cos(e, vector('[1,2,3]')) as dist FROM v");
  console.log(res.rows);
  await client.execute("DROP TABLE v");
}
main().catch(console.error);
