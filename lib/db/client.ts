import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  libsql?: Client;
  schemaReady?: Promise<void>;
};

function getClient(): Client {
  if (!globalForDb.libsql) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("TURSO_DATABASE_URL не задан. Добавьте его в .env.local");
    }
    globalForDb.libsql = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return globalForDb.libsql;
}

/** Создаёт таблицы при первом обращении (идемпотентно). */
function ensureSchema(client: Client): Promise<void> {
  if (!globalForDb.schemaReady) {
    globalForDb.schemaReady = client
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'Другое',
            deadline TEXT,
            quadrant TEXT NOT NULL,
            priority_reason TEXT NOT NULL DEFAULT '',
            done INTEGER NOT NULL DEFAULT 0,
            completed_at INTEGER,
            created_at INTEGER NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS subtasks (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            done INTEGER NOT NULL DEFAULT 0,
            position INTEGER NOT NULL DEFAULT 0
          )`,
          `CREATE INDEX IF NOT EXISTS subtasks_task_idx ON subtasks(task_id)`,
        ],
        "write",
      )
      .then(() => undefined)
      .catch((e) => {
        globalForDb.schemaReady = undefined;
        throw e;
      });
  }
  return globalForDb.schemaReady;
}

export async function getDb(): Promise<LibSQLDatabase<typeof schema>> {
  const client = getClient();
  await ensureSchema(client);
  return drizzle(client, { schema });
}
