// Removes third-party test sources from node_modules after every install (VA-033).
//
// Some packages publish their own test suites (e.g. zod ships src/v3/tests/*.test.ts with
// fixture values such as `password: "peanuts"`). They are never loaded at runtime — Node
// does not execute .ts files from node_modules and Next's standalone output only traces
// imported files — but secret scanners report the fixtures as hard-coded credentials.
//
// Deletes, under node_modules only:
//   - TypeScript test files: *.test.ts(x) / *.spec.ts(x) / *.test.mts / *.test-d.ts
//   - zod's bundled test directories (src/**/tests, including their helper .ts files)
// Run: node scripts/strip-dependency-tests.mjs   (also runs from `postinstall`)
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'node_modules');
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|cts)$|\.test-d\.ts$/;
const TEST_DIRS = [join(ROOT, 'zod', 'src')];

let removedFiles = 0;
let removedDirs = 0;

function walk(dir, visit) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue; // never follow links out of node_modules
    if (entry.isDirectory()) {
      if (visit(full, true) !== false) walk(full, visit);
    } else if (entry.isFile()) {
      visit(full, false);
    }
  }
}

// 1. Whole test directories inside zod's published sources.
for (const base of TEST_DIRS) {
  walk(base, (path, isDir) => {
    if (isDir && /[\\/](tests|__tests__)$/.test(path)) {
      rmSync(path, { recursive: true, force: true });
      removedDirs++;
      return false;
    }
  });
}

// 2. TypeScript test files anywhere in node_modules.
walk(ROOT, (path, isDir) => {
  if (!isDir && TEST_FILE.test(path)) {
    rmSync(path, { force: true });
    removedFiles++;
  }
});

try {
  statSync(ROOT);
  console.log(`[strip-dependency-tests] removed ${removedDirs} test director(ies) and ${removedFiles} test file(s) from node_modules`);
} catch {
  // no node_modules (e.g. script run from elsewhere) — nothing to do
}
