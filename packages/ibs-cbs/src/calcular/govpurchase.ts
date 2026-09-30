/**
 * Compras governamentais (LC 214/2025, arts. 370, 472 e 473).
 *
 * Até 2026 cada ente fica com o próprio tributo. A partir de 2027 o art. 473 redistribui o que foi calculado para o
 * ente contratante: a União fica com tudo (CBS recebe a soma e o IBS zera); Estado e Distrito Federal ficam com o IBS
 * municipal e com a parte transferida da CBS (percentual de transição da tabela `transferenciaCbs`); Município, e os entes
 * que a Calculadora trata como município (consórcio público e Comitê Gestor), ficam com o IBS estadual e com a parte
 * transferida da CBS. As contas são exatas, como na Calculadora (`TributacaoCompraGovernamentalDomain`).
 */
import type { TributoDaAliquota } from '../aliquotas/index.ts';
import { Decimal } from './decimal.ts';
import type { DataIso, TpEnteGov } from './types.ts';

/** Alíquota efetiva (em percentual) e valor devido por tributo. */
export type ValoresCompraGov = Readonly<
  Record<TributoDaAliquota, { readonly pAliq: Decimal; readonly vTrib: Decimal }>
>;

/** Primeiro dia em que a redistribuição do art. 473 vale. */
export const REDISTRIBUICAO_A_PARTIR_DE: DataIso = '2027-01-01';

type Ente = 'uniao' | 'estado' | 'municipio';

/** Ente equivalente para a redistribuição. */
export function enteDe(tp: TpEnteGov): Ente {
  if (tp === 1) return 'uniao';
  if (tp === 2 || tp === 3) return 'estado';
  return 'municipio';
}

const zero: ValoresCompraGov[TributoDaAliquota] = { pAliq: Decimal.ZERO, vTrib: Decimal.ZERO };

/**
 * Valores que cada ente efetivamente recebe. `transferPercent` é o percentual da CBS transferido ao ente contratante
 * (`'0'` até 2028), já em fração de 8 casas.
 */
export function redistribuir(
  valores: ValoresCompraGov,
  tp: TpEnteGov,
  data: DataIso,
  fracaoTransferida: Decimal,
): ValoresCompraGov {
  if (data < REDISTRIBUICAO_A_PARTIR_DE) return valores;
  const { CBS, IBSUF, IBSMun } = valores;
  const ente = enteDe(tp);
  if (ente === 'uniao') {
    return {
      CBS: { pAliq: CBS.pAliq.add(IBSUF.pAliq).add(IBSMun.pAliq), vTrib: CBS.vTrib.add(IBSUF.vTrib).add(IBSMun.vTrib) },
      IBSUF: zero,
      IBSMun: zero,
    };
  }
  const pTransf = CBS.pAliq.mul(fracaoTransferida);
  const vTransf = CBS.vTrib.mul(fracaoTransferida);
  const cbs = { pAliq: CBS.pAliq.sub(pTransf), vTrib: CBS.vTrib.sub(vTransf) };
  const joined = {
    pAliq: pTransf.add(IBSUF.pAliq).add(IBSMun.pAliq),
    vTrib: vTransf.add(IBSUF.vTrib).add(IBSMun.vTrib),
  };
  return ente === 'estado' ? { CBS: cbs, IBSUF: joined, IBSMun: zero } : { CBS: cbs, IBSUF: zero, IBSMun: joined };
}
