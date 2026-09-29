import { $ } from 'bun';

await $`rm -rf dist`;
const r = await Bun.build({
  outdir: 'dist',
  format: 'esm',
  sourcemap: 'linked',
  packages: 'external',
  entrypoints: ['src/index.ts'],
  target: 'browser',
});
if (!r.success) {
  console.error(r.logs);
  process.exit(1);
}
await $`tsc -p tsconfig.build.json`;
