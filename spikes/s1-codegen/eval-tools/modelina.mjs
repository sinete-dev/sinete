import { TypeScriptGenerator } from '@asyncapi/modelina';
import { readFileSync, writeFileSync } from 'node:fs';
const dir = '../xsd/PL_010f_v1.04/';
const xsd = readFileSync(dir + 'leiauteNFe_v4.00.xsd', 'utf8');
const gen = new TypeScriptGenerator({ modelType: 'interface' });
const t = performance.now();
try {
  const models = await gen.generate(xsd);
  const out = models.map(m => m.result).join('\n\n');
  writeFileSync('modelina-out.ts', out);
  console.log('models', models.length, 'bytes', out.length, 'ms', (performance.now()-t).toFixed(0));
} catch (e) { console.log('ERR', String(e).slice(0, 500)); }
