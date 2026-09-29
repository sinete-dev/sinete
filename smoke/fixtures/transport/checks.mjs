// Verificações do @sinete/transport em Node, Bun, Deno e Chromium, sem rede: tudo que envia é recusado antes do
// socket (política, perfil TLS do host ou runtime sem transporte).
import { openPfx, base64ToBytes } from '@sinete/cert';
import { fixedClock, isSineteError } from '@sinete/core';
import {
  allowlistPolicy,
  classifyTransportFailure,
  createTransport,
  mdfeEndpoint,
  nfceConsultaUrls,
  nfceEndpoint,
  nfeEndpoint,
  nfseEndpoint,
  soap12Envelope,
  soapBody,
  tlsProfileForHost,
  TransportError,
} from '@sinete/transport';
import * as signer from '@sinete/transport/signer';
import { PFX_LEGACY_B64, SENHA } from '../cert/pfx.mjs';

export async function runChecks(mode) {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const sp = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
  expect('endpoint SP homologação', sp.host === 'homologacao.nfe.fazenda.sp.gov.br' && sp.tls?.clientCert === 'renegotiation');
  expect('contingência por ambiente', nfeEndpoint({ ambiente: 'producao', uf: 'PI', servico: 'NFeAutorizacao', contingencia: 'svc' }).autorizador === 'SVC-AN');
  expect('NFC-e em outro host', nfceEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NFeAutorizacao' }).host === 'homologacao.nfce.fazenda.sp.gov.br');
  expect('NFC-e na SVRS', nfceEndpoint({ ambiente: 'producao', uf: 'BA', servico: 'RecepcaoEvento' }).autorizador === 'SVRS');
  expect('QR Code MG', nfceConsultaUrls('MG', 'producao')?.qrCode.startsWith('https://portalsped.fazenda.mg.gov.br/') === true);
  expect('MDF-e', mdfeEndpoint({ ambiente: 'producao', servico: 'MDFeStatusServico' }).host === 'mdfe.svrs.rs.gov.br');
  expect('NFS-e restrita', nfseEndpoint({ ambiente: 'homologacao', api: 'adn' }).host === 'adn.producaorestrita.nfse.gov.br');
  expect('perfil GO produção só DHE', tlsProfileForHost('nfe.sefaz.go.gov.br')?.keyExchange === 'dhe');
  const env = soap12Envelope('<nfeDadosMsg>&amp;</nfeDadosMsg>');
  expect('SOAP sem tocar no corpo', soapBody(env) === '<nfeDadosMsg>&amp;</nfeDadosMsg>');
  const cls = classifyTransportFailure(Object.assign(new Error('x'), { code: 'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA' }), { host: 'h' });
  expect('erro tipado', cls instanceof TransportError && cls.code === 'certificado_recusado' && isSineteError(cls));

  // Cliente do helper sinete-signer: o protocolo sobre um canal de mentira, sem binário (ADR 0005).
  expect('signer: versão do protocolo', signer.SIGNER_PROTOCOL_VERSION === 1);
  let listener = () => {};
  const conn = await signer.connectSignerChannel({
    send: (line) => {
      const f = JSON.parse(line);
      const result = { protocol: 1, helper: 'sinete-signer/smoke', lab: true, ambientes: ['laboratorio'], backends: ['remote'], signModes: ['digest'], schemes: ['rsa_pkcs1_sha256'], methods: ['hello'] };
      queueMicrotask(() => listener(JSON.stringify({ v: 1, id: f.id, result })));
    },
    onLine: (l) => {
      listener = l;
    },
    onClose: () => {},
    close: async () => {},
  });
  expect('signer: hello', conn.hello.helper === 'sinete-signer/smoke' && conn.hello.backends[0] === 'remote');
  if (mode === 'browser') expect('signer: sem startSigner no browser', signer.startSigner === undefined);
  else {
    let serr;
    try {
      await signer.startSigner({ binary: '/nao/existe/sinete-signer', lab: true });
    } catch (e) {
      serr = e;
    }
    expect('signer: binário ausente', serr?.code === 'signer_indisponivel');
  }

  const ks = await openPfx(base64ToBytes(PFX_LEGACY_B64), { password: SENHA, clock: fixedClock('2026-09-25T12:00:00Z') });
  const identity = { kind: 'pem', ...ks.tlsPem() };
  const policy = allowlistPolicy({ hosts: ['exemplo.invalid'] });
  if (mode === 'browser') {
    let err;
    try {
      createTransport({ identity });
    } catch (e) {
      err = e;
    }
    expect('browser sem transporte mTLS', err?.code === 'nao_suportado');
    return failures;
  }
  // No Deno, sem política: a recusa tem de vir do perfil TLS do host, antes do socket.
  const t = createTransport(typeof Deno !== 'undefined' ? { identity } : { identity, policy });
  const rt = t.capabilities.runtime;
  expect('runtime detectada', rt === (typeof Deno !== 'undefined' ? 'deno' : typeof Bun !== 'undefined' ? 'bun' : 'node'));
  let err;
  try {
    await t.send({ url: sp.url, endpoint: sp });
  } catch (e) {
    err = e;
  }
  if (rt === 'deno') expect('Deno recusa host que renegocia', err?.name === 'TransportUnsupportedError' && err?.code === 'nao_suportado');
  else expect('política recusa antes do socket', err?.code === 'politica_recusou');
  expect('capacidades', rt === 'deno' ? t.capabilities.renegotiation === false : t.capabilities.renegotiation === true);
  await t.close();
  return failures;
}
