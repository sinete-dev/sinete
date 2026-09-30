/**
 * Provedores de alíquota. `aliquotasOficiais` responde pela tabela versionada (fonte e vigência em cada linha);
 * `comAliquotasInformadas` sobrepõe alíquotas informadas pelo usuário, que saem com estado `informada` e o motivo.
 * `exigirAliquota` é a fronteira: devolve o valor ou lança `ErroAliquotaDesconhecida`, nunca um default.
 */
import { ErroDeConfiguracao } from '@sinete/core';
import table from './data/rates.json' with { type: 'json' };
import { ErroAliquotaDesconhecida, ErroDadosDeAliquotas } from './errors.ts';
import type {
  Aliquota,
  AliquotaInformada,
  AliquotasNominais,
  DataIso,
  Local,
  ProvedorDeAliquotas,
  RegistroAliquotaDeReferencia,
  RegistroAliquotaPadrao,
  TabelaDeAliquotas,
  TributoDaAliquota,
  Vigencia,
} from './types.ts';
import { TRIBUTOS_DAS_ALIQUOTAS } from './types.ts';

/** Formato de tabela que este código lê. */
export const VERSAO_DO_FORMATO_DAS_ALIQUOTAS = 2;

/** A tabela embarcada nesta versão do pacote. */
export const TABELA_ALIQUOTAS: TabelaDeAliquotas = table as unknown as TabelaDeAliquotas;

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DECIMAL = /^\d{1,3}(\.\d{1,4})?$/;

function checkDate(date: DataIso): DataIso {
  if (typeof date !== 'string' || !ISO_DATE.test(date)) {
    throw new ErroDeConfiguracao(`data inválida: ${JSON.stringify(date)}; use AAAA-MM-DD`, {
      detalhes: { data: date },
    });
  }
  return date;
}

const inForce = (v: Vigencia, d: DataIso): boolean => v.inicio <= d && (v.fim === null || v.fim >= d);
const overlaps = (a: Vigencia, b: Vigencia): boolean =>
  a.inicio <= (b.fim ?? '9999-12-31') && b.inicio <= (a.fim ?? '9999-12-31');

function checkPercent(value: unknown, where: string): void {
  if (typeof value !== 'string' || !DECIMAL.test(value) || Number(value) > 100) {
    throw new ErroDadosDeAliquotas(`${where}: alíquota fora do formato (percentual de 0 a 100, até 4 casas): ${value}`);
  }
}

function validateTable(t: TabelaDeAliquotas): void {
  if (t.versaoDoFormato !== VERSAO_DO_FORMATO_DAS_ALIQUOTAS) {
    throw new ErroDadosDeAliquotas(
      `versaoDoFormato ${t.versaoDoFormato} não suportado; este código lê ${VERSAO_DO_FORMATO_DAS_ALIQUOTAS}`,
    );
  }
  const ids = new Set(t.fontes.map((s) => s.id));
  const check = (r: RegistroAliquotaDeReferencia | RegistroAliquotaPadrao, where: string): void => {
    if (!ISO_DATE.test(r.vigencia.inicio) || (r.vigencia.fim !== null && !ISO_DATE.test(r.vigencia.fim))) {
      throw new ErroDadosDeAliquotas(`${where}: vigência inválida`);
    }
    for (const s of r.fontes) if (!ids.has(s)) throw new ErroDadosDeAliquotas(`${where}: fonte ${s} inexistente`);
  };
  t.referencia.forEach((r, i) => {
    const where = `referencia[${i}] ${r.tributo} ${r.vigencia.inicio}`;
    check(r, where);
    if (r.situacao === 'oficial') checkPercent(r.aliquota, where);
    else if (r.aliquota !== null) throw new ErroDadosDeAliquotas(`${where}: alíquota desconhecida com valor`);
    const clash = t.referencia.find((o, j) => j !== i && o.tributo === r.tributo && overlaps(o.vigencia, r.vigencia));
    if (clash)
      throw new ErroDadosDeAliquotas(`${where}: vigência sobreposta a ${clash.tributo} ${clash.vigencia.inicio}`);
  });
  t.padrao.forEach((r, i) => {
    const where = `padrao[${i}] ${r.tributo} ${r.ente} ${r.vigencia.inicio}`;
    check(r, where);
    checkPercent(r.aliquota, where);
    const clash = t.padrao.find(
      (o, j) => j !== i && o.tributo === r.tributo && o.ente === r.ente && overlaps(o.vigencia, r.vigencia),
    );
    if (clash) throw new ErroDadosDeAliquotas(`${where}: vigência sobreposta`);
  });
}

function unknownRate(tributo: TributoDaAliquota, note: string): Aliquota {
  return { tributo, situacao: 'desconhecida', valor: null, fontes: [], nota: note };
}

function fromReference(r: RegistroAliquotaDeReferencia): Aliquota {
  return {
    tributo: r.tributo,
    situacao: r.situacao,
    valor: r.aliquota,
    legal: r.legal,
    fontes: r.fontes,
    vigencia: r.vigencia,
    ...(r.nota === undefined ? {} : { nota: r.nota }),
  };
}

/** Provedor da tabela oficial (a embarcada, por padrão). */
export function aliquotasOficiais(t: TabelaDeAliquotas = TABELA_ALIQUOTAS): ProvedorDeAliquotas {
  validateTable(t);
  const reference = (tributo: TributoDaAliquota, d: DataIso): Aliquota => {
    const r = t.referencia.find((x) => x.tributo === tributo && inForce(x.vigencia, d));
    return r
      ? fromReference(r)
      : unknownRate(tributo, `sem alíquota de ${tributo} na tabela para ${d} (antes de 2026 não há IBS/CBS)`);
  };
  const standard = (tributo: TributoDaAliquota, d: DataIso, place: Local | undefined): Aliquota => {
    if (place && tributo !== 'CBS') {
      const ente = tributo === 'IBSUF' ? place.uf : place.cMun;
      const s = t.padrao.find((x) => x.tributo === tributo && x.ente === ente && inForce(x.vigencia, d));
      if (s)
        return {
          tributo,
          situacao: 'oficial',
          valor: s.aliquota,
          legal: s.legal,
          fontes: s.fontes,
          vigencia: s.vigencia,
        };
    }
    // Sem lei própria do ente, vale a alíquota de referência (LC 214/2025, art. 18).
    return reference(tributo, d);
  };
  const all = (f: (t: TributoDaAliquota) => Aliquota): AliquotasNominais => ({
    CBS: f('CBS'),
    IBSUF: f('IBSUF'),
    IBSMun: f('IBSMun'),
  });
  return {
    id: `oficial ${t.versaoDosDados}`,
    nominal: (date: DataIso, place?: Local): AliquotasNominais => {
      const d = checkDate(date);
      return all((tr) => standard(tr, d, place));
    },
    referencia: (date: DataIso): AliquotasNominais => {
      const d = checkDate(date);
      return all((tr) => reference(tr, d));
    },
  };
}

function validateOverride(o: AliquotaInformada, i: number): void {
  const where = `override[${i}]`;
  if (!TRIBUTOS_DAS_ALIQUOTAS.includes(o.tributo))
    throw new ErroDeConfiguracao(`${where}: tributo inválido: ${String(o.tributo)}`);
  if (typeof o.valor !== 'string' || !DECIMAL.test(o.valor) || Number(o.valor) > 100) {
    throw new ErroDeConfiguracao(
      `${where}: alíquota inválida (percentual de 0 a 100, até 4 casas): ${String(o.valor)}`,
    );
  }
  if (typeof o.motivo !== 'string' || o.motivo.trim() === '') {
    throw new ErroDeConfiguracao(`${where}: informe o motivo da alíquota informada (reason)`);
  }
  if (o.vigencia) {
    checkDate(o.vigencia.inicio);
    if (o.vigencia.fim !== null) checkDate(o.vigencia.fim);
  }
}

/**
 * Sobrepõe alíquotas informadas pelo usuário. A primeira sobreposição que casar (tributo, vigência, local, tipo)
 * vence; as demais alíquotas continuam vindo de `base`. O resultado sai `informada`, com o motivo.
 */
export function comAliquotasInformadas(
  base: ProvedorDeAliquotas,
  informadas: readonly AliquotaInformada[],
): ProvedorDeAliquotas {
  informadas.forEach(validateOverride);
  const apply = (
    rates: AliquotasNominais,
    d: DataIso,
    kind: 'nominal' | 'referencia',
    place?: Local,
  ): AliquotasNominais => {
    const pick = (tributo: TributoDaAliquota): Aliquota => {
      const o = informadas.find(
        (x) =>
          x.tributo === tributo &&
          (x.aplicaA ?? 'ambas') !== (kind === 'nominal' ? 'referencia' : 'nominal') &&
          (!x.vigencia || inForce(x.vigencia, d)) &&
          (!x.local ||
            (place !== undefined &&
              (x.local.uf === undefined || x.local.uf === place.uf) &&
              (x.local.cMun === undefined || x.local.cMun === place.cMun))),
      );
      if (!o) return rates[tributo];
      return {
        tributo,
        situacao: 'informada',
        valor: o.valor,
        fontes: o.fonte ? ['usuario', o.fonte] : ['usuario'],
        motivo: o.motivo,
        ...(o.vigencia ? { vigencia: o.vigencia } : {}),
      };
    };
    return { CBS: pick('CBS'), IBSUF: pick('IBSUF'), IBSMun: pick('IBSMun') };
  };
  return {
    id: `${base.id} + ${informadas.length} informada(s)`,
    nominal: (date: DataIso, place?: Local): AliquotasNominais =>
      apply(base.nominal(date, place), checkDate(date), 'nominal', place),
    referencia: (date: DataIso): AliquotasNominais => apply(base.referencia(date), checkDate(date), 'referencia'),
  };
}

/** Valor da alíquota, ou `ErroAliquotaDesconhecida` quando ela ainda não existe. */
export function exigirAliquota(aliquota: Aliquota, data: DataIso): string {
  if (aliquota.valor === null || aliquota.situacao === 'desconhecida') {
    throw new ErroAliquotaDesconhecida(
      aliquota.tributo,
      data,
      `alíquota de ${aliquota.tributo} desconhecida em ${data}${aliquota.nota ? `: ${aliquota.nota}` : ''}; informe-a com comAliquotasInformadas para simular`,
      { detalhes: { tributo: aliquota.tributo, data, legal: aliquota.legal } },
    );
  }
  return aliquota.valor;
}

/** Alguma das alíquotas não é oficial: o cálculo feito com elas é simulação. */
export function ehSimulada(aliquotas: AliquotasNominais): boolean {
  return TRIBUTOS_DAS_ALIQUOTAS.some((t) => aliquotas[t].situacao !== 'oficial');
}
