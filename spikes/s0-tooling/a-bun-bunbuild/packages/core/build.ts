// Build com o bundler do Bun (uma chamada, builtins node: externos) + tsc só para .d.ts.
import { $ } from 'bun';

await $`rm -rf dist`;
const r = await Bun.build({
  outdir: 'dist',
  format: 'esm',
  sourcemap: 'linked',
  packages: 'external',
  splitting: true,
  external: ['node:*'],
  target: 'browser',
  entrypoints: ['src/index.ts', 'src/runtime.ts', 'src/runtime.node.ts'],
});
if (!r.success) {
  console.error(r.logs);
  process.exit(1);
}
await $`tsc -p tsconfig.build.json`;
