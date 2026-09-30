/**
 * A entrada Node do cliente do signer fora do caminho feliz: onde o binário é procurado, os argumentos que o helper
 * recebe, o stderr que vira log e o helper que não sobe. Os casos com o helper de verdade precisam de Go; os outros
 * usam um script que imita um helper quebrado.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ErroDeConfiguracao, ErroDeTempoEsgotado, loggerEmMemoria } from '@sinete/core';
import { ErroSigner } from '../src/index.node.ts';
import { conectarSigner, iniciarSigner } from '../src/signer.node.ts';
import { createPki, findOpenssl } from './lab/pki.ts';
import { signerBinaries } from './lab/signer-bin.ts';

const dir = mkdtempSync(path.join(tmpdir(), 'sinete-signer-node-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  const apply = (v: Record<string, string | undefined>): void => {
    for (const [k, value] of Object.entries(v)) {
      if (value === undefined) delete process.env[k];
      else process.env[k] = value;
    }
  };
  apply(vars);
  try {
    return await fn();
  } finally {
    apply(before);
  }
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('esperava rejeição');
}

describe('iniciarSigner e conectarSigner sem helper utilizável', () => {
  test('sem binary e sem a variável do sabor: signer_indisponivel', async () => {
    await withEnv({ SINETE_SIGNER_BIN: undefined, SINETE_SIGNER_P11_BIN: undefined }, async () => {
      const e = await rejection(iniciarSigner({ lab: true }));
      expect(e).toBeInstanceOf(ErroSigner);
      expect((e as ErroSigner).code).toBe('signer_indisponivel');
      expect((e as Error).message).toContain('SINETE_SIGNER_BIN');
      const p11 = await rejection(iniciarSigner({ lab: true, pkcs11: true }));
      expect((p11 as Error).message).toContain('SINETE_SIGNER_P11_BIN');
    });
  });

  test('binário que não existe: signer_indisponivel', async () => {
    const e = await rejection(iniciarSigner({ lab: true, binario: path.join(dir, 'nao-existe') }));
    expect((e as ErroSigner).code).toBe('signer_indisponivel');
  });

  test('fora do laboratório, ambientes é obrigatório', async () => {
    const bin = path.join(dir, 'qualquer');
    writeFileSync(bin, '');
    await expect(iniciarSigner({ binario: bin })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(iniciarSigner({ binario: bin, ambientes: [] })).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });

  test('arquivo sem permissão de execução: o spawn falha e o cliente recusa sem derrubar o processo', async () => {
    const bin = path.join(dir, 'sem-exec');
    writeFileSync(bin, '#!/bin/sh\n');
    chmodSync(bin, 0o644);
    const e = await rejection(iniciarSigner({ lab: true, binario: bin, prazoDeControleMs: 5_000 }));
    expect(e).toBeInstanceOf(ErroSigner);
  });

  test.skipIf(process.platform === 'win32')(
    'helper que sai antes do hello: o stderr vira log e o cliente recusa',
    async () => {
      const bin = path.join(dir, 'quebrado.sh');
      writeFileSync(bin, "#!/bin/sh\necho 'audit {nao e json' >&2\necho 'falhou ao iniciar' >&2\nexit 3\n");
      chmodSync(bin, 0o755);
      const logger = loggerEmMemoria();
      const e = await rejection(iniciarSigner({ lab: true, binario: bin, logger, prazoDeControleMs: 5_000 }));
      expect(e).toBeInstanceOf(ErroSigner);
      for (let i = 0; i < 50 && logger.entradas.length < 2; i++) await Bun.sleep(20);
      const lines = logger.entradas.filter((l) => l.mensagem === 'sinete-signer').map((l) => l.campos.linha);
      expect(lines).toEqual(['audit {nao e json', 'falhou ao iniciar']);
    },
  );

  test.skipIf(process.platform === 'win32')(
    'binary relativo sem barra: roda o arquivo do diretório que o existsSync conferiu, não uma busca no PATH',
    async () => {
      writeFileSync(path.join(dir, 'relativo.sh'), "#!/bin/sh\necho 'rodou o relativo' >&2\nexit 3\n");
      chmodSync(path.join(dir, 'relativo.sh'), 0o755);
      const logger = loggerEmMemoria();
      const antes = process.cwd();
      process.chdir(dir);
      try {
        const e = await rejection(
          iniciarSigner({ lab: true, binario: 'relativo.sh', logger, prazoDeControleMs: 5_000 }),
        );
        expect(e).toBeInstanceOf(ErroSigner);
      } finally {
        process.chdir(antes);
      }
      for (let i = 0; i < 50 && logger.entradas.length < 1; i++) await Bun.sleep(20);
      expect(logger.entradas.map((l) => l.campos.linha)).toContain('rodou o relativo');
    },
  );

  test.skipIf(process.platform === 'win32')(
    'conectarSigner: socket que conecta mas não responde ao hello é fechado pelo cliente',
    async () => {
      const sockPath = path.join(dir, 'mudo.sock');
      const peers: net.Socket[] = [];
      let fechou = false;
      const server = net.createServer((s) => {
        peers.push(s);
        s.on('close', () => {
          fechou = true;
        });
        s.resume();
      });
      await new Promise<void>((resolve) => server.listen(sockPath, resolve));
      try {
        const e = await rejection(conectarSigner({ caminhoDoSocket: sockPath, prazoDeControleMs: 100 }));
        expect(e).toBeInstanceOf(ErroDeTempoEsgotado);
        for (let i = 0; i < 50 && !fechou; i++) await Bun.sleep(10);
        expect(fechou).toBe(true);
      } finally {
        for (const p of peers) p.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    },
  );

  test('conectarSigner num socket que não existe: signer_indisponivel', async () => {
    const e = await rejection(conectarSigner({ caminhoDoSocket: path.join(dir, 'nao-existe.sock') }));
    expect((e as ErroSigner).code).toBe('signer_indisponivel');
  });
});

const openssl = findOpenssl();
const bins = openssl ? await signerBinaries() : undefined;

describe.skipIf(!bins)('iniciarSigner com o helper de verdade fora do laboratório', () => {
  test('binário pela variável, ambientes, tpAmb, raízes extras e auditoria em arquivo', async () => {
    const b = bins as NonNullable<typeof bins>;
    const auditFile = path.join(dir, 'auditoria.jsonl');
    const pki = createPki();
    afterAll(() => pki.cleanup());
    const roots = pki.files.ca;
    const signer = await withEnv({ SINETE_SIGNER_BIN: b.static }, () =>
      iniciarSigner({
        ambientes: ['homologacao'],
        tpAmb: '2',
        arquivosDeRaizes: [roots],
        arquivoDeAuditoria: auditFile,
      }),
    );
    try {
      expect(signer.hello).toMatchObject({ lab: false, ambientes: ['homologacao'] });
    } finally {
      await signer.fechar();
    }
    expect(existsSync(auditFile)).toBe(true);
  });
});
