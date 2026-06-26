import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createPool, createDb, databaseUrl } from "./client";

async function main(): Promise<void> {
  const pool = createPool();
  const db = createDb(pool);
  // __dirname 相对: dev(tsx) 下是 src/config/db, 生产(dist) 下是 dist/config/db
  // (Dockerfile 会把 migrations 一并拷到 dist/config/db/migrations)
  const migrationsFolder = join(__dirname, "migrations");
  console.log(`[migrate] applying ${migrationsFolder} -> ${databaseUrl()}`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] done");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
