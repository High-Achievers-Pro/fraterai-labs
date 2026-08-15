import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// `server-only` exports a throwing `index.js` under the default condition and a
// no-op `empty.js` under the `react-server` condition (see node_modules/server-only/package.json).
// Next's build sets the `react-server` condition; vitest does not, so importing any
// module that does `import 'server-only'` throws under test. Alias the specifier
// directly to the no-op file (bypassing its package "exports" map) rather than
// enabling the `react-server` resolve condition globally, which would also change
// how `react`/`react-dom` resolve for every test in the suite. Test-only — the real
// build in next.config.ts is untouched, so the production guarantee (fail the build
// if this module reaches a client bundle) still holds.
const serverOnlyStub = fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url));

export default defineConfig({
  test: { environment: 'node', include: ['**/__tests__/**/*.test.ts'] },
  resolve: {
    alias: {
      'server-only': serverOnlyStub,
    },
  },
});
