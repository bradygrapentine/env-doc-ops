import fs from "node:fs";
import { closeDb } from "@/lib/db";

export function resetDb() {
  closeDb();
  const p = process.env.ENVDOCOS_DB_PATH;
  if (!p) return;
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      fs.unlinkSync(p + suffix);
    } catch {
      // ignore
    }
  }
}
