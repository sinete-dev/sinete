/**
 * Restrições oficiais: tira dos candidatos de cada item todo cClassTrib que o dado oficial exclui, com o motivo. Só usa
 * o dataset e as tabelas da NT, é síncrono e barato (dá para rodar num formulário a cada tecla).
 *
 * Ordem das restrições (vale o primeiro motivo): vigência, DF-e, tipo de nota, nomenclatura, anexo de NCM ou NBS,
 * atores. Fato desconhecido não exclui nada: sem NCM, a aplicabilidade por NCM não é conferida; sem atores, o vínculo
 * por atores também não.
 */
import type { TimeContext } from '@sinete/core';
import type { ClassTribRecord, IbsCbsDataset, TaxContent } from '@sinete/ibs-cbs-dados';
import { BRASILIA_OFFSET_MINUTES, civilDate } from '@sinete/ibs-cbs-dados';
import { NT_TABLES } from '../validar/index.ts';
import { DeterminationError } from './errors.ts';
import type { Candidate, Exclusion, ItemFacts, OperationFacts, PartyFacts } from './types.ts';

export interface ConstrainOptions {
  readonly dataset: IbsCbsDataset;
  /** O relógio de fato gerador decide a data das tabelas. */
  readonly time: TimeContext;
  /** Deslocamento do fuso do emitente em minutos (padrão: Brasília). */
  readonly utcOffsetMinutes?: number;
}

/** Candidatos e exclusões de um item, só pelas restrições oficiais. */
export interface ItemConstraints {
  readonly n: number;
  readonly candidates: readonly Candidate[];
  readonly exclusions: readonly Exclusion[];
}

const NT = 'NT 2025.002 v1.51';
const ROMAN: readonly string[] = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
];

/** Data civil do fato gerador. */
export function factDate(time: TimeContext, utcOffsetMinutes: number = BRASILIA_OFFSET_MINUTES): string {
  return civilDate(time.fatoGerador.now(), utcOffsetMinutes);
}

export function candidateOf(content: TaxContent, ct: ClassTribRecord): Candidate {
  const treatment = content.treatment(ct);
  return {
    cst: ct.cst,
    cClassTrib: ct.code,
    name: ct.name,
    description: ct.description,
    lc214: ct.legal.lc214,
    link: ct.legal.link,
    requiresRegular: (treatment?.flags.exigeGrupoTribRegular ?? false) || ct.groups.gTribRegular === 'required',
  };
}

function annexName(annex: string | null): string {
  if (annex === null || annex === '') return 'lista de NCM e NBS do cClassTrib';
  const roman = ROMAN[Number(annex)];
  return roman ? `Anexo ${roman} da LC 214/2025` : `anexo técnico ${annex} do IT 2025.002`;
}

function checkFacts(facts: OperationFacts, content: TaxContent): void {
  if (!facts || !Array.isArray(facts.items)) throw new DeterminationError('fatos_invalidos', 'operação sem itens');
  if (!Number.isInteger(facts.modelo)) {
    throw new DeterminationError('fatos_invalidos', `modelo inválido: ${String(facts.modelo)}`);
  }
  const seen = new Set<number>();
  for (const it of facts.items) {
    if (!Number.isInteger(it.n) || it.n < 1 || seen.has(it.n)) {
      throw new DeterminationError('fatos_invalidos', `número de item inválido ou repetido: ${String(it.n)}`, it.n);
    }
    seen.add(it.n);
    if (it.ncm !== undefined && !/^\d{1,8}$/.test(it.ncm)) {
      throw new DeterminationError('fatos_invalidos', `NCM inválido: ${it.ncm}`, it.n);
    }
    if (it.nbs !== undefined && !/^\d{1,9}$/.test(it.nbs)) {
      throw new DeterminationError('fatos_invalidos', `NBS inválida: ${it.nbs}`, it.n);
    }
  }
  for (const [role, party] of [
    ['fornecedor', facts.supplier],
    ['adquirente', facts.buyer],
  ] as const) {
    for (const id of party?.actors ?? []) {
      if (!Number.isInteger(id) || !content.actor(id)) {
        throw new DeterminationError(
          'fatos_invalidos',
          `ator do ${role} inexistente em ${content.asOf}: ${String(id)}`,
        );
      }
    }
  }
  for (const [field, table] of [
    ['tpNFDebito', NT_TABLES.tpNFDebito],
    ['tpNFCredito', NT_TABLES.tpNFCredito],
  ] as const) {
    const code = facts[field];
    if (code !== undefined && !table.some((r) => r.code === code)) {
      throw new DeterminationError('fatos_invalidos', `${field} inexistente na ${NT}: ${code}`);
    }
  }
}

/** Códigos admitidos pelos atores conhecidos da parte, ou `undefined` sem atores (não restringe). */
function admitted(
  content: TaxContent,
  party: PartyFacts | undefined,
  role: 'supplier' | 'buyer',
): Set<string> | undefined {
  const actors = party?.actors ?? [];
  if (actors.length === 0) return undefined;
  return new Set(actors.flatMap((id) => content.byActors({ [role]: id })));
}

type Excluded = Omit<Exclusion, 'cClassTrib'> | undefined;
type Check = (ct: ClassTribRecord, item: ItemFacts) => Excluded;

function noteTypeCheck(facts: OperationFacts): Check {
  if (facts.modelo !== 55 && facts.modelo !== 65) return () => undefined;
  const debit = NT_TABLES.tpNFDebito.find((r) => r.code === facts.tpNFDebito)?.cClassTrib ?? null;
  const credit = NT_TABLES.tpNFCredito.find((r) => r.code === facts.tpNFCredito)?.cClassTrib ?? null;
  return (ct: ClassTribRecord): Excluded => {
    if (debit !== null && ct.code !== debit) {
      return {
        reason: 'tipo-de-nota',
        detail: `tpNFDebito ${facts.tpNFDebito} exige cClassTrib ${debit}`,
        source: `${NT}, UB14-70`,
      };
    }
    if (credit !== null && ct.code !== credit) {
      return {
        reason: 'tipo-de-nota',
        detail: `tpNFCredito ${facts.tpNFCredito} exige cClassTrib ${credit}`,
        source: `${NT}, UB14-80`,
      };
    }
    const row = NT_TABLES.classTribByNoteType.find((r) => r.cClassTrib === ct.code);
    if (!row) return undefined;
    const ok =
      (row.tpNFDebito !== null && facts.tpNFDebito === row.tpNFDebito) ||
      (row.tpNFCredito !== null && facts.tpNFCredito === row.tpNFCredito);
    if (ok) return undefined;
    const needs = [
      row.tpNFDebito && `tpNFDebito ${row.tpNFDebito}`,
      row.tpNFCredito && `tpNFCredito ${row.tpNFCredito}`,
    ];
    return {
      reason: 'tipo-de-nota',
      detail: `cClassTrib ${ct.code} só em nota com ${needs.filter(Boolean).join(' ou ')}`,
      source: `${NT}, UB14-60`,
    };
  };
}

function checks(facts: OperationFacts, content: TaxContent): readonly Check[] {
  const data = `@sinete/ibs-cbs-dados ${content.dataset.contentVersion}`;
  const supplier = admitted(content, facts.supplier, 'supplier');
  const buyer = admitted(content, facts.buyer, 'buyer');
  return [
    (ct: ClassTribRecord): Excluded =>
      content.allowedIn(ct, facts.modelo)
        ? undefined
        : {
            reason: 'dfe',
            detail: `cClassTrib ${ct.code} não habilitado no modelo ${facts.modelo} em ${content.asOf}`,
            source: `${data}, vínculo cClassTrib x DF-e`,
          },
    noteTypeCheck(facts),
    (ct: ClassTribRecord, item: ItemFacts): Excluded => {
      const onlyNbs = item.nbs !== undefined && item.ncm === undefined;
      const onlyNcm = item.ncm !== undefined && item.nbs === undefined;
      if ((ct.nomenclature === 'NCM' && onlyNbs) || (ct.nomenclature === 'NBS' && onlyNcm)) {
        return {
          reason: 'nomenclatura',
          detail: `cClassTrib ${ct.code} pede ${ct.nomenclature} e o item só tem ${onlyNbs ? 'NBS' : 'NCM'}`,
          source: `${data}, nomenclatura do cClassTrib`,
        };
      }
      return undefined;
    },
    (ct: ClassTribRecord, item: ItemFacts): Excluded => {
      for (const kind of ['ncm', 'nbs'] as const) {
        const code = item[kind];
        if (code === undefined) continue;
        const r = kind === 'ncm' ? content.applicableNcm(ct, code) : content.applicableNbs(ct, code);
        if (r.result !== 'no') continue;
        const label = kind.toUpperCase();
        const detail =
          r.excludedBy.length > 0
            ? `${label} ${code} está numa exceção (${r.excludedBy.join(', ')}) do cClassTrib ${ct.code}`
            : `${label} ${code} fora da lista do cClassTrib ${ct.code}`;
        return { reason: kind, detail, source: `${annexName(ct.annex)}; ${data}, aplicabilidade de ${label}` };
      }
      return undefined;
    },
    (ct: ClassTribRecord): Excluded => {
      const bySupplier = supplier !== undefined && !supplier.has(ct.code);
      const byBuyer = buyer !== undefined && !buyer.has(ct.code);
      if (!bySupplier && !byBuyer) return undefined;
      const roles = [bySupplier && 'fornecedor', byBuyer && 'adquirente'].filter(Boolean).join(' e ');
      return {
        reason: 'atores',
        detail: `cClassTrib ${ct.code} tem vínculo de atores que não casa com o ${roles}`,
        source: `${data}, vínculo cClassTrib x atores`,
      };
    },
  ];
}

/** Restrições oficiais na data do fato gerador de `options.time`. */
export function constrain(facts: OperationFacts, options: ConstrainOptions): readonly ItemConstraints[] {
  return constrainAt(facts, options.dataset.at(factDate(options.time, options.utcOffsetMinutes)));
}

/** Restrições oficiais numa visão já fixada numa data. */
export function constrainAt(facts: OperationFacts, content: TaxContent): readonly ItemConstraints[] {
  checkFacts(facts, content);
  const inForce = content.classTribs();
  const live = new Set(inForce.map((c) => c.code));
  const expired = new Map<string, ClassTribRecord>();
  for (const c of content.dataset.tables.classTrib) {
    if (c.family !== 'CBS_IBS' || live.has(c.code)) continue;
    const prev = expired.get(c.code);
    if (!prev || prev.validity.from < c.validity.from) expired.set(c.code, c);
  }
  const rules = checks(facts, content);
  const data = `@sinete/ibs-cbs-dados ${content.dataset.contentVersion}`;
  return facts.items.map((item) => {
    const candidates: Candidate[] = [];
    const exclusions: Exclusion[] = [];
    for (const [code, c] of [...expired].sort(([a], [b]) => a.localeCompare(b))) {
      exclusions.push({
        cClassTrib: code,
        reason: 'vigencia',
        detail: `cClassTrib ${code} fora de vigência em ${content.asOf} (${c.validity.from} a ${c.validity.to ?? 'indeterminado'})`,
        source: `${data}, vigência do cClassTrib`,
      });
    }
    for (const ct of inForce) {
      let excluded: Excluded;
      for (const check of rules) {
        excluded = check(ct, item);
        if (excluded) break;
      }
      if (excluded) exclusions.push({ cClassTrib: ct.code, ...excluded });
      else candidates.push(candidateOf(content, ct));
    }
    return { n: item.n, candidates, exclusions };
  });
}
