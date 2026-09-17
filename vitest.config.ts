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

// Mirrors tsconfig.json's "paths": { "@/*": ["./*"] }, which Next's bundler
// and the TS language service already honor but vitest's own resolver
// never has. Before this alias existed, every '@/lib/server/*' import in a
// file under test had to be mocked by literal specifier (vi.mock('@/lib/
// server/x', ...) with no importOriginal) even when a test wanted the REAL
// module — see final-review.md I7 for the three concrete workarounds this
// forced (duplicated header-name literals, two hand-reimplemented
// requireEnv's, and a relative import three lines below sibling '@/'
// imports in app/api/leads/inbound/route.ts) and docs/runbooks for none of
// that being news to Tasks 9 and 10, which both flagged it independently.
const repoRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  test: { environment: 'node', include: ['**/__tests__/**/*.test.ts'] },
  resolve: {
    alias: {
      'server-only': serverOnlyStub,
      '@': repoRoot,
    },
  },
});
