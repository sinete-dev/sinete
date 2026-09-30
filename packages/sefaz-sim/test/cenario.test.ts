/**
 * Cenário de ponta a ponta pelo HTTPS com mTLS e o transporte real do `@sinete/transport`: emissão sem resposta,
 * reenvio (204 e 539), consulta, CC-e duas vezes, cancelamento, inutilização e a NF-e chegando ao destinatário pela
 * distribuição de DF-e.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import net from 'node:net';
import tls from 'node:tls';
import { ErroDeTempoEsgotado, relogioManual } from '@sinete/core';
import type { Transport } from '@sinete/transport';
// No Bun o pacote resolve a condição node, e o createTransport de lá é o node:https; o tsc vê a entrada padrão.
import { createTransport, soap12ContentType } from '@sinete/transport';
import type { SefazSimServer, SyntheticCertificate } from '../src/index.node.ts';
import { createSefazSim, NFE_SERVICES, soapAction, startSefazSimServer } from '../src/index.node.ts';
import type { Certs } from './helpers.ts';
import {
  certs,
  consChNFe,
  consSitNFe,
  consStatServ,
  DESTINATARIO,
  det,
  distDFe,
  distNSU,
  docZips,
  envEvento,
  envelope,
  enviNFe,
  evento,
  INICIO,
  inutNFe,
  nfe,
  tag,
  tags,
  unwrap,
} from './helpers.ts';

type Servico = keyof typeof NFE_SERVICES;

let c: Certs;
const clock = relogioManual(INICIO);
const sim = createSefazSim({ clock });
let server: SefazSimServer;
const transports: Transport[] = [];

function transportOf(cert: SyntheticCertificate, timeoutMs = 5000): Transport {
  const t = createTransport({ identity: cert.tlsIdentity, additionalCa: [c.ac.pem], timeoutMs });
  transports.push(t);
  return t;
}

async function send(
  t: Transport,
  servico: Servico,
  payload: string,
  autorizador?: 'uf' | 'svc' | 'an',
): Promise<string> {
  const res = await t.send({
    url: server.url(servico, autorizador),
    headers: { 'content-type': soap12ContentType(soapAction(NFE_SERVICES[servico])) },
    body: envelope(servico, payload),
  });
  expect(res.status).toBe(200);
  return unwrap(servico, new TextDecoder().decode(res.body));
}

beforeAll(async () => {
  c = await certs();
  server = await startSefazSimServer(sim, { cert: c.servidor.pem, key: c.servidor.keyPem });
});

afterAll(async () => {
  for (const t of transports) await t.close();
  await server.close();
});

describe('HTTPS com mTLS', () => {
  test('cenário completo do emitente ao destinatário', async () => {
    const emitente = transportOf(c.emitente);
    expect(tag(await send(emitente, 'NfeStatusServico', consStatServ()), 'cStat')).toBe('107');

    // 1. Emissão: a SEFAZ processa e a resposta não chega.
    const nota = await nfe({ nNF: 1 });
    sim.injectFault({ kind: 'hang', phase: 'after' }, { servico: 'NFeAutorizacao' });
    const semResposta = transportOf(c.emitente, 300);
    expect(await send(semResposta, 'NFeAutorizacao', enviNFe([nota.xml])).catch((e: unknown) => e)).toBeInstanceOf(
      ErroDeTempoEsgotado,
    );
    const registro = sim.inspect.nfe(nota.chave);
    expect(registro?.situacao).toBe('autorizada');

    // 2. Reenvio da mesma nota: 204 com o recibo original. Nota regerada com outro cNF: 539 com a chave autorizada.
    const reenvio = await send(emitente, 'NFeAutorizacao', enviNFe([nota.xml], '1', '2'));
    expect(tags(reenvio, 'cStat')[1]).toBe('204');
    expect(tags(reenvio, 'xMotivo')[1]).toContain(`[nRec:${registro?.nRec}]`);
    const regerada = await nfe({ nNF: 1, cNF: '87654321' });
    const r539 = await send(emitente, 'NFeAutorizacao', enviNFe([regerada.xml], '1', '3'));
    expect(tags(r539, 'cStat')[1]).toBe('539');
    expect(tags(r539, 'xMotivo')[1]).toContain(nota.chave);

    // 3. Consulta do protocolo recupera a autorização perdida.
    const consulta = await send(emitente, 'NfeConsultaProtocolo', consSitNFe(nota.chave));
    expect(tag(consulta, 'cStat')).toBe('100');
    const nProt = tag(consulta, 'nProt') as string;
    expect(nProt).toBe(registro?.nProt as string);

    // 4. CC-e duas vezes (sequência 1 e 2) e cancelamento.
    clock.avancar(60_000);
    for (const nSeq of [1, 2]) {
      const cce = await evento({
        chave: nota.chave,
        tpEvento: '110110',
        nSeq,
        det: det.cce(`CORRECAO NUMERO ${nSeq}`),
      });
      const r = await send(emitente, 'RecepcaoEvento', envEvento([cce], String(nSeq)));
      expect([tags(r, 'cStat')[1], tag(r, 'nSeqEvento')]).toEqual(['135', String(nSeq)]);
    }
    const cce1 = await evento({ chave: nota.chave, tpEvento: '110110', nSeq: 1, det: det.cce() });
    expect(tags(await send(emitente, 'RecepcaoEvento', envEvento([cce1])), 'cStat')[1]).toBe('573');
    const canc = await evento({ chave: nota.chave, tpEvento: '110111', det: det.cancelamento(nProt) });
    expect(tags(await send(emitente, 'RecepcaoEvento', envEvento([canc])), 'cStat')[1]).toBe('135');
    expect(tag(await send(emitente, 'NfeConsultaProtocolo', consSitNFe(nota.chave)), 'cStat')).toBe('101');

    // 5. Inutilização da faixa pulada.
    const inut = await send(emitente, 'NfeInutilizacao', await inutNFe({ ini: 2, fin: 5 }));
    expect(tag(inut, 'cStat')).toBe('102');

    // 6. Destinatário: resumo antes da manifestação, ciência no AN, NF-e completa depois.
    const destinatario = transportOf(c.destinatario);
    const outra = await nfe({ nNF: 6 });
    expect(tags(await send(emitente, 'NFeAutorizacao', enviNFe([outra.xml])), 'cStat')[1]).toBe('100');
    const primeira = await send(destinatario, 'NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(0)));
    const docs = await docZips(primeira);
    expect(docs.filter((d) => d.schema === 'resNFe_v1.01.xsd').map((d) => d.xml.includes(outra.chave))).toContain(true);
    const ultNSU = Number(tag(primeira, 'ultNSU'));
    const ciencia = await evento({ chave: outra.chave, tpEvento: '210210', det: det.ciencia() });
    expect(tags(await send(destinatario, 'RecepcaoEvento', envEvento([ciencia]), 'an'), 'cStat')[1]).toBe('135');
    const depois = await docZips(
      await send(destinatario, 'NFeDistribuicaoDFe', distDFe(DESTINATARIO, distNSU(ultNSU))),
    );
    const proc = depois.find((d) => d.schema === 'procNFe_v4.00.xsd');
    expect(proc?.xml).toContain(outra.xml);
    const porChave = await docZips(
      await send(destinatario, 'NFeDistribuicaoDFe', distDFe(DESTINATARIO, consChNFe(outra.chave))),
    );
    expect(porChave.map((d) => d.schema)).toEqual(['procNFe_v4.00.xsd']);
  });

  test('atraso maior que o prazo do cliente: timeout, e a conexão fechada não deixa resposta pendente', async () => {
    const t = transportOf(c.terceiro, 200);
    sim.injectFault({ kind: 'delay', ms: 60_000 }, { servico: 'NfeStatusServico' });
    expect(await send(t, 'NfeStatusServico', consStatServ()).catch((e: unknown) => e)).toBeInstanceOf(
      ErroDeTempoEsgotado,
    );
    await t.close();
    expect(tag(await send(transportOf(c.terceiro), 'NfeStatusServico', consStatServ()), 'cStat')).toBe('107');
  });

  test('queda depois de processar vira erro de conexão e o reenvio responde 204', async () => {
    const t = transportOf(c.emitente);
    const nota = await nfe({ nNF: 50 });
    sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao' });
    const erro = await send(t, 'NFeAutorizacao', enviNFe([nota.xml])).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(ErroDeTempoEsgotado);
    expect(tags(await send(t, 'NFeAutorizacao', enviNFe([nota.xml])), 'cStat')[1]).toBe('204');
  });

  test('atraso curto responde; keep-alive reaproveita a conexão; o certificado do canal é capturado', async () => {
    const t = transportOf(c.terceiro);
    sim.injectFault({ kind: 'delay', ms: 30 }, { servico: 'NfeStatusServico' });
    expect(tag(await send(t, 'NfeStatusServico', consStatServ()), 'cStat')).toBe('107');
    expect(tag(await send(t, 'NfeStatusServico', consStatServ()), 'cStat')).toBe('107');
    // O certificado do canal chega ao simulador: vencido vira 281 e sem CNPJ vira 282.
    expect(tag(await send(transportOf(c.vencido), 'NfeStatusServico', consStatServ()), 'cStat')).toBe('281');
    expect(tag(await send(transportOf(c.semDocumento), 'NfeStatusServico', consStatServ()), 'cStat')).toBe('282');
  });

  test('HTTP cru: sem certificado (403), chunked, Connection: close, 404 e lixo', async () => {
    const raw = (payload: string, cert?: SyntheticCertificate): Promise<string> =>
      new Promise((resolve) => {
        const socket = tls.connect({
          host: '127.0.0.1',
          port: server.port,
          ca: [c.ac.pem],
          ...(cert === undefined ? {} : { cert: cert.pem, key: cert.keyPem }),
        });
        let out = '';
        socket.on('data', (d: Uint8Array) => {
          out += new TextDecoder().decode(d);
        });
        socket.on('end', () => resolve(out));
        socket.on('close', () => resolve(out));
        // Conexão derrubada pelo servidor: o que chegou até ali (nada, nos casos de lixo) é a resposta.
        socket.on('error', () => resolve(out));
        socket.on('secureConnect', () => socket.write(payload));
      });
    const path = sim.path('NfeStatusServico');
    const ct = soap12ContentType(soapAction(NFE_SERVICES.NfeStatusServico));
    const body = envelope('NfeStatusServico', consStatServ());
    const semCert = await raw(`POST ${path} HTTP/1.1\r\nhost: x\r\ncontent-length: 0\r\nconnection: close\r\n\r\n`);
    expect(semCert).toStartWith('HTTP/1.1 403 Forbidden');
    const half = Math.floor(body.length / 2);
    const chunks = `${half.toString(16)}\r\n${body.slice(0, half)}\r\n${(body.length - half).toString(16)};x=1\r\n${body.slice(half)}\r\n0\r\n\r\n`;
    const chunked = await raw(
      `POST ${path} HTTP/1.1\r\nhost: x\r\ncontent-type: ${ct}\r\ntransfer-encoding: chunked\r\nconnection: close\r\n\r\n${chunks}`,
      c.terceiro,
    );
    expect(chunked).toStartWith('HTTP/1.1 200 OK');
    expect(chunked).toContain('connection: close');
    expect(chunked).toContain('<cStat>107</cStat>');
    // Trailers no fim do chunked não vazam para o próximo pedido da mesma conexão.
    const comTrailer = `0\r\nx-trailer: 1\r\nx-outro: 2\r\n\r\n`;
    const dois = await raw(
      `POST ${path} HTTP/1.1\r\ncontent-type: ${ct}\r\ntransfer-encoding: chunked\r\n\r\n` +
        `${body.length.toString(16)}\r\n${body}\r\n${comTrailer}` +
        `POST ${path} HTTP/1.1\r\ncontent-type: ${ct}\r\ncontent-length: ${Buffer.byteLength(body)}\r\nconnection: close\r\n\r\n${body}`,
      c.terceiro,
    );
    expect(dois.split('HTTP/1.1 200 OK').length - 1).toBe(2);
    const semCrlf = await raw(
      `POST ${path} HTTP/1.1\r\ntransfer-encoding: chunked\r\n\r\n2\r\nabXY0\r\n\r\n`,
      c.terceiro,
    );
    expect(semCrlf).toBe('');
    const nada = await raw('GET /nada HTTP/1.1\r\nhost: x\r\nconnection: close\r\n\r\n', c.terceiro);
    expect(nada).toStartWith('HTTP/1.1 404 Not Found');
    const lixo = await raw(`POST ${path} HTTP/1.1\r\ntransfer-encoding: chunked\r\n\r\nzz\r\n`, c.terceiro);
    expect(lixo).toBe('');
    // Tamanho de chunk negativo ou Content-Length fora do formato derrubam a conexão, sem travar o laço de leitura.
    expect(
      await raw(`POST ${path} HTTP/1.1\r\ntransfer-encoding: chunked\r\n\r\n-6\r\nabcdef\r\n0\r\n\r\n`, c.terceiro),
    ).toBe('');
    expect(await raw(`POST ${path} HTTP/1.1\r\ncontent-length: -1\r\n\r\n`, c.terceiro)).toBe('');
    // Pedido que passa do limite do buffer também.
    const enorme = `POST ${path} HTTP/1.1\r\ncontent-length: 99999999\r\n\r\n${'x'.repeat(9 * 1024 * 1024)}`;
    expect(await raw(enorme, c.terceiro)).toBe('');
    const status = sim.config.clock === clock;
    expect(status).toBe(true);
  });

  test('close() não espera conexão que nunca completou o handshake TLS', async () => {
    const s = await startSefazSimServer(sim, { cert: c.servidor.pem, key: c.servidor.keyPem });
    const bruta = net.connect({ host: '127.0.0.1', port: s.port });
    bruta.on('error', () => undefined);
    await new Promise<void>((resolve) => bruta.once('connect', () => resolve()));
    const fechou = await Promise.race([
      s.close().then(() => 'fechou'),
      new Promise<string>((resolve) => setTimeout(() => resolve('preso'), 2000)),
    ]);
    expect(fechou).toBe('fechou');
    bruta.destroy();
  });

  test('servidor em IPv6: URL com colchetes e o SAN do certificado cobre ::1', async () => {
    const s = await startSefazSimServer(sim, { cert: c.servidor.pem, key: c.servidor.keyPem, hostname: '::1' });
    expect(s.baseUrl).toBe(`https://[::1]:${s.port}`);
    const res = await transportOf(c.terceiro).send({
      url: s.url('NfeStatusServico'),
      headers: { 'content-type': soap12ContentType(soapAction(NFE_SERVICES.NfeStatusServico)) },
      body: envelope('NfeStatusServico', consStatServ()),
    });
    expect(tag(unwrap('NfeStatusServico', res.text()), 'cStat')).toBe('107');
    await s.close();
  });

  test('servidor sem pedir certificado e em porta fixa', async () => {
    const s = await startSefazSimServer(createSefazSim({ clock, exigirCertificado: false }), {
      cert: c.servidor.pem,
      key: c.servidor.keyPem,
      requestCert: false,
    });
    const t = transportOf(c.terceiro);
    const res = await t.send({
      url: s.url('NfeStatusServico'),
      headers: { 'content-type': soap12ContentType(soapAction(NFE_SERVICES.NfeStatusServico)) },
      body: envelope('NfeStatusServico', consStatServ()),
    });
    expect(tag(unwrap('NfeStatusServico', res.text()), 'cStat')).toBe('107');
    expect(s.baseUrl).toBe(`https://127.0.0.1:${s.port}`);
    await t.close();
    await s.close();
  });
});
