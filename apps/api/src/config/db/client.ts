import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL =
  "postgresql://insurance:insurance@localhost:5432/insurance";

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function createPool(url = databaseUrl()): Pool {
  // 生产建议在前面挂 PgBouncer 连接池 (需求书 7.2)
  return new Pool({ connectionString: url, max: 10 });
}

export function createDb(pool: Pool): NodePgDatabase<typeof schema> {
  return drizzle(pool, { schema });
}

export type Db = NodePgDatabase<typeof schema>;
export { schema };
