import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the one env-var typo that would ship TURNSTILE_SECRET_KEY to
// every visitor: prefixing it with NEXT_PUBLIC_ (or referencing that
// prefixed name in source) makes Next.js inline it into the client bundle.
// This currently fails no test — see final-review.md's merge-blocking
// minors and Task 5c's own note that this specific typo is enforceable.
const PUBLIC_SECRET_PATTERN = /^NEXT_PUBLIC_.*SECRET/;

const ROOT = join(__dirname, '..');

const SCAN_DIRS = ['app', 'components', 'lib'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);
// Directories that never hold source relevant to this app's env
// contract — mirrors the "unrelated trees" boundary the review draws.
const SKIP_DIR_NAMES = new Set(['node_modules', '__tests__', '.next']);

const collectSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (SCAN_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf('.')))) {
      files.push(fullPath);
    }
  }

  return files;
};

describe('no NEXT_PUBLIC_ secret leak', () => {
  it('.env.example has no NEXT_PUBLIC_*SECRET* line', () => {
    const contents = readFileSync(join(ROOT, '.env.example'), 'utf8');
    const offendingLines = contents
      .split('\n')
      .filter((line) => PUBLIC_SECRET_PATTERN.test(line.trim()));

    expect(offendingLines).toEqual([]);
  });

  it('no source file under app/, components/, or lib/ references process.env.NEXT_PUBLIC_TURNSTILE_SECRET_KEY', () => {
    const offenders: string[] = [];

    for (const dirName of SCAN_DIRS) {
      const dir = join(ROOT, dirName);
      for (const file of collectSourceFiles(dir)) {
        const contents = readFileSync(file, 'utf8');
        if (contents.includes('NEXT_PUBLIC_TURNSTILE_SECRET_KEY')) {
          offenders.push(file);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
