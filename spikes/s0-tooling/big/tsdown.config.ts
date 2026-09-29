import { defineConfig } from 'tsdown';
export default defineConfig({ entry: ['src/index.ts'], format: ['esm'], platform: 'neutral', dts: { sourcemap: true }, sourcemap: true, fixedExtension: false });
