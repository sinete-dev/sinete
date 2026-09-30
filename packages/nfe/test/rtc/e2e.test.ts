/**
 * Ponta a ponta com IBS/CBS: casos gravados da Calculadora offline da RFB (fixtures do oráculo do `@sinete/ibs-cbs/calcular`,
 * só os sem divergência) viram notas pelo `buildNfe` com a calculadora padrão (o `ibsCbsCalculator`), são assinados e autorizados na
 * `@sinete/sefaz-sim` por HTTPS com mTLS e o transporte real. Os grupos `IBSCBS` e o `IBSCBSTot` da nota autorizada
 * têm de bater, campo a campo, com o que a Calculadora devolveu.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { relogioManual } from '@sinete/core';
import { decodificarXml } from '@sinete/schemas';
import { nfeProcElement } from '@sinete/schemas/nfe/PL_010f';
import type { SefazSimServer, SyntheticCertificate } from '@sinete/sefaz-sim';
import { createSefazSim, redirectToSim, startSefazSimServer, syntheticCertificate } from '@sinete/sefaz-sim';
import type { Transporte } from '@sinete/transport';
import { criarTransporte } from '@sinete/transport';
import fixture from '../../../ibs-cbs/test/calcular/fixtures/oracle-cases.json' with { type: 'json' };
import { buildNfe, createNfeClient, signNfe } from '../../src/index.ts';
import type { ItemRtc, Local } from './helpers.ts';
import { CNPJ_EMIT, flatten, LOCAIS, notaRtc, opcoesRtc } from './helpers.ts';

interface Caso {
  readonly id: string;
  readonly date: string;
  readonly op: {
    readonly modelo: number;
    readonly local: { readonly uf: string; readonly cMun: string };
    readonly itens: readonly {
      readonly n: number;
      readonly cst: string;
      readonly cClassTrib: string;
      readonly base: string;
    }[];
  };
  readonly engine: Readonly<Record<string, string>>;
  readonly divergences: readonly unknown[];
}

/** NF-e em RS e AM, com redução de alíquota, imunidade e tributação integral, sem divergência com a Calculadora. */
const IDS = ['s1-22', 's1-89'];
const casos = (fixture.cases as unknown as Caso[]).filter((c) => IDS.includes(c.id));

let ac: SyntheticCertificate;
let servidor: SyntheticCertificate;
let emitente: SyntheticCertificate;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual('2026-09-01T00:00:00-03:00');
  ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
  [servidor, emitente] = await Promise.all([
    syntheticCertificate({ clock, role: 'servidor', issuer: ac, validDays: 3650 }),
    syntheticCertificate({ clock, role: 'titular', cnpj: CNPJ_EMIT, issuer: ac, validDays: 3650 }),
  ]);
}, 60_000);

afterAll(async () => {
  for (const f of fechar.splice(0)) await f();
});

describe('IBS/CBS pelo @sinete/ibs-cbs, autorizado na SEFAZ simulada, conferido com a Calculadora', () => {
  test('os casos escolhidos existem, são NF-e e concordam com a Calculadora', () => {
    expect(casos.map((c) => c.id).sort()).toEqual([...IDS].sort());
    for (const c of casos) {
      expect(c.op.modelo).toBe(55);
      expect(c.divergences).toEqual([]);
    }
  });

  for (const id of IDS) {
    test(`caso ${id}`, async () => {
      const caso = casos.find((c) => c.id === id) as Caso;
      const local = LOCAIS[caso.op.local.uf as Local['UF']];
      expect(local.cMun).toBe(caso.op.local.cMun);
      // Emissão e fato gerador no dia do caso, ao meio-dia de Brasília.
      const clock = relogioManual(`${caso.date}T12:00:00-03:00`);
      const sim = createSefazSim({ clock, uf: local.UF });
      const server: SefazSimServer = await startSefazSimServer(sim, { cert: servidor.pem, key: servidor.keyPem });
      const real: Transporte = criarTransporte({ identidade: emitente.tlsIdentity, acsAdicionais: [ac.pem] });
      fechar.push(async () => {
        await real.fechar();
        await server.close();
      });
      const client = createNfeClient({
        transport: redirectToSim(real, server.baseUrl),
        signer: emitente.signer,
        ambiente: 'homologacao',
        uf: local.UF,
        clock,
      });

      const itens: ItemRtc[] = caso.op.itens.map((i) => ({ CST: i.cst, cClassTrib: i.cClassTrib, base: i.base }));
      // Sem `ibsCbs` nas opções: a calculadora padrão do buildNfe, com o dataset embarcado importado sob demanda.
      const r = await buildNfe(notaRtc(local, itens), opcoesRtc(clock));
      if (!r.ok) throw new Error(r.issues.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
      const assinada = await signNfe(r.value, emitente.signer);
      const aut = await client.autorizar(assinada);
      expect([aut.tipo, aut.cStat]).toEqual(['autorizado', '100']);
      if (aut.tipo !== 'autorizado') return;

      // O que foi autorizado, lido de volta do nfeProc: os grupos do XML contra a saída gravada da Calculadora.
      const proc = decodificarXml(nfeProcElement, aut.valor.nfeProc as string).valor;
      const inf = proc.NFe.infNFe;
      const autorizado: Record<string, string> = {};
      for (const det of inf.det) flatten(`item${det.nItem}`, det.imposto.IBSCBS, autorizado);
      flatten('total', inf.total.IBSCBSTot, autorizado);
      const esperado = Object.fromEntries(Object.entries(caso.engine).filter(([k]) => !k.endsWith('.simulated')));
      expect(autorizado).toEqual(esperado);
    });
  }
});
