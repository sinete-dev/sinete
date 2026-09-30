// Verificações do @sinete/mdfe compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
// Monta um MDF-e sintético em homologação (produtor rural com CPF, carga própria de MT para SP; documentos de exemplo,
// sem dado real) e confere chave, XML, divisas e QR Code; os data JSON (fusos, divisas, vigências, cStat) precisam
// estar embutidos no bundle. Depois autoriza o MDF-e na SEFAZ simulada em processo, consulta os não encerrados e
// encerra (o cliente resolve o endpoint pelos dados do transporte e o redirecionarParaSim troca só a URL).
import { relogioManual, contextoDeTempo } from '@sinete/core';
import {
  montarMdfe,
  criarClienteMdfe,
  dec,
  descomprimirGzipBase64,
  comprimirGzipBase64,
  qrCodeMdfe,
  saoVizinhas,
  rotuloDoCaminho,
  assinarMdfe,
  sugerirPercurso,
} from '@sinete/mdfe';
import {
  criarSefazSim,
  redirecionarParaSim,
  URL_BASE_SIM,
  transporteSim,
  certificadoSintetico,
} from '@sinete/sefaz-sim';

const CPF = '11144477735';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  expect('decimal', dec('1.5').plus(dec('0.25')).toFixed(4) === '1.7500');
  expect('divisas por dado', saoVizinhas('MT', 'MS') && !saoVizinhas('MT', 'SP'));
  expect('sugestão de percurso', sugerirPercurso('MT', 'SP')?.join() === 'MS');
  const mdfe = {
    tpEmit: '2',
    serie: 920,
    nMDF: 1,
    emitente: {
      CPF,
      IE: '00130000019',
      xNome: 'PRODUTOR RURAL SINTETICO',
      endereco: { xLgr: 'RODOVIA FICTICIA', nro: 'KM 10', xBairro: 'ZONA RURAL', cMun: '5103403', xMun: 'CUIABA', UF: 'MT' },
    },
    ufIni: 'MT',
    ufFim: 'SP',
    percurso: ['MS'],
    carregamento: [{ cMun: '5103403', xMun: 'CUIABA' }],
    rodoviario: {
      tracao: {
        placa: 'ABC1D23',
        tara: 10000,
        capKG: 30000,
        condutores: [{ xNome: 'CONDUTOR SINTETICO', CPF: '52998224725' }],
        tpRod: '01',
        tpCar: '03',
        UF: 'MT',
      },
    },
    descarregamentos: [
      { cMun: '3550308', xMun: 'SAO PAULO', nfe: [{ chave: '51260911222333000181550010000000011100000016' }] },
    ],
    produtoPredominante: { tpCarga: '01', xProd: 'SOJA EM GRAOS', NCM: '12019000' },
    totais: { vCarga: '150000', cUnid: '01', qCarga: '30000' },
  };
  const clock = relogioManual('2026-09-26T10:00:00-04:00');
  const opcoes = { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: clock }) };
  const r = await montarMdfe(mdfe, opcoes);
  expect('monta', r.ok);
  const semPercurso = await montarMdfe({ ...mdfe, percurso: [] }, opcoes);
  expect('percurso conferido', !semPercurso.ok && semPercurso.ocorrencias.some((i) => i.code === 'percurso_invalido'));
  expect('ocorrência da entrada', !semPercurso.ok && semPercurso.ocorrencias.every((i) => i.origem === 'entrada'));
  expect('rótulo do caminho', rotuloDoCaminho('rodoviario.tracao.condutores[0].CPF') === 'Condutor 1, CPF');
  expect('qr code por dado', qrCodeMdfe('5'.repeat(44), '2').startsWith('https://dfe-portal.svrs.rs.gov.br/mdfe/qrCode?'));
  expect('gzip', (await descomprimirGzipBase64(await comprimirGzipBase64('ok'))) === 'ok');
  if (!r.ok) return failures;
  const m = r.valor;
  expect('chave', m.chave.length === 44 && m.chave.startsWith('51260900011144477735589200000000011') && m.id === `MDFe${m.chave}`);
  expect('fuso da UF', m.dhEmi === '2026-09-26T10:00:00-04:00');
  expect('totais', m.infMDFe.tot.vCarga === '150000.00' && m.infMDFe.tot.qCarga === '30000.0000' && m.infMDFe.tot.qNFe === '1');
  expect('xml', m.xml.startsWith('<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"><infMDFe Id="MDFe'));

  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });
  const produtor = await certificadoSintetico({ relogio: clock, papel: 'titular', cpf: CPF, emissor: ac });
  const sim = criarSefazSim({ relogio: clock, uf: 'MT' });
  const transport = redirecionarParaSim(transporteSim(sim, { certificadoDoCliente: produtor.der }), URL_BASE_SIM);
  const client = criarClienteMdfe({ transporte: transport, assinador: produtor.assinador, ambiente: 'homologacao', relogio: clock, autor: { CPF } });
  const assinado = await assinarMdfe(m, produtor.assinador);
  expect('qr code antes da assinatura', assinado.includes('<infMDFeSupl><qrCodMDFe>'));
  const aut = await client.autorizar(assinado);
  expect('autorizado no simulador', aut.tipo === 'autorizado' && aut.valor.mdfeProc?.includes(assinado) === true);
  const abertos = await client.consultarNaoEncerrados();
  expect('não encerrados', abertos.tipo === 'autorizado' && abertos.valor.length === 1);
  if (aut.tipo === 'autorizado') {
    clock.avancar(3_600_000);
    const enc = await client.encerrar({ chave: m.chave, nProt: aut.valor.nProt ?? '', uf: 'SP', cMun: '3550308' });
    expect('encerrado', enc.tipo === 'autorizado' && enc.cStat === '135');
  }
  const dup = await client.autorizar(assinado);
  expect('duplicidade enriquecida', dup.tipo === 'recusado' && dup.cStat === '204' && dup.dica !== undefined);
  await transport.fechar();

  return failures;
}
