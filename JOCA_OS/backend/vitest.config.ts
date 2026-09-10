import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

// The tests write and DELETE files from `DATA_DIR` (`notifications.test.ts` and `manager.test.ts`
// do `fs.rmSync` to isolate each case). Without this override they pointed at the real data: running
// `npm test` deleted the notifications and the manager chat of anyone with JOCA for real in this copy.
// `env` is applied before any module is imported, which is what makes `project-store` read the
// right value already — a `setupFiles` would arrive too late because of import hoisting.
export default defineConfig({
  test: {
    env: {
      JOCA_DATA_DIR: path.join(os.tmpdir(), 'joca-os-test-data'),
    },
  },
});
