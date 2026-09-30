import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao, ErroDeValidacao, ErroRespostaInvalida } from '@sinete/core';
import { conferirAssinatura, lerXml } from '@sinete/core/xml';
import { nfceEndpoint, nfeEndpoint } from '@sinete/transport';
import {
  CNPJ_DEST,
  CNPJ_EMIT,
  CPF_EMIT,
  chave,
  client,
  fakeTransport,
  mensagem,
  NFE_NS,
  retEnvEvento,
  soap,
} from './helpers.ts';

function eventoEnviado(msg: string): string {
  const m = /(<evento [\s\S]*<\/evento>)<\/envEvento>$/.exec(msg);
  if (!m?.[1]) throw new Error('sem evento');
  return m[1];
}

function campo(xml: string, tag: string): string | undefined {
  return new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1];
}

describe('cancelar (110111)', () => {
  test('monta Id, cOrgao da chave, dhEvento no fuso da UF, assina e devolve procEventoNFe', async () => {
    const ch = chave({ cUF: '41' });
    const t = fakeTransport(
      soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110111', chNFe: ch } }), 'NFeRecepcaoEvento4'),
    );
    const { c } = await client(t);
    const r = await c.cancelar({
      chave: ch,
      nProt: '141260000000001',
      xJust: 'Cancelamento por erro de digitação & teste',
    });
    expect(r.tipo).toBe('autorizado');
    if (r.tipo !== 'autorizado') return;
    const req = t.requests[0];
    expect(req?.url).toBe(nfeEndpoint({ ambiente: 'homologacao', servico: 'RecepcaoEvento', uf: 'PR' }).url);
    expect(req?.headers['content-type']).toContain('NFeRecepcaoEvento4/nfeRecepcaoEvento');
    const msg = mensagem(req as never);
    expect(
      msg.startsWith(
        `<envEvento xmlns="${NFE_NS}" versao="1.00"><idLote>42</idLote><evento xmlns="${NFE_NS}" versao="1.00">`,
      ),
    ).toBe(true);
    const ev = eventoEnviado(msg);
    const id = `ID110111${ch}01`;
    expect(ev).toContain(`<infEvento Id="${id}">`);
    expect(campo(ev, 'cOrgao')).toBe('41');
    expect(campo(ev, 'tpAmb')).toBe('2');
    expect(campo(ev, 'CNPJ')).toBe(CNPJ_EMIT);
    // SP em -03:00: 12:00Z vira 09:00:00-03:00; PR idem (o fuso é o da UF do cliente).
    expect(campo(ev, 'dhEvento')).toBe('2026-09-10T09:00:00-03:00');
    expect(campo(ev, 'nSeqEvento')).toBe('1');
    expect(campo(ev, 'verEvento')).toBe('1.00');
    expect(ev).toContain(
      '<detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>141260000000001</nProt>',
    );
    expect(ev).toContain('&amp; teste');
    expect((await conferirAssinatura(ev, { id, elemento: 'infEvento' })).ok).toBe(true);
    expect(r.valor).toMatchObject({ chNFe: ch, tpEvento: '110111', nSeqEvento: '1', nProt: '135260000000002' });
    expect(
      r.valor.procEventoNFe.startsWith(`<procEventoNFe xmlns="${NFE_NS}" versao="1.00">${ev}<retEvento versao="1.00">`),
    ).toBe(true);
    expect(r.valor.retEvento.startsWith(`<retEvento xmlns="${NFE_NS}" versao="1.00">`)).toBe(true);
    const proc = lerXml(r.valor.procEventoNFe);
    expect(proc.raiz.local).toBe('procEventoNFe');
    expect((await conferirAssinatura(r.valor.procEventoNFe, { id, elemento: 'infEvento' })).ok).toBe(true);
  });

  test('offsetMinutes sobrepõe o fuso da UF; autor explícito CPF', async () => {
    const ch = chave({ emitente: `000${CPF_EMIT}`, serie: 920 });
    const t = fakeTransport(soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110111', chNFe: ch, nProt: '' } })));
    const { c } = await client(t, { offsetMinutes: -240 });
    const r = await c.cancelar({
      chave: ch,
      nProt: '135260000000001',
      xJust: 'Justificativa de teste longa',
      autor: { CPF: CPF_EMIT },
    });
    const ev = eventoEnviado(mensagem(t.requests[0] as never));
    expect(campo(ev, 'dhEvento')).toBe('2026-09-10T08:00:00-04:00');
    expect(campo(ev, 'CPF')).toBe(CPF_EMIT);
    expect(r.tipo === 'autorizado' && r.valor.nProt).toBeUndefined();
  });

  test('autor diferente do emitente da chave: recusado antes de enviar (P12-44, rejeição 574)', async () => {
    const t = fakeTransport(soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110111', chNFe: chave() } })));
    const { c } = await client(t);
    const pedido = { chave: chave(), nProt: '135260000000001', xJust: 'Justificativa de teste longa' };
    for (const autor of [{ CPF: CPF_EMIT }, { CNPJ: '11444777000161' }]) {
      const e = await c.cancelar({ ...pedido, autor }).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(ErroDeValidacao);
      expect((e as ErroDeValidacao).ocorrencias[0]).toMatchObject({
        code: 'autor_difere_do_emitente',
        origem: 'entrada',
      });
      const cce = await c
        .cartaCorrecao({ chave: chave(), nSeqEvento: 1, xCorrecao: 'Correcao de teste com texto suficiente', autor })
        .catch((x: unknown) => x);
      expect(cce).toBeInstanceOf(ErroDeValidacao);
    }
    expect(t.requests).toHaveLength(0);
  });

  test('emitente CPF na chave vira autor CPF', async () => {
    const ch = chave({ emitente: `000${CPF_EMIT}`, serie: 920 });
    const t = fakeTransport(soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110111', chNFe: ch } })));
    const { c } = await client(t);
    await c.cancelar({ chave: ch, nProt: '135260000000001', xJust: 'Justificativa de teste longa' });
    expect(campo(eventoEnviado(mensagem(t.requests[0] as never)), 'CPF')).toBe(CPF_EMIT);
  });

  test('lote rejeitado, evento rejeitado e lote sem retEvento', async () => {
    const ch = chave();
    const t = fakeTransport(
      soap(retEnvEvento({ cStat: '489', xMotivo: 'Rejeição: CNPJ informado inválido' })),
      soap(
        retEnvEvento({
          evento: { cStat: '573', xMotivo: 'Rejeição: Duplicidade de Evento', tpEvento: '110111', chNFe: ch },
        }),
      ),
      soap(retEnvEvento({})),
    );
    const { c } = await client(t);
    const p = { chave: ch, nProt: '135260000000001', xJust: 'Justificativa de teste longa' };
    expect((await c.cancelar(p)).cStat).toBe('489');
    const r2 = await c.cancelar(p);
    expect(r2.tipo).toBe('recusado');
    expect(r2.cStat).toBe('573');
    await expect(c.cancelar(p)).rejects.toBeInstanceOf(ErroRespostaInvalida);
  });

  test('xJust curta falha no schema antes de enviar; autor com CNPJ inválido', async () => {
    const t = fakeTransport();
    const { c } = await client(t);
    await expect(c.cancelar({ chave: chave(), nProt: '135260000000001', xJust: 'curta' })).rejects.toBeInstanceOf(
      ErroDeValidacao,
    );
    await expect(
      c.cancelar({
        chave: chave(),
        nProt: '135260000000001',
        xJust: 'Justificativa longa',
        autor: { CNPJ: '11111111111111' },
      }),
    ).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(
      c.cancelar({
        chave: chave(),
        nProt: '135260000000001',
        xJust: 'Justificativa longa',
        autor: { CPF: '11111111111' },
      }),
    ).rejects.toBeInstanceOf(ErroDeValidacao);
    expect(t.requests).toHaveLength(0);
  });
});

describe('cartaCorrecao (110110)', () => {
  test('nSeqEvento no Id com 2 dígitos, descEvento e xCondUso fixos', async () => {
    const ch = chave();
    const t = fakeTransport(
      soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110110', chNFe: ch, nSeqEvento: '3' } })),
    );
    const { c } = await client(t);
    const r = await c.cartaCorrecao({ chave: ch, xCorrecao: 'Correção do endereço de entrega', nSeqEvento: 3 });
    expect(r.tipo).toBe('autorizado');
    const ev = eventoEnviado(mensagem(t.requests[0] as never));
    expect(ev).toContain(`<infEvento Id="ID110110${ch}03">`);
    expect(campo(ev, 'nSeqEvento')).toBe('3');
    expect(campo(ev, 'descEvento')).toBe('Carta de Correção');
    expect(campo(ev, 'xCondUso')).toStartWith(
      'A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N',
    );
    expect((await conferirAssinatura(ev, { id: `ID110110${ch}03` })).ok).toBe(true);
  });

  test('nSeqEvento fora de 1 a 20 é ConfigError', async () => {
    const { c } = await client(fakeTransport());
    for (const n of [0, 21, 1.5]) {
      await expect(
        c.cartaCorrecao({ chave: chave(), xCorrecao: 'Correção qualquer', nSeqEvento: n }),
      ).rejects.toBeInstanceOf(ErroDeConfiguracao);
    }
  });
});

describe('manifestar (AN, cOrgao 91)', () => {
  const casos = [
    ['ciencia', '210210', 'Ciencia da Operacao'],
    ['confirmacao', '210200', 'Confirmacao da Operacao'],
    ['desconhecimento', '210220', 'Desconhecimento da Operacao'],
  ] as const;
  for (const [tipo, tpEvento, desc] of casos) {
    test(`${tipo}: ${tpEvento} no AN com o autor das opções`, async () => {
      const ch = chave();
      const t = fakeTransport(soap(retEnvEvento({ evento: { cStat: '135', tpEvento, chNFe: ch } })));
      const { c } = await client(t, { autor: { CNPJ: CNPJ_DEST } });
      const r = await c.manifestar({ chave: ch, tipo });
      expect(r.tipo).toBe('autorizado');
      expect(t.requests[0]?.url).toBe(
        nfeEndpoint({ ambiente: 'homologacao', servico: 'RecepcaoEvento', autorizador: 'AN' }).url,
      );
      const ev = eventoEnviado(mensagem(t.requests[0] as never));
      expect(campo(ev, 'cOrgao')).toBe('91');
      expect(campo(ev, 'CNPJ')).toBe(CNPJ_DEST);
      expect(campo(ev, 'descEvento')).toBe(desc);
      expect(ev).toContain(`Id="ID${tpEvento}${ch}01"`);
    });
  }

  test('operação não realizada exige xJust (schema) e a envia', async () => {
    const ch = chave();
    const t = fakeTransport(soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '210240', chNFe: ch } })));
    const { c } = await client(t, { autor: { CNPJ: CNPJ_DEST } });
    await expect(c.manifestar({ chave: ch, tipo: 'nao-realizada' })).rejects.toBeInstanceOf(ErroDeValidacao);
    const r = await c.manifestar({ chave: ch, tipo: 'nao-realizada', xJust: 'Mercadoria não entregue no prazo' });
    expect(r.tipo).toBe('autorizado');
    expect(campo(eventoEnviado(mensagem(t.requests[0] as never)), 'xJust')).toBe('Mercadoria não entregue no prazo');
  });

  test('sem autor é ConfigError; tipo desconhecido é ConfigError', async () => {
    const { c } = await client(fakeTransport());
    await expect(c.manifestar({ chave: chave(), tipo: 'ciencia' })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(
      c.manifestar({ chave: chave(), tipo: 'outro' as never, autor: { CNPJ: CNPJ_DEST } }),
    ).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });
});

describe('retEvento de outro evento', () => {
  test('chave, tipo ou sequência diferentes do enviado é ProtocolError, nunca sucesso', async () => {
    const ch = chave();
    const outra = chave({ nNF: 77 });
    const pedido = { chave: ch, nProt: '141260000000001', xJust: 'Cancelamento por erro de digitação' };
    for (const evento of [
      { cStat: '135', tpEvento: '110111', chNFe: outra },
      { cStat: '135', tpEvento: '110110', chNFe: ch },
      { cStat: '135', tpEvento: '110111', chNFe: ch, nSeqEvento: '2' },
    ]) {
      const { c } = await client(fakeTransport(soap(retEnvEvento({ evento }), 'NFeRecepcaoEvento4')));
      await expect(c.cancelar(pedido)).rejects.toBeInstanceOf(ErroRespostaInvalida);
    }
  });
});

describe('cancelarPorSubstituicao (110112)', () => {
  test('NFC-e: detEvento do e110112 gerado, validado com o envelope e assinado', async () => {
    const ch = chave({ mod: '65', nNF: 10 });
    const ref = chave({ mod: '65', nNF: 11 });
    const t = fakeTransport(soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110112', chNFe: ch } })));
    const nfce = {
      ...nfeEndpoint({ ambiente: 'homologacao', servico: 'RecepcaoEvento', uf: 'SP' }),
      url: 'https://nfce.exemplo.invalid/ws/NFeRecepcaoEvento4.asmx',
      host: 'nfce.exemplo.invalid',
    };
    const ufs: string[] = [];
    const { c } = await client(t, {
      nfceEndpoint: (servico, uf) => {
        ufs.push(`${servico} ${uf}`);
        return nfce;
      },
    });
    const r = await c.cancelarPorSubstituicao({
      chave: ch,
      nProt: '135260000000001',
      xJust: 'Substituída por erro <no> total & troco',
      chNFeRef: ref,
      cOrgaoAutor: '35',
      verAplic: 'PDV-1.0',
    });
    expect(r.tipo).toBe('autorizado');
    const ev = eventoEnviado(mensagem(t.requests[0] as never));
    expect(ev).toContain(
      `<detEvento versao="1.00"><descEvento>Cancelamento por substituicao</descEvento><cOrgaoAutor>35</cOrgaoAutor><tpAutor>1</tpAutor><verAplic>PDV-1.0</verAplic><nProt>135260000000001</nProt><xJust>Substituída por erro &lt;no&gt; total &amp; troco</xJust><chNFeRef>${ref}</chNFeRef></detEvento>`,
    );
    expect((await conferirAssinatura(ev, { id: `ID110112${ch}01` })).ok).toBe(true);
    expect(t.requests[0]?.url).toBe(nfce.url);
    expect(ufs).toEqual(['RecepcaoEvento SP']);
  });

  test('sem a opção vai à recepção de eventos da NFC-e do transporte, nunca ao serviço da NF-e', async () => {
    const ch = chave({ mod: '65', nNF: 10 });
    const t = fakeTransport(soap(retEnvEvento({ evento: { cStat: '135', tpEvento: '110112', chNFe: ch } })));
    const { c } = await client(t);
    const r = await c.cancelarPorSubstituicao({
      chave: ch,
      chNFeRef: chave({ mod: '65', nNF: 11 }),
      nProt: '135260000000001',
      xJust: 'Justificativa longa',
      cOrgaoAutor: '35',
      verAplic: 'x',
    });
    expect(r.tipo).toBe('autorizado');
    expect(t.requests[0]?.url).toBe(nfceEndpoint({ ambiente: 'homologacao', servico: 'RecepcaoEvento', uf: 'SP' }).url);
  });

  test('detEvento fora do e110112 (cOrgaoAutor que não é UF) é ValidationError sem enviar', async () => {
    const t = fakeTransport();
    const { c } = await client(t);
    await expect(
      c.cancelarPorSubstituicao({
        chave: chave({ mod: '65', nNF: 10 }),
        chNFeRef: chave({ mod: '65', nNF: 11 }),
        nProt: '135260000000001',
        xJust: 'Justificativa longa',
        cOrgaoAutor: '91',
        verAplic: 'x',
      }),
    ).rejects.toBeInstanceOf(ErroDeValidacao);
    expect(t.requests).toHaveLength(0);
  });

  test('NF-e modelo 55 é ValidationError; chave de referência inválida também', async () => {
    const { c } = await client(fakeTransport());
    const base = { nProt: '135260000000001', xJust: 'Justificativa longa', cOrgaoAutor: '35', verAplic: 'x' };
    await expect(
      c.cancelarPorSubstituicao({ ...base, chave: chave(), chNFeRef: chave({ nNF: 2 }) }),
    ).rejects.toBeInstanceOf(ErroDeValidacao);
    await expect(
      c.cancelarPorSubstituicao({ ...base, chave: chave({ mod: '65' }), chNFeRef: '123' }),
    ).rejects.toBeInstanceOf(ErroDeValidacao);
  });
});
