// Verificações do @sinete/nfse compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
// Monta uma DPS sintética em homologação (CNPJ de exemplo, sem dado real), confere Id, declaração UTF-8 e o leiaute
// escolhido pela tabela de vigências embutida no bundle, e emite na NFS-e simulada em processo: o cliente resolve as
// bases pelos dados de endpoints do transporte e o redirectNfseToSim troca só a origem. Por fim, a rejeição com o
// catálogo do Anexo I, um parâmetro municipal com cache e o gzip da plataforma.
import { relogioManual, contextoDeTempo } from '@sinete/core';
import {
  buildDps,
  codigoServicoParametrizacao,
  createNfseClient,
  gunzipBase64,
  gzipBase64,
  signDps,
} from '@sinete/nfse';
import {
  createNfseSim,
  redirectNfseToSim,
  SIM_BASE_URL,
  simTransport,
  syntheticCertificate,
} from '@sinete/sefaz-sim';

const PRESTADOR = '11222333000181';
const SAO_PAULO = '3550308';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioManual('2026-09-26T10:00:00-03:00');
  const dps = (cTribNac) => ({
    serie: '1',
    nDPS: cTribNac === '01.01.01' ? '1' : '2',
    cLocEmi: SAO_PAULO,
    prestador: { CNPJ: PRESTADOR, regTrib: { opSimpNac: '3', regApTribSN: '1', regEspTrib: '0' } },
    tomador: { CNPJ: '44555666000181', xNome: 'TOMADOR SINTETICO LTDA' },
    servico: { local: { cLocPrestacao: SAO_PAULO }, cTribNac, xDescServ: 'Desenvolvimento de software (teste)', cNBS: '115021000' },
    valores: { vServ: '1500.00' },
    tributacao: { issqn: { tribISSQN: '1', tpRetISSQN: '1' }, totTrib: { pTotTribSN: '6.00' } },
  });
  const r = buildDps(dps('01.01.01'), { ambiente: 'homologacao', time: contextoDeTempo({ emissao: clock }) });
  expect('monta', r.ok);
  expect('código de 9 dígitos', codigoServicoParametrizacao('010101') === '01.01.01.000');
  expect('gunzip', (await gunzipBase64(await gzipBase64('ok'))) === 'ok');
  if (!r.ok) return failures;
  expect('id da DPS', r.value.id === `DPS${SAO_PAULO}2${PRESTADOR}00001000000000000001`);
  expect('declaração UTF-8', r.value.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><DPS'));
  expect('leiaute por vigência', r.value.modulo === 'nfse/1.01-20260727');

  const ac = await syntheticCertificate({ clock, role: 'ac' });
  const [servidor, titular] = await Promise.all([
    syntheticCertificate({ clock, role: 'servidor', issuer: ac }),
    syntheticCertificate({ clock, role: 'titular', cnpj: PRESTADOR, issuer: ac }),
  ]);
  const sim = createNfseSim({
    clock,
    signer: servidor.signer,
    municipios: [
      {
        cMun: SAO_PAULO,
        nome: 'São Paulo',
        servicos: [
          { codigo: '01.01.01', aliquotas: [{ aliquota: '2.00', inicio: '2026-01-01' }] },
          { codigo: '01.02.01', aliquotas: [] },
        ],
      },
    ],
  });
  const transport = redirectNfseToSim(simTransport(sim, { clientCertificate: titular.der }), SIM_BASE_URL);
  const client = createNfseClient({ transport, ambiente: 'homologacao', clock, signer: titular.signer });
  const assinada = await signDps(r.value, titular.signer);
  const gerada = await client.autorizar(assinada);
  expect(
    'NFS-e gerada com a DPS embutida',
    gerada.tipo === 'autorizado' && gerada.valor.chaveAcesso.length === 50 && gerada.valor.xml.includes(assinada.slice(38)),
  );
  const outra = buildDps(dps('01.02.01'), { ambiente: 'homologacao', time: contextoDeTempo({ emissao: clock }) });
  if (outra.ok) {
    const rej = await client.autorizar(await signDps(outra.value, titular.signer));
    expect('rejeição com o catálogo', rej.tipo === 'recusado' && rej.cStat === 'E0312' && rej.dica !== undefined);
  } else expect('monta a segunda', false);
  const conv = await client.parametros.convenio(SAO_PAULO);
  await client.parametros.convenio(SAO_PAULO);
  expect('convênio', conv?.aderenteEmissorNacional === true);
  expect('cache de parâmetros', sim.inspect.nfses().length === 1);
  await transport.fechar();

  return failures;
}
