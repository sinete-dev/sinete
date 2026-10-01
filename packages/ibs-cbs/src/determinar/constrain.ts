/**
 * Restrições oficiais: tira dos candidatos de cada item todo cClassTrib que o dado oficial exclui, com o motivo. Só usa
 * o dataset e as tabelas da NT, é síncrono e barato (dá para rodar num formulário a cada tecla).
 *
 * Ordem das restrições (vale o primeiro motivo): vigência, DF-e, tipo de nota, nomenclatura, anexo de NCM ou NBS,
 * atores. Fato desconhecido não exclui nada: sem NCM, a aplicabilidade por NCM não é conferida; sem atores, o vínculo
 * por atores também não.
 */
import type { ContextoDeTempo } from '@sinete/core';
import type { ConteudoTributario, DatasetIbsCbs, RegistroClassTrib } from '@sinete/ibs-cbs-dados';
import { DESLOCAMENTO_BRASILIA_MIN, dataCivil } from '@sinete/ibs-cbs-dados';
import { exigirFormatoDosDados } from '../formato.ts';
import { TABELAS_NT } from '../validar/index.ts';
import { ErroDeterminacao } from './errors.ts';
import type { Candidato, Exclusao, FatosDaOperacao, FatosDaParte, FatosDoItem } from './types.ts';

export interface RestringirOpcoes {
  readonly dataset: DatasetIbsCbs;
  /** O relógio de fato gerador decide a data das tabelas. */
  readonly tempo: ContextoDeTempo;
  /** Deslocamento do fuso do emitente em minutos (padrão: Brasília). */
  readonly deslocamentoMin?: number;
}

/** Candidatos e exclusões de um item, só pelas restrições oficiais. */
export interface RestricoesDoItem {
  readonly n: number;
  readonly candidatos: readonly Candidato[];
  readonly exclusoes: readonly Exclusao[];
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
export function dataDoFato(tempo: ContextoDeTempo, deslocamentoMin: number = DESLOCAMENTO_BRASILIA_MIN): string {
  return dataCivil(tempo.fatoGerador.agora(), deslocamentoMin);
}

export function candidatoDe(conteudo: ConteudoTributario, ct: RegistroClassTrib): Candidato {
  const treatment = conteudo.tratamento(ct);
  return {
    cst: ct.cst,
    cClassTrib: ct.codigo,
    nome: ct.nome,
    descricao: ct.descricao,
    lc214: ct.legal.lc214,
    url: ct.legal.url,
    exigeRegular: (treatment?.indicadores.exigeGrupoTribRegular ?? false) || ct.grupos.gTribRegular === 'obrigatorio',
  };
}

function annexName(annex: string | null): string {
  if (annex === null || annex === '') return 'lista de NCM e NBS do cClassTrib';
  const roman = ROMAN[Number(annex)];
  return roman ? `Anexo ${roman} da LC 214/2025` : `anexo técnico ${annex} do IT 2025.002`;
}

function checkFacts(facts: FatosDaOperacao, content: ConteudoTributario): void {
  if (!facts || !Array.isArray(facts.itens)) throw new ErroDeterminacao('fatos_invalidos', 'operação sem itens');
  if (!Number.isInteger(facts.modelo)) {
    throw new ErroDeterminacao('fatos_invalidos', `modelo inválido: ${String(facts.modelo)}`);
  }
  const seen = new Set<number>();
  for (const it of facts.itens) {
    if (!Number.isInteger(it.n) || it.n < 1 || seen.has(it.n)) {
      throw new ErroDeterminacao('fatos_invalidos', `número de item inválido ou repetido: ${String(it.n)}`, it.n);
    }
    seen.add(it.n);
    if (it.ncm !== undefined && !/^\d{1,8}$/.test(it.ncm)) {
      throw new ErroDeterminacao('fatos_invalidos', `NCM inválido: ${it.ncm}`, it.n);
    }
    if (it.nbs !== undefined && !/^\d{1,9}$/.test(it.nbs)) {
      throw new ErroDeterminacao('fatos_invalidos', `NBS inválida: ${it.nbs}`, it.n);
    }
  }
  for (const [role, party] of [
    ['fornecedor', facts.fornecedor],
    ['adquirente', facts.adquirente],
  ] as const) {
    for (const id of party?.atores ?? []) {
      if (!Number.isInteger(id) || !content.ator(id)) {
        throw new ErroDeterminacao(
          'fatos_invalidos',
          `ator do ${role} inexistente em ${content.dataDeReferencia}: ${String(id)}`,
        );
      }
    }
  }
  for (const [field, table] of [
    ['tpNFDebito', TABELAS_NT.tpNFDebito],
    ['tpNFCredito', TABELAS_NT.tpNFCredito],
  ] as const) {
    const code = facts[field];
    if (code !== undefined && !table.some((r) => r.codigo === code)) {
      throw new ErroDeterminacao('fatos_invalidos', `${field} inexistente na ${NT}: ${code}`);
    }
  }
}

/** Códigos admitidos pelos atores conhecidos da parte, ou `undefined` sem atores (não restringe). */
function admitted(
  content: ConteudoTributario,
  party: FatosDaParte | undefined,
  role: 'fornecedor' | 'adquirente',
): Set<string> | undefined {
  const actors = party?.atores ?? [];
  if (actors.length === 0) return undefined;
  return new Set(actors.flatMap((id) => content.porAtores({ [role]: id })));
}

type Excluded = Omit<Exclusao, 'cClassTrib'> | undefined;
type Check = (ct: RegistroClassTrib, item: FatosDoItem) => Excluded;

function noteTypeCheck(facts: FatosDaOperacao): Check {
  if (facts.modelo !== 55 && facts.modelo !== 65) return () => undefined;
  const debit = TABELAS_NT.tpNFDebito.find((r) => r.codigo === facts.tpNFDebito)?.cClassTrib ?? null;
  const credit = TABELAS_NT.tpNFCredito.find((r) => r.codigo === facts.tpNFCredito)?.cClassTrib ?? null;
  return (ct: RegistroClassTrib): Excluded => {
    if (debit !== null && ct.codigo !== debit) {
      return {
        motivo: 'tipo-de-nota',
        detalhe: `tpNFDebito ${facts.tpNFDebito} exige cClassTrib ${debit}`,
        fonte: `${NT}, UB14-70`,
      };
    }
    if (credit !== null && ct.codigo !== credit) {
      return {
        motivo: 'tipo-de-nota',
        detalhe: `tpNFCredito ${facts.tpNFCredito} exige cClassTrib ${credit}`,
        fonte: `${NT}, UB14-80`,
      };
    }
    const row = TABELAS_NT.classTribPorTipoDeNota.find((r) => r.cClassTrib === ct.codigo);
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
      motivo: 'tipo-de-nota',
      detalhe: `cClassTrib ${ct.codigo} só em nota com ${needs.filter(Boolean).join(' ou ')}`,
      fonte: `${NT}, UB14-60`,
    };
  };
}

function checks(facts: FatosDaOperacao, content: ConteudoTributario): readonly Check[] {
  const data = `@sinete/ibs-cbs-dados ${content.dataset.versaoDoConteudo}`;
  const supplier = admitted(content, facts.fornecedor, 'fornecedor');
  const buyer = admitted(content, facts.adquirente, 'adquirente');
  return [
    (ct: RegistroClassTrib): Excluded =>
      content.permitidoEm(ct, facts.modelo)
        ? undefined
        : {
            motivo: 'dfe',
            detalhe: `cClassTrib ${ct.codigo} não habilitado no modelo ${facts.modelo} em ${content.dataDeReferencia}`,
            fonte: `${data}, vínculo cClassTrib x DF-e`,
          },
    noteTypeCheck(facts),
    (ct: RegistroClassTrib, item: FatosDoItem): Excluded => {
      const onlyNbs = item.nbs !== undefined && item.ncm === undefined;
      const onlyNcm = item.ncm !== undefined && item.nbs === undefined;
      if ((ct.nomenclatura === 'NCM' && onlyNbs) || (ct.nomenclatura === 'NBS' && onlyNcm)) {
        return {
          motivo: 'nomenclatura',
          detalhe: `cClassTrib ${ct.codigo} pede ${ct.nomenclatura} e o item só tem ${onlyNbs ? 'NBS' : 'NCM'}`,
          fonte: `${data}, nomenclatura do cClassTrib`,
        };
      }
      return undefined;
    },
    (ct: RegistroClassTrib, item: FatosDoItem): Excluded => {
      for (const kind of ['ncm', 'nbs'] as const) {
        const code = item[kind];
        if (code === undefined) continue;
        const r = kind === 'ncm' ? content.ncmAplicavel(ct, code) : content.nbsAplicavel(ct, code);
        if (r.resultado !== 'nao') continue;
        const label = kind.toUpperCase();
        const detail =
          r.excluidoPor.length > 0
            ? `${label} ${code} está numa exceção (${r.excluidoPor.join(', ')}) do cClassTrib ${ct.codigo}`
            : `${label} ${code} fora da lista do cClassTrib ${ct.codigo}`;
        return { motivo: kind, detalhe: detail, fonte: `${annexName(ct.anexo)}; ${data}, aplicabilidade de ${label}` };
      }
      return undefined;
    },
    (ct: RegistroClassTrib): Excluded => {
      const bySupplier = supplier !== undefined && !supplier.has(ct.codigo);
      const byBuyer = buyer !== undefined && !buyer.has(ct.codigo);
      if (!bySupplier && !byBuyer) return undefined;
      const roles = [bySupplier && 'fornecedor', byBuyer && 'adquirente'].filter(Boolean).join(' e ');
      return {
        motivo: 'atores',
        detalhe: `cClassTrib ${ct.codigo} tem vínculo de atores que não casa com o ${roles}`,
        fonte: `${data}, vínculo cClassTrib x atores`,
      };
    },
  ];
}

/** Restrições oficiais na data do fato gerador de `opcoes.tempo`. */
export function restringir(fatos: FatosDaOperacao, opcoes: RestringirOpcoes): readonly RestricoesDoItem[] {
  exigirFormatoDosDados(opcoes.dataset);
  return restringirEm(fatos, opcoes.dataset.em(dataDoFato(opcoes.tempo, opcoes.deslocamentoMin)));
}

/** Restrições oficiais numa visão já fixada numa data. */
export function restringirEm(fatos: FatosDaOperacao, conteudo: ConteudoTributario): readonly RestricoesDoItem[] {
  exigirFormatoDosDados(conteudo.dataset);
  checkFacts(fatos, conteudo);
  const inForce = conteudo.classTribs();
  const live = new Set(inForce.map((c) => c.codigo));
  const expired = new Map<string, RegistroClassTrib>();
  for (const c of conteudo.dataset.tabelas.classTrib) {
    if (c.familia !== 'CBS_IBS' || live.has(c.codigo)) continue;
    const prev = expired.get(c.codigo);
    if (!prev || prev.vigencia.inicio < c.vigencia.inicio) expired.set(c.codigo, c);
  }
  const rules = checks(fatos, conteudo);
  const data = `@sinete/ibs-cbs-dados ${conteudo.dataset.versaoDoConteudo}`;
  return fatos.itens.map((item) => {
    const candidates: Candidato[] = [];
    const exclusions: Exclusao[] = [];
    for (const [code, c] of [...expired].sort(([a], [b]) => a.localeCompare(b))) {
      exclusions.push({
        cClassTrib: code,
        motivo: 'vigencia',
        detalhe: `cClassTrib ${code} fora de vigência em ${conteudo.dataDeReferencia} (${c.vigencia.inicio} a ${c.vigencia.fim ?? 'indeterminado'})`,
        fonte: `${data}, vigência do cClassTrib`,
      });
    }
    for (const ct of inForce) {
      let excluded: Excluded;
      for (const check of rules) {
        excluded = check(ct, item);
        if (excluded) break;
      }
      if (excluded) exclusions.push({ cClassTrib: ct.codigo, ...excluded });
      else candidates.push(candidatoDe(conteudo, ct));
    }
    return { n: item.n, candidatos: candidates, exclusoes: exclusions };
  });
}
