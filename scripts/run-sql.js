// One-off runner for applying a .sql file directly against the Supabase
// Postgres database via DATABASE_URL (Supabase transaction pooler).
// Usage: node scripts/run-sql.js path/to/file.sql
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const { Client } = require("pg");

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/run-sql.js <path-to-sql-file>");
  process.exit(1);
}

const sql = fs.readFileSync(filePath, "utf8");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`OK: applied ${filePath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
