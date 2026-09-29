// Bun.build + tsc (só .d.ts) sobre o pacote sintético; comparar com `bun --bun tsdown`.
import { $ } from 'bun';
await $`rm -rf dist-bun`;
const r = await Bun.build({ entrypoints: ['src/index.ts'], outdir: 'dist-bun', format: 'esm', sourcemap: 'linked', target: 'browser' });
if (!r.success) process.exit(1);
await $`./node_modules/.bin/tsc -p . --emitDeclarationOnly --outDir dist-bun/types`;
