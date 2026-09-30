/** Todo método do `NfeClient` que vai à rede repassa o `signal` ao transporte: abortar cancela a requisição em curso. */
import { describe, expect, test } from 'bun:test';
import type { NfeClient } from '../../src/services/index.ts';
import type { FakeTransport } from './helpers.ts';
import { CNPJ_DEST, CNPJ_EMIT, chave, client, nfeAssinada, transportePendente } from './helpers.ts';

type Chamada = (c: NfeClient, signal: AbortSignal) => Promise<unknown>;

const casos: readonly (readonly [string, Chamada])[] = [
  ['statusServico', (c, signal) => c.statusServico({ signal })],
  ['statusServico da NFC-e', (c, signal) => c.statusServico({ mod: '65', signal })],
  ['autorizar', async (c, signal) => c.autorizar(await nfeAssinada(), { signal })],
  ['consultarRecibo', (c, signal) => c.consultarRecibo('351000000000001', undefined, { signal })],
  ['consultar', (c, signal) => c.consultar(chave(), undefined, { signal })],
  [
    'cancelar',
    (c, signal) =>
      c.cancelar({ chave: chave(), nProt: '135260000000001', xJust: 'Justificativa de teste longa' }, { signal }),
  ],
  [
    'cancelarPorSubstituicao',
    (c, signal) =>
      c.cancelarPorSubstituicao(
        {
          chave: chave({ mod: '65' }),
          nProt: '135260000000001',
          xJust: 'Substituída por erro no total',
          chNFeRef: chave({ mod: '65', nNF: 124 }),
          cOrgaoAutor: '35',
          verAplic: 'PDV-1.0',
        },
        { signal },
      ),
  ],
  [
    'cartaCorrecao',
    (c, signal) =>
      c.cartaCorrecao({ chave: chave(), xCorrecao: 'Correção do endereço de entrega', nSeqEvento: 1 }, { signal }),
  ],
  ['manifestar', (c, signal) => c.manifestar({ chave: chave(), tipo: 'ciencia' }, { signal })],
  [
    'inutilizar',
    (c, signal) =>
      c.inutilizar(
        { ano: 2026, serie: 1, nNFIni: 10, nNFFin: 12, xJust: 'Quebra de sequência na emissão' },
        { signal },
      ),
  ],
  ['consultarCadastro', (c, signal) => c.consultarCadastro({ uf: 'MT', CNPJ: CNPJ_DEST }, { signal })],
  ['distribuicaoDFe', (c, signal) => c.distribuicaoDFe({ ultNSU: 0 }, { signal })],
];

async function cliente(): Promise<{ c: NfeClient; t: ReturnType<typeof transportePendente> }> {
  const t = transportePendente();
  const { c } = await client(t, { autor: { CNPJ: CNPJ_EMIT } });
  return { c, t };
}

describe('signal', () => {
  for (const [nome, chamar] of casos) {
    test(`${nome}: abortar durante a requisição rejeita com o motivo`, async () => {
      const { c, t } = await cliente();
      const ac = new AbortController();
      const p = chamar(c, ac.signal);
      await t.enviou;
      ac.abort(new Error('parou'));
      await expect(p).rejects.toThrow('parou');
      expect(t.sinais).toEqual([ac.signal]);
    });

    test(`${nome}: signal já abortado rejeita sem resposta`, async () => {
      const { c } = await cliente();
      const ac = new AbortController();
      ac.abort(new Error('antes'));
      await expect(chamar(c, ac.signal)).rejects.toThrow('antes');
    });
  }
});
