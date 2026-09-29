import { $ } from 'bun';

await $`rm -rf dist`;
const r = await Bun.build({
  outdir: 'dist',
  format: 'esm',
  sourcemap: 'linked',
  packages: 'external',
  entrypoints: ['src/index.ts'],
  target: 'node',
});
if (!r.success) {
  console.error(r.logs);
  process.exit(1);
}
await $`chmod +x dist/index.js`;
