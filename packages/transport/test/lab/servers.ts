/**
 * Servidores TLS locais do laboratório. Nada fala com a SEFAZ: tudo em 127.0.0.1, com a PKI descartável de `pki.ts`.
 *
 * - `renegotiationServer`: imita o IIS da SEFAZ (BA, SP, SVAN, AN, Sefin). `openssl s_server` sem CertificateRequest
 *   no handshake inicial; depois de ler a requisição HTTP, recebe `R` no stdin e renegocia pedindo o certificado (sem
 *   retomar a sessão), e só então responde. O log `-msg` prova se o cliente mandou Certificate e CertificateVerify.
 * - `wwwServer`: `openssl s_server -www` com as opções dadas (só CBC, só DHE, certificado exigido no handshake). A
 *   página devolvida diz a cifra e o certificado de cliente recebido.
 *
 * Usa `Bun.spawn`: o stdin do `node:child_process` no Bun chega ao s_server de um jeito que quebra o comando `R`.
 *
 * Duas corridas conhecidas e como este arquivo evita as duas:
 * - Porta: `freePort()` fecha o socket de sondagem antes do `s_server` abrir o dele (não tem como reservar e repassar
 *   o fd para um processo externo). Entre o `close()` e o `bind()` do `s_server`, outra `freePort()` concorrente pode
 *   pegar a mesma porta primeiro; o `s_server` morre na hora com `BIO_bind: Address already in use`. `spawnWithRetry`
 *   reconhece esse sinal específico (não qualquer saída prematura) e tenta de novo com porta nova, um número limitado
 *   de vezes.
 * - stdout x stderr: o rastro do handshake (`-msg`) sai no stdout; as linhas de verificação do certificado do
 *   cliente (`depth=`, `verify return:`) saem no stderr. São dois pipes lidos por dois loops assíncronos
 *   independentes: não há garantia de ordem relativa entre eles. Concatenar os dois incrementalmente, no meio da
 *   leitura, arrisca fatiar uma linha do stdout com um pedaço do stderr no meio (quebra qualquer regex que dependa da
 *   linha inteira) e deixa `presentedInRenegotiation` bisbilhotando a posição de uma linha de stderr relativa a uma
 *   marca de stdout, sem garantia nenhuma dessa posição. Este arquivo mantém os dois buffers separados durante toda a
 *   vida do processo (a máquina de estados da renegociação só olha o stdout, que é onde as marcas de protocolo
 *   realmente aparecem) e só concatena (stdout inteiro, depois stderr inteiro) na hora de devolver o log final, já
 *   com os dois drenados até o fim.
 */
import net from 'node:net';
import type { Subprocess } from 'bun';
import type { Pki } from './pki.ts';

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

export interface LabServer {
  readonly port: number;
  readonly url: string;
  /** Saída (stdout seguido de stderr) do s_server até agora. */
  log(): string;
  /** Espera o processo terminar (ou mata depois de `ms`) e devolve a saída, já com os dois pipes drenados até o fim. */
  finished(ms?: number): Promise<string>;
  stop(): void;
}

type Proc = Subprocess<'pipe', 'pipe', 'pipe'>;

/** Os dois pipes do processo, sempre separados: nunca há garantia de ordem relativa entre eles. */
interface Streams {
  stdout: string;
  stderr: string;
}

/** Bombeia um stream para dentro de `streams`, chamando `onChunk` (se houver) a cada pedaço novo. Devolve uma
 * promessa que só se resolve quando o stream fecha (EOF): é isso que `finished()` espera em vez de um sleep. */
function pump(stream: ReadableStream<Uint8Array>, onChunk?: (text: string) => void): Promise<void> {
  const dec = new TextDecoder();
  return (async () => {
    for await (const c of stream) onChunk?.(dec.decode(c));
  })();
}

/** Sinal de que o s_server morreu de bind: a porta que `freePort()` deu foi ocupada por outro processo entre o
 * `close()` da sondagem e o `bind()` do s_server. Corrida de recurso do SO, não falha de asserção: só por isso se
 * tenta de novo, com porta nova. */
const BIND_FAILED = /BIO_bind|Address already in use/;
const MAX_BIND_ATTEMPTS = 5;

interface Started {
  proc: Proc;
  streams: Streams;
  port: number;
  drained(): Promise<void>;
}

/** Sobe um `s_server` com retentativa só para a corrida de porta (nunca para falha de asserção do teste). */
async function spawnWithRetry(
  buildArgs: (port: number) => string[],
  onStdoutChunk?: (text: string, proc: Proc) => void,
): Promise<Started> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= MAX_BIND_ATTEMPTS; attempt++) {
    const port = await freePort();
    const streams: Streams = { stdout: '', stderr: '' };
    const proc = Bun.spawn(buildArgs(port), { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' });
    const outDone = pump(proc.stdout, (text) => {
      streams.stdout += text;
      onStdoutChunk?.(streams.stdout, proc);
    });
    const errDone = pump(proc.stderr, (text) => {
      streams.stderr += text;
    });
    const drained = (): Promise<void> => Promise.all([outDone, errDone]).then(() => undefined);
    try {
      await waitAccept(proc, streams);
      return { proc, streams, port, drained };
    } catch (e) {
      lastError = e as Error;
      proc.kill();
      await drained();
      if (!BIND_FAILED.test(streams.stdout) && !BIND_FAILED.test(streams.stderr)) throw lastError;
      // porta caiu numa corrida com outro processo: tenta de novo com porta nova.
    }
  }
  throw lastError ?? new Error('s_server: esgotadas as tentativas de bind');
}

async function waitAccept(proc: Proc, streams: Streams): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (/^ACCEPT$/m.test(streams.stdout)) return;
    if (proc.exitCode !== null)
      throw new Error(`s_server saiu com ${proc.exitCode}: ${streams.stdout}${streams.stderr}`);
    await Bun.sleep(25);
  }
  throw new Error('s_server não subiu');
}

function wrap(started: Started): LabServer {
  const { proc, port, streams, drained } = started;
  return {
    port,
    url: `https://127.0.0.1:${port}`,
    log: (): string => streams.stdout + streams.stderr,
    async finished(ms = 3000): Promise<string> {
      const t = setTimeout(() => proc.kill(), ms);
      await proc.exited;
      clearTimeout(t);
      // dreno determinístico: espera os dois pipes fecharem (EOF) em vez de um sleep torcendo pra terem drenado.
      await drained();
      return streams.stdout + streams.stderr;
    },
    stop: (): void => {
      proc.kill();
    },
  };
}

const RESPONSE = 'HTTP/1.0 200 OK\r\ncontent-type: text/plain\r\ncontent-length: 11\r\n\r\nrenegociado';
const FINISHED_FROM_CLIENT = /<<< TLS 1\.2, Handshake \[length [0-9a-f]+\], Finished/g;

/** Aceita uma conexão só (`-naccept 1`): cada cenário sobe o seu. */
export async function renegotiationServer(pki: Pki, caFile: string = pki.files.ca): Promise<LabServer> {
  let stage = 0;
  const started = await spawnWithRetry(
    (port) => [
      pki.openssl,
      's_server',
      '-accept',
      String(port),
      '-cert',
      pki.files.srv,
      '-key',
      pki.files.srvKey,
      '-CAfile',
      caFile,
      '-tls1_2',
      '-msg',
      '-verify_return_error',
      '-no_resumption_on_reneg',
      '-no_ticket',
      '-naccept',
      '1',
    ],
    (text, p) => {
      // As marcas de protocolo (GET, HelloRequest, Finished) só aparecem no stdout: o stderr (verify/depth) nunca
      // entra nessa máquina de estados, então a ordem entre os dois pipes não importa aqui.
      if (stage === 0 && /^(GET|POST) \//m.test(text)) {
        stage = 1;
        void (async () => {
          p.stdin.write('R\n');
          await p.stdin.flush();
        })();
      }
      if (stage === 1 && (text.match(FINISHED_FROM_CLIENT) ?? []).length >= 2) {
        stage = 2;
        void (async () => {
          p.stdin.write(RESPONSE);
          await p.stdin.flush();
          setTimeout(() => p.kill(), 300);
        })();
      }
    },
  );
  return wrap(started);
}

/** O cliente mandou Certificate e CertificateVerify na renegociação, e o servidor aceitou a cadeia.
 *
 * `log` é a concatenação final (stdout inteiro, depois stderr inteiro) devolvida por `finished()`: a checagem de
 * `Certificate`/`CertificateVerify` cai inteiramente no trecho de stdout (só há um `HelloRequest`, emitido no
 * stdout, e tudo que vem depois dele no stdout já é da renegociação); `verify return:1` mora inteiro no stderr, que
 * nesta função só existe por causa da renegociação (o handshake inicial não pede certificado, não tem `-Verify`), e
 * como o stderr vem sempre depois de todo o stdout na concatenação, ele cai sempre depois do único `HelloRequest`. */
export function presentedInRenegotiation(log: string): boolean {
  const after = log.split(/>>> TLS 1\.2, Handshake \[length [0-9a-f]+\], HelloRequest/)[1] ?? '';
  return (
    /<<< TLS 1\.2, Handshake \[length [0-9a-f]+\], Certificate\n/.test(after) &&
    /verify return:1/.test(after) &&
    /<<< TLS 1\.2, Handshake \[length [0-9a-f]+\], CertificateVerify/.test(after)
  );
}

export async function wwwServer(
  pki: Pki,
  args: readonly string[],
  cert: 'srv' | 'badSrv' | 'wrongName' = 'srv',
): Promise<LabServer> {
  const [c, k] =
    cert === 'srv'
      ? [pki.files.srv, pki.files.srvKey]
      : cert === 'badSrv'
        ? [pki.files.badSrv, pki.files.badSrvKey]
        : [pki.files.wrongName, pki.files.wrongNameKey];
  const started = await spawnWithRetry((port) => [
    pki.openssl,
    's_server',
    '-accept',
    String(port),
    '-cert',
    c,
    '-key',
    k,
    '-www',
    ...args,
  ]);
  return wrap(started);
}
