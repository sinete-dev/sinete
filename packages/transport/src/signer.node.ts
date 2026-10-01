/**
 * `@sinete/transport/signer`, entrada `node` (Node, Bun e o Deno que resolve a condição `node`): a entrada pura mais
 * `iniciarSigner`, que sobe o binário `sinete-signer` como processo filho e fala pelo stdio, e `conectarSigner`, que
 * conecta no socket Unix do helper em contêiner próprio.
 *
 * Experimental, como a entrada pura (ADR 0016, seção 5).
 *
 * @experimental
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import type { Ambiente, Logger } from '@sinete/core';
import { ErroDeConfiguracao, loggerSilencioso } from '@sinete/core';
import { ErroSigner } from './errors.ts';
import type { CanalSigner, ClienteSignerOpcoes, ConexaoSigner } from './signer.ts';
import { conectarCanalSigner, divisorDeLinhas } from './signer.ts';

export type {
  AbrirPkcs11Opcoes,
  AbrirRemotoOpcoes,
  CanalSigner,
  ClienteSignerOpcoes,
  ConexaoSigner,
  HelloDoSigner,
  IdentidadeSigner,
} from './signer.ts';
export {
  assinadorTlsDeCryptoKey,
  assinadorTlsDeDigest,
  certificadoAberto,
  conectarCanalSigner,
  divisorDeLinhas,
  lerTranscricaoTls,
  VERSAO_PROTOCOLO_SIGNER,
} from './signer.ts';

export interface IniciarSignerOpcoes extends ClienteSignerOpcoes {
  /**
   * Caminho do binário (relativo ao diretório atual, nunca buscado no `PATH`). Padrão: a variável `SINETE_SIGNER_BIN` (ou `SINETE_SIGNER_P11_BIN` com `pkcs11: true`). Sem
   * nenhum dos dois, `signer_indisponivel` com o que instalar.
   */
  readonly binario?: string;
  /** Sobe o sabor `-p11` (backend PKCS#11). Só muda o binário padrão. */
  readonly pkcs11?: boolean;
  /** Ambientes liberados na guarda do helper. Obrigatório fora do laboratório. */
  readonly ambientes?: readonly Ambiente[];
  /** Exige este `tpAmb` em todo `<tpAmb>` do corpo (a guarda do helper, além da política do transporte). */
  readonly tpAmb?: '1' | '2';
  /** Laboratório: o helper só fala com loopback. Para testes. */
  readonly lab?: boolean;
  /** Arquivos PEM de AC somados à confiança do servidor em todas as identidades. */
  readonly arquivosDeRaizes?: readonly string[];
  /** Grava a auditoria neste arquivo em vez de mandá-la ao `logger`. */
  readonly arquivoDeAuditoria?: string;
  /**
   * Variáveis de ambiente extras do helper (por exemplo `SOFTHSM2_CONF` ou o que o módulo do fabricante pedir). O
   * helper sobe com o ambiente mínimo (`PATH`, `HOME`, `SYSTEMROOT` no Windows) mais estas: nada do processo pai, que
   * pode ter segredo de outra ferramenta, vai junto. Nunca passe PIN aqui.
   */
  readonly env?: Readonly<Record<string, string>>;
}

function processEnv(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function resolveBinary(o: IniciarSignerOpcoes): string {
  const env = processEnv();
  const bin = o.binario ?? (o.pkcs11 ? env.SINETE_SIGNER_P11_BIN : env.SINETE_SIGNER_BIN);
  if (bin === undefined || bin === '') {
    throw new ErroSigner(
      'signer_indisponivel',
      `binário do sinete-signer${o.pkcs11 ? ' -p11' : ''} não informado: passe binary ou defina ${o.pkcs11 ? 'SINETE_SIGNER_P11_BIN' : 'SINETE_SIGNER_BIN'} (ADR 0014: pacote @sinete/signer ou os binários da release)`,
    );
  }
  // Caminho de arquivo, nunca busca no PATH: o spawn roda exatamente o arquivo que o existsSync conferiu.
  const abs = path.resolve(bin);
  if (!existsSync(abs)) throw new ErroSigner('signer_indisponivel', `binário do sinete-signer não existe: ${abs}`);
  return abs;
}

function helperArgs(o: IniciarSignerOpcoes): string[] {
  const args: string[] = [];
  if (o.lab) args.push('--lab');
  else {
    if (!o.ambientes || o.ambientes.length === 0) {
      throw new ErroDeConfiguracao('iniciarSigner: informe ambientes (homologacao, producao) ou lab: true');
    }
    for (const a of o.ambientes) args.push('--ambiente', a);
  }
  if (o.tpAmb !== undefined) args.push('--tpamb', o.tpAmb);
  for (const f of o.arquivosDeRaizes ?? []) args.push('--roots', f);
  if (o.arquivoDeAuditoria !== undefined) args.push('--audit-file', o.arquivoDeAuditoria);
  return args;
}

function forwardStderr(logger: Logger): (chunk: string) => void {
  return divisorDeLinhas((line) => {
    if (line.startsWith('audit ')) {
      try {
        logger.info('sinete-signer: auditoria', JSON.parse(line.slice(6)) as Record<string, unknown>);
        return;
      } catch {}
    }
    if (line.trim() !== '') logger.debug('sinete-signer', { linha: line });
  });
}

/**
 * Sobe o helper como processo filho e conecta pelo stdio. Fechar a conexão fecha o stdin, e o helper encerra as
 * requisições em andamento, fecha as identidades (sessões PKCS#11 inclusive) e sai.
 */
export async function iniciarSigner(opcoes: IniciarSignerOpcoes): Promise<ConexaoSigner> {
  const logger = opcoes.logger ?? loggerSilencioso;
  const bin = resolveBinary(opcoes);
  const args = helperArgs(opcoes);
  const env = processEnv();
  const childEnv: Record<string, string> = { PATH: env.PATH ?? '/usr/bin:/bin', HOME: env.HOME ?? '' };
  if (env.SYSTEMROOT !== undefined) childEnv.SYSTEMROOT = env.SYSTEMROOT;
  Object.assign(childEnv, opcoes.env ?? {});
  const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], env: childEnv, windowsHide: true });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', forwardStderr(logger));
  const closeListeners: ((reason: string) => void)[] = [];
  let closed = false;
  const markClosed = (reason: string): void => {
    if (closed) return;
    closed = true;
    for (const l of closeListeners) l(reason);
  };
  const exited = new Promise<void>((resolve) => {
    child.once('exit', (code, sig) => {
      markClosed(`processo saiu (${sig ?? code})`);
      resolve();
    });
    child.once('error', (e) => {
      markClosed(`não subiu: ${e.message}`);
      resolve();
    });
  });
  // Escrita num stdin já fechado (o helper morreu) não pode derrubar o processo do chamador.
  child.stdin.on('error', (e) => markClosed(`stdin: ${e.message}`));
  const channel: CanalSigner = {
    enviar: (line: string): void => {
      if (!closed) child.stdin.write(`${line}\n`);
    },
    aoReceberLinha: (listener: (line: string) => void): void => {
      child.stdout.on('data', divisorDeLinhas(listener));
    },
    aoFechar: (listener: (reason: string) => void): void => {
      closeListeners.push(listener);
    },
    async fechar(): Promise<void> {
      if (child.exitCode === null && child.signalCode === null) {
        child.stdin.end();
        const t = setTimeout(() => child.kill(), 10_000);
        await exited;
        clearTimeout(t);
      }
      markClosed('fechado pelo cliente');
    },
  };
  try {
    return await conectarCanalSigner(channel, opcoes);
  } catch (e) {
    child.kill();
    throw e;
  }
}

/** Conecta no helper que atende num socket Unix (`sinete-signer --socket caminho`), em contêiner próprio. */
export async function conectarSigner(
  opcoes: ClienteSignerOpcoes & { readonly caminhoDoSocket: string },
): Promise<ConexaoSigner> {
  const socket = net.createConnection(opcoes.caminhoDoSocket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', (e) =>
      reject(new ErroSigner('signer_indisponivel', `socket ${opcoes.caminhoDoSocket}: ${e.message}`, { cause: e })),
    );
  });
  socket.setEncoding('utf8');
  const closeListeners: ((reason: string) => void)[] = [];
  let closed = false;
  const markClosed = (reason: string): void => {
    if (closed) return;
    closed = true;
    for (const l of closeListeners) l(reason);
  };
  socket.on('close', () => markClosed('socket fechado'));
  socket.on('error', (e) => markClosed(e.message));
  const channel: CanalSigner = {
    enviar: (line: string): void => {
      if (!closed) socket.write(`${line}\n`);
    },
    aoReceberLinha: (listener: (line: string) => void): void => {
      socket.on('data', divisorDeLinhas(listener));
    },
    aoFechar: (listener: (reason: string) => void): void => {
      closeListeners.push(listener);
    },
    fechar: (): Promise<void> =>
      new Promise((resolve) => {
        if (closed) return resolve();
        socket.once('close', () => resolve());
        socket.end();
      }),
  };
  try {
    return await conectarCanalSigner(channel, opcoes);
  } catch (e) {
    socket.destroy();
    throw e;
  }
}
