// Consumidor sem o @sinete/da, que é peer dependency opcional do @sinete/emissor. Os emissores de NF-e e MDF-e têm de
// instalar, empacotar para o browser e rodar sem ele; só o pdf() pede o pacote, com ConfigError e não com um erro de
// módulo.
// No Deno com `npm:`, peer opcional só é resolvida quando está no grafo estático do app (ADR 0010): quem usa o
// emissor de um documento importa também o pacote dele. No Node, o import não muda nada.
import '@sinete/mdfe';
import '@sinete/nfe';
import { relogioManual } from '@sinete/core';
import { createMdfeEmissor } from '@sinete/emissor/mdfe';
import { createMemoriaStore } from '@sinete/emissor/memoria';
import { createNfeEmissor } from '@sinete/emissor/nfe';
import { createSefazSim, redirectToSim, SIM_BASE_URL, simTransport, syntheticCertificate, syntheticPfx } from '@sinete/sefaz-sim';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioManual('2026-09-26T10:00:00-03:00');
  const ac = await syntheticCertificate({ clock, role: 'ac' });
  const titular = await syntheticCertificate({ clock, role: 'titular', cnpj: '11222333000181', issuer: ac });
  const sim = createSefazSim({ clock });
  const comum = {
    pfx: syntheticPfx(titular, 'senha-sintetica', { chain: [ac] }),
    senha: 'senha-sintetica',
    ambiente: 'homologacao',
    clock,
    store: createMemoriaStore({ clock }),
    aoDecidir: () => {},
    transporte: () => redirectToSim(simTransport(sim, { clientCertificate: titular.der }), SIM_BASE_URL),
  };
  const nfe = await createNfeEmissor(comum);
  const mdfe = await createMdfeEmissor(comum);
  for (const [nome, emissor] of [
    ['nfe', nfe],
    ['mdfe', mdfe],
  ]) {
    const e = await emissor.pdf('<nfeProc/>').catch((x) => x);
    expect(`${nome}: pdf sem o @sinete/da pede o pacote`, e?.code === 'config_invalida' && String(e.message).includes('@sinete/da'));
    await emissor.fechar();
  }
  return failures;
}

if (typeof document === 'undefined') {
  const failures = await runChecks();
  console.log(JSON.stringify({ ok: failures.length === 0, mode: 'sem-da', failures }));
}
