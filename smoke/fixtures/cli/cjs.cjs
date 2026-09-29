// require() do @sinete/cli (ESM puro) e a mesma função em require e import.
const cli = require('@sinete/cli');
const failures = [];
if (typeof cli.runDoctor !== 'function') failures.push('runDoctor via require');
import('@sinete/cli').then((esm) => {
  if (esm.runDoctor !== cli.runDoctor) failures.push('mesma função em require e import');
  console.log(JSON.stringify({ ok: failures.length === 0, rt: `node ${process.version}`, mode: 'require', failures }));
});
