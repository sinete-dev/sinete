// Verificações do @sinete/nfe compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
// Monta uma NF-e sintética em homologação (documentos de exemplo, sem dado real) e confere totais, chave e XML; os
// data JSON (fusos, vigências, cStat) precisam estar embutidos no bundle. Depois autoriza a nota na SEFAZ simulada em
// processo (o cliente resolve o endpoint pelos dados do transporte e o redirectToSim troca só a URL). Por fim, IBS/CBS
// pela calculadora padrão (o motor do @sinete/ibs-cbs com o dataset embarcado, importado sob demanda pelo pacote publicado).
import { relogioFixo, relogioManual, contextoDeTempo } from '@sinete/core';
import {
  autorizadorContingencia,
  buildNfe,
  createNfeClient,
  carregarDatasetEmbarcado,
  Decimal,
  dec,
  gunzipBase64,
  ibsCbsCalculator,
  rotuloDoCaminho,
  signNfe,
  TipoPagamento,
  XNOME_HOMOLOGACAO,
} from '@sinete/nfe';
import { determine, officialRates, RULES, verifyDataset } from '@sinete/nfe/ibs-cbs';
import {
  createSefazSim,
  redirectToSim,
  SIM_BASE_URL,
  simTransport,
  syntheticCertificate,
} from '@sinete/sefaz-sim';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  expect('decimal half-even', dec('0.125').toFixed(2, 'HALF_EVEN') === '0.12' && dec('0.125').toFixed(2) === '0.13');
  const nota = {
    serie: 1,
    nNF: 1,
    natOp: 'VENDA',
    tpNF: '1',
    emitente: {
      CNPJ: '11222333000181',
      xNome: 'EMPRESA SINTETICA LTDA',
      endereco: { xLgr: 'RUA A', nro: '1', xBairro: 'CENTRO', cMun: '3550308', xMun: 'SAO PAULO', UF: 'SP', CEP: '01001000' },
      IE: '110042490114',
      CRT: '3',
    },
    destinatario: {
      CPF: '11144477735',
      xNome: 'X',
      indIEDest: '9',
      endereco: { xLgr: 'RUA B', nro: '2', xBairro: 'CENTRO', cMun: '3550308', xMun: 'SAO PAULO', UF: 'SP' },
    },
    itens: [
      {
        produto: { cProd: '1', xProd: 'ITEM', NCM: '73181500', CFOP: '5102', uCom: 'UN', qCom: '3', vUnCom: '3.3333' },
        impostos: {
          icms: { CST: '00', orig: '0', pICMS: '18' },
          pis: { CST: '07' },
          cofins: { CST: '07' },
        },
      },
    ],
    pagamento: { detPag: [{ tPag: TipoPagamento.PIX_DINAMICO, vPag: '10' }] },
  };
  const time = contextoDeTempo({ emissao: relogioFixo('2026-09-26T10:00:00-03:00') });
  const r = await buildNfe(nota, { ambiente: 'homologacao', time });
  expect('monta', r.ok);
  expect('rótulo do caminho', rotuloDoCaminho('/infNFe/det[2]/prod/xProd') === 'Item 2, Descrição do produto');
  if (r.ok) {
    const n = r.value;
    expect('chave', n.chave.length === 44 && n.chave.startsWith('352609') && n.id === `NFe${n.chave}`);
    expect('pl por vigência', n.pl.pl.startsWith('PL_010f'));
    expect('fuso da UF', n.dhEmi === '2026-09-26T10:00:00-03:00');
    expect('totais', n.infNFe.total.ICMSTot.vNF === '10.00' && n.infNFe.total.ICMSTot.vICMS === '1.80');
    expect('homologação', n.infNFe.dest.xNome === XNOME_HOMOLOGACAO);
    expect('xml', n.xml.startsWith('<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe'));
  }
  const semDest = await buildNfe({ ...nota, destinatario: undefined }, { ambiente: 'homologacao', time });
  expect('ocorrências', !semDest.ok && semDest.issues.some((i) => i.code === 'campo_obrigatorio'));
  expect('contingência por dado', autorizadorContingencia('SP', 'homologacao').autorizador === 'SVC-AN');
  // gzip de "ok" (bytes fixos): DecompressionStream da plataforma
  const gz = 'H4sIAAAAAAAAA8vPBgBH3dx5AgAAAA==';
  expect('gunzip', (await gunzipBase64(gz)) === 'ok');

  if (r.ok) {
    const clock = relogioManual('2026-09-26T10:00:00-03:00');
    const ac = await syntheticCertificate({ clock, role: 'ac' });
    const titular = await syntheticCertificate({ clock, role: 'titular', cnpj: '11222333000181', issuer: ac });
    const sim = createSefazSim({ clock });
    const transport = redirectToSim(simTransport(sim, { clientCertificate: titular.der }), SIM_BASE_URL);
    const client = createNfeClient({ transport, signer: titular.signer, ambiente: 'homologacao', uf: 'SP', clock });
    const assinada = await signNfe(r.value, titular.signer);
    const aut = await client.autorizar(assinada);
    expect('autorizada no simulador', aut.tipo === 'autorizado' && aut.valor.nfeProc?.includes(assinada) === true);
    const consulta = await client.consultar(r.value.chave, assinada);
    expect('consulta confere o digVal', consulta.tipo === 'autorizado' && consulta.valor.digValConfere === true);
    await transport.close();
  }

  // IBS/CBS sem calculadora nas opções: o buildNfe usa o ibsCbsCalculator e importa o dataset embarcado na hora.
  const quando = relogioFixo('2026-10-10T12:00:00-03:00');
  const classificado = {
    ...nota,
    itens: [
      {
        produto: { cProd: '1', xProd: 'ITEM', NCM: '73181500', CFOP: '5102', uCom: 'UN', qCom: '1', vUnCom: '1000' },
        impostos: {
          icms: { CST: '00', orig: '0', pICMS: '18' },
          pis: { CST: '07' },
          cofins: { CST: '07' },
          ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '1000.00' } },
        },
      },
    ],
    pagamento: undefined,
  };
  const rtc = await buildNfe(classificado, { ambiente: 'homologacao', time: contextoDeTempo({ emissao: quando }) });
  expect('ibs/cbs pelo motor padrão', rtc.ok && rtc.value.infNFe.total.IBSCBSTot?.gCBS.vCBS === '9.00');
  const ds = await carregarDatasetEmbarcado();
  expect('dataset embarcado sob demanda', typeof ds === 'object' && ds !== null);
  // O subpath @sinete/nfe/ibs-cbs dá o motor e o leitor do dataset sem importar os pacotes do IBS/CBS.
  expect('nfe/ibs-cbs: alíquotas', officialRates().nominal('2026-10-10').CBS.value === '0.9');
  expect('nfe/ibs-cbs: regras e dados', RULES.length > 0 && typeof verifyDataset === 'function');
  const det = await determine(
    { modelo: 55, kind: 'transferencia', items: [{ n: 1, ncm: '10063021' }] },
    { dataset: ds, time: contextoDeTempo({ emissao: quando }) },
  );
  expect('nfe/ibs-cbs: determinação', det.items[0]?.decided?.candidate.cClassTrib === '410002');
  const zero = Decimal.of('0');
  const semBase = await ibsCbsCalculator({ regras: false }).calcular({
    nota: {
      fatoGerador: quando.agora(),
      emissao: quando.agora(),
      ambiente: 'homologacao',
      mod: '55',
      tpNF: '1',
      finNFe: '1',
      indFinal: '1',
      indPres: '1',
      emitente: { UF: 'SP', cMun: '3550308', CRT: '3' },
    },
    itens: [
      { nItem: 1, CST: '000', cClassTrib: '000001', NCM: '73181500', CFOP: '5102', uTrib: 'UN', qTrib: Decimal.of('1'), vProd: Decimal.of('1'), vDesc: zero, vFrete: zero, vSeg: zero, vOutro: zero, vICMS: zero, vICMSST: zero, vFCP: zero, vFCPST: zero, vIPI: zero, vPIS: zero, vCOFINS: zero, vII: zero, vISSQN: zero },
    ],
  });
  expect('base ausente vira ocorrência', semBase.issues?.[0]?.code === 'ibscbs_base_ausente');
  return failures;
}
