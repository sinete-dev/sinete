import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import type { Ocorrencia } from '@sinete/core';
import { contextoDeTempo, formatarVerProc, relogioFixo, relogioManual } from '@sinete/core';
import { conferirAssinatura } from '@sinete/core/xml';
import { aliquotasOficiais, comAliquotasInformadas } from '@sinete/ibs-cbs/aliquotas';
import { lerChaveAcesso, montarChaveAcesso } from '@sinete/validators';
import type { CalculadoraIbsCbs, DadosNfe, Item, NfeMontada, ResultadoMontagemNfe } from '../../src/index.ts';
import {
  assinarNfe,
  calculadoraIbsCbs,
  exigenciaRespTec,
  hashCsrt,
  montarNfe,
  rotuloDoCaminho,
  TipoPagamento,
  XNOME_HOMOLOGACAO,
} from '../../src/index.ts';
import { VERSAO_PACOTE } from '../../src/versao-gerada.ts';
import { CNPJ_DEST, CNPJ_EMIT, CPF, calculadoraFixa, EMISSAO, IE_SP, item, nota, opcoes } from '../helpers/nota.ts';
import { generateTestKeys } from '../helpers/test-keys.ts';

function ok(r: ResultadoMontagemNfe): NfeMontada {
  if (!r.ok) throw new Error(JSON.stringify(r.ocorrencias, null, 1));
  return r.valor;
}

function falha(r: ResultadoMontagemNfe): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

const codes = (r: ResultadoMontagemNfe): string[] => falha(r).map((i) => i.code);

type Obj = Record<string, unknown>;
const det = (n: NfeMontada, i = 0): Obj => n.infNFe.det[i] as unknown as Obj;
const imposto = (n: NfeMontada, i = 0): Record<string, Obj> => det(n, i).imposto as Record<string, Obj>;
const tot = (n: NfeMontada): Record<string, string> => n.infNFe.total.ICMSTot as unknown as Record<string, string>;
const ide = (n: NfeMontada): Record<string, unknown> => n.infNFe.ide as unknown as Record<string, unknown>;

describe('montarNfe: identificação e chave', () => {
  test('nota mínima: chave, Id, cDV e XML sem assinatura', async () => {
    const n = ok(await montarNfe(nota(), opcoes()));
    expect(n.chave).toHaveLength(44);
    expect(n.id).toBe(`NFe${n.chave}`);
    expect(n.cDV).toBe(n.chave.slice(43));
    expect(n.chave.slice(0, 2)).toBe('35');
    expect(n.chave.slice(2, 6)).toBe('2609');
    expect(n.chave.slice(6, 20)).toBe(CNPJ_EMIT);
    expect(n.chave.slice(20, 22)).toBe('55');
    expect(n.chave.slice(22, 25)).toBe('001');
    expect(n.chave.slice(25, 34)).toBe('000000123');
    expect(n.chave.slice(34, 35)).toBe('1');
    expect(n.chave.slice(35, 43)).toBe(n.cNF);
    expect(lerChaveAcesso(n.chave, { emissao: true }).ok).toBe(true);
    expect(n.dhEmi).toBe('2026-09-26T10:00:00-03:00');
    expect(n.tpEmis).toBe('1');
    expect(n.xml.startsWith('<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe')).toBe(true);
    expect(n.xml).not.toContain('Signature');
    expect(ide(n)).toMatchObject({
      tpAmb: '2',
      idDest: '1',
      indFinal: '1',
      indPres: '9',
      indIntermed: '0',
      procEmi: '0',
    });
    expect(n.infNFe.transp).toEqual({ modFrete: '9' });
    expect(n.infNFe.pag).toEqual({ detPag: [{ tPag: '90', vPag: '0.00' }] });
  });

  test('verProc padrão é "sinete <versão do pacote>"; override explícito prevalece', async () => {
    const padrao = ok(await montarNfe(nota(), opcoes()));
    expect(ide(padrao).verProc).toBe(formatarVerProc('sinete', VERSAO_PACOTE));
    expect((ide(padrao).verProc as string).length).toBeLessThanOrEqual(20);

    const override = ok(await montarNfe(nota(), opcoes({ verProc: 'meu-erp 9.9.9' })));
    expect(ide(override).verProc).toBe('meu-erp 9.9.9');
  });

  test('o fuso vem da UF do emitente (AM, UTC-4)', async () => {
    const base = nota();
    const n = ok(
      await montarNfe(
        {
          ...base,
          emitente: {
            CNPJ: CNPJ_EMIT,
            xNome: 'EMPRESA SINTETICA LTDA',
            IE: '040000001',
            CRT: '3',
            endereco: { ...base.emitente.endereco, UF: 'AM', cMun: '1302603' },
          },
        },
        opcoes(),
      ),
    );
    expect(n.dhEmi).toBe('2026-09-26T09:00:00-04:00');
    expect(n.chave.slice(0, 2)).toBe('13');
  });

  test('o fuso pode vir das opções', async () => {
    expect(ok(await montarNfe(nota(), opcoes({ deslocamentoMin: -120 }))).dhEmi).toBe('2026-09-26T11:00:00-02:00');
  });

  test('PL por vigência: homologação em set/2026 usa PL_010f; produção usa PL_010e', async () => {
    expect(ok(await montarNfe(nota(), opcoes())).pl.pl).toStartWith('PL_010f');
    const prod = ok(await montarNfe(nota(), opcoes({ ambiente: 'producao' })));
    expect(prod.pl.pl).toStartWith('PL_010e');
    expect(prod.infNFe.ide.tpAmb).toBe('1');
    expect(ok(await montarNfe(nota(), opcoes({}, '2026-08-15T10:00:00-03:00'))).pl.pl).toStartWith('PL_010e');
  });

  test('em homologação o nome do destinatário é o literal da RV E04-20; em produção, o informado', async () => {
    expect(ok(await montarNfe(nota(), opcoes())).infNFe.dest?.xNome).toBe(XNOME_HOMOLOGACAO);
    expect(ok(await montarNfe(nota(), opcoes({ ambiente: 'producao' }))).infNFe.dest?.xNome).toBe(
      'CONSUMIDOR SINTETICO',
    );
  });

  test('cNF informado é usado; o que a RV B03-10 proíbe vira chave_invalida', async () => {
    expect(ok(await montarNfe(nota({ cNF: '31415926' }), opcoes())).cNF).toBe('31415926');
    expect(codes(await montarNfe(nota({ cNF: '00000123' }), opcoes()))).toEqual(['chave_invalida']);
    expect(codes(await montarNfe(nota({ cNF: '123' }), opcoes()))).toEqual(['campo_invalido']);
  });

  test('cNF aleatório: sorteia de novo quando cai numa sequência proibida', async () => {
    let chamadas = 0;
    const random = (b: Uint8Array): Uint8Array => {
      chamadas++;
      if (chamadas > 1) b.set([1, 2, 3, 4]);
      else b.fill(0);
      return b;
    };
    const n = ok(await montarNfe(nota(), opcoes({ aleatorio: random })));
    expect(chamadas).toBe(2);
    expect(n.cNF).toBe(String((1 * 2 ** 24 + 2 * 2 ** 16 + 3 * 2 ** 8 + 4) % 100_000_000).padStart(8, '0'));
    const sempreZero = (b: Uint8Array): Uint8Array => b.fill(0);
    expect(codes(await montarNfe(nota(), opcoes({ aleatorio: sempreZero })))).toEqual(['chave_invalida']);
  });

  test('sem random nas opções, usa o WebCrypto', async () => {
    const o = opcoes();
    const { aleatorio: _r, ...semRandom } = o;
    expect(ok(await montarNfe(nota(), semRandom)).cNF).toMatch(/^\d{8}$/);
  });

  test('série e número fora da faixa', async () => {
    expect(codes(await montarNfe(nota({ serie: 1000 }), opcoes()))).toContain('serie_invalida');
    expect(codes(await montarNfe(nota({ nNF: 0 }), opcoes()))).toContain('campo_invalido');
  });

  test('produtor rural pessoa física: CPF e séries 920 a 969', async () => {
    const base = nota();
    const { CNPJ: _c, ...resto } = base.emitente as { CNPJ: string } & Omit<DadosNfe['emitente'], 'CNPJ'>;
    const emitente = { ...resto, CPF } as DadosNfe['emitente'];
    expect(codes(await montarNfe({ ...base, emitente }, opcoes()))).toContain('serie_invalida');
    const n = ok(await montarNfe({ ...base, emitente, serie: 920 }, opcoes()));
    expect(n.chave.slice(6, 20)).toBe(`000${CPF}`);
    expect(n.infNFe.emit.CPF).toBe(CPF);
  });

  test('documento do emitente inválido', async () => {
    const base = nota();
    const r = await montarNfe(
      { ...base, emitente: { ...base.emitente, CNPJ: '11222333000180' } as DadosNfe['emitente'] },
      opcoes(),
    );
    expect(falha(r)[0]?.caminho).toBe('emitente.CNPJ');
  });

  test('modelo fora de 55 e 65 e UF inválida', async () => {
    expect(codes(await montarNfe(nota({ modelo: '57' as '55' }), opcoes()))).toEqual(['modelo_nao_suportado']);
    const base = nota();
    const r = await montarNfe(
      { ...base, emitente: { ...base.emitente, endereco: { ...base.emitente.endereco, UF: 'XX' as 'SP' } } },
      opcoes(),
    );
    expect(codes(r)).toEqual(['campo_invalido']);
  });

  test('contingência SVC: tpEmis, dhCont e xJust', async () => {
    const contingencia = {
      tpEmis: '6' as const,
      dhCont: relogioFixo('2026-09-26T09:30:00-03:00').agora(),
      xJust: 'SEFAZ AUTORIZADORA FORA DO AR',
    };
    const n = ok(await montarNfe(nota({ contingencia }), opcoes()));
    expect(n.tpEmis).toBe('6');
    expect(n.chave.slice(34, 35)).toBe('6');
    expect(ide(n)).toMatchObject({ tpEmis: '6', dhCont: '2026-09-26T09:30:00-03:00', xJust: contingencia.xJust });
    const curta = await montarNfe(nota({ contingencia: { ...contingencia, xJust: 'CURTA' } }), opcoes());
    expect(codes(curta)).toEqual(['contingencia_invalida']);
    const futura = await montarNfe(
      nota({ contingencia: { ...contingencia, dhCont: relogioFixo('2026-09-26T11:00:00-03:00').agora() } }),
      opcoes(),
    );
    expect(codes(futura)).toEqual(['contingencia_invalida']);
  });

  test('dhSaiEnt no fuso do emitente, dPrevEntrega e verProc', async () => {
    const n = ok(
      await montarNfe(
        nota({ dhSaiEnt: relogioFixo('2026-09-26T15:00:00Z').agora(), dPrevEntrega: '2026-09-30' }),
        opcoes({ verProc: 'meu-erp 1.0' }),
      ),
    );
    expect(ide(n)).toMatchObject({
      dhSaiEnt: '2026-09-26T12:00:00-03:00',
      dPrevEntrega: '2026-09-30',
      verProc: 'meu-erp 1.0',
    });
  });

  test('texto longo aparece como ocorrência da entrada, antes de assinar', async () => {
    const issues = falha(await montarNfe(nota({ natOp: 'X'.repeat(61) }), opcoes()));
    expect(issues[0]).toMatchObject({ code: 'campo_invalido', origem: 'entrada' });
  });
});

describe('montarNfe: destinatário', () => {
  test('destinatário é obrigatório na NF-e', async () => {
    const { destinatario: _d, ...semDest } = nota();
    expect(codes(await montarNfe(semDest, opcoes()))).toContain('campo_obrigatorio');
  });

  test('contribuinte em outra UF: idDest 2, IE validada, indFinal 0', async () => {
    const n = ok(
      await montarNfe(
        nota({
          destinatario: {
            CNPJ: CNPJ_DEST,
            xNome: 'CLIENTE SINTETICO',
            indIEDest: '1',
            // IE do RJ sintética, com o dígito do roteiro da UF (pesos 2, 7, 6, 5, 4, 3, 2, módulo 11).
            IE: '12345674',
            endereco: {
              xLgr: 'RUA',
              nro: '1',
              xBairro: 'BAIRRO',
              cMun: '3304557',
              xMun: 'RIO DE JANEIRO',
              UF: 'RJ',
            },
          },
          idDest: '2',
        }),
        opcoes(),
      ),
    );
    expect(n.infNFe.dest).toMatchObject({ CNPJ: CNPJ_DEST, IE: '12345674', indIEDest: '1' });
    expect(ide(n)).toMatchObject({ idDest: '2', indFinal: '0' });
  });

  test('UF de destino diferente: idDest 2 por padrão', async () => {
    const base = nota();
    const dest = base.destinatario as NonNullable<DadosNfe['destinatario']>;
    const n = ok(
      await montarNfe(
        {
          ...base,
          destinatario: {
            ...dest,
            endereco: { xLgr: 'RUA', nro: '1', xBairro: 'BAIRRO', cMun: '3304557', xMun: 'RIO DE JANEIRO', UF: 'RJ' },
          },
        },
        opcoes(),
      ),
    );
    expect(ide(n).idDest).toBe('2');
  });

  test('exterior: idEstrangeiro, UF EX, idDest 3', async () => {
    const n = ok(
      await montarNfe(
        nota({
          destinatario: {
            idEstrangeiro: 'AB123',
            xNome: 'FOREIGN BUYER',
            indIEDest: '9',
            endereco: {
              exterior: true,
              xLgr: 'MAIN ST',
              nro: '1',
              xBairro: 'DOWNTOWN',
              cPais: '2496',
              xPais: 'ESTADOS UNIDOS',
              fone: '1-555-0100',
            },
          },
        }),
        opcoes(),
      ),
    );
    expect(n.infNFe.dest).toMatchObject({ idEstrangeiro: 'AB123' });
    expect(n.infNFe.dest?.enderDest).toMatchObject({
      cMun: '9999999',
      xMun: 'EXTERIOR',
      UF: 'EX',
      cPais: '2496',
      fone: '15550100',
    });
    expect(ide(n).idDest).toBe('3');
  });

  test('regras do indIEDest', async () => {
    const base = nota();
    const dest = base.destinatario as NonNullable<DadosNfe['destinatario']>;
    expect(codes(await montarNfe({ ...base, destinatario: { ...dest, indIEDest: '1' } }, opcoes()))).toContain(
      'campo_obrigatorio',
    );
    expect(
      codes(await montarNfe({ ...base, destinatario: { ...dest, indIEDest: '2', IE: IE_SP } }, opcoes())),
    ).toContain('combinacao_invalida');
    const ieRuim = await montarNfe(
      { ...base, destinatario: { ...dest, indIEDest: '1', IE: '110042490115' } },
      opcoes(),
    );
    expect(falha(ieRuim)[0]?.caminho).toBe('destinatario.IE');
  });

  test('locais de retirada e entrega, autXML', async () => {
    const local = {
      CNPJ: CNPJ_DEST,
      xLgr: 'RUA',
      nro: '1',
      xBairro: 'BAIRRO',
      cMun: '3550308',
      xMun: 'SAO PAULO',
      UF: 'SP' as const,
    };
    const n = ok(
      await montarNfe(
        nota({ retirada: local, entrega: { ...local, xNome: 'DEPOSITO' }, autXML: [{ CPF }, { CNPJ: CNPJ_DEST }] }),
        opcoes(),
      ),
    );
    expect(n.infNFe.entrega).toMatchObject({ CNPJ: CNPJ_DEST, xNome: 'DEPOSITO', cPais: '1058' });
    expect(n.infNFe.autXML).toEqual([{ CPF }, { CNPJ: CNPJ_DEST }]);
    const muitos = Array.from({ length: 11 }, () => ({ CPF }));
    expect(codes(await montarNfe(nota({ autXML: muitos }), opcoes()))).toContain('campo_invalido');
  });
});

describe('montarNfe: referências', () => {
  const chaveRef = montarChaveAcesso({
    cUF: '35',
    aamm: '2608',
    emitente: CNPJ_EMIT,
    mod: '55',
    serie: '1',
    nNF: '99',
    tpEmis: '1',
    cNF: '31415926',
  });

  test('NF-e, CT-e, NF modelo 1 e ECF referenciados', async () => {
    const n = ok(
      await montarNfe(
        nota({
          finNFe: '4',
          referenciadas: [
            { refNFe: chaveRef },
            { refCTe: chaveRef },
            { refNF: { cUF: '35', AAMM: '2001', CNPJ: CNPJ_EMIT, mod: '01', serie: '1', nNF: '1' } },
            { refECF: { mod: '2D', nECF: '1', nCOO: '1' } },
          ],
        }),
        opcoes(),
      ),
    );
    expect(ide(n).NFref).toHaveLength(4);
    expect(ide(n).indPres).toBe('9');
    expect(
      ok(await montarNfe(nota({ finNFe: '2', referenciadas: [{ refNFe: chaveRef }] }), opcoes())).infNFe.ide.indPres,
    ).toBe('0');
  });

  test('refNFeSig: chave com cNF zerado, sem conferência do DV (NT 2022.003)', async () => {
    const sig = `${chaveRef.slice(0, 35)}00000000${chaveRef.slice(43)}`;
    expect(ide(ok(await montarNfe(nota({ referenciadas: [{ refNFeSig: sig }] }), opcoes()))).NFref).toEqual([
      { refNFeSig: sig },
    ]);
    expect(codes(await montarNfe(nota({ referenciadas: [{ refNFeSig: chaveRef }] }), opcoes()))).toEqual([
      'chave_invalida',
    ]);
  });

  test('chave referenciada inválida', async () => {
    const r = await montarNfe(
      nota({ referenciadas: [{ refNFe: `${chaveRef.slice(0, 43)}${(Number(chaveRef.slice(43)) + 1) % 10}` }] }),
      opcoes(),
    );
    expect(falha(r)[0]?.caminho).toBe('referenciadas[0].refNFe');
  });

  test('refNFP modelo 04 é vedado para notas depois do fim do modelo (Ajuste SINIEF 10/2022)', async () => {
    const refNFP = { cUF: '35', AAMM: '2601', CPF, IE: IE_SP, mod: '04' as const, serie: 1, nNF: 10 };
    expect(codes(await montarNfe(nota({ referenciadas: [{ refNFP }] }), opcoes()))).toEqual(['referencia_vedada']);
    const antiga = ok(await montarNfe(nota({ referenciadas: [{ refNFP: { ...refNFP, AAMM: '2512' } }] }), opcoes()));
    expect(ide(antiga).NFref).toEqual([
      { refNFP: { cUF: '35', AAMM: '2512', CPF, IE: IE_SP, mod: '04', serie: '1', nNF: '10' } },
    ]);
  });

  test('refNFP modelo 01 não tem vedação', async () => {
    const refNFP = { cUF: '35', AAMM: '2608', CNPJ: CNPJ_DEST, IE: 'ISENTO', mod: '01' as const, serie: '0', nNF: '5' };
    expect(ok(await montarNfe(nota({ referenciadas: [{ refNFP }] }), opcoes())).infNFe.ide.NFref).toHaveLength(1);
  });
});

describe('montarNfe: tributos do item e totais', () => {
  test('IPI tributado por alíquota e por unidade, IPI não tributado', async () => {
    const it = (ipi: NonNullable<Item['impostos']['ipi']>): Item => {
      const b = item();
      return { ...b, impostos: { ...b.impostos, ipi } };
    };
    const a = ok(await montarNfe(nota({ itens: [it({ cEnq: '999', CST: '50', pIPI: '10' })] }), opcoes()));
    expect(imposto(a).IPI).toEqual({ cEnq: '999', IPITrib: { CST: '50', vBC: '15.00', pIPI: '10.00', vIPI: '1.50' } });
    expect(tot(a)).toMatchObject({ vIPI: '1.50', vNF: '16.50' });
    const b = ok(
      await montarNfe(nota({ itens: [it({ cEnq: '999', CST: '50', qUnid: '10', vUnid: '0.25' })] }), opcoes()),
    );
    expect(imposto(b).IPI).toMatchObject({ IPITrib: { CST: '50', qUnid: '10', vUnid: '0.2500', vIPI: '2.50' } });
    const c = ok(await montarNfe(nota({ itens: [it({ cEnq: '999', CST: '53' })] }), opcoes()));
    expect(imposto(c).IPI).toEqual({ cEnq: '999', IPINT: { CST: '53' } });
  });

  test('PIS e COFINS: alíquota, quantidade, não tributado e outras', async () => {
    const it = (pis: NonNullable<Item['impostos']['pis']>, cofins: NonNullable<Item['impostos']['cofins']>): Item => {
      const b = item();
      return { ...b, impostos: { ...b.impostos, pis, cofins } };
    };
    const a = ok(
      await montarNfe(nota({ itens: [it({ CST: '03', qBCProd: '10', vAliqProd: '0.1' }, { CST: '07' })] }), opcoes()),
    );
    expect(imposto(a).PIS).toEqual({ PISQtde: { CST: '03', qBCProd: '10', vAliqProd: '0.1', vPIS: '1.00' } });
    expect(imposto(a).COFINS).toEqual({ COFINSNT: { CST: '07' } });
    expect(tot(a)).toMatchObject({ vPIS: '1.00', vCOFINS: '0.00' });
    const b = ok(
      await montarNfe(
        nota({
          itens: [it({ CST: '99', vBC: '15', aliquota: '0.65' }, { CST: '99', qBCProd: '10', vAliqProd: '0.3' })],
        }),
        opcoes(),
      ),
    );
    expect(imposto(b).PIS).toEqual({ PISOutr: { CST: '99', vBC: '15.00', pPIS: '0.65', vPIS: '0.10' } });
    expect(imposto(b).COFINS).toEqual({ COFINSOutr: { CST: '99', qBCProd: '10', vAliqProd: '0.3', vCOFINS: '3.00' } });
  });

  test('PIS-ST e COFINS-ST: só compõem o total com indSoma 1', async () => {
    const b = item();
    const it: Item = {
      ...b,
      impostos: {
        ...b.impostos,
        pisSt: { vBC: '15', aliquota: '1', indSoma: '1' },
        cofinsSt: { qBCProd: '10', vAliqProd: '0.1', indSoma: '0' },
      },
    };
    const n = ok(await montarNfe(nota({ itens: [it] }), opcoes()));
    expect(imposto(n).PISST).toEqual({ vBC: '15.00', pPIS: '1.00', vPIS: '0.15', indSomaPISST: '1' });
    expect(imposto(n).COFINSST).toEqual({
      qBCProd: '10.0000',
      vAliqProd: '0.1000',
      vCOFINS: '1.00',
      indSomaCOFINSST: '0',
    });
    expect(tot(n).vNF).toBe('15.15');
  });

  test('imposto de importação soma no vNF', async () => {
    const b = item();
    const it: Item = { ...b, impostos: { ...b.impostos, ii: { vBC: '15', vDespAdu: '1', vII: '3', vIOF: '0' } } };
    const n = ok(await montarNfe(nota({ itens: [it] }), opcoes()));
    expect(imposto(n).II).toEqual({ vBC: '15.00', vDespAdu: '1.00', vII: '3.00', vIOF: '0.00' });
    expect(tot(n)).toMatchObject({ vII: '3.00', vNF: '18.00' });
  });

  test('ICMS para a UF de destino: totais só quando algum item tem o grupo', async () => {
    const b = item();
    const it: Item = {
      ...b,
      impostos: {
        ...b.impostos,
        icmsUfDest: {
          vBCUFDest: '15',
          pFCPUFDest: '2',
          pICMSUFDest: '18',
          pICMSInter: '12.00',
          vFCPUFDest: '0.30',
          vICMSUFDest: '0.90',
        },
      },
    };
    const n = ok(await montarNfe(nota({ itens: [it] }), opcoes()));
    expect(imposto(n).ICMSUFDest).toMatchObject({ pICMSInterPart: '100.00', vICMSUFRemet: '0.00', vFCPUFDest: '0.30' });
    expect(tot(n)).toMatchObject({ vFCPUFDest: '0.30', vICMSUFDest: '0.90', vICMSUFRemet: '0.00' });
    const { vFCPUFDest: _v, ...semVUfDest } = it.impostos.icmsUfDest as NonNullable<Item['impostos']['icmsUfDest']>;
    const semV: Item = { ...it, impostos: { ...it.impostos, icmsUfDest: semVUfDest } };
    expect(codes(await montarNfe(nota({ itens: [semV] }), opcoes()))).toContain('campo_obrigatorio');
  });

  test('ISSQN (NF-e conjugada): vServ fora do vProd, ISSQNtot com a competência', async () => {
    const servico: Item = {
      produto: {
        cProd: 'S1',
        xProd: 'SERVICO SINTETICO',
        NCM: '00',
        CFOP: '5933',
        uCom: 'UN',
        qCom: '1',
        vUnCom: '100',
      },
      impostos: {
        issqn: {
          vBC: '100',
          vAliq: '5',
          cMunFG: '3550308',
          cListServ: '14.01',
          indISS: '1',
          indIncentivo: '2',
          vISSRet: '5',
          vDeducao: '10',
        },
        pis: { CST: '01', vBC: '100', aliquota: '0.65' },
        cofins: { CST: '01', vBC: '100', aliquota: '3' },
      },
    };
    const n = ok(await montarNfe(nota({ itens: [item(), servico] }), opcoes()));
    expect(imposto(n, 1).ISSQN).toMatchObject({ vBC: '100.00', vAliq: '5.00', vISSQN: '5.00', cListServ: '14.01' });
    expect(tot(n)).toMatchObject({ vProd: '15.00', vPIS: '0.25', vNF: '115.00' });
    expect(n.infNFe.total.ISSQNtot).toEqual({
      vServ: '100.00',
      vBC: '100.00',
      vISS: '5.00',
      vPIS: '0.65',
      vCOFINS: '3.00',
      dCompet: '2026-09-26',
      vDeducao: '10.00',
      vISSRet: '5.00',
    });
  });

  test('ICMS e ISSQN no mesmo item são exclusivos; item sem ICMS nem ISSQN', async () => {
    const b = item();
    const ambos: Item = {
      ...b,
      impostos: {
        ...b.impostos,
        issqn: { vBC: '1', vAliq: '1', cMunFG: '3550308', cListServ: '14.01', indISS: '1', indIncentivo: '2' },
      },
    };
    expect(codes(await montarNfe(nota({ itens: [ambos] }), opcoes()))).toContain('combinacao_invalida');
    const nenhum: Item = { ...b, impostos: { pis: { CST: '07' }, cofins: { CST: '07' } } };
    expect(codes(await montarNfe(nota({ itens: [nenhum] }), opcoes()))).toContain('campo_obrigatorio');
  });

  test('frete, seguro, desconto e outras despesas entram na base e no vNF', async () => {
    const b = item();
    const it: Item = { ...b, produto: { ...b.produto, vFrete: '2', vSeg: '1', vDesc: '3', vOutro: '0.5' } };
    const semPis: Item = {
      ...it,
      impostos: { icms: { CST: '00', orig: '0', pICMS: '10' }, pis: { CST: '07' }, cofins: { CST: '07' } },
    };
    const n = ok(await montarNfe(nota({ itens: [semPis] }), opcoes()));
    // vOp = 15 + 2 + 1 + 0,5 - 3 = 15,50
    expect(imposto(n).ICMS).toMatchObject({ ICMS00: { vBC: '15.50', vICMS: '1.55' } });
    expect(tot(n)).toMatchObject({ vFrete: '2.00', vSeg: '1.00', vDesc: '3.00', vOutro: '0.50', vNF: '15.50' });
    expect(det(n).prod).toMatchObject({ vFrete: '2.00', vSeg: '1.00', vDesc: '3.00', vOutro: '0.50' });
  });

  test('indTot 0: o item não compõe vProd nem vNF', async () => {
    const b = item();
    const fora: Item = { ...b, produto: { ...b.produto, indTot: '0' } };
    const n = ok(await montarNfe(nota({ itens: [item(), fora] }), opcoes()));
    expect(tot(n)).toMatchObject({ vProd: '15.00', vNF: '15.00', vICMS: '5.40' });
  });

  test('unidade tributável diferente: vUnTrib = vProd / qTrib', async () => {
    const b = item();
    const it: Item = { ...b, produto: { ...b.produto, uTrib: 'CX', qTrib: '3' } };
    expect(det(ok(await montarNfe(nota({ itens: [it] }), opcoes()))).prod).toMatchObject({
      uTrib: 'CX',
      qTrib: '3',
      vUnTrib: '5',
    });
    const zero: Item = { ...b, produto: { ...b.produto, uTrib: 'CX', qTrib: '0' } };
    // qTrib zero não fecha qTrib × vUnTrib = vProd na NF-e normal (rejeição 630); na complementar passa
    expect(codes(await montarNfe(nota({ itens: [zero] }), opcoes()))).toEqual(['valor_divergente']);
    expect(det(ok(await montarNfe(nota({ finNFe: '2', itens: [zero] }), opcoes()))).prod).toMatchObject({
      vUnTrib: '0',
    });
    const dado: Item = { ...b, produto: { ...b.produto, uTrib: 'CX', qTrib: '3', vUnTrib: '5.003' } };
    expect(det(ok(await montarNfe(nota({ itens: [dado] }), opcoes()))).prod).toMatchObject({ vUnTrib: '5.003' });
  });

  test('vProd divergente de qCom × vUnCom', async () => {
    const b = item();
    const it: Item = { ...b, produto: { ...b.produto, vProd: '16' } };
    expect(falha(await montarNfe(nota({ itens: [it] }), opcoes()))[0]).toMatchObject({
      code: 'valor_divergente',
      caminho: 'itens[0].produto.vProd',
    });
  });

  test('vTotTrib, devolução de IPI, infAdProd, obsItem e DFe referenciado no item', async () => {
    const chave = montarChaveAcesso({
      cUF: '35',
      aamm: '2608',
      emitente: CNPJ_EMIT,
      mod: '55',
      serie: '1',
      nNF: '9',
      tpEmis: '1',
      cNF: '31415926',
    });
    const b = item();
    const it: Item = {
      ...b,
      impostos: { ...b.impostos, vTotTrib: '4.5' },
      impostoDevol: { pDevol: '100', vIPIDevol: '1.5' },
      infAdProd: 'LOTE 1',
      obsItem: { obsCont: { xCampo: 'X', xTexto: 'Y' } } as unknown as NonNullable<Item['obsItem']>,
      DFeReferenciado: { chaveAcesso: chave, nItem: 1 },
    };
    const n = ok(await montarNfe(nota({ finNFe: '4', referenciadas: [{ refNFe: chave }], itens: [it] }), opcoes()));
    expect(tot(n)).toMatchObject({ vTotTrib: '4.50', vIPIDevol: '1.50', vNF: '16.50' });
    expect(det(n)).toMatchObject({
      impostoDevol: { pDevol: '100.00', IPI: { vIPIDevol: '1.50' } },
      infAdProd: 'LOTE 1',
    });
    expect(det(n).DFeReferenciado).toEqual({ chaveAcesso: chave, nItem: '1' });
    const ruim: Item = { ...it, DFeReferenciado: { chaveAcesso: '123' } };
    expect(falha(await montarNfe(nota({ itens: [ruim] }), opcoes()))[0]?.caminho).toBe(
      'itens[0].DFeReferenciado.chaveAcesso',
    );
  });

  test('quantidade de itens', async () => {
    expect(codes(await montarNfe(nota({ itens: [] }), opcoes()))).toContain('itens_limite');
  });

  test('o modo de arredondamento por família pode ser trocado', async () => {
    const b = item();
    const it: Item = {
      ...b,
      produto: { ...b.produto, vUnCom: '1.25' },
      impostos: { ...b.impostos, icms: { CST: '00', orig: '0', pICMS: '1' } },
    };
    // 12,50 × 1% = 0,125
    const up = ok(await montarNfe(nota({ itens: [it] }), opcoes()));
    expect(imposto(up).ICMS).toMatchObject({ ICMS00: { vICMS: '0.13' } });
    const even = ok(await montarNfe(nota({ itens: [it] }), opcoes({ arredondamento: { icms: 'HALF_EVEN' } })));
    expect(imposto(even).ICMS).toMatchObject({ ICMS00: { vICMS: '0.12' } });
  });
});

describe('montarNfe: IBS e CBS pela calculadora', () => {
  const classificado = (): Item => {
    const b = item();
    return { ...b, impostos: { ...b.impostos, ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001' } } } };
  };

  test('grupo IBSCBS do item, IBSCBSTot e vNFTot; em 2026 o vItem não soma IBS/CBS', async () => {
    const pedidos: unknown[] = [];
    const calc: CalculadoraIbsCbs = {
      calcular(req) {
        pedidos.push(req);
        return calculadoraFixa.calcular(req);
      },
    };
    const n = ok(await montarNfe(nota({ itens: [classificado(), item()] }), opcoes({ ibsCbs: calc })));
    expect(imposto(n).IBSCBS).toMatchObject({
      CST: '000',
      cClassTrib: '000001',
      gIBSCBS: { vBC: '15.00', vIBS: '0.02' },
    });
    expect(imposto(n, 1).IBSCBS).toBeUndefined();
    expect(n.infNFe.total.IBSCBSTot).toMatchObject({
      vBCIBSCBS: '15.00',
      gIBS: { vIBS: '0.02' },
      gCBS: { vCBS: '0.14' },
    });
    expect(det(n).vItem).toBe('15.00');
    expect(det(n, 1).vItem).toBe('15.00');
    expect(n.infNFe.total.vNFTot).toBe('30.00');
    const pedido = pedidos[0] as { nota: Record<string, unknown>; itens: Record<string, unknown>[] };
    expect(pedido.nota).toMatchObject({
      ambiente: 'homologacao',
      mod: '55',
      indFinal: '1',
      emitente: { UF: 'SP', CRT: '3' },
    });
    expect(pedido.nota.destino).toEqual({ UF: 'SP', cMun: '3550308' });
    // O instante da emissão (o do dhEmi) vai junto, para a calculadora saber que regras da NT já valem.
    expect((pedido.nota.emissao as Date).getTime()).toBe(opcoes().tempo.emissao.agora().getTime());
    expect(pedido.itens).toHaveLength(1);
    expect(String(pedido.itens[0]?.vICMS)).toBe('2.7');
  });

  test('a partir de 2027 (fato gerador) o vItem soma IBS e CBS (NT 2025.002, VB01-10)', async () => {
    const time = contextoDeTempo({
      emissao: relogioFixo(EMISSAO),
      fatoGerador: relogioFixo('2027-01-04T10:00:00-03:00'),
    });
    const n = ok(await montarNfe(nota({ itens: [classificado()] }), opcoes({ ibsCbs: calculadoraFixa, tempo: time })));
    expect(det(n).vItem).toBe('15.16');
    expect(n.infNFe.total.vNFTot).toBe('15.16');
  });

  test('sem calculadora nas opções, calcula o motor do sinete (calculadoraIbsCbs)', async () => {
    // Sem vBC, a calculadora padrão não presume base (UB16-10 ainda sem regra publicada).
    expect(codes(await montarNfe(nota({ itens: [classificado()] }), opcoes()))).toEqual(['ibscbs_base_ausente']);
    const b = item();
    const comBase: Item = {
      ...b,
      impostos: { ...b.impostos, ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '15.00' } } },
    };
    const n = ok(await montarNfe(nota({ itens: [comBase] }), opcoes()));
    expect(imposto(n).IBSCBS).toMatchObject({
      CST: '000',
      cClassTrib: '000001',
      gIBSCBS: { vBC: '15.00', gCBS: { pCBS: '0.90', vCBS: '0.14' }, gIBSUF: { pIBSUF: '0.10', vIBSUF: '0.02' } },
    });
    expect(n.infNFe.total.IBSCBSTot?.vBCIBSCBS).toBe('15.00');
    expect(n.aliquotasInformadas).toBeUndefined();
  });

  const comBase = (): Item => {
    const b = item();
    return {
      ...b,
      impostos: { ...b.impostos, ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '15.00' } } },
    };
  };
  // 2029: ano em que nenhuma alíquota está publicada; emissão no mesmo dia, para as regras da NT serem as do ano.
  const em2029 = contextoDeTempo({ emissao: relogioFixo('2029-01-08T10:00:00-03:00') });

  test('alíquota desconhecida: uma ocorrência, no caminho do item, sem a ibscbs_calculo de cada item', async () => {
    const r = await montarNfe(nota({ itens: [comBase(), comBase()] }), opcoes({ tempo: em2029 }));
    expect(falha(r).map((i) => [i.caminho, i.code, i.origem])).toEqual([
      ['itens[0].impostos.ibsCbs', 'ibscbs_aliquota_desconhecida', 'montagem'],
    ]);
  });

  test('alíquota informada por quem integra: monta, sem recusar, e o resultado diz quais vieram de fora', async () => {
    const aliquotas = comAliquotasInformadas(aliquotasOficiais(), [
      { tributo: 'CBS', valor: '8.8', motivo: 'resolução publicada' },
      { tributo: 'IBSUF', valor: '17.7', motivo: 'lei estadual' },
      { tributo: 'IBSMun', valor: '2.5', motivo: 'lei municipal' },
    ]);
    const n = ok(
      await montarNfe(
        nota({ itens: [comBase(), item()] }),
        opcoes({ tempo: em2029, ibsCbs: calculadoraIbsCbs({ aliquotas }) }),
      ),
    );
    expect(imposto(n).IBSCBS).toMatchObject({ gIBSCBS: { gCBS: { pCBS: '8.80' } } });
    expect(n.aliquotasInformadas).toEqual([
      { nItem: 1, tributo: 'CBS', valor: '8.8', motivo: 'resolução publicada' },
      { nItem: 1, tributo: 'IBSUF', valor: '17.7', motivo: 'lei estadual' },
      { nItem: 1, tributo: 'IBSMun', valor: '2.5', motivo: 'lei municipal' },
    ]);
  });

  test('a calculadora não devolve o item, ou devolve ocorrências', async () => {
    const vazia: CalculadoraIbsCbs = { calcular: () => ({ itens: [] }) };
    expect(codes(await montarNfe(nota({ itens: [classificado()] }), opcoes({ ibsCbs: vazia })))).toEqual([
      'ibscbs_calculo',
    ]);
    const reclama: CalculadoraIbsCbs = {
      calcular: async () => ({
        itens: [],
        ocorrencias: [
          { caminho: 'itens[0].impostos.ibsCbs', code: 'ibscbs_calculo', mensagem: 'cClassTrib desconhecido' },
        ],
      }),
    };
    // A causa que a calculadora deu basta: sem a segunda ocorrência por item.
    expect(codes(await montarNfe(nota({ itens: [classificado()] }), opcoes({ ibsCbs: reclama })))).toEqual([
      'ibscbs_calculo',
    ]);
  });

  test('pedido leva vBC informado, destino da entrega, compra governamental e cMunFGIBS', async () => {
    let pedido: { nota: Record<string, unknown>; itens: Record<string, unknown>[] } | undefined;
    const calc: CalculadoraIbsCbs = {
      calcular(req) {
        pedido = req as unknown as typeof pedido;
        return calculadoraFixa.calcular(req);
      },
    };
    const b = classificado();
    const it: Item = {
      ...b,
      impostos: {
        ...b.impostos,
        ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '10', indDoacao: '1', cCredPres: '1' } },
      },
    };
    const entrega = {
      CNPJ: CNPJ_DEST,
      xLgr: 'RUA',
      nro: '1',
      xBairro: 'BAIRRO',
      cMun: '3304557',
      xMun: 'RIO DE JANEIRO',
      UF: 'RJ' as const,
    };
    const n = ok(
      await montarNfe(
        nota({
          itens: [it],
          entrega,
          cMunFGIBS: '3550308',
          gCompraGov: { tpEnteGov: '1', pRedutor: '10', tpOperGov: '1' },
        }),
        opcoes({ ibsCbs: calc }),
      ),
    );
    expect(ide(n).gCompraGov).toEqual({ tpEnteGov: '1', pRedutor: '10.00', tpOperGov: '1' });
    expect(pedido?.nota.destino).toEqual({ UF: 'RJ', cMun: '3304557' });
    expect(pedido?.nota.cMunFGIBS).toBe('3550308');
    expect(String((pedido?.nota.compraGov as { pRedutor: unknown } | undefined)?.pRedutor)).toBe('10');
    expect(String(pedido?.itens[0]?.vBC)).toBe('10');
    expect(pedido?.itens[0]).toMatchObject({ indDoacao: '1', cCredPres: '1' });
  });

  test('grupo IBSCBS pronto dispensa a calculadora', async () => {
    const b = item();
    const grupo = { CST: '410', cClassTrib: '410001' };
    const it: Item = {
      ...b,
      impostos: { ...b.impostos, ibsCbs: { grupo } as unknown as NonNullable<Item['impostos']['ibsCbs']> },
    };
    const n = ok(await montarNfe(nota({ itens: [it] }), opcoes()));
    expect(imposto(n).IBSCBS).toEqual(grupo);
    expect(n.infNFe.total.vNFTot).toBe('15.00');
  });
});

describe('montarNfe: pagamentoIgualTotal', () => {
  test('o único detPag recebe o vNF calculado, numa montagem só; o valor informado é ignorado', async () => {
    const entrada = nota({
      itens: [item(), item({ produto: { ...item().produto, cProd: 'P002', vUnCom: '2.35', qCom: '3' } })],
      pagamento: { detPag: [{ tPag: TipoPagamento.PIX_DINAMICO, vPag: '0' }] },
    });
    const n = ok(await montarNfe(entrada, opcoes({ pagamentoIgualTotal: true })));
    expect(tot(n).vNF).toBe('22.05');
    expect(n.infNFe.pag?.detPag).toEqual([{ tPag: '17', vPag: '22.05' }]);
    // Sem a opção, o valor informado vale como sempre.
    const sem = ok(await montarNfe(entrada, opcoes()));
    expect(sem.infNFe.pag?.detPag[0]?.vPag).toBe('0.00');
    // O valor informado nem é validado: é substituído.
    const lixo = nota({ pagamento: { detPag: [{ tPag: TipoPagamento.DINHEIRO, vPag: 'abc' }] } });
    expect(ok(await montarNfe(lixo, opcoes({ pagamentoIgualTotal: true }))).infNFe.pag?.detPag[0]?.vPag).toBe('15.00');
  });

  test('nenhum, mais de um detPag ou tPag 90 dão ocorrência pagamento_igual_total', async () => {
    const o = opcoes({ pagamentoIgualTotal: true });
    const dois = nota({
      pagamento: {
        detPag: [
          { tPag: TipoPagamento.PIX_DINAMICO, vPag: '10' },
          { tPag: TipoPagamento.DINHEIRO, vPag: '5' },
        ],
      },
    });
    expect(falha(await montarNfe(dois, o)).find((i) => i.code === 'pagamento_igual_total')?.caminho).toBe(
      'pagamento.detPag',
    );
    const { pagamento: _sem, ...semPagamento } = nota();
    expect(codes(await montarNfe(semPagamento, o))).toContain('pagamento_igual_total');
    const noventa = nota({ pagamento: { detPag: [{ tPag: TipoPagamento.SEM_PAGAMENTO, vPag: '0' }] } });
    expect(falha(await montarNfe(noventa, o)).find((i) => i.code === 'pagamento_igual_total')?.caminho).toBe(
      'pagamento.detPag[0].tPag',
    );
  });
});

describe('montarNfe: transporte, cobrança, pagamento e informações adicionais', () => {
  test('grupos completos', async () => {
    const n = ok(
      await montarNfe(
        nota({
          transporte: {
            modFrete: '0',
            transportador: {
              CNPJ: CNPJ_DEST,
              xNome: 'TRANSPORTADORA SINTETICA',
              IE: 'ISENTO',
              xEnder: 'R',
              xMun: 'SAO PAULO',
              UF: 'SP',
            },
            retTransp: { vServ: '100', vBCRet: '100', pICMSRet: '12', CFOP: '5352', cMunFG: '3550308' },
            veicTransp: { placa: 'ABC1D23', UF: 'SP' },
            volumes: [{ qVol: 2, esp: 'CAIXA', pesoL: '10.5', pesoB: '11', lacres: ['L1'] }],
          },
          cobranca: {
            fatura: { nFat: '123', vOrig: '15', vDesc: '1' },
            duplicatas: [
              { dVenc: '2026-10-26', vDup: '7' },
              { dVenc: '2026-11-26', vDup: '7' },
            ],
          },
          pagamento: {
            detPag: [
              { tPag: TipoPagamento.BOLETO, vPag: '14' },
              { tPag: TipoPagamento.OUTROS, xPag: 'PERMUTA', vPag: '1', indPag: '0' },
            ],
          },
          informacoesAdicionais: { infCpl: 'OBSERVACAO SINTETICA', infAdFisco: 'FISCO' },
          respTec: { CNPJ: CNPJ_EMIT, xContato: 'SUPORTE', email: 'suporte@example.com', fone: '(11) 5555-0100' },
        }),
        opcoes(),
      ),
    );
    expect(n.infNFe.transp).toMatchObject({
      modFrete: '0',
      transporta: { CNPJ: CNPJ_DEST, IE: 'ISENTO' },
      retTransp: { vServ: '100.00', vBCRet: '100.00', pICMSRet: '12.00', vICMSRet: '12.00' },
      vol: [{ qVol: '2', esp: 'CAIXA', pesoL: '10.500', pesoB: '11.000', lacres: [{ nLacre: 'L1' }] }],
    });
    expect(n.infNFe.cobr).toEqual({
      fat: { nFat: '123', vOrig: '15.00', vDesc: '1.00', vLiq: '14.00' },
      dup: [
        { nDup: '001', dVenc: '2026-10-26', vDup: '7.00' },
        { nDup: '002', dVenc: '2026-11-26', vDup: '7.00' },
      ],
    });
    expect(n.infNFe.pag?.detPag).toHaveLength(2);
    expect(n.infNFe.infAdic).toEqual({ infAdFisco: 'FISCO', infCpl: 'OBSERVACAO SINTETICA' });
    expect(n.infNFe.infRespTec).toEqual({
      CNPJ: CNPJ_EMIT,
      xContato: 'SUPORTE',
      email: 'suporte@example.com',
      fone: '1155550100',
    });
  });

  test('duplicatas demais; fatura só com vLiq', async () => {
    const dup = Array.from({ length: 121 }, () => ({ vDup: '1' }));
    expect(codes(await montarNfe(nota({ cobranca: { duplicatas: dup } }), opcoes()))).toContain('campo_invalido');
    const n = ok(await montarNfe(nota({ cobranca: { fatura: { vLiq: '15' } } }), opcoes()));
    expect(n.infNFe.cobr).toEqual({ fat: { vLiq: '15.00' } });
  });

  test('transportador sem documento e informações adicionais vazias', async () => {
    const n = ok(
      await montarNfe(
        nota({ transporte: { modFrete: '1', transportador: { xNome: 'AUTONOMO' } }, informacoesAdicionais: {} }),
        opcoes(),
      ),
    );
    expect(n.infNFe.transp).toEqual({ modFrete: '1', transporta: { xNome: 'AUTONOMO' } });
    expect(n.infNFe.infAdic).toBeUndefined();
  });
});

describe('responsável técnico e CSRT', () => {
  const respTec = { CNPJ: CNPJ_EMIT, xContato: 'SUPORTE', email: 'suporte@example.com', fone: '1155550100' };

  test('hashCSRT = Base64(SHA-1(CSRT + chave)) (NT 2018.005)', async () => {
    const csrt = 'G8063VRTNDMO886SFNK5LDUDEI24XJ22YIPO';
    const n = ok(await montarNfe(nota({ respTec: { ...respTec, csrt: { idCSRT: '01', CSRT: csrt } } }), opcoes()));
    const esperado = createHash('sha1')
      .update(csrt + n.chave)
      .digest('base64');
    expect(n.infNFe.infRespTec).toMatchObject({ idCSRT: '01', hashCSRT: esperado });
    expect(await hashCsrt(csrt, n.chave)).toBe(esperado);
    expect(n.xml).not.toContain(csrt);
  });

  test('exigência por UF como dado: PR exige desde 15/09/2025 em produção', () => {
    const antes = relogioFixo('2025-09-14T12:00:00-03:00').agora();
    const depois = relogioFixo('2025-09-15T12:00:00-03:00').agora();
    expect(exigenciaRespTec('PR', 'producao', antes)).toEqual({ infRespTec: 'opcional', csrt: 'opcional' });
    expect(exigenciaRespTec('PR', 'producao', depois)).toEqual({ infRespTec: 'obrigatorio', csrt: 'obrigatorio' });
    expect(exigenciaRespTec('SP', 'producao', depois)).toEqual({ infRespTec: 'opcional', csrt: 'opcional' });
  });

  test('exigências aplicadas pelo builder, e o padrão das opções', async () => {
    const exigencias = { infRespTec: 'obrigatorio' as const, csrt: 'obrigatorio' as const };
    expect(codes(await montarNfe(nota(), opcoes({ exigencias })))).toEqual(['resp_tec_obrigatorio']);
    expect(codes(await montarNfe(nota({ respTec }), opcoes({ exigencias })))).toEqual(['csrt_obrigatorio']);
    const n = ok(await montarNfe(nota(), opcoes({ respTec: { ...respTec, csrt: { idCSRT: '02', CSRT: 'X' } } })));
    expect(n.infNFe.infRespTec).toMatchObject({ idCSRT: '02' });
    expect(codes(await montarNfe(nota({ respTec: { ...respTec, CNPJ: '1' } }), opcoes()))).toContain(
      'cnpj_tamanho_invalido',
    );
  });
});

describe('assinarNfe', () => {
  test('assina por splice: a string montada é prefixo intacto e a assinatura confere', async () => {
    const keys = await generateTestKeys();
    const n = ok(await montarNfe(nota(), opcoes()));
    const assinada = await assinarNfe(n, keys.dataSigner);
    expect(assinada.startsWith(n.xml.slice(0, n.xml.length - '</infNFe></NFe>'.length))).toBe(true);
    expect(assinada.indexOf('<Signature')).toBeGreaterThan(assinada.indexOf('</infNFe>'));
    const v = await conferirAssinatura(assinada, { id: n.id, elemento: 'infNFe' });
    expect(v.ok).toBe(true);
  });
});

describe('bases informadas e notas não normais', () => {
  test('vBC informado prevalece sobre o padrão (a base legal varia), e a alíquota é aplicada sobre ele', async () => {
    const b = item();
    const it: Item = { ...b, impostos: { ...b.impostos, icms: { CST: '00', orig: '0', vBC: '16.50', pICMS: '18' } } };
    expect(imposto(ok(await montarNfe(nota({ itens: [it] }), opcoes()))).ICMS).toMatchObject({
      ICMS00: { vBC: '16.50', vICMS: '2.97' },
    });
  });

  test('complementar (finNFe 2): valores informados não são conferidos contra a conta', async () => {
    const b = item();
    const it: Item = {
      ...b,
      produto: { ...b.produto, qCom: '0', vUnCom: '0', vProd: '10' },
      impostos: { ...b.impostos, icms: { CST: '00', orig: '0', vBC: '0', pICMS: '0', vICMS: '5' } },
    };
    const n = ok(await montarNfe(nota({ finNFe: '2', itens: [it] }), opcoes()));
    expect(tot(n)).toMatchObject({ vProd: '10.00', vICMS: '5.00' });
    expect(codes(await montarNfe(nota({ itens: [it] }), opcoes()))).toEqual([
      'valor_divergente',
      'valor_divergente',
      'valor_divergente',
    ]);
  });

  test('devolução (finNFe 4): vProd não é conferido (RV I11 só na normal), os tributos são', async () => {
    const b = item();
    const it: Item = { ...b, produto: { ...b.produto, vProd: '14' } };
    const n = ok(await montarNfe(nota({ finNFe: '4', itens: [it] }), opcoes()));
    expect(tot(n).vProd).toBe('14.00');
  });
});

describe('grupos repassados e contexto da calculadora', () => {
  test('decimal malformado em grupo IBSCBS ou IS repassado vira ocorrência, não exceção', async () => {
    const b = item();
    const grupo = { CST: '000', cClassTrib: '000001', gIBSCBS: { vBC: 'abc' } };
    const it: Item = {
      ...b,
      impostos: {
        ...b.impostos,
        ibsCbs: { grupo } as unknown as NonNullable<Item['impostos']['ibsCbs']>,
        is: { vIS: '1,5' } as unknown as NonNullable<Item['impostos']['is']>,
      },
    };
    const issues = falha(await montarNfe(nota({ itens: [it] }), opcoes()));
    expect(issues.map((i) => [i.code, i.caminho])).toEqual([
      ['decimal_invalido', 'itens[0].impostos.ibsCbs.gIBSCBS.vBC'],
      ['decimal_invalido', 'itens[0].impostos.is.vIS'],
    ]);
    const vinda: CalculadoraIbsCbs = {
      calcular: ({ itens }) => ({ itens: itens.map((i) => ({ nItem: i.nItem, IBSCBS: grupo as never })) }),
    };
    const c = { ...b, impostos: { ...b.impostos, ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001' } } } };
    expect(codes(await montarNfe(nota({ itens: [c] }), opcoes({ ibsCbs: vinda })))).toEqual(['decimal_invalido']);
  });

  test('indPres e indFinal resolvidos uma vez: a calculadora vê o que vai no ide; pRedutor inválido aparece uma vez', async () => {
    let visto: Record<string, unknown> | undefined;
    const calc: CalculadoraIbsCbs = {
      calcular(req) {
        visto = req.nota as unknown as Record<string, unknown>;
        return calculadoraFixa.calcular(req);
      },
    };
    const b = item();
    const c: Item = {
      ...b,
      impostos: { ...b.impostos, ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001' } } },
    };
    const n = ok(await montarNfe(nota({ finNFe: '2', itens: [c] }), opcoes({ ibsCbs: calc })));
    expect(visto).toMatchObject({ indPres: '0', indFinal: '1', finNFe: '2' });
    expect(ide(n)).toMatchObject({ indPres: '0', indFinal: '1' });
    const r = await montarNfe(
      nota({ itens: [c], gCompraGov: { tpEnteGov: '1', pRedutor: 'x', tpOperGov: '1' } }),
      opcoes({ ibsCbs: calc }),
    );
    expect(falha(r).filter((i) => i.caminho === 'gCompraGov.pRedutor')).toHaveLength(1);
  });
});

test('texto com caractere proibido em XML vira ocorrência com o caminho da entrada, não exceção', async () => {
  const b = item();
  const it: Item = { ...b, produto: { ...b.produto, xProd: 'ABC\u0001DEF' } };
  expect(falha(await montarNfe(nota({ itens: [it], natOp: 'VENDA \uD800' }), opcoes()))).toEqual([
    expect.objectContaining({ caminho: 'natOp', code: 'campo_invalido', origem: 'entrada' }),
    expect.objectContaining({ caminho: 'itens[0].produto.xProd', code: 'campo_invalido', origem: 'entrada' }),
  ]);
});

test('texto fora do tipo do leiaute é conferido na entrada: tamanho, espaço nas pontas e caractere fora do TString', async () => {
  const b = item();
  const itens: Item[] = [
    { ...b, produto: { ...b.produto, xProd: 'X'.repeat(121) } },
    { ...b, produto: { ...b.produto, uCom: 'CAIXA12' }, infAdProd: 'peça \u2013 nova' },
    { ...b, produto: { ...b.produto, cProd: ' 1' } },
  ];
  const issues = falha(
    await montarNfe(
      nota({
        itens,
        informacoesAdicionais: { infCpl: 'X'.repeat(5001), obsCont: [{ xCampo: 'a', xTexto: 'X'.repeat(61) }] },
        transporte: { modFrete: '9', volumes: [{ marca: 'X'.repeat(61) }] },
      }),
      opcoes(),
    ),
  );
  expect(issues.map((i) => [i.caminho, i.code, i.origem, i.mensagem])).toEqual([
    ['itens[2].produto.cProd', 'campo_invalido', 'entrada', 'sem espaço no começo nem no fim'],
    ['itens[0].produto.xProd', 'campo_invalido', 'entrada', 'no máximo 120 caracteres (tem 121)'],
    ['itens[1].produto.uCom', 'campo_invalido', 'entrada', 'no máximo 6 caracteres (tem 7)'],
    ['itens[1].infAdProd', 'campo_invalido', 'entrada', 'caractere não aceito: “\u2013”'],
    ['transporte.volumes[0].marca', 'campo_invalido', 'entrada', 'no máximo 60 caracteres (tem 61)'],
    ['informacoesAdicionais.infCpl', 'campo_invalido', 'entrada', 'no máximo 5000 caracteres (tem 5001)'],
    ['informacoesAdicionais.obsCont[0].xTexto', 'campo_invalido', 'entrada', 'no máximo 60 caracteres (tem 61)'],
  ]);
  // O rótulo da entrada diz à pessoa o que corrigir.
  expect(rotuloDoCaminho('itens[0].produto.xProd')).toBe('Item 1, Descrição do produto');
});

test('grupo IBSCBS incompleto vira ocorrência de schema no item, antes dos totais', async () => {
  const b = item();
  const grupo = { CST: '000', cClassTrib: '000001', gIBSCBS: { vBC: '15.00' } };
  const it: Item = {
    ...b,
    impostos: { ...b.impostos, ibsCbs: { grupo } as unknown as NonNullable<Item['impostos']['ibsCbs']> },
  };
  const issues = falha(await montarNfe(nota({ itens: [it] }), opcoes()));
  expect(issues.length).toBeGreaterThan(0);
  expect(issues.every((i) => i.code === 'schema' && i.caminho.startsWith('itens[0].impostos.ibsCbs'))).toBe(true);
  expect(issues.map((i) => i.caminho)).toContain('itens[0].impostos.ibsCbs.gIBSCBS');
});

test('a partir de 2027 o vIS soma no item mesmo sem IBSCBS; o fato gerador é lido uma vez', async () => {
  const time = contextoDeTempo({
    emissao: relogioFixo(EMISSAO),
    fatoGerador: relogioFixo('2027-01-04T10:00:00-03:00'),
  });
  const b = item();
  const comIbs: Item = {
    ...b,
    impostos: { ...b.impostos, ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001' } } },
  };
  const is = { CSTIS: '000', cClassTribIS: '000001', vBCIS: '15.00', pIS: '10.0000', vIS: '1.50' };
  const comIs: Item = { ...b, impostos: { ...b.impostos, is: is as unknown as NonNullable<Item['impostos']['is']> } };
  const n = ok(await montarNfe(nota({ itens: [comIbs, comIs] }), opcoes({ ibsCbs: calculadoraFixa, tempo: time })));
  expect(det(n, 1).vItem).toBe('16.50');
  expect(n.infNFe.total.vNFTot).toBe('31.66');

  const relogio = relogioManual('2026-12-31T23:59:59-03:00');
  const avanca: CalculadoraIbsCbs = {
    calcular(req) {
      relogio.ajustar('2027-01-01T00:00:01-03:00');
      return calculadoraFixa.calcular(req);
    },
  };
  const t2 = contextoDeTempo({ emissao: relogioFixo(EMISSAO), fatoGerador: relogio });
  const m = ok(await montarNfe(nota({ itens: [comIbs] }), opcoes({ ibsCbs: avanca, tempo: t2 })));
  expect(det(m).vItem).toBe('15.00');
});

test('nota só com IS: vItem e vNFTot sem IBSCBSTot', async () => {
  const time = contextoDeTempo({
    emissao: relogioFixo(EMISSAO),
    fatoGerador: relogioFixo('2027-01-04T10:00:00-03:00'),
  });
  const b = item();
  const is = { CSTIS: '000', cClassTribIS: '000001', vBCIS: '15.00', pIS: '10.0000', vIS: '1.50' };
  const comIs: Item = { ...b, impostos: { ...b.impostos, is: is as unknown as NonNullable<Item['impostos']['is']> } };
  const n = ok(await montarNfe(nota({ itens: [comIs] }), opcoes({ tempo: time })));
  expect(det(n).vItem).toBe('16.50');
  expect(n.infNFe.total.vNFTot).toBe('16.50');
  expect(n.infNFe.total.IBSCBSTot).toBeUndefined();
});

test('COFINS-ST aceita base zero (TDec_1302); PIS-ST não (TDec_1302Opc)', async () => {
  const b = item();
  const cof: Item = { ...b, impostos: { ...b.impostos, cofinsSt: { vBC: '0', aliquota: '0', valor: '0' } } };
  expect(imposto(ok(await montarNfe(nota({ itens: [cof] }), opcoes()))).COFINSST).toMatchObject({ vBC: '0.00' });
  const pis: Item = { ...b, impostos: { ...b.impostos, pisSt: { vBC: '0', aliquota: '0', valor: '0' } } };
  expect(codes(await montarNfe(nota({ itens: [pis] }), opcoes()))).toEqual(['decimal_invalido']);
});

test('zero informado em campo opcional sem zero no XSD é aceito e omitido', async () => {
  const b = item();
  const it: Item = { ...b, produto: { ...b.produto, vFrete: '0', vDesc: 0 } };
  const p = det(ok(await montarNfe(nota({ itens: [it] }), opcoes()))).prod as Record<string, unknown>;
  expect(p.vFrete).toBeUndefined();
  expect(p.vDesc).toBeUndefined();
});

test('escolhas exclusivas informadas juntas viram ocorrência de schema, não exceção', async () => {
  const issues = falha(await montarNfe(nota({ transporte: { modFrete: '9', vagao: 'V1', balsa: 'B1' } }), opcoes()));
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ code: 'schema' });
  expect(issues[0]?.caminho).toContain('transp');
});

test('NF-e normal: qTrib × vUnTrib confere com vProd (rejeição 630); fora da normal não', async () => {
  const b = item();
  const it: Item = { ...b, produto: { ...b.produto, vUnTrib: '2' } };
  expect(falha(await montarNfe(nota({ itens: [it] }), opcoes()))).toEqual([
    expect.objectContaining({ code: 'valor_divergente', caminho: 'itens[0].produto.vUnTrib' }),
  ]);
  expect(ok(await montarNfe(nota({ finNFe: '2', itens: [it] }), opcoes())).chave).toHaveLength(44);
  const derivado: Item = { ...b, produto: { ...b.produto, qCom: '3', vUnCom: '1', uTrib: 'G', qTrib: '7' } };
  expect(det(ok(await montarNfe(nota({ itens: [derivado] }), opcoes()))).prod).toMatchObject({
    vUnTrib: '0.4285714286',
  });
});

test('PL e dhEmi saem do mesmo instante, mesmo com o relógio virando a vigência no meio', async () => {
  const instantes = ['2026-08-31T23:59:59-03:00', '2026-09-01T00:00:00-03:00'];
  let i = 0;
  const relogio = { agora: (): Date => relogioFixo(instantes[Math.min(i++, 1)] as string).agora() };
  const n = ok(await montarNfe(nota(), opcoes({ tempo: contextoDeTempo({ emissao: relogio }) })));
  expect(n.dhEmi).toBe('2026-08-31T23:59:59-03:00');
  expect(n.pl.pl).toStartWith('PL_010e');
});
