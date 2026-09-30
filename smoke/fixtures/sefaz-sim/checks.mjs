// Verificações do @sinete/sefaz-sim em Node, Bun, Deno e Chromium, sem rede: o simulador atende em processo pelo
// Transport do próprio pacote.
import { relogioManual, ehErroSinete } from '@sinete/core';
import { nfeEndpoint, nfseEndpoint, soap12ContentType, soap12Envelope, soapBody } from '@sinete/transport';
import { createNfseSim, createSefazSim, dvChave, MDFE_SERVICES, NFE_SERVICES, redirectNfseToSim, redirectToSim, SIM_BASE_URL, simTransport, soapAction, syntheticCertificate } from '@sinete/sefaz-sim';

export async function runChecks(mode) {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const clock = relogioManual('2026-09-26T10:00:00-03:00');
  const ac = await syntheticCertificate({ clock, role: 'ac' });
  const titular = await syntheticCertificate({ clock, role: 'titular', cnpj: '11222333000181', issuer: ac });
  const sim = createSefazSim({ clock });
  expect('caminho do WSDL', sim.path('NfeStatusServico') === '/uf/ws/NFeStatusServico4');
  expect('caminho do MDF-e', sim.path('MDFeRecepcaoSinc') === '/uf/ws/MDFeRecepcaoSinc' && MDFE_SERVICES.MDFeRecepcaoSinc.compactado === true);
  const def = NFE_SERVICES.NfeStatusServico;
  const ns = 'http://www.portalfiscal.inf.br/nfe';
  const body = soap12Envelope(
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ versao="4.00" xmlns="${ns}"><tpAmb>2</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg>`,
  );
  const t = simTransport(sim, { clientCertificate: titular.der });
  const res = await t.send({
    url: sim.url(SIM_BASE_URL, 'NfeStatusServico'),
    headers: { 'content-type': soap12ContentType(soapAction(def)) },
    body,
  });
  const ret = soapBody(res.text());
  expect('status 107', res.status === 200 && ret.includes('<cStat>107</cStat>'));
  expect('dhRecbto no relógio injetado', ret.includes('<dhRecbto>2026-09-26T10:00:00-03:00</dhRecbto>'));
  const sp = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
  const redirecionado = await redirectToSim(t, SIM_BASE_URL).send({
    url: sp.url,
    endpoint: sp,
    headers: { 'content-type': soap12ContentType(soapAction(def)) },
    body,
  });
  expect('redirectToSim atende o endpoint real', soapBody(redirecionado.text()).includes('<cStat>107</cStat>'));
  let err;
  try {
    await simTransport(sim).send({ url: sim.url(SIM_BASE_URL, 'NfeStatusServico'), body });
  } catch (e) {
    err = e;
  }
  expect('403 sem certificado vira erro tipado', ehErroSinete(err) && err.code === 'certificado_ausente_ou_recusado');
  if (mode !== 'browser' && typeof Deno === 'undefined') {
    const node = await import('@sinete/sefaz-sim');
    expect('entrada node com o servidor HTTPS', typeof node.startSefazSimServer === 'function');
  }
  // NFS-e simulada no mesmo transporte em processo: parametrização do ADN pela base real, redirecionada.
  const nfse = createNfseSim({ clock, signer: titular.signer, municipios: [{ cMun: '3550308', nome: 'São Paulo' }] });
  const ep = nfseEndpoint({ ambiente: 'homologacao', api: 'parametrizacao' });
  const conv = await redirectNfseToSim(simTransport(nfse, { clientCertificate: titular.der }), SIM_BASE_URL).send({
    url: `${ep.url}/3550308/convenio`,
    endpoint: ep,
  });
  expect('NFS-e: convênio simulado', conv.status === 200 && JSON.parse(conv.text()).parametrosConvenio.aderenteEmissorNacional === 1);
  expect('NFS-e: DV da chave', dvChave('0'.repeat(49)) === '0');
  await t.close();
  return failures;
}
