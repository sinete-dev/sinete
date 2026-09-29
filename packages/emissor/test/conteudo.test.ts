/** Conteúdo comparável da barreira da recusa repetida: some o que muda sozinho, fica o que a nota diz. */
import { describe, expect, test } from 'bun:test';
import { conteudoDps, conteudoMdfe, conteudoNfe } from '../src/conteudo.ts';

describe('conteudoNfe', () => {
  const nfe = (dhEmi: string, cNF: string, cDV: string, natOp: string) =>
    `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe3526${cNF}${cDV}"><ide><cNF>${cNF}</cNF><natOp>${natOp}</natOp><dhEmi>${dhEmi}</dhEmi><dhSaiEnt>${dhEmi}</dhSaiEnt><cDV>${cDV}</cDV></ide><infRespTec><hashCSRT>abc${cNF}</hashCSRT></infRespTec></infNFe><infNFeSupl><qrCode>q${cNF}</qrCode></infNFeSupl><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>${cNF}</SignatureValue></Signature></NFe>`;

  test('hora, cNF, cDV, Id, hashCSRT, QR Code e assinatura não contam', () => {
    expect(conteudoNfe(nfe('2026-09-28T10:00:00-03:00', '11111111', '1', 'VENDA'))).toBe(
      conteudoNfe(nfe('2026-09-28T10:05:00-03:00', '22222222', '7', 'VENDA')),
    );
  });

  test('o que a nota diz conta', () => {
    expect(conteudoNfe(nfe('2026-09-28T10:00:00-03:00', '11111111', '1', 'VENDA'))).not.toBe(
      conteudoNfe(nfe('2026-09-28T10:00:00-03:00', '11111111', '1', 'REMESSA')),
    );
  });
});

describe('conteudoMdfe e conteudoDps', () => {
  test('MDF-e: hora, cMDF, cDV e Id não contam; DPS: hora e assinatura não contam, o Id conta', () => {
    const mdfe = (dh: string, c: string) =>
      `<MDFe><infMDFe versao="3.00" Id="MDFe${c}"><ide><cMDF>${c}</cMDF><dhEmi>${dh}</dhEmi><cDV>1</cDV></ide></infMDFe><infMDFeSupl/><Signature/></MDFe>`;
    expect(conteudoMdfe(mdfe('a', '1'))).toBe(conteudoMdfe(mdfe('b', '2')));
    const dps = (dh: string, id: string) =>
      `<DPS><infDPS Id="${id}"><dhEmi>${dh}</dhEmi></infDPS><Signature>x</Signature></DPS>`;
    expect(conteudoDps(dps('a', 'DPS1'))).toBe(conteudoDps(dps('b', 'DPS1')));
    expect(conteudoDps(dps('a', 'DPS1'))).not.toBe(conteudoDps(dps('a', 'DPS2')));
  });
});
