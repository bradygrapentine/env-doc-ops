import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const tmp = path.join(os.tmpdir(), `envdocos-test-${process.pid}-${Date.now()}.db`);
process.env.ENVDOCOS_DB_PATH = tmp;

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      fs.unlinkSync(tmp + suffix);
    } catch {
      // ignore
    }
  }
});
