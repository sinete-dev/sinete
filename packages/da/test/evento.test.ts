import { describe, expect, test } from 'bun:test';
import { dacce } from '../src/cce.ts';
import { daEvento } from '../src/evento.ts';
import type { Documento } from '../src/model.ts';
import { chaveDe, eventoMdfeXml, eventoXml, mdfeXml, NFE_FIXTURES, nfeXml } from './fixtures.ts';

const texts = (doc: Documento): string =>
  doc.paginas.flatMap((p) => p.ops.flatMap((o) => (o.t === 'texto' ? [o.s] : []))).join(' | ');
const erro = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
  return 'sem erro';
};
const fx = (name: string): (typeof NFE_FIXTURES)[number] => {
  const f = NFE_FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(name);
  return f;
};

const blocos = (c: string): string => c.replace(/(.{4})(?=.)/g, '$1 ');
const CH_NFE = chaveDe('55');
const CH_NFCE = chaveDe('65');
const CH_MDFE = chaveDe('58', '1', 888);
const NFE = nfeXml(fx('basica'));
const NFCE = nfeXml(fx('nfce'));
const MDFE = mdfeXml({ name: 'x' });

describe('daEvento: uma chamada para qualquer evento registrado', () => {
  test('CC-e (110110): o mesmo documento do dacce, com e sem a NF-e', () => {
    const cce = eventoXml({ tpEvento: '110110', chave: CH_NFE });
    expect(daEvento(cce)).toEqual(dacce(cce));
    expect(daEvento(cce, { nfe: NFE })).toEqual(dacce(cce, { nfe: NFE }));
  });

  test('cancelamento da NF-e (110111): cabeçalho, evento, registro e justificativa', () => {
    const doc = daEvento(eventoXml({ tpEvento: '110111', chave: CH_NFE }), { nfe: NFE });
    const t = texts(doc);
    expect(t).toContain('CANCELAMENTO DA NF-e');
    expect(t).toContain('EMPRESA FICTICIA DE TESTES DO SINETE LTDA');
    expect(t).toContain('CHAVE DE ACESSO DA NF-e');
    expect(t).toContain(`CHAVE DE ACESSO DA NF-e | ${blocos(CH_NFE)}`);
    expect(t).toContain('CÓDIGO DO EVENTO | 110111');
    expect(t).toContain('SEQUÊNCIA DO EVENTO | 1');
    expect(t).toContain('PROTOCOLO | 135260000000099');
    expect(t).toContain('DATA E HORA DO REGISTRO | 02/09/2026 09:00:05');
    expect(t).toContain('PROTOCOLO DE AUTORIZAÇÃO DA NF-e | 135260000000001');
    expect(t).toContain('JUSTIFICATIVA');
    expect(t).toContain('CANCELAMENTO DE TESTE POR ERRO DE DIGITACAO');
    expect(t).toContain('NÚMERO DA NF-e | 000.001.234');
    expect(t).toContain('135 - Evento registrado e vinculado a NF-e');
    expect(t).toContain('Consulte a autenticidade no portal da NF-e.');
    expect(doc.paginas).toHaveLength(1);
  });

  test('cancelamento por substituição da NFC-e (110112): chave da substituta e justificativa', () => {
    const doc = daEvento(eventoXml({ tpEvento: '110112', chave: CH_NFCE }), { nfe: NFCE });
    const t = texts(doc);
    expect(t).toContain('CANCELAMENTO POR SUBSTITUIÇÃO DA NFC-e');
    expect(t).toContain('CHAVE DE ACESSO DA NFC-e');
    expect(t).toContain('NÚMERO DA NFC-e');
    expect(t).toContain('CHAVE DE ACESSO DA NFC-e SUBSTITUTA');
    expect(t).toContain(`CHAVE DE ACESSO DA NFC-e SUBSTITUTA | ${blocos(chaveDe('65', '1', 1235))}`);
    expect(t).toContain('CANCELAMENTO DE TESTE POR SUBSTITUICAO');
    expect(t).toContain('CÓDIGO DO EVENTO | 110112');
  });

  test('cancelamento da NFC-e (110111): o modelo da chave dá o nome do documento', () => {
    const t = texts(daEvento(eventoXml({ tpEvento: '110111', chave: CH_NFCE })));
    expect(t).toContain('CANCELAMENTO DA NFC-e');
    expect(t).toContain('CHAVE DE ACESSO DA NFC-e');
    expect(t).toContain('Consulte a autenticidade no portal da NFC-e.');
  });

  test('cancelamento do MDF-e (110111): emitente do mdfeProc, justificativa e protocolos', () => {
    const doc = daEvento(eventoMdfeXml({ tpEvento: '110111', chave: CH_MDFE }), { mdfe: MDFE });
    const t = texts(doc);
    expect(t).toContain('CANCELAMENTO DO MDF-e');
    expect(t).toContain('EMPRESA FICTICIA DE TESTES DO SINETE LTDA');
    expect(t).toContain(`CHAVE DE ACESSO DO MDF-e | ${blocos(CH_MDFE)}`);
    expect(t).toContain('CÓDIGO DO EVENTO | 110111');
    expect(t).toContain('PROTOCOLO | 935260000000088');
    expect(t).toContain('DATA E HORA DO REGISTRO | 05/09/2026 17:00:04');
    expect(t).toContain('PROTOCOLO DE AUTORIZAÇÃO DO MDF-e | 935260000000001');
    expect(t).toContain('CANCELAMENTO DE TESTE DO MANIFESTO SINTETICO');
    expect(t).toContain('NÚMERO DO MDF-e | 000.000.888');
    expect(t).toContain('UF DE INÍCIO E DE FIM | SP / RJ');
    expect(t).toContain('135 - Evento registrado e vinculado ao MDF-e');
    expect(t).toContain('Consulte a autenticidade no portal do MDF-e.');
  });

  test('encerramento do MDF-e (110112): data, UF e município do encerramento', () => {
    const t = texts(daEvento(eventoMdfeXml({ tpEvento: '110112', chave: CH_MDFE })));
    expect(t).toContain('ENCERRAMENTO DO MDF-e');
    expect(t).toContain('DATA DO ENCERRAMENTO | 05/09/2026');
    expect(t).toContain('UF DO ENCERRAMENTO | RJ');
    expect(t).toContain('MUNICÍPIO DO ENCERRAMENTO (CÓDIGO IBGE) | 3304557');
    expect(t).toContain('PROTOCOLO DE AUTORIZAÇÃO DO MDF-e | 935260000000001');
    expect(t).not.toContain('ENCERRADO PELO TRANSPORTADOR TERCEIRO');
    const terceiro = texts(daEvento(eventoMdfeXml({ tpEvento: '110112', chave: CH_MDFE, indEncPorTerceiro: true })));
    expect(terceiro).toContain('ENCERRADO PELO TRANSPORTADOR TERCEIRO');
  });

  test('inclusão de condutor no MDF-e (110114): nome e CPF do condutor', () => {
    const t = texts(daEvento(eventoMdfeXml({ tpEvento: '110114', chave: CH_MDFE })));
    expect(t).toContain('INCLUSÃO DE CONDUTOR NO MDF-e');
    expect(t).toContain('NOME DO CONDUTOR | MOTORISTA FICTICIO TRES');
    expect(t).toContain('CPF DO CONDUTOR | 111.444.777-35');
  });

  test('sem o documento: o CNPJ do autor no lugar do emitente; homologação marca SEM VALOR FISCAL', () => {
    const nfe = texts(daEvento(eventoXml({ tpEvento: '110111', chave: CH_NFE, tpAmb: '2' })));
    expect(nfe).toContain('CNPJ/CPF DO AUTOR: 11.222.333/0001-81');
    expect(nfe).toContain('SEM VALOR FISCAL');
    expect(nfe).not.toContain('NÚMERO DA NF-e');
    const mdfe = texts(daEvento(eventoMdfeXml({ tpEvento: '110114', chave: CH_MDFE, tpAmb: '2' })));
    expect(mdfe).toContain('CNPJ/CPF DO AUTOR: 11.222.333/0001-81');
    expect(mdfe).toContain('SEM VALOR FISCAL');
    expect(texts(daEvento(eventoMdfeXml({ tpEvento: '110114', chave: CH_MDFE })))).not.toContain('SEM VALOR FISCAL');
  });

  test('o título do documento é o nome do evento e da chave', () => {
    expect(daEvento(eventoMdfeXml({ tpEvento: '110112', chave: CH_MDFE })).titulo).toBe(
      `Evento 110112 do MDF-e ${CH_MDFE}`,
    );
    expect(daEvento(eventoXml({ tpEvento: '110111', chave: CH_NFE })).titulo).toBe(`Evento 110111 da NF-e ${CH_NFE}`);
  });
});

describe('daEvento: entradas recusadas', () => {
  test('evento não registrado, sem retorno ou com o retorno de outro evento: evento_incompativel', () => {
    expect(erro(() => daEvento(eventoXml({ tpEvento: '110111', chave: CH_NFE, cStat: '573' })))).toBe(
      'evento_incompativel',
    );
    expect(erro(() => daEvento(eventoXml({ tpEvento: '110110', chave: CH_NFE, cStat: '494' })))).toBe(
      'evento_incompativel',
    );
    expect(erro(() => daEvento(eventoMdfeXml({ tpEvento: '110112', chave: CH_MDFE, cStat: '631' })))).toBe(
      'evento_incompativel',
    );
    const nfe = eventoXml({ tpEvento: '110111', chave: CH_NFE });
    const semRet = nfe.replace(/<retEvento.*<\/retEvento>/, '');
    expect(erro(() => daEvento(semRet))).toBe('evento_incompativel');
    const outraChave = nfe.replace(
      `<chNFe>${CH_NFE}</chNFe><tpEvento>`,
      `<chNFe>${chaveDe('55', '1', 9)}</chNFe><tpEvento>`,
    );
    expect(outraChave).not.toBe(nfe);
    expect(erro(() => daEvento(outraChave))).toBe('evento_incompativel');
    const outraSeq = nfe.replace('<nSeqEvento>1</nSeqEvento><dhRegEvento>', '<nSeqEvento>2</nSeqEvento><dhRegEvento>');
    expect(erro(() => daEvento(outraSeq))).toBe('evento_incompativel');
    const mdfe = eventoMdfeXml({ tpEvento: '110114', chave: CH_MDFE });
    const outroTipo = mdfe.replace('<tpEvento>110114</tpEvento><xEvento>', '<tpEvento>110111</tpEvento><xEvento>');
    expect(erro(() => daEvento(outroTipo))).toBe('evento_incompativel');
  });

  test('tipo de evento sem documento auxiliar: evento_incompativel', () => {
    const nfe = eventoXml({ tpEvento: '110111', chave: CH_NFE }).replaceAll('110111', '210200');
    expect(erro(() => daEvento(nfe))).toBe('evento_incompativel');
    const mdfe = eventoMdfeXml({ tpEvento: '110111', chave: CH_MDFE }).replaceAll('110111', '110115');
    expect(erro(() => daEvento(mdfe))).toBe('evento_incompativel');
  });

  test('documento de outra chave ou de outra família: evento_incompativel', () => {
    const nfe = eventoXml({ tpEvento: '110111', chave: CH_NFE });
    const mdfe = eventoMdfeXml({ tpEvento: '110111', chave: CH_MDFE });
    expect(erro(() => daEvento(nfe, { nfe: NFCE }))).toBe('evento_incompativel');
    expect(erro(() => daEvento(mdfe, { mdfe: mdfeXml({ name: 'x', cnpj: '99888777000166' }) }))).toBe(
      'evento_incompativel',
    );
    expect(erro(() => daEvento(nfe, { mdfe: MDFE }))).toBe('evento_incompativel');
    expect(erro(() => daEvento(mdfe, { nfe: NFE }))).toBe('evento_incompativel');
  });

  test('raiz que não é procEventoNFe nem procEventoMDFe e XML malformado', () => {
    expect(erro(() => daEvento(NFE))).toBe('documento_inesperado');
    expect(erro(() => daEvento(MDFE))).toBe('documento_inesperado');
    expect(erro(() => daEvento('<procEventoNFe'))).toBe('xml_invalido');
  });
});
