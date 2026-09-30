#!/usr/bin/env node
/** Executável `sinete`: liga a CLI ao processo (stdout, stderr, env, arquivos e o prompt de senha sem eco). */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { EntradaSaidaCli } from './main.ts';
import { main } from './main.ts';

/** IO real do processo. */
function processIo(): EntradaSaidaCli {
  return {
    saida: (line: string): void => {
      process.stdout.write(`${line}\n`);
    },
    erro: (line: string): void => {
      process.stderr.write(`${line}\n`);
    },
    env: process.env,
    lerArquivo: async (p: string): Promise<Uint8Array> => new Uint8Array(await readFile(p)),
    gravarArquivo: async (p: string, text: string): Promise<void> => {
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, text);
    },
    pedirSenha: async (question: string): Promise<string | undefined> => {
      const stdin = process.stdin;
      if (!stdin.isTTY) return undefined;
      process.stderr.write(question);
      stdin.setRawMode(true);
      stdin.resume();
      return new Promise((resolve) => {
        let value = '';
        const onData = (chunk: Buffer): void => {
          for (const ch of chunk.toString('utf8')) {
            if (ch === '\r' || ch === '\n') {
              stdin.setRawMode(false);
              stdin.pause();
              stdin.off('data', onData);
              process.stderr.write('\n');
              resolve(value);
              return;
            }
            if (ch === '\u0003') {
              stdin.setRawMode(false);
              process.stderr.write('\n');
              process.exit(130);
            }
            if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
            else value += ch;
          }
        };
        stdin.on('data', onData);
      });
    },
  };
}

process.exitCode = await main(process.argv.slice(2), processIo());
