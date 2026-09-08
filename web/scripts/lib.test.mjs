/* The pure library, proved. It is TypeScript and this node cannot strip types,
   so it is compiled to .libbuild first and the test modules import from there
   through process.env.LIB.

   Run: node scripts/lib.test.mjs                                            */
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('npx', ['tsc', '-p', 'tsconfig.lib.json'], { cwd: root, stdio: 'inherit' });
// tsc emits ES modules; the root package.json has no "type", so without this
// node reads the .js it just wrote as CommonJS.
writeFileSync(join(root, '.libbuild/package.json'), '{"type":"module"}\n');
process.env.LIB = pathToFileURL(join(root, '.libbuild')).href;

// Top-level modules and one level of folders (src/lib/hijri/), in name order.
const tests = readdirSync(join(root, 'src/lib'), { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && e.name.endsWith('.test.mjs'))
  .map((e) => join(e.parentPath ?? e.path, e.name)).sort();
for (const f of tests) await import(pathToFileURL(f).href);
console.log('\n  all library assertions passed\n');
