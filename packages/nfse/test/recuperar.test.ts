/** `recuperarEventoRegistrado` contra uma consulta que devolve o que não foi pedido (fora do contrato da Sefin). */
import { expect, test } from 'bun:test';
import type { ClienteNfse, EventoRegistrado } from '../src/index.ts';
import { recuperarEventoRegistrado } from '../src/index.ts';

const CHAVE = '35503082211222333000181000000000000126090000000017';

function clienteQueDevolve(eventos: readonly EventoRegistrado[]): ClienteNfse {
  return { consultarEventos: async () => eventos } as unknown as ClienteNfse;
}

const evento = (o: Partial<EventoRegistrado>): EventoRegistrado => ({
  xml: '<evento/>',
  id: 'PRE1',
  chaveAcesso: CHAVE,
  tpEvento: '101101',
  nSeqEvento: '1',
  dhProc: '2026-10-06T10:00:00-03:00',
  ...o,
});

test('evento de outro tipo, de outra sequência ou de outra chave não é o pedido', async () => {
  for (const outro of [{ tpEvento: '105102' }, { nSeqEvento: '2' }, { chaveAcesso: `${CHAVE.slice(0, -1)}8` }]) {
    expect(await recuperarEventoRegistrado(clienteQueDevolve([evento(outro)]), CHAVE, '101101')).toEqual({
      registrado: false,
    });
  }
  const certo = evento({});
  expect(
    await recuperarEventoRegistrado(clienteQueDevolve([evento({ tpEvento: '105102' }), certo]), CHAVE, '101101'),
  ).toEqual({
    registrado: true,
    evento: certo,
  });
});
