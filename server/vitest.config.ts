import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Los tests nunca tocan server/data/settings.json
    env: { SETTINGS_FILE: join(tmpdir(), `periodico-ia-test-settings-${process.pid}.json`), ADMIN_TOKEN: '' },
  },
});
