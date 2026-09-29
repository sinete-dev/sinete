import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts', 'src/runtime.node.ts'],
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  dts: { sourcemap: true },
  sourcemap: true,
  fixedExtension: false,
  deps: { neverBundle: [/^node:/] },
});
