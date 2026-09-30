/**
 * A lista `campoVolatil` (recusas que a barreira da recusa repetida compara pelos bytes) acompanha o catálogo do
 * `@sinete/rejeicoes`: todo código cuja mensagem fala de data, prazo, chave, assinatura, certificado, QR Code ou CSRT.
 * A `eventoJaRegistrado` da NFS-e também: só códigos do catálogo que recusam o próprio e101101.
 */
import { expect, test } from 'bun:test';
import nfse from '../../rejeicoes/src/data/nfse-erros.json' with { type: 'json' };
import nfe from '../../rejeicoes/src/data/rejeicoes.json' with { type: 'json' };
import mdfe from '../../rejeicoes/src/data/rejeicoes-mdfe.json' with { type: 'json' };
import tabela from '../src/data/cstat.json' with { type: 'json' };

const rx = new RegExp(tabela.campoVolatilPadrao.regex, tabela.campoVolatilPadrao.flags);
const casam = (lista: readonly { readonly code: string; readonly message?: string; readonly mensagem?: string }[]) =>
  lista.filter((e) => rx.test(e.message ?? e.mensagem ?? '')).map((e) => e.code);

test('campoVolatil em sincronia com o catálogo', () => {
  expect(tabela.nfe.campoVolatil).toEqual(casam(nfe.rejeicoes));
  expect(tabela.mdfe.campoVolatil).toEqual(casam(mdfe.rejeicoes));
  expect(tabela.nfse.campoVolatil).toEqual(casam(nfse.erros));
});

test('as recusas que se corrigem só na data, na chave ou na assinatura entram; as da nota, não', () => {
  for (const c of ['212', '228', '703', '1154', '1155', '978', '464', '297', '213', '900']) {
    expect(tabela.nfe.campoVolatil).toContain(c);
  }
  for (const c of ['203', '232', '266', '529', '656']) expect(tabela.nfe.campoVolatil).not.toContain(c);
});

test('eventoJaRegistrado da NFS-e vem do catálogo: só códigos de recusa do próprio e101101', () => {
  expect(tabela.nfse.eventoJaRegistrado).toEqual(['E0840']);
  for (const code of tabela.nfse.eventoJaRegistrado) {
    const e = nfse.erros.find((x) => x.codigo === code);
    expect(e?.regras.some((r) => 'caminho' in r && r.caminho === 'evento/pedRegEvento/infPedReg/e101101')).toBe(true);
    expect(e?.mensagem).toContain('EVENTO DE CANCELAMENTO DE NFS-e pois');
  }
});
