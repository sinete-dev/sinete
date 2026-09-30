/**
 * Ponta a ponta com IBS/CBS: casos gravados da Calculadora offline da RFB (fixtures do oráculo do `@sinete/ibs-cbs/calcular`,
 * só os sem divergência) viram notas pelo `montarNfe` com a calculadora padrão (o `calculadoraIbsCbs`), são assinados e autorizados na
 * `@sinete/sefaz-sim` por HTTPS com mTLS e o transporte real. Os grupos `IBSCBS` e o `IBSCBSTot` da nota autorizada
 * têm de bater, campo a campo, com o que a Calculadora devolveu.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { relogioManual } from '@sinete/core';
import { decodificarXml } from '@sinete/schemas';
import { nfeProcElement } from '@sinete/schemas/nfe/PL_010f';
import type { CertificadoSintetico, ServidorSefazSim } from '@sinete/sefaz-sim';
import { certificadoSintetico, criarSefazSim, iniciarServidorSefazSim, redirecionarParaSim } from '@sinete/sefaz-sim';
import type { Transporte } from '@sinete/transport';
import { criarTransporte } from '@sinete/transport';
import fixture from '../../../ibs-cbs/test/calcular/fixtures/oracle-cases.json' with { type: 'json' };
import { assinarNfe, criarClienteNfe, montarNfe } from '../../src/index.ts';
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

let ac: CertificadoSintetico;
let servidor: CertificadoSintetico;
let emitente: CertificadoSintetico;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual('2026-09-01T00:00:00-03:00');
  ac = await certificadoSintetico({ relogio: clock, papel: 'ac', diasDeValidade: 3650 });
  [servidor, emitente] = await Promise.all([
    certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac, diasDeValidade: 3650 }),
    certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: CNPJ_EMIT, emissor: ac, diasDeValidade: 3650 }),
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
      const sim = criarSefazSim({ relogio: clock, uf: local.UF });
      const server: ServidorSefazSim = await iniciarServidorSefazSim(sim, {
        certificado: servidor.pem,
        chave: servidor.chavePem,
      });
      const real: Transporte = criarTransporte({ identidade: emitente.identidadeTls, acsAdicionais: [ac.pem] });
      fechar.push(async () => {
        await real.fechar();
        await server.fechar();
      });
      const client = criarClienteNfe({
        transporte: redirecionarParaSim(real, server.urlBase),
        assinador: emitente.assinador,
        ambiente: 'homologacao',
        uf: local.UF,
        relogio: clock,
      });

      const itens: ItemRtc[] = caso.op.itens.map((i) => ({ CST: i.cst, cClassTrib: i.cClassTrib, base: i.base }));
      // Sem `ibsCbs` nas opções: a calculadora padrão do montarNfe, com o dataset embarcado importado sob demanda.
      const r = await montarNfe(notaRtc(local, itens), opcoesRtc(clock));
      if (!r.ok) throw new Error(r.ocorrencias.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
      const assinada = await assinarNfe(r.valor, emitente.assinador);
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
