// Verificações do @sinete/transport em Node, Bun, Deno e Chromium, sem rede: tudo que envia é recusado antes do
// socket (política, perfil TLS do host ou runtime sem transporte).
import { abrirPfx, decodificarBase64 } from '@sinete/cert';
import { relogioFixo, ehErroSinete } from '@sinete/core';
import {
  politicaDeHostsPermitidos,
  classificarFalhaDeTransporte,
  criarTransporte,
  mdfeEndpoint,
  urlsConsultaNfce,
  nfceEndpoint,
  nfeEndpoint,
  nfseEndpoint,
  envelopeSoap12,
  lerBodySoap,
  perfilTlsDoHost,
  ErroTransporte,
} from '@sinete/transport';
import * as signer from '@sinete/transport/signer';
import { PFX_LEGACY_B64, SENHA } from '../cert/pfx.mjs';

export async function runChecks(mode) {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const sp = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
  expect('endpoint SP homologação', sp.host === 'homologacao.nfe.fazenda.sp.gov.br' && sp.tls?.certificadoDoCliente === 'renegociacao');
  expect('contingência por ambiente', nfeEndpoint({ ambiente: 'producao', uf: 'PI', servico: 'NFeAutorizacao', contingencia: 'svc' }).autorizador === 'SVC-AN');
  expect('NFC-e em outro host', nfceEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NFeAutorizacao' }).host === 'homologacao.nfce.fazenda.sp.gov.br');
  expect('NFC-e na SVRS', nfceEndpoint({ ambiente: 'producao', uf: 'BA', servico: 'RecepcaoEvento' }).autorizador === 'SVRS');
  expect('QR Code MG', urlsConsultaNfce('MG', 'producao')?.qrCode.startsWith('https://portalsped.fazenda.mg.gov.br/') === true);
  expect('MDF-e', mdfeEndpoint({ ambiente: 'producao', servico: 'MDFeStatusServico' }).host === 'mdfe.svrs.rs.gov.br');
  expect('NFS-e restrita', nfseEndpoint({ ambiente: 'homologacao', api: 'adn' }).host === 'adn.producaorestrita.nfse.gov.br');
  expect('perfil GO produção só DHE', perfilTlsDoHost('nfe.sefaz.go.gov.br')?.trocaDeChaves === 'dhe');
  const env = envelopeSoap12('<nfeDadosMsg>&amp;</nfeDadosMsg>');
  expect('SOAP sem tocar no corpo', lerBodySoap(env) === '<nfeDadosMsg>&amp;</nfeDadosMsg>');
  const cls = classificarFalhaDeTransporte(Object.assign(new Error('x'), { code: 'ERR_SSL_TLSV1_ALERT_UNKNOWN_CA' }), { host: 'h' });
  expect('erro tipado', cls instanceof ErroTransporte && cls.code === 'certificado_recusado' && ehErroSinete(cls));

  // Cliente do helper sinete-signer: o protocolo sobre um canal de mentira, sem binário (ADR 0005).
  expect('signer: versão do protocolo', signer.VERSAO_PROTOCOLO_SIGNER === 1);
  let listener = () => {};
  const conn = await signer.conectarCanalSigner({
    enviar: (line) => {
      const f = JSON.parse(line);
      const result = { protocol: 1, helper: 'sinete-signer/smoke', lab: true, ambientes: ['laboratorio'], backends: ['remote'], signModes: ['digest'], schemes: ['rsa_pkcs1_sha256'], methods: ['hello'] };
      queueMicrotask(() => listener(JSON.stringify({ v: 1, id: f.id, result })));
    },
    aoReceberLinha: (l) => {
      listener = l;
    },
    aoFechar: () => {},
    fechar: async () => {},
  });
  expect('signer: hello', conn.hello.helper === 'sinete-signer/smoke' && conn.hello.backends[0] === 'remote');
  if (mode === 'browser') expect('signer: sem iniciarSigner no browser', signer.iniciarSigner === undefined);
  else {
    let serr;
    try {
      await signer.iniciarSigner({ binario: '/nao/existe/sinete-signer', lab: true });
    } catch (e) {
      serr = e;
    }
    expect('signer: binário ausente', serr?.code === 'signer_indisponivel');
  }

  const ks = await abrirPfx(decodificarBase64(PFX_LEGACY_B64), { senha: SENHA, relogio: relogioFixo('2026-09-25T12:00:00Z') });
  const identity = { tipo: 'pem', ...ks.tlsPem() };
  const policy = politicaDeHostsPermitidos({ hosts: ['exemplo.invalid'] });
  if (mode === 'browser') {
    let err;
    try {
      criarTransporte({ identidade: identity });
    } catch (e) {
      err = e;
    }
    expect('browser sem transporte mTLS', err?.code === 'nao_suportado');
    return failures;
  }
  // No Deno, sem política: a recusa tem de vir do perfil TLS do host, antes do socket.
  const t = criarTransporte(typeof Deno !== 'undefined' ? { identidade: identity } : { identidade: identity, politica: policy });
  const rt = t.capacidades.runtime;
  expect('runtime detectada', rt === (typeof Deno !== 'undefined' ? 'deno' : typeof Bun !== 'undefined' ? 'bun' : 'node'));
  let err;
  try {
    await t.enviar({ url: sp.url, endpoint: sp });
  } catch (e) {
    err = e;
  }
  if (rt === 'deno') expect('Deno recusa host que renegocia', err?.name === 'ErroTransporteNaoSuportado' && err?.code === 'nao_suportado');
  else expect('política recusa antes do socket', err?.code === 'politica_recusou');
  expect('capacidades', rt === 'deno' ? t.capacidades.renegociacao === false : t.capacidades.renegociacao === true);
  await t.fechar();
  return failures;
}
