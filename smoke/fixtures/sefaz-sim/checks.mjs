// Verificações do @sinete/sefaz-sim em Node, Bun, Deno e Chromium, sem rede: o simulador atende em processo pelo
// Transporte do próprio pacote.
import { relogioManual, ehErroSinete } from '@sinete/core';
import { nfeEndpoint, nfseEndpoint, contentTypeSoap12, envelopeSoap12, lerBodySoap } from '@sinete/transport';
import { criarNfseSim, criarSefazSim, dvChave, SERVICOS_MDFE, SERVICOS_NFE, redirecionarNfseParaSim, redirecionarParaSim, URL_BASE_SIM, transporteSim, acaoSoap, certificadoSintetico } from '@sinete/sefaz-sim';

export async function runChecks(mode) {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioManual('2026-09-26T10:00:00-03:00');
  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });
  const titular = await certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: '11222333000181', emissor: ac });
  const sim = criarSefazSim({ relogio: clock });
  expect('caminho do WSDL', sim.caminho('NfeStatusServico') === '/uf/ws/NFeStatusServico4');
  expect('caminho do MDF-e', sim.caminho('MDFeRecepcaoSinc') === '/uf/ws/MDFeRecepcaoSinc' && SERVICOS_MDFE.MDFeRecepcaoSinc.compactado === true);
  const def = SERVICOS_NFE.NfeStatusServico;
  const ns = 'http://www.portalfiscal.inf.br/nfe';
  const body = envelopeSoap12(
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ versao="4.00" xmlns="${ns}"><tpAmb>2</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg>`,
  );
  const t = transporteSim(sim, { certificadoDoCliente: titular.der });
  const res = await t.enviar({
    url: sim.url(URL_BASE_SIM, 'NfeStatusServico'),
    cabecalhos: { 'content-type': contentTypeSoap12(acaoSoap(def)) },
    corpo: body,
  });
  const ret = lerBodySoap(res.texto());
  expect('status 107', res.status === 200 && ret.includes('<cStat>107</cStat>'));
  expect('dhRecbto no relógio injetado', ret.includes('<dhRecbto>2026-09-26T10:00:00-03:00</dhRecbto>'));
  const sp = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
  const redirecionado = await redirecionarParaSim(t, URL_BASE_SIM).enviar({
    url: sp.url,
    endpoint: sp,
    cabecalhos: { 'content-type': contentTypeSoap12(acaoSoap(def)) },
    corpo: body,
  });
  expect('redirecionarParaSim atende o endpoint real', lerBodySoap(redirecionado.texto()).includes('<cStat>107</cStat>'));
  let err;
  try {
    await transporteSim(sim).enviar({ url: sim.url(URL_BASE_SIM, 'NfeStatusServico'), corpo: body });
  } catch (e) {
    err = e;
  }
  expect('403 sem certificado vira erro tipado', ehErroSinete(err) && err.code === 'certificado_ausente_ou_recusado');
  if (mode !== 'browser' && typeof Deno === 'undefined') {
    const node = await import('@sinete/sefaz-sim');
    expect('entrada node com o servidor HTTPS', typeof node.iniciarServidorSefazSim === 'function');
  }
  // NFS-e simulada no mesmo transporte em processo: parametrização do ADN pela base real, redirecionada.
  const nfse = criarNfseSim({ relogio: clock, assinador: titular.assinador, municipios: [{ cMun: '3550308', nome: 'São Paulo' }] });
  const ep = nfseEndpoint({ ambiente: 'homologacao', api: 'parametrizacao' });
  const conv = await redirecionarNfseParaSim(transporteSim(nfse, { certificadoDoCliente: titular.der }), URL_BASE_SIM).enviar({
    url: `${ep.url}/3550308/convenio`,
    endpoint: ep,
  });
  expect('NFS-e: convênio simulado', conv.status === 200 && JSON.parse(conv.texto()).parametrosConvenio.aderenteEmissorNacional === 1);
  expect('NFS-e: DV da chave', dvChave('0'.repeat(49)) === '0');
  await t.fechar();
  return failures;
}
