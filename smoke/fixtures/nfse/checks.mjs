// Verificações do @sinete/nfse compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
// Monta uma DPS sintética em homologação (CNPJ de exemplo, sem dado real), confere Id, declaração UTF-8 e o leiaute
// escolhido pela tabela de vigências embutida no bundle, e emite na NFS-e simulada em processo: o cliente resolve as
// bases pelos dados de endpoints do transporte e o redirecionarNfseParaSim troca só a origem. Por fim, a rejeição com o
// catálogo do Anexo I, um parâmetro municipal com cache e o gzip da plataforma.
import { relogioManual, contextoDeTempo } from '@sinete/core';
import {
  montarDps,
  codigoServicoParametrizacao,
  criarClienteNfse,
  descomprimirGzipBase64,
  comprimirGzipBase64,
  assinarDps,
} from '@sinete/nfse';
import {
  criarNfseSim,
  redirecionarNfseParaSim,
  URL_BASE_SIM,
  transporteSim,
  certificadoSintetico,
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
  const r = await montarDps(dps('01.01.01'), { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: clock }) });
  expect('monta', r.ok);
  expect('código de 9 dígitos', codigoServicoParametrizacao('010101') === '01.01.01.000');
  expect('gunzip', (await descomprimirGzipBase64(await comprimirGzipBase64('ok'))) === 'ok');
  if (!r.ok) return failures;
  expect('id da DPS', r.valor.id === `DPS${SAO_PAULO}2${PRESTADOR}00001000000000000001`);
  expect('declaração UTF-8', r.valor.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><DPS'));
  expect('leiaute por vigência', r.valor.modulo === 'nfse/1.01-20260727');

  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });
  const [servidor, titular] = await Promise.all([
    certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac }),
    certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: PRESTADOR, emissor: ac }),
  ]);
  const sim = criarNfseSim({
    relogio: clock,
    assinador: servidor.assinador,
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
  const transport = redirecionarNfseParaSim(transporteSim(sim, { certificadoDoCliente: titular.der }), URL_BASE_SIM);
  const client = criarClienteNfse({ transporte: transport, ambiente: 'homologacao', relogio: clock, assinador: titular.assinador });
  const assinada = await assinarDps(r.valor, titular.assinador);
  const gerada = await client.autorizar(assinada);
  expect(
    'NFS-e gerada com a DPS embutida',
    gerada.tipo === 'autorizado' && gerada.valor.chaveAcesso.length === 50 && gerada.valor.xml.includes(assinada.slice(38)),
  );
  const outra = await montarDps(dps('01.02.01'), { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: clock }) });
  if (outra.ok) {
    const rej = await client.autorizar(await assinarDps(outra.valor, titular.assinador));
    expect('rejeição com o catálogo', rej.tipo === 'recusado' && rej.cStat === 'E0312' && rej.dica !== undefined);
  } else expect('monta a segunda', false);
  const conv = await client.parametros.convenio(SAO_PAULO);
  await client.parametros.convenio(SAO_PAULO);
  expect('convênio', conv?.aderenteEmissorNacional === true);
  expect('cache de parâmetros', sim.inspecao.nfses().length === 1);
  await transport.fechar();

  return failures;
}
