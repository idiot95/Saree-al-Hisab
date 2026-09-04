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

for (const f of readdirSync(join(root, 'src/lib')).filter((f) => f.endsWith('.test.mjs')).sort()) {
  await import(pathToFileURL(join(root, 'src/lib', f)).href);
}
console.log('\n  all library assertions passed\n');
