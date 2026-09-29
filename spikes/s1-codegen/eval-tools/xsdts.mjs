import x from 'xsd-ts';
import dl from 'xsd-ts/dist/download-schema.js';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const dir = path.resolve('../xsd/PL_010f_v1.04');
try {
  const xmls = await dl.downloadXsd('file://' + dir + '/nfe_v4.00.xsd', async (p) => readFileSync(path.join(dir, path.basename(p)), 'utf8'));
  const schemas = x.parseSchemas(xmls);
  const types = x.generateTypes(schemas);
  const out = x.toTsTypes(types);
  writeFileSync('xsdts-out.ts', out); console.log('bytes', out.length);
} catch (e) { console.log('ERR', String(e.stack).slice(0, 800)); }
