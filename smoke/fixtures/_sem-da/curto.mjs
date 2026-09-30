// Consumidor sem o @sinete/da, que é peer dependency opcional do @sinete/emissor. Os emissores de NF-e e MDF-e têm de
// instalar, empacotar para o browser e rodar sem ele; só o pdf() pede o pacote, com ErroDeConfiguracao e não com um erro de
// módulo.
// No Deno com `npm:`, peer opcional só é resolvida quando está no grafo estático do app (ADR 0010): quem usa o
// emissor de um documento importa também o pacote dele. No Node, o import não muda nada.
import '@sinete/mdfe';
import '@sinete/nfe';
import { relogioManual } from '@sinete/core';
import { criarEmissorMdfe } from '@sinete/emissor/mdfe';
import { criarMemoriaStore } from '@sinete/emissor/memoria';
import { criarEmissorNfe } from '@sinete/emissor/nfe';
import { criarSefazSim, redirecionarParaSim, URL_BASE_SIM, transporteSim, certificadoSintetico, pfxSintetico } from '@sinete/sefaz-sim';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioManual('2026-09-26T10:00:00-03:00');
  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });
  const titular = await certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: '11222333000181', emissor: ac });
  const sim = criarSefazSim({ relogio: clock });
  const comum = {
    pfx: pfxSintetico(titular, 'senha-sintetica', { cadeia: [ac] }),
    senha: 'senha-sintetica',
    ambiente: 'homologacao',
    relogio: clock,
    store: criarMemoriaStore({ relogio: clock }),
    aoDecidir: () => {},
    transporte: () => redirecionarParaSim(transporteSim(sim, { certificadoDoCliente: titular.der }), URL_BASE_SIM),
  };
  const nfe = await criarEmissorNfe(comum);
  const mdfe = await criarEmissorMdfe(comum);
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
