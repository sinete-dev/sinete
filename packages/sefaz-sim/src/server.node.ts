/**
 * Servidor HTTPS do simulador, para exercitar o transporte real (`@sinete/transport`) de ponta a ponta: TLS com
 * certificado de cliente opcional e capturado, HTTP/1.1 com keep-alive, e as falhas de rede do cenário aplicadas no
 * socket (derrubar a conexão, não responder, atrasar).
 *
 * É HTTP/1.1 mínimo sobre `node:tls`, e não `node:https`, porque o servidor HTTP do Bun não expõe o certificado do
 * cliente (`getPeerCertificate` ausente no socket da requisição, medido no Bun 1.4.2). Aceita `Content-Length` e
 * `Transfer-Encoding: chunked`; não faz pipelining.
 */

import type { AddressInfo, Socket } from 'node:net';
import tls from 'node:tls';
import type { TratadorSim } from './handler.ts';
import type { AutorizadorSim, ServicoSim } from './services.ts';
import type { RespostaSim, SefazSim } from './sim.ts';

export interface ServidorSefazSimOpcoes {
  /** Certificado e chave do servidor em PEM (ex.: `certificadoSintetico({ papel: 'servidor', emissor: ac })`). */
  readonly certificado: string;
  readonly chave: string;
  /** Pede certificado de cliente no handshake (sem recusar, para que o simulador decida). Padrão: `true`. */
  readonly pedirCertificado?: boolean;
  /** Padrão: `127.0.0.1`. */
  readonly host?: string;
  /** Padrão: 0 (porta livre). */
  readonly porta?: number;
}

/** Servidor HTTPS de um simulador (NF-e ou NFS-e). */
export interface ServidorSim {
  /** `https://127.0.0.1:<porta>`. */
  readonly urlBase: string;
  readonly porta: number;
  /** Fecha o servidor e destrói as conexões abertas (inclusive as que o cenário deixou sem resposta). */
  fechar(): Promise<void>;
}

export interface ServidorSefazSim extends ServidorSim {
  /** URL completa de um serviço. */
  url(servico: ServicoSim, autorizador?: AutorizadorSim): string;
}

interface ParsedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body: Uint8Array;
  /** Bytes consumidos do buffer. */
  readonly used: number;
}

function indexOf(buf: Uint8Array, seq: readonly number[], from = 0): number {
  outer: for (let i = from; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer;
    return i;
  }
  return -1;
}

const CRLF = [13, 10];
/** Bytes pendentes por conexão antes de desistir: bem acima do limite de 500 KB da área de dados. */
const MAX_BUFFER = 8 * 1024 * 1024;
const HEADER_END = [13, 10, 13, 10];

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Corpo chunked a partir de `start`; `undefined` se ainda incompleto. */
function readChunked(buf: Uint8Array, start: number): { body: Uint8Array; used: number } | undefined {
  const parts: Uint8Array[] = [];
  let pos = start;
  for (;;) {
    const lineEnd = indexOf(buf, CRLF, pos);
    if (lineEnd < 0) return undefined;
    const token = (new TextDecoder().decode(buf.subarray(pos, lineEnd)).split(';')[0] ?? '').trim();
    if (!/^[0-9a-fA-F]{1,8}$/.test(token)) throw new Error('chunk inválido');
    const size = Number.parseInt(token, 16);
    pos = lineEnd + 2;
    if (size === 0) {
      // Trailers (RFC 9112, 7.1.2): linhas de cabeçalho até a linha vazia, que é o fim do pedido.
      for (;;) {
        const end = indexOf(buf, CRLF, pos);
        if (end < 0) return undefined;
        if (end === pos) return { body: concat(parts), used: end + 2 };
        pos = end + 2;
      }
    }
    if (buf.length < pos + size + 2) return undefined;
    if (buf[pos + size] !== 13 || buf[pos + size + 1] !== 10) throw new Error('chunk sem CRLF no fim');
    parts.push(buf.subarray(pos, pos + size));
    pos += size + 2;
  }
}

/** Um pedido completo no começo do buffer, ou `undefined` se faltam bytes. */
function parseRequest(buf: Uint8Array): ParsedRequest | undefined {
  const headEnd = indexOf(buf, HEADER_END);
  if (headEnd < 0) return undefined;
  const lines = new TextDecoder().decode(buf.subarray(0, headEnd)).split('\r\n');
  const [method = '', path = ''] = (lines[0] ?? '').split(' ');
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const start = headEnd + 4;
  if (/chunked/i.test(headers['transfer-encoding'] ?? '')) {
    const c = readChunked(buf, start);
    return c === undefined ? undefined : { method, path, headers, body: c.body, used: c.used };
  }
  const cl = headers['content-length'] ?? '0';
  if (!/^[0-9]{1,9}$/.test(cl)) throw new Error('content-length inválido');
  const len = Number(cl);
  if (buf.length < start + len) return undefined;
  return { method, path, headers, body: buf.subarray(start, start + len), used: start + len };
}

const REASONS: Readonly<Record<number, string>> = {
  200: 'OK',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

function serialize(r: RespostaSim, keepAlive: boolean): Uint8Array {
  const body = new TextEncoder().encode(r.corpo);
  const head = [
    `HTTP/1.1 ${r.status} ${REASONS[r.status] ?? 'Status'}`,
    ...Object.entries(r.cabecalhos).map(([k, v]) => `${k}: ${v}`),
    `content-length: ${body.length}`,
    `connection: ${keepAlive ? 'keep-alive' : 'close'}`,
    '',
    '',
  ].join('\r\n');
  return concat([new TextEncoder().encode(head), body]);
}

/** Sobe o simulador da NF-e num servidor HTTPS local. */
export async function iniciarServidorSefazSim(
  sim: SefazSim,
  opcoes: ServidorSefazSimOpcoes,
): Promise<ServidorSefazSim> {
  const server = await iniciarServidorSim(sim, opcoes);
  return {
    ...server,
    url: (servico: ServicoSim, autorizador?: AutorizadorSim): string => sim.url(server.urlBase, servico, autorizador),
  };
}

/** Sobe um simulador qualquer (o da NFS-e, por exemplo) num servidor HTTPS local com mTLS. */
export async function iniciarServidorSim(sim: TratadorSim, opcoes: ServidorSefazSimOpcoes): Promise<ServidorSim> {
  const sockets = new Set<tls.TLSSocket>();
  const server = tls.createServer(
    {
      cert: opcoes.certificado,
      key: opcoes.chave,
      requestCert: opcoes.pedirCertificado ?? true,
      rejectUnauthorized: false,
    },
    (socket) => {
      sockets.add(socket);
      // Espera do atraso injetado: cancelada quando a conexão fecha, para não segurar o processo depois do close().
      let espera: ReturnType<typeof setTimeout> | undefined;
      let acordar: (() => void) | undefined;
      socket.on('close', () => {
        sockets.delete(socket);
        clearTimeout(espera);
        acordar?.();
      });
      socket.on('error', () => socket.destroy());
      const peer = socket.getPeerCertificate(false) as { raw?: Uint8Array } | null;
      const clientCertificate = peer?.raw ? new Uint8Array(peer.raw) : undefined;
      let buf: Uint8Array = new Uint8Array(0);
      let busy = false;
      const pump = async (): Promise<void> => {
        if (busy) return;
        busy = true;
        try {
          for (;;) {
            const req = parseRequest(buf);
            if (req === undefined) break;
            buf = buf.subarray(req.used);
            const result = await sim.atender({
              metodo: req.method,
              caminho: req.path,
              cabecalhos: req.headers,
              corpo: req.body,
              ...(clientCertificate === undefined ? {} : { certificadoDoCliente: clientCertificate }),
            });
            if (result.atrasoMs > 0) {
              await new Promise<void>((resolve) => {
                acordar = resolve;
                espera = setTimeout(resolve, result.atrasoMs);
              });
            }
            if (socket.destroyed) return;
            if (result.efeito === 'derrubar') {
              socket.destroy();
              return;
            }
            // Sem resposta: o socket fica aberto até o cliente desistir ou o servidor fechar.
            if (result.efeito === 'travar') return;
            const keepAlive = (req.headers.connection ?? 'keep-alive').toLowerCase() !== 'close';
            socket.write(serialize(result, keepAlive));
            if (!keepAlive) {
              socket.end();
              return;
            }
          }
        } catch {
          socket.destroy();
        } finally {
          busy = false;
        }
      };
      socket.on('data', (chunk: Uint8Array) => {
        buf = concat([buf, chunk]);
        // Pedido que não termina nunca não pode crescer sem limite na memória do teste.
        if (buf.length > MAX_BUFFER) {
          socket.destroy();
          return;
        }
        void pump();
      });
    },
  );
  // Conexões TCP desde o accept: a callback do createServer só roda depois do handshake, e uma conexão que nunca
  // completa o TLS seguraria o close() até o timeout do handshake.
  const brutas = new Set<Socket>();
  server.on('connection', (raw: Socket) => {
    brutas.add(raw);
    raw.on('close', () => brutas.delete(raw));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opcoes.porta ?? 0, opcoes.host ?? '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  const hostname = opcoes.host ?? '127.0.0.1';
  // IPv6 literal vai entre colchetes na URL (RFC 3986, 3.2.2); o listen() recebe sem.
  const baseUrl = `https://${hostname.includes(':') ? `[${hostname}]` : hostname}:${port}`;
  return {
    urlBase: baseUrl,
    porta: port,
    fechar(): Promise<void> {
      for (const s of sockets) s.destroy();
      for (const s of brutas) s.destroy();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
