/** Coerência do estado: namespaces herdados, recibo do síncrono, SVC fixada no lote, ano da inutilização e ecos. */
import { describe, expect, test } from 'bun:test';
import { assinarXml, conferirAssinatura } from '@sinete/core/xml';
import { NFE_NS } from '../src/index.ts';
import {
  certs,
  consCad,
  consChNFe,
  consReciNFe,
  consSitNFe,
  DESTINATARIO,
  det,
  distDFe,
  docZips,
  EMITENTE,
  envEvento,
  enviNFe,
  evento,
  harness,
  INICIO,
  inutNFe,
  nfe,
  TERCEIRO,
  tag,
  tags,
} from './helpers.ts';

const semAssinatura = (xml: string): string => xml.replace(/<Signature[\s\S]*<\/Signature>/, '');

describe('coerência do estado', () => {
  test('NF-e assinada no contexto do lote com namespace extra continua verificável no estado e no nfeProc', async () => {
    const c = await certs();
    const h = await harness();
    const n = await nfe({ autXML: [TERCEIRO] });
    const lote =
      `<enviNFe versao="4.00" xmlns="${NFE_NS}" xmlns:x="urn:sinete:teste"><idLote>1</idLote><indSinc>1</indSinc>` +
      `${semAssinatura(n.xml)}</enviNFe>`;
    const assinado = await assinarXml(lote, { id: `NFe${n.chave}` }, c.emitente.signer);
    expect(tags(await h.send('NFeAutorizacao', assinado), 'cStat')[1]).toBe('100');
    const guardada = h.sim.inspect.nfe(n.chave)?.xml as string;
    expect(guardada).toContain('xmlns:x="urn:sinete:teste"');
    expect((await conferirAssinatura(guardada, { id: `NFe${n.chave}`, elemento: 'infNFe' })).ok).toBe(true);
    const [proc] = h.sim.inspect.distribuicao(TERCEIRO);
    expect((await conferirAssinatura(proc?.xml ?? '', { id: `NFe${n.chave}`, elemento: 'infNFe' })).ok).toBe(true);
  });

  test('emitente que se lista em autXML não recebe a própria NF-e, nem pela fila nem pelo consChNFe', async () => {
    const h = await harness({}, (await certs()).emitente);
    const n = await nfe({ autXML: [EMITENTE, TERCEIRO] });
    await h.send('NFeAutorizacao', enviNFe([n.xml]));
    expect(h.sim.inspect.distribuicao(EMITENTE)).toHaveLength(0);
    expect(h.sim.inspect.distribuicao(TERCEIRO).map((d) => d.schema)).toEqual(['procNFe_v4.00.xsd']);
    expect(tag(await h.send('NFeDistribuicaoDFe', distDFe(EMITENTE, consChNFe(n.chave))), 'cStat')).toBe('641');
  });

  test('NFC-e não entra na distribuição de DF-e', async () => {
    const h = await harness();
    const n = await nfe({ mod: '65' });
    expect(tags(await h.send('NFeAutorizacao', enviNFe([n.xml])), 'cStat')[1]).toBe('100');
    expect(h.sim.inspect.distribuicao(DESTINATARIO)).toHaveLength(0);
  });

  test('o recibo do lote síncrono devolvido no 204 é consultável', async () => {
    const h = await harness();
    const n = await nfe();
    const primeira = await h.send('NFeAutorizacao', enviNFe([n.xml]));
    const nRec = h.sim.inspect.nfe(n.chave)?.nRec as string;
    expect(tags(primeira, 'cStat')[1]).toBe('100');
    expect(tags(await h.send('NFeAutorizacao', enviNFe([n.xml])), 'xMotivo')[1]).toContain(`[nRec:${nRec}]`);
    const consulta = await h.send('NFeRetAutorizacao', consReciNFe(nRec));
    expect(tags(consulta, 'cStat')).toEqual(['104', '100']);
    expect(tag(consulta, 'nProt')).toBe(tag(primeira, 'nProt') as string);
  });

  test('lote assíncrono aceito pela SVC-RS é processado como SVC-RS mesmo com a contingência desligada depois', async () => {
    const h = await harness({ atrasoProcessamentoMs: 1000 });
    h.sim.setContingencia('SVC-RS');
    const n = await nfe({ tpEmis: '7' });
    const rec = await h.send('NFeAutorizacao', enviNFe([n.xml], '0'), { autorizador: 'svc' });
    const nRec = tag(rec, 'nRec') as string;
    h.sim.setContingencia(undefined);
    h.clock.avancar(1000);
    await h.sim.settle();
    const [prot] = h.sim.inspect.lote(nRec)?.protNFe ?? [];
    expect(prot?.infProt.cStat).toBe('100');
    expect(prot?.infProt.verAplic).toBe('SVC-RS_SINETE_SIM');
    expect(prot?.infProt.nProt).toMatch(/^335/);
  });

  test('inutilização é por ano: a mesma faixa em outro ano é outra inutilização e não barra a NF-e do ano seguinte', async () => {
    const h = await harness();
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 1, fin: 3, ano: '25' })), 'cStat')).toBe('102');
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 1, fin: 3, ano: '26' })), 'cStat')).toBe('102');
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 2, fin: 5, ano: '25' })), 'cStat')).toBe('256');
    const r = await h.send('NFeAutorizacao', enviNFe([(await nfe({ nNF: 4 })).xml]));
    expect(tags(r, 'cStat')[1]).toBe('100');
    // A NF-e de 2026 barra a inutilização de 2026 (241), não a de 2025.
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 4, fin: 4, ano: '25' })), 'cStat')).toBe('102');
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 4, fin: 4, ano: '26' })), 'cStat')).toBe('241');
    expect(INICIO.slice(2, 4)).toBe('26');
  });

  test('consulta cadastro com documento fora do schema responde 215 válido, sem ecoar o valor', async () => {
    const h = await harness();
    const r = await h.send('NfeConsultaCadastro', consCad('CNPJ', 'lixo'));
    expect(tag(r, 'cStat')).toBe('215');
    expect(r).not.toContain('lixo');
  });

  test('destinatário que também é autXML recebe a NF-e completa desde o início, uma vez só', async () => {
    const h = await harness({}, (await certs()).destinatario);
    const n = await nfe({ autXML: [DESTINATARIO] });
    await h.send('NFeAutorizacao', enviNFe([n.xml]), { canal: h.c.emitente });
    const porChave = await docZips(await h.send('NFeDistribuicaoDFe', distDFe(DESTINATARIO, consChNFe(n.chave))));
    expect(porChave.map((d) => d.schema)).toEqual(['procNFe_v4.00.xsd']);
    await h.send('RecepcaoEvento', envEvento([await evento({ chave: n.chave, tpEvento: '110110', det: det.cce() })]), {
      canal: h.c.emitente,
    });
    await h.send(
      'RecepcaoEvento',
      envEvento([await evento({ chave: n.chave, tpEvento: '210210', det: det.ciencia() })]),
      {
        autorizador: 'an',
      },
    );
    expect(h.sim.inspect.distribuicao(DESTINATARIO).map((d) => d.schema)).toEqual([
      'procNFe_v4.00.xsd',
      'procEventoNFe_v1.00.xsd',
    ]);
  });

  test('envelope de evento com prefixo responde 404 também quando só o detEvento foge do schema do cancelamento', async () => {
    const h = await harness();
    const { chave } = await nfe();
    await h.send('NFeAutorizacao', enviNFe([(await nfe()).xml]));
    const cce = await evento({ chave, tpEvento: '110110', det: det.cce() });
    const prefixado = `<p:envEvento versao="1.00" xmlns:p="${NFE_NS}"><p:idLote>1</p:idLote>${cce}</p:envEvento>`;
    const r = await h.send('RecepcaoEvento', prefixado);
    expect(tag(r, 'cStat')).toBe('404');
    expect(h.sim.inspect.eventos(chave)).toHaveLength(0);
  });

  test('evento com $$ e $& no texto volta intacto e verificável na consulta de protocolo', async () => {
    const h = await harness();
    const n = await nfe();
    await h.send('NFeAutorizacao', enviNFe([n.xml]));
    const cce = await evento({ chave: n.chave, tpEvento: '110110', det: det.cce('PRECO DE $$ 10 E $&amp; OUTRO $1') });
    expect(tags(await h.send('RecepcaoEvento', envEvento([cce])), 'cStat')[1]).toBe('135');
    const r = await h.send('NfeConsultaProtocolo', consSitNFe(n.chave));
    expect(r).toContain(cce);
    const id = `ID110110${n.chave}01`;
    const inicio = r.indexOf('<procEventoNFe');
    const proc = r.slice(inicio, r.indexOf('</procEventoNFe>') + '</procEventoNFe>'.length);
    expect((await conferirAssinatura(proc, { id, elemento: 'infEvento' })).ok).toBe(true);
  });

  test('UF atendida além da principal: cadastro e inutilização usam a UF do pedido', async () => {
    const IE_RJ = '12345678';
    const h = await harness({
      ufsAtendidas: ['RJ'],
      cadastro: [{ UF: 'RJ', IE: IE_RJ, CNPJ: EMITENTE, xNome: 'FILIAL RJ', situacao: 'irregular' }],
    });
    expect(tag(await h.send('NfeConsultaCadastro', consCad('CNPJ', EMITENTE, 'RJ')), 'cStat')).toBe('111');
    expect(tag(await h.send('NfeConsultaCadastro', consCad('CNPJ', EMITENTE, 'MG')), 'cStat')).toBe('265');
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 1, fin: 1, cUF: '33' })), 'cStat')).toBe('240');
    expect(tag(await h.send('NfeInutilizacao', await inutNFe({ ini: 1, fin: 1 })), 'cStat')).toBe('102');
  });
});
