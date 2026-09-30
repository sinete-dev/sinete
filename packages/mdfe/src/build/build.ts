/**
 * Montagem do MDF-e 3.00b (modal rodoviário): entrada do domínio (`MdfeInput`) para o objeto tipado do
 * `@sinete/schemas` (`mdfe/3.00b`, escolhido pela vigência), com a chave de acesso, os derivados e as regras de
 * validação do MOC (Anexo I, grupo F) conferidas antes de qualquer serialização. A saída é a string canônica de
 * `<MDFe>` sem `infMDFeSupl` e sem assinatura, já validada contra o schema; `signMdfe` acrescenta o QR Code e a
 * `Signature` por splice (ADR 0003) e nada mais toca nela.
 */

import type { Ambiente, Assinador, ContextoDeTempo, Ocorrencia } from '@sinete/core';
import {
  ErroDeConfiguracao,
  ErroDeValidacao,
  ErroNaoSuportado,
  ehUf,
  formatarVerProc,
  relogioFixo,
  tpAmbDoAmbiente,
  ufPorSigla,
} from '@sinete/core';
import { assinarXml, codificarBase64, lerXml, PREFIXO_DIGEST_INFO_SHA1, primeiroFilho } from '@sinete/core/xml';
import type { ComplexType, VigenciaEntry } from '@sinete/schemas';
import { SerializeError, selecionarPl, serialize, validate } from '@sinete/schemas';
import type { TMDFe_infMDFe } from '@sinete/schemas/mdfe/3.00b';
import { TMDFe_infMDFe as InfMDFe300b } from '@sinete/schemas/mdfe/3.00b';
import type { ChaveAcesso } from '@sinete/validators';
import { lerChaveAcesso, lerCnpj, lerCpf, lerIe, montarChaveAcesso } from '@sinete/validators';
import emissao from '../data/emissao.json' with { type: 'json' };
import qrcode from '../data/qrcode.json' with { type: 'json' };
import regras from '../data/regras.json' with { type: 'json' };
import type { DecimalFormat, DecimalInput } from '../decimal.ts';
import { D1104, D1302, D1302_OPC, Decimal, formatDecimal, formatProblem, sum } from '../decimal.ts';
import type { MdfeIssueCode } from '../issues.ts';
import { Issues } from '../issues.ts';
import type {
  Contratante,
  Descarregamento,
  DocumentoContratante,
  DocumentoPessoa,
  LocalLotacao,
  MdfeInput,
  NfeTransportada,
  PagamentoFrete,
  Proprietario,
  ResponsavelTecnico,
} from '../model.ts';
import { conferirPercurso, sugerirPercurso } from '../percurso.ts';
import type { Instante } from '../time.ts';
import { dataDe, formatDh, offsetDaUf } from '../time.ts';
import { VERSAO_PACOTE } from '../versao-gerada.ts';

export const MDFE_NS = 'http://www.portalfiscal.inf.br/mdfe';
const VERSAO = '3.00';
const BRASILIA = -180;
/** Tolerância das regras de valor do pagamento (Anexo I, F58 e F62). */
const TOLERANCIA = Decimal.of('0.01');

export interface BuildMdfeOptions {
  readonly ambiente: Ambiente;
  /** Relógio de emissão (dhEmi, schema vigente, regras com vigência). O MDF-e não usa o de fato gerador. */
  readonly time: ContextoDeTempo;
  /** Fuso do emitente em minutos; padrão pela UF (`data/fusos.json`). */
  readonly offsetMinutes?: number;
  /** Versão do aplicativo emissor (`verProc`); padrão `sinete <versão do @sinete/mdfe>` (`formatarVerProc`). */
  readonly verProc?: string;
  /**
   * `1` emissão normal (padrão) ou `2` contingência off-line: o QR Code leva o parâmetro `sign` e o MDF-e tem 168
   * horas para ser transmitido (MOC Visão Geral, item 11). O regime especial da NFF (`3`) não é emitido pelo sinete.
   */
  readonly tpEmis?: '1' | '2';
  /** Responsável técnico padrão, usado quando o MDF-e não traz `respTec`. */
  readonly respTec?: ResponsavelTecnico;
  /** Fonte de aleatoriedade para o cMDF; padrão `crypto.getRandomValues`. */
  readonly random?: (bytes: Uint8Array) => Uint8Array;
}

export interface BuiltMdfe {
  /** Chave de acesso (44 posições). */
  readonly chave: string;
  /** `Id` do `infMDFe` (`MDFe` + chave): é o que a assinatura referencia. */
  readonly id: string;
  readonly cMDF: string;
  readonly cDV: string;
  readonly tpEmis: '1' | '2';
  readonly tpAmb: '1' | '2';
  readonly dhEmi: string;
  /** Schema usado (escolhido pela vigência). */
  readonly schema: VigenciaEntry;
  readonly infMDFe: TMDFe_infMDFe;
  /** `<MDFe xmlns="...">` com o `infMDFe` canônico, sem `infMDFeSupl` e sem assinatura, validado contra o schema. */
  readonly xml: string;
}

export type BuildMdfeResult =
  | { readonly ok: true; readonly value: BuiltMdfe }
  | { readonly ok: false; readonly issues: readonly Ocorrencia[] };

/** Descritor de `infMDFe` de cada módulo da família `mdfe` da tabela de vigências. */
const INF_MDFE: Readonly<Record<string, ComplexType>> = { 'mdfe/3.00b': InfMDFe300b as ComplexType };

const PLACA = new RegExp(emissao.placa.padrao);
const [SERIE_CPF_INI, SERIE_CPF_FIM] = emissao.series.cpf as [number, number];

type Doc = { CNPJ: string } | { CPF: string };
type Obj = Record<string, unknown>;

function clean<T extends object>(o: T): T {
  const out: Obj = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

const digits = (s: string): string => s.replace(/\D/g, '');

function randomBytes(b: Uint8Array): Uint8Array {
  return globalThis.crypto.getRandomValues(b as Uint8Array<ArrayBuffer>);
}

function cUFde(uf: string): string | undefined {
  return ehUf(uf) ? ufPorSigla(uf)?.cUF : undefined;
}

/** Regra com vigência (`data/regras.json`) em vigor no dia de Brasília da emissão. */
function emVigor(regra: keyof typeof regras.regras, ambiente: Ambiente, agora: Instante): boolean {
  const r = regras.regras[regra];
  const inicio = ambiente === 'producao' ? r.producao : r.homologacao;
  return formatDh(agora, BRASILIA).slice(0, 10) >= inicio;
}

function textoXmlValido(texto: string): boolean {
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0;
    const ok =
      c === 0x9 ||
      c === 0xa ||
      c === 0xd ||
      (c >= 0x20 && c <= 0xd7ff) ||
      (c >= 0xe000 && c <= 0xfffd) ||
      (c >= 0x10000 && c <= 0x10ffff);
    if (!ok) return false;
  }
  return true;
}

function textosForaDoXml(value: unknown, path: string, issues: Issues): void {
  if (typeof value === 'string') {
    if (!textoXmlValido(value)) issues.montagem(path, 'campo_invalido', 'texto com caractere não permitido em XML');
  } else if (Array.isArray(value)) {
    for (const [n, v] of value.entries()) textosForaDoXml(v, `${path}[${n}]`, issues);
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) textosForaDoXml(v, `${path}.${k}`, issues);
  }
}

/** Contexto da montagem: ocorrências e conversão de números conferida contra o formato do campo. */
class Ctx {
  readonly issues = new Issues();

  num(value: DecimalInput | undefined, path: string, format: DecimalFormat): Decimal | undefined {
    if (value === undefined) return undefined;
    const d = Decimal.tryOf(value);
    if (d === undefined) {
      this.issues.add(path, 'decimal_invalido', 'número decimal inválido (use ponto como separador, sem milhar)');
      return undefined;
    }
    const problem = formatProblem(d, format);
    if (problem !== undefined) {
      this.issues.add(path, 'decimal_invalido', `${problem} (${format.name})`);
      return undefined;
    }
    return d;
  }

  req(value: DecimalInput | undefined, path: string, format: DecimalFormat): Decimal {
    if (value === undefined) {
      this.issues.add(path, 'campo_obrigatorio', 'campo obrigatório');
      return Decimal.ZERO;
    }
    return this.num(value, path, format) ?? Decimal.ZERO;
  }

  /** Documento de pessoa normalizado; inválido vira a ocorrência do validador, com a regra e o cStat do MOC. */
  doc(d: Partial<DocumentoPessoa> | undefined, path: string, regra?: string, cStat?: string): Doc | undefined {
    if (d === undefined) return undefined;
    const sufixo = regra === undefined ? '' : ` (${regra}, rejeição ${cStat})`;
    if (d.CNPJ !== undefined) {
      const r = lerCnpj(d.CNPJ, { caminho: `${path}.CNPJ` });
      if (!r.ok) this.issues.list.push({ ...r.erro, mensagem: `${r.erro.mensagem}${sufixo}` });
      return { CNPJ: r.ok ? r.valor : d.CNPJ };
    }
    if (d.CPF !== undefined) {
      const r = lerCpf(d.CPF, { caminho: `${path}.CPF` });
      if (!r.ok) this.issues.list.push({ ...r.erro, mensagem: `${r.erro.mensagem}${sufixo}` });
      return { CPF: r.ok ? r.valor : d.CPF };
    }
    this.issues.add(path, 'campo_obrigatorio', 'informe o CNPJ ou o CPF');
    return undefined;
  }

  docContratante(
    d: DocumentoContratante,
    path: string,
    regra: string,
    cStat: string,
  ): Doc | { idEstrangeiro: string } | undefined {
    if ('idEstrangeiro' in d && d.idEstrangeiro !== undefined) return { idEstrangeiro: d.idEstrangeiro };
    return this.doc(d as DocumentoPessoa, path, regra, cStat);
  }

  regra(path: string, code: MdfeIssueCode, message: string, regra: string, cStat: string): void {
    this.issues.regra(path, code, message, regra, cStat);
  }
}

const docKey = (d: Doc | { idEstrangeiro: string } | undefined): string | undefined =>
  d === undefined ? undefined : 'CNPJ' in d ? d.CNPJ : 'CPF' in d ? d.CPF : d.idEstrangeiro;

/** Inteiro do leiaute (`tara`, `capKG`, `capM3`): sem casas e sem zero à esquerda. */
function inteiro(v: number | string | undefined, path: string, max: number, ctx: Ctx): string | undefined {
  if (v === undefined) return undefined;
  const s = String(v).trim();
  if (!/^(0|[1-9][0-9]*)$/.test(s) || s.length > max) {
    ctx.issues.add(path, 'campo_invalido', `inteiro de até ${max} dígitos, sem casas decimais`);
    return s;
  }
  return s;
}

function placa(p: string): string {
  return p.replace(/[\s-]/g, '').toUpperCase();
}

function local(l: LocalLotacao): Obj {
  return 'CEP' in l ? { CEP: digits(l.CEP) } : { latitude: l.latitude, longitude: l.longitude };
}

/** Instante utilizável (o tipo não impede um `Date` inválido nem, em JS, outro valor). */
function instanteValido(x: unknown): x is Instante {
  const t = (x as { getTime?: unknown } | null | undefined)?.getTime;
  return typeof t === 'function' && Number.isFinite(t.call(x));
}

/** O cMDF informado, ou um sorteado que não repete o número do MDF-e. */
function gerarCmdf(informado: string | undefined, nMDF: number, random: (b: Uint8Array) => Uint8Array): string {
  if (informado !== undefined) return informado;
  for (;;) {
    const b = random(new Uint8Array(4));
    const v = ((b[0] ?? 0) * 2 ** 24 + (b[1] ?? 0) * 2 ** 16 + (b[2] ?? 0) * 2 ** 8 + (b[3] ?? 0)) % 100_000_000;
    if (v !== nMDF) return String(v).padStart(8, '0');
  }
}

interface ChaveDoc {
  readonly chave: string;
  readonly path: string;
  readonly municipio: number;
}

/** Documentos de um tipo: chave válida (F30/F37), segundo código de barras (F35/F36, F41/F42) e duplicidade (F28/F29). */
function documentos(
  ctx: Ctx,
  lista: readonly ChaveDoc[],
  tipo: {
    mod: string;
    nome: string;
    regraChave: [string, string];
    regraAntiga: [string, string];
    regraSeg: [string, string, string, string];
  },
  interestadual: boolean,
  aammMinimo: number,
): void {
  const vistos = new Map<string, string>();
  for (const d of lista) {
    const r = lerChaveAcesso(d.chave, { caminho: d.path });
    if (!r.ok || r.valor.mod !== tipo.mod) {
      const motivo = r.ok ? `modelo ${r.valor.mod} diferente de ${tipo.mod}` : r.erro.mensagem;
      ctx.regra(d.path, 'chave_invalida', `chave de ${tipo.nome} inválida: ${motivo}`, ...tipo.regraChave);
      continue;
    }
    if (r.valor.ano * 100 + r.valor.mes < aammMinimo) {
      ctx.regra(
        d.path,
        'chave_invalida',
        `chave de ${tipo.nome} de ${r.valor.aamm.slice(2)}/${r.valor.ano} é anterior a ${emissao.chaveAntiga.meses} meses da emissão`,
        ...tipo.regraAntiga,
      );
    }
    const escopo = interestadual ? r.valor.chave : `${d.municipio}:${r.valor.chave}`;
    const anterior = vistos.get(escopo);
    if (anterior !== undefined) {
      ctx.regra(
        d.path,
        'duplicado',
        `chave de ${tipo.nome} repetida (já em ${anterior})`,
        tipo.mod === '57' ? 'F28' : 'F29',
        tipo.mod === '57' ? '668' : '669',
      );
    } else vistos.set(escopo, d.path);
  }
}

function segCodBarra(
  ctx: Ctx,
  chave: ChaveAcesso | undefined,
  seg: string | undefined,
  path: string,
  regras: [string, string, string, string],
): void {
  if (chave === undefined) return;
  const fsda = chave.tpEmis === emissao.segCodBarra.tpEmisFsDa;
  if (fsda && seg === undefined) {
    ctx.regra(path, 'campo_obrigatorio', 'documento em contingência FS-DA exige SegCodBarra', regras[0], regras[1]);
  } else if (!fsda && seg !== undefined) {
    ctx.regra(path, 'combinacao_invalida', 'SegCodBarra só para documento em FS-DA', regras[2], regras[3]);
  }
}

function pagamento(ctx: Ctx, p: PagamentoFrete, path: string, dataEmissao: string): Obj {
  const docP = ctx.docContratante(p, path, 'F56', '727');
  if (p.componentes.length === 0) ctx.issues.add(`${path}.componentes`, 'campo_obrigatorio', 'ao menos um componente');
  const comps = p.componentes.map((c, n) => ({
    c,
    v: ctx.req(c.vComp, `${path}.componentes[${n}].vComp`, D1302),
  }));
  const soma = sum(comps.map((x) => x.v));
  const vContratoIn = ctx.num(p.vContrato, `${path}.vContrato`, D1302);
  if (vContratoIn?.minus(soma).abs().gt(TOLERANCIA)) {
    ctx.regra(
      `${path}.vContrato`,
      'pagamento_invalido',
      `soma dos componentes (${formatDecimal(soma, D1302)}) difere do valor do contrato`,
      'F58',
      '746',
    );
  }
  const vContrato = vContratoIn ?? soma;
  const vAdiant = ctx.num(p.vAdiant, `${path}.vAdiant`, D1302);
  const parcelas = p.parcelas ?? [];
  if (p.indPag === '1' && parcelas.length === 0) {
    ctx.regra(`${path}.parcelas`, 'pagamento_invalido', 'pagamento a prazo exige as parcelas', 'F52', '724');
  }
  if (p.indPag === '0' && parcelas.length > 0) {
    ctx.regra(`${path}.parcelas`, 'pagamento_invalido', 'pagamento à vista não tem parcelas', 'F53', '729');
  }
  if (p.indPag === '0' && vAdiant !== undefined) {
    ctx.regra(`${path}.vAdiant`, 'pagamento_invalido', 'adiantamento só no pagamento a prazo', 'F63', '739');
  }
  let anterior: string | undefined;
  const infPrazo = parcelas.map((x, n) => {
    const pp = `${path}.parcelas[${n}]`;
    const nParcela = String(n + 1).padStart(3, '0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(x.dVenc)) ctx.issues.add(`${pp}.dVenc`, 'campo_invalido', 'data AAAA-MM-DD');
    else {
      if (x.dVenc < dataEmissao) {
        ctx.regra(`${pp}.dVenc`, 'pagamento_invalido', `parcela ${nParcela} vence antes da emissão`, 'F60', '736');
      }
      if (anterior !== undefined && x.dVenc < anterior) {
        ctx.regra(`${pp}.dVenc`, 'pagamento_invalido', `parcela ${nParcela} vence antes da anterior`, 'F61', '737');
      }
      anterior = x.dVenc;
    }
    return { nParcela, dVenc: x.dVenc, v: ctx.req(x.vParcela, `${pp}.vParcela`, D1302_OPC) };
  });
  if (p.indPag === '1' && parcelas.length > 0) {
    const total = sum(infPrazo.map((x) => x.v)).plus(vAdiant ?? Decimal.ZERO);
    if (total.minus(vContrato).abs().gt(TOLERANCIA)) {
      ctx.regra(
        `${path}.parcelas`,
        'pagamento_invalido',
        `parcelas mais adiantamento (${formatDecimal(total, D1302)}) diferem do valor do contrato`,
        'F62',
        '738',
      );
    }
  }
  let infBanc: Obj;
  if ('CNPJIPEF' in p.banco) {
    const r = lerCnpj(p.banco.CNPJIPEF, { caminho: `${path}.banco.CNPJIPEF` });
    if (!r.ok) ctx.regra(`${path}.banco.CNPJIPEF`, 'documento_invalido', 'CNPJ da IPEF inválido', 'F57', '728');
    infBanc = { CNPJIPEF: r.ok ? r.valor : p.banco.CNPJIPEF };
  } else if ('PIX' in p.banco) infBanc = { PIX: p.banco.PIX };
  else infBanc = { codBanco: p.banco.codBanco, codAgencia: p.banco.codAgencia };
  return clean({
    xNome: p.xNome,
    ...docP,
    Comp: comps.map(({ c, v }) => clean({ tpComp: c.tpComp, vComp: formatDecimal(v, D1302), xComp: c.xComp })),
    vContrato: formatDecimal(vContrato, D1302),
    indAltoDesemp: p.indAltoDesemp ? '1' : undefined,
    indPag: p.indPag,
    vAdiant: vAdiant === undefined ? undefined : formatDecimal(vAdiant, D1302),
    indAntecipaAdiant: p.indAntecipaAdiant ? '1' : undefined,
    infPrazo:
      infPrazo.length === 0
        ? undefined
        : infPrazo.map((x) => ({ nParcela: x.nParcela, dVenc: x.dVenc, vParcela: formatDecimal(x.v, D1302_OPC) })),
    tpAntecip: p.tpAntecip,
    infBanc,
  });
}

/**
 * Grupos `infPag` do leiaute a partir dos pagamentos do domínio, com as regras de pagamento do Anexo I (F52, F53, F56 a
 * F63). O evento de pagamento da operação (110116) usa o mesmo leiaute e as mesmas regras (Visão Geral, item 6.5.1,
 * K07 a K16); `dataReferencia` é o dia (`AAAA-MM-DD`) que nenhuma parcela pode anteceder.
 */
export function pagamentosDoLeiaute(
  pagamentos: readonly PagamentoFrete[],
  dataReferencia: string,
  path = 'pagamentos',
): { readonly infPag: readonly Record<string, unknown>[]; readonly issues: readonly Ocorrencia[] } {
  const ctx = new Ctx();
  const infPag = pagamentos.map((p, n) => pagamento(ctx, p, `${path}[${n}]`, dataReferencia));
  return { infPag, issues: ctx.issues.list };
}

function proprietario(ctx: Ctx, p: Proprietario, path: string, regra: string, cStat: string): Obj {
  const d = ctx.doc(p, path, regra, cStat);
  return clean({
    ...d,
    RNTRC: p.RNTRC,
    xNome: p.xNome,
    IE: p.IE,
    UF: p.IE === undefined ? undefined : p.UF,
    tpProp: p.tpProp,
  });
}

/**
 * Monta o MDF-e. Devolve as ocorrências (todas de uma vez) em vez do documento quando alguma regra falha; a exceção
 * fica para erro de configuração (vigência sem schema conhecido, UF inválida no relógio).
 */
export function buildMdfe(input: MdfeInput, options: BuildMdfeOptions): BuildMdfeResult {
  const ctx = new Ctx();
  const issues = ctx.issues;
  const random = options.random ?? randomBytes;
  const tpEmis = options.tpEmis ?? '1';
  if ((tpEmis as string) !== '1' && (tpEmis as string) !== '2') {
    // tpEmis vem das opções do montador, não da entrada.
    issues.montagem('tpEmis', 'contingencia_invalida', 'tpEmis 1 (normal) ou 2 (contingência off-line)');
    return { ok: false, issues: issues.classificadas };
  }
  const e = input.emitente;
  const emitUf = e.endereco.UF;
  if (!ehUf(emitUf)) {
    issues.add('emitente.endereco.UF', 'campo_invalido', 'UF do emitente inválida');
    return { ok: false, issues: issues.classificadas };
  }
  const cUF = cUFde(emitUf) as string;
  const offset = options.offsetMinutes ?? offsetDaUf(emitUf);
  const agora = options.time.emissao.agora();
  const dhEmi = formatDh(agora, offset);
  const dataEmissao = dataDe(agora, offset);
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const tpAmb = tpAmbDoAmbiente(options.ambiente);

  // Schema vigente (VigenciaError do schemas propaga: data fora de toda vigência é configuração, não dado).
  const vigencia = selecionarPl('mdfe', options.ambiente, relogioFixo(agora));
  const infCt = INF_MDFE[vigencia.modulo];
  if (infCt === undefined) {
    throw new ErroNaoSuportado(`@sinete/mdfe não conhece o módulo ${vigencia.modulo}; atualize o pacote`);
  }

  // Emitente (F67 a F73, F77)
  const emitDoc = ctx.doc(e, 'emitente', e.CNPJ !== undefined ? 'F67' : 'F68', e.CNPJ !== undefined ? '207' : '210');
  const serie = Number(input.serie);
  const nMDF = Number(input.nMDF);
  const serieValida = Number.isInteger(serie) && serie >= 0 && serie <= 999;
  const nMDFValido = Number.isInteger(nMDF) && nMDF >= 1 && nMDF <= 999_999_999;
  if (!serieValida) issues.add('serie', 'serie_invalida', 'série de 0 a 999');
  if (!nMDFValido) {
    issues.add('nMDF', 'campo_invalido', 'nMDF de 1 a 999999999');
  }
  const serieCpf = serie >= SERIE_CPF_INI && serie <= SERIE_CPF_FIM;
  if (emitDoc !== undefined && 'CPF' in emitDoc && !serieCpf) {
    ctx.regra(
      'serie',
      'serie_invalida',
      `emitente CPF usa as séries ${SERIE_CPF_INI} a ${SERIE_CPF_FIM}`,
      'F70',
      '233',
    );
  }
  if (emitDoc !== undefined && 'CNPJ' in emitDoc && serieCpf) {
    ctx.regra(
      'serie',
      'serie_invalida',
      `séries ${SERIE_CPF_INI} a ${SERIE_CPF_FIM} são do emitente CPF`,
      'F69',
      '232',
    );
  }
  if (emitDoc !== undefined && 'CPF' in emitDoc && input.tpEmit !== '2') {
    ctx.regra('tpEmit', 'tipo_emitente_invalido', 'emitente pessoa física só como carga própria (2)', 'F71', '234');
  }
  let ie: string | undefined;
  if (e.IE === undefined || e.IE.trim() === '') {
    ctx.regra('emitente.IE', 'campo_obrigatorio', 'IE do emitente obrigatória', 'F72', '229');
  } else {
    const r = lerIe(e.IE, emitUf, { caminho: 'emitente.IE', aceitarIsento: false });
    if (!r.ok) ctx.regra('emitente.IE', 'ie_invalida', r.erro.mensagem, 'F73', '209');
    // Vai como informada (só sem máscara): a SEFAZ completa os zeros não significativos antes de conferir (F73).
    ie = digits(e.IE);
  }
  const end = e.endereco;
  if (end.cMun.slice(0, 2) !== cUF) {
    ctx.regra('emitente.endereco.cMun', 'municipio_uf_divergente', 'município fora da UF do emitente', 'F77', '407');
  }
  const emit = clean({
    ...emitDoc,
    IE: ie,
    xNome: e.xNome,
    xFant: e.xFant,
    enderEmit: clean({
      xLgr: end.xLgr,
      nro: end.nro,
      xCpl: end.xCpl,
      xBairro: end.xBairro,
      cMun: end.cMun,
      xMun: end.xMun,
      CEP: end.CEP === undefined ? undefined : digits(end.CEP),
      UF: end.UF,
      fone: end.fone === undefined ? undefined : digits(end.fone),
      email: end.email,
    }),
  });

  if (input.dhIniViagem !== undefined && !instanteValido(input.dhIniViagem)) {
    issues.add('dhIniViagem', 'campo_invalido', 'dhIniViagem precisa ser um instante válido');
  }
  // Chave de acesso: cUF + AAMM + CNPJ/CPF + 58 + série + número + tpEmis + cMDF + DV (MOC Visão Geral, item 2.2.6)
  const cMDF = gerarCmdf(input.cMDF, nMDF, random);
  if (!/^\d{8}$/.test(cMDF)) issues.add('cMDF', 'campo_invalido', 'cMDF tem 8 algarismos');
  let chave = '';
  // Só com todos os componentes válidos: o buildChaveAcesso lança com série, número ou cMDF fora da forma, e o
  // buildMdfe devolve problema de entrada como ocorrência, nunca como exceção.
  const componentesOk =
    serieValida && nMDFValido && issues.list.every((i) => !i.caminho.startsWith('emitente.C') && i.caminho !== 'cMDF');
  if (emitDoc !== undefined && componentesOk) {
    try {
      chave = montarChaveAcesso({
        cUF,
        aamm,
        emitente: 'CNPJ' in emitDoc ? emitDoc.CNPJ : emitDoc.CPF,
        mod: '58',
        serie,
        nNF: nMDF,
        tpEmis,
        cNF: cMDF,
      });
    } catch (err) {
      if (!(err instanceof ErroDeValidacao)) throw err;
      issues.list.push(
        ...err.ocorrencias.map((i) => ({ ...i, path: 'chave', code: 'chave_invalida', origem: 'montagem' as const })),
      );
    }
    if (chave !== '') {
      const r = lerChaveAcesso(chave, { caminho: 'chave' });
      if (!r.ok)
        issues.list.push({
          ...r.erro,
          code: 'chave_invalida',
          mensagem: `${r.erro.mensagem} (${r.erro.code})`,
          origem: 'montagem',
        });
    }
  }
  const cDV = chave.slice(-1);

  // UFs, carregamento, descarregamento e percurso (F08 a F13, F90)
  const ufValida = (u: string, path: string): boolean => {
    if (u === 'EX' || ehUf(u)) return true;
    issues.add(path, 'campo_invalido', 'UF inválida');
    return false;
  };
  const ufIni = input.ufIni;
  const ufFim = input.ufFim;
  const okUfs = ufValida(ufIni, 'ufIni') && ufValida(ufFim, 'ufFim');
  const interestadual = ufIni !== ufFim || ufIni === 'EX';
  const carrega = input.carregamento;
  if (carrega.length === 0 || carrega.length > 50) {
    issues.add('carregamento', 'campo_obrigatorio', 'de 1 a 50 municípios de carregamento');
  }
  const cUFIni = ufIni === 'EX' ? undefined : cUFde(ufIni);
  const cUFFim = ufFim === 'EX' ? undefined : cUFde(ufFim);
  const vistosCarrega = new Set<string>();
  for (const [n, m] of carrega.entries()) {
    const p = `carregamento[${n}].cMun`;
    if (cUFIni !== undefined && m.cMun.slice(0, 2) !== cUFIni) {
      ctx.regra(p, 'municipio_uf_divergente', 'município de carregamento fora da UF de início', 'F08', '456');
    }
    if (vistosCarrega.has(m.cMun)) ctx.regra(p, 'duplicado', 'município de carregamento repetido', 'F10', '685');
    vistosCarrega.add(m.cMun);
  }
  const descargas: readonly Descarregamento[] = input.descarregamentos;
  if (descargas.length === 0 || descargas.length > 1000) {
    issues.add('descarregamentos', 'campo_obrigatorio', 'de 1 a 1000 municípios de descarregamento');
  }
  const vistosDescarga = new Set<string>();
  for (const [n, m] of descargas.entries()) {
    const p = `descarregamentos[${n}].cMun`;
    if (cUFFim !== undefined && m.cMun.slice(0, 2) !== cUFFim) {
      ctx.regra(p, 'municipio_uf_divergente', 'município de descarregamento fora da UF de fim', 'F11', '612');
    }
    if (vistosDescarga.has(m.cMun)) ctx.regra(p, 'duplicado', 'município de descarregamento repetido', 'F13', '680');
    vistosDescarga.add(m.cMun);
  }
  const percurso = input.percurso ?? [];
  if (percurso.length > emissao.percursoMaximo) {
    issues.add('percurso', 'campo_invalido', `no máximo ${emissao.percursoMaximo} UFs de percurso`);
  }
  for (const [n, u] of percurso.entries()) ufValida(u, `percurso[${n}]`);
  if (okUfs && percurso.every((u) => u === 'EX' || ehUf(u))) {
    const trecho = conferirPercurso(ufIni, percurso, ufFim);
    if (trecho !== undefined) {
      const sugestao =
        ufIni !== 'EX' && ufFim !== 'EX' && percurso.length === 0 ? sugerirPercurso(ufIni, ufFim) : undefined;
      ctx.regra(
        'percurso',
        'percurso_invalido',
        `${trecho.de} e ${trecho.para} não fazem divisa` +
          (sugestao === undefined ? '' : `; um percurso possível é ${sugestao.join(', ')}`),
        'F90',
        '663',
      );
    }
  }

  // Tipo do emitente e documentos (F14 a F17, F26 a F42)
  const tpEmit = input.tpEmit;
  const nfes = descargas.flatMap((d, m) =>
    (d.nfe ?? []).map((x, k) => ({ x, path: `descarregamentos[${m}].nfe[${k}]`, municipio: m })),
  );
  const ctes = descargas.flatMap((d, m) =>
    (d.cte ?? []).map((x, k) => ({ x, path: `descarregamentos[${m}].cte[${k}]`, municipio: m })),
  );
  if (tpEmit === '1' && nfes.length > 0) {
    ctx.regra(
      'descarregamentos',
      'tipo_emitente_invalido',
      'prestador de serviço (1) não relaciona NF-e',
      'F14',
      '638',
    );
  }
  if (tpEmit === '2' && ctes.length > 0) {
    ctx.regra('descarregamentos', 'tipo_emitente_invalido', 'carga própria (2) não relaciona CT-e', 'F15', '639');
  }
  if (tpEmit === '3' && ctes.length > 0) {
    ctx.regra('descarregamentos', 'tipo_emitente_invalido', 'CT-e globalizado (3) não relaciona CT-e', 'F16', '540');
  }
  if (tpEmit === '3' && interestadual) {
    ctx.regra('tpEmit', 'tipo_emitente_invalido', 'CT-e globalizado (3) só em operação interna', 'F17', '541');
  }
  const posterior = input.indCarregaPosterior === true;
  if (posterior) {
    const d0 = descargas[0];
    if (carrega.length !== 1 || descargas.length !== 1 || d0 === undefined || carrega[0]?.cMun !== d0.cMun) {
      ctx.regra(
        'indCarregaPosterior',
        'carregamento_posterior_invalido',
        'um único município de carregamento, igual ao único de descarregamento',
        'F21',
        '703',
      );
    }
    if (interestadual) {
      ctx.regra('indCarregaPosterior', 'carregamento_posterior_invalido', 'só em operação interna', 'F22', '704');
    }
    if (tpEmit !== '2') {
      ctx.regra('indCarregaPosterior', 'carregamento_posterior_invalido', 'só para carga própria (2)', 'F24', '707');
    }
    if (nfes.length + ctes.length > 0) {
      ctx.regra(
        'descarregamentos',
        'carregamento_posterior_invalido',
        'com carregamento posterior os documentos entram pelo evento de inclusão de DF-e',
        'F27',
        '706',
      );
    }
  } else {
    for (const [n, d] of descargas.entries()) {
      if ((d.nfe ?? []).length + (d.cte ?? []).length === 0) {
        ctx.regra(`descarregamentos[${n}]`, 'campo_obrigatorio', 'município sem documento', 'F26', '616');
      }
    }
  }
  // F30a e F37a (NT 2024.001): ano e mês da chave não podem ser anteriores a 6 meses da emissão (como AAAAMM).
  const [anoEmi = 0, mesEmi = 1] = dataEmissao.split('-').map(Number);
  const mesesMinimo = anoEmi * 12 + (mesEmi - 1) - emissao.chaveAntiga.meses;
  const aammMinimo = Math.floor(mesesMinimo / 12) * 100 + (mesesMinimo % 12) + 1;
  documentos(
    ctx,
    nfes.map((d) => ({ chave: d.x.chave, path: `${d.path}.chave`, municipio: d.municipio })),
    {
      mod: '55',
      nome: 'NF-e',
      regraChave: ['F37', '604'],
      regraAntiga: ['F37a', '519'],
      regraSeg: ['F41', '606', 'F42', '607'],
    },
    interestadual,
    aammMinimo,
  );
  documentos(
    ctx,
    ctes.map((d) => ({ chave: d.x.chave, path: `${d.path}.chave`, municipio: d.municipio })),
    {
      mod: '57',
      nome: 'CT-e',
      regraChave: ['F30', '601'],
      regraAntiga: ['F30a', '518'],
      regraSeg: ['F35', '602', 'F36', '603'],
    },
    interestadual,
    aammMinimo,
  );
  const lerChave = (ch: string): ChaveAcesso | undefined => {
    const r = lerChaveAcesso(ch);
    return r.ok ? r.valor : undefined;
  };
  for (const d of nfes)
    segCodBarra(ctx, lerChave(d.x.chave), d.x.segCodBarra, `${d.path}.segCodBarra`, ['F41', '606', 'F42', '607']);
  for (const d of ctes)
    segCodBarra(ctx, lerChave(d.x.chave), d.x.segCodBarra, `${d.path}.segCodBarra`, ['F35', '602', 'F36', '603']);
  const docOut = (x: NfeTransportada): Obj => ({
    SegCodBarra: x.segCodBarra,
    indReentrega: x.indReentrega ? '1' : undefined,
    peri:
      x.perigosos === undefined || x.perigosos.length === 0
        ? undefined
        : x.perigosos.map((p) =>
            clean({
              nONU: p.nONU,
              xNomeAE: p.xNomeAE,
              xClaRisco: p.xClaRisco,
              grEmb: p.grEmb,
              qTotProd: p.qTotProd,
              qVolTipo: p.qVolTipo,
            }),
          ),
  });
  // A chave sai como o validador a leu (letras do CNPJ alfanumérico em maiúsculas), a mesma que as regras conferiram.
  const chaveNormal = (ch: string): string => lerChave(ch)?.chave ?? ch.replace(/\s/g, '');
  const infDoc = {
    infMunDescarga: descargas.map((d) =>
      clean({
        cMunDescarga: d.cMun,
        xMunDescarga: d.xMun,
        infCTe:
          (d.cte ?? []).length === 0
            ? undefined
            : (d.cte ?? []).map((x) => clean({ chCTe: chaveNormal(x.chave), ...docOut(x) })),
        infNFe:
          (d.nfe ?? []).length === 0
            ? undefined
            : (d.nfe ?? []).map((x) => clean({ chNFe: chaveNormal(x.chave), ...docOut(x) })),
      }),
    ),
  };
  const qtdDfe = nfes.length + ctes.length;

  // Modal rodoviário
  const rodo = input.rodoviario;
  const prestacao = tpEmit === '1' || tpEmit === '3' || (tpEmit === '2' && input.tpTransp !== undefined);
  const tr = rodo.tracao;
  const propTr = tr.proprietario;
  // Tipo do transportador (F18 a F20)
  if (propTr === undefined && input.tpTransp !== undefined) {
    ctx.regra('tpTransp', 'combinacao_invalida', 'sem proprietário do veículo de tração, não informe', 'F20', '745');
  }
  if (propTr?.CPF !== undefined && input.tpTransp !== '2') {
    ctx.regra('tpTransp', 'combinacao_invalida', 'proprietário CPF exige TAC (2)', 'F18', '743');
  }
  if (propTr?.CNPJ !== undefined && input.tpTransp !== '1' && input.tpTransp !== '3') {
    ctx.regra('tpTransp', 'combinacao_invalida', 'proprietário CNPJ exige ETC (1) ou CTC (3)', 'F19', '744');
  }
  const semEx = ufIni !== 'EX' && ufFim !== 'EX';
  const conferirPlaca = (p: string, path: string): void => {
    if (semEx && !PLACA.test(p)) ctx.regra(path, 'placa_invalida', 'placa fora do formato nacional', 'F89', '646');
  };
  const placaTr = placa(tr.placa);
  conferirPlaca(placaTr, 'rodoviario.tracao.placa');
  if (tr.condutores.length === 0 || tr.condutores.length > 10) {
    issues.add('rodoviario.tracao.condutores', 'campo_obrigatorio', 'de 1 a 10 condutores');
  }
  const cpfsCondutor = new Set<string>();
  const condutor = tr.condutores.map((c, n) => {
    const path = `rodoviario.tracao.condutores[${n}].CPF`;
    const r = lerCpf(c.CPF, { caminho: path });
    if (!r.ok) ctx.regra(path, 'documento_invalido', 'CPF do condutor inválido', 'F100', '645');
    const cpf = r.ok ? r.valor : c.CPF;
    if (cpfsCondutor.has(cpf)) ctx.regra(path, 'duplicado', 'condutor repetido', 'F99', '577');
    cpfsCondutor.add(cpf);
    return { xNome: c.xNome, CPF: cpf };
  });
  const emitKey = docKey(emitDoc);
  const propTrOut =
    propTr === undefined ? undefined : proprietario(ctx, propTr, 'rodoviario.tracao.proprietario', 'F103', '718');
  if (propTrOut !== undefined && docKey(propTrOut as Doc) === emitKey) {
    ctx.regra('rodoviario.tracao.proprietario', 'combinacao_invalida', 'proprietário igual ao emitente', 'F64', '740');
  }
  const veicTracao = clean({
    cInt: tr.cInt,
    placa: placaTr,
    RENAVAM: tr.RENAVAM,
    tara: inteiro(tr.tara, 'rodoviario.tracao.tara', 6, ctx),
    capKG: inteiro(tr.capKG, 'rodoviario.tracao.capKG', 6, ctx),
    capM3: inteiro(tr.capM3, 'rodoviario.tracao.capM3', 3, ctx),
    prop: propTrOut,
    condutor,
    tpRod: tr.tpRod,
    tpCar: tr.tpCar,
    UF: tr.UF,
  });
  const reboques = rodo.reboques ?? [];
  if (reboques.length > 3) issues.add('rodoviario.reboques', 'campo_invalido', 'no máximo 3 reboques');
  if (tr.tpRod === emissao.reboqueCavalo.tpRod && reboques.length === 0) {
    ctx.regra('rodoviario.reboques', 'campo_obrigatorio', 'cavalo mecânico (tpRod 03) exige reboque', 'F89c', '523');
  }
  const veicReboque = reboques.map((r, n) => {
    const path = `rodoviario.reboques[${n}]`;
    const pl = placa(r.placa);
    conferirPlaca(pl, `${path}.placa`);
    return clean({
      cInt: r.cInt,
      placa: pl,
      RENAVAM: r.RENAVAM,
      tara: inteiro(r.tara, `${path}.tara`, 6, ctx),
      capKG: inteiro(r.capKG, `${path}.capKG`, 6, ctx),
      capM3: inteiro(r.capM3, `${path}.capM3`, 3, ctx),
      prop:
        r.proprietario === undefined
          ? undefined
          : proprietario(ctx, r.proprietario, `${path}.proprietario`, 'F104', '719'),
      tpCar: r.tpCar,
      UF: r.UF,
    });
  });

  // ANTT: RNTRC, CIOT, vale-pedágio, contratantes e pagamento (F52 a F66, F94 a F98, F101, F102, F108)
  const ciots = (rodo.ciot ?? []).map((c, n) =>
    clean({ CIOT: c.CIOT, ...ctx.doc(c, `rodoviario.ciot[${n}]`, 'F101', '716') }),
  );
  let valePed: Obj | undefined;
  let pagadorValePed = false;
  if (rodo.valePedagio !== undefined) {
    const vp = rodo.valePedagio;
    if (vp.categCombVeic === undefined) {
      ctx.regra(
        'rodoviario.valePedagio.categCombVeic',
        'campo_obrigatorio',
        'categoria de combinação veicular',
        'F95',
        '731',
      );
    }
    if (vp.dispositivos.length === 0) {
      issues.add('rodoviario.valePedagio.dispositivos', 'campo_obrigatorio', 'ao menos um dispositivo');
    }
    valePed = clean({
      disp: vp.dispositivos.map((d, n) => {
        const path = `rodoviario.valePedagio.dispositivos[${n}]`;
        const forn = lerCnpj(d.CNPJForn, { caminho: `${path}.CNPJForn` });
        if (!forn.ok) ctx.regra(`${path}.CNPJForn`, 'documento_invalido', 'CNPJ da fornecedora inválido', 'F96', '732');
        const pg = ctx.doc(d.responsavel, `${path}.responsavel`, 'F98', '734');
        if (pg !== undefined) pagadorValePed = true;
        const v = ctx.req(d.vValePed, `${path}.vValePed`, D1302);
        return clean({
          CNPJForn: forn.ok ? forn.valor : d.CNPJForn,
          ...(pg === undefined ? {} : 'CNPJ' in pg ? { CNPJPg: pg.CNPJ } : { CPFPg: pg.CPF }),
          nCompra: d.nCompra,
          vValePed: formatDecimal(v, D1302),
          tpValePed: d.tpValePed,
        });
      }),
      categCombVeic: vp.categCombVeic,
    });
  }
  const contratantes: readonly Contratante[] = rodo.contratantes ?? [];
  const vistosContratante = new Set<string>();
  const infContratante = contratantes.map((c, n) => {
    const path = `rodoviario.contratantes[${n}]`;
    const d = ctx.docContratante(c, path, 'F102', '717');
    const k = docKey(d);
    if (k !== undefined && vistosContratante.has(k)) {
      ctx.regra(path, 'duplicado', 'contratante repetido', 'F66', '742');
    }
    if (k !== undefined) vistosContratante.add(k);
    const contrato = c.contrato;
    return clean({
      xNome: c.xNome,
      ...d,
      infContrato:
        contrato === undefined
          ? undefined
          : {
              NroContrato: contrato.NroContrato,
              vContratoGlobal: formatDecimal(
                ctx.req(contrato.vContratoGlobal, `${path}.contrato.vContratoGlobal`, D1302_OPC),
                D1302_OPC,
              ),
            },
    });
  });
  if (propTr !== undefined) {
    const soEmitente = infContratante.length === 1 && docKey(infContratante[0] as Doc) === emitKey;
    if (!soEmitente) {
      ctx.regra(
        'rodoviario.contratantes',
        'contratante_obrigatorio',
        'com proprietário do veículo, o contratante é só o emitente',
        'F65',
        '741',
      );
    }
  }
  const infPag = (rodo.pagamentos ?? []).map((p, n) => pagamento(ctx, p, `rodoviario.pagamentos[${n}]`, dataEmissao));
  if (prestacao) {
    if (ciots.length === 0 && !pagadorValePed && infContratante.length === 0) {
      ctx.regra(
        'rodoviario.contratantes',
        'contratante_obrigatorio',
        'informe o contratante (ou o responsável pelo CIOT ou pelo vale-pedágio)',
        'F94',
        '578',
      );
    }
    if (ciots.length === 0 && emVigor('ciotObrigatorio', options.ambiente, agora)) {
      ctx.regra(
        'rodoviario.ciot',
        'ciot_obrigatorio',
        `CIOT obrigatório na prestação por conta de terceiros (${regras.regras.ciotObrigatorio.fonte})`,
        'NT 2026.001',
        regras.regras.ciotObrigatorio.cStat,
      );
    }
    if (input.produtoPredominante === undefined) {
      ctx.regra('produtoPredominante', 'prod_pred_obrigatorio', 'produto predominante obrigatório', 'F54', '725');
    }
    if (qtdDfe === 1) {
      const pp = input.produtoPredominante;
      if (pp !== undefined && pp.lotacao === undefined) {
        ctx.regra(
          'produtoPredominante.lotacao',
          'prod_pred_obrigatorio',
          'carga lotação (um único DF-e) exige os locais de carregamento e descarregamento',
          'F55',
          '726',
        );
      }
      if (pp !== undefined && pp.NCM === undefined && emVigor('ncmLotacao', options.ambiente, agora)) {
        ctx.regra(
          'produtoPredominante.NCM',
          'prod_pred_obrigatorio',
          'NCM obrigatório na carga lotação',
          'F55a',
          '301',
        );
      }
      if (infPag.length === 0 && emVigor('infPagLotacao', options.ambiente, agora)) {
        ctx.regra(
          'rodoviario.pagamentos',
          'pagamento_invalido',
          'pagamento do frete obrigatório na carga lotação',
          'F55b',
          '302',
        );
      }
    }
  }
  if ((tpEmit === '1' || tpEmit === '3') && interestadual && rodo.RNTRC === undefined) {
    ctx.regra('rodoviario.RNTRC', 'campo_obrigatorio', 'RNTRC do prestador em operação interestadual', 'F108', '688');
  }
  const temAntt =
    rodo.RNTRC !== undefined ||
    ciots.length > 0 ||
    valePed !== undefined ||
    infContratante.length > 0 ||
    infPag.length > 0;
  const infANTT = temAntt
    ? clean({
        RNTRC: rodo.RNTRC,
        infCIOT: ciots.length === 0 ? undefined : ciots,
        valePed,
        infContratante: infContratante.length === 0 ? undefined : infContratante,
        infPag: infPag.length === 0 ? undefined : infPag,
      })
    : undefined;
  const infModal = {
    versaoModal: VERSAO,
    rodo: clean({
      infANTT,
      veicTracao,
      veicReboque: veicReboque.length === 0 ? undefined : veicReboque,
      codAgPorto: rodo.codAgPorto,
      lacRodo:
        rodo.lacres === undefined || rodo.lacres.length === 0 ? undefined : rodo.lacres.map((nLacre) => ({ nLacre })),
    }),
  };

  // Seguro (F91 a F93)
  const seguros = input.seguros ?? [];
  if ((tpEmit === '1' || tpEmit === '3') && seguros.length === 0) {
    ctx.regra('seguros', 'seguro_obrigatorio', 'seguro da carga obrigatório para o prestador', 'F91', '698');
  }
  const seg = seguros.map((s, n) => {
    const path = `seguros[${n}]`;
    if (tpEmit === '1' || tpEmit === '3') {
      if (s.seguradora === undefined || s.nApol === undefined || (s.nAver ?? []).length === 0) {
        ctx.regra(path, 'seguro_obrigatorio', 'seguradora, apólice e averbação obrigatórias', 'F92', '699');
      }
      if (s.responsavel.respSeg === '2' && s.responsavel.CNPJ === undefined && s.responsavel.CPF === undefined) {
        ctx.regra(`${path}.responsavel`, 'seguro_obrigatorio', 'CNPJ ou CPF do contratante responsável', 'F93', '542');
      }
    }
    const resp =
      s.responsavel.CNPJ === undefined && s.responsavel.CPF === undefined
        ? undefined
        : ctx.doc(s.responsavel as DocumentoPessoa, `${path}.responsavel`);
    let infSeg: Obj | undefined;
    if (s.seguradora !== undefined) {
      const r = lerCnpj(s.seguradora.CNPJ, { caminho: `${path}.seguradora.CNPJ` });
      if (!r.ok) issues.list.push(r.erro);
      infSeg = { xSeg: s.seguradora.xSeg, CNPJ: r.ok ? r.valor : s.seguradora.CNPJ };
    }
    return clean({
      infResp: clean({ respSeg: s.responsavel.respSeg, ...resp }),
      infSeg,
      nApol: s.nApol,
      nAver: s.nAver === undefined || s.nAver.length === 0 ? undefined : [...s.nAver],
    });
  });

  // Produto predominante (com infLotacao dentro dele) e totais
  const pp = input.produtoPredominante;
  const prodPred =
    pp === undefined
      ? undefined
      : clean({
          tpCarga: pp.tpCarga,
          xProd: pp.xProd,
          cEAN: pp.cEAN,
          NCM: pp.NCM,
          infLotacao:
            pp.lotacao === undefined
              ? undefined
              : {
                  infLocalCarrega: local(pp.lotacao.carregamento),
                  infLocalDescarrega: local(pp.lotacao.descarregamento),
                },
        });
  const vCarga = ctx.req(input.totais.vCarga, 'totais.vCarga', D1302);
  const qCarga = ctx.req(input.totais.qCarga, 'totais.qCarga', D1104);
  const tot = clean({
    qCTe: ctes.length === 0 ? undefined : String(ctes.length),
    qNFe: nfes.length === 0 ? undefined : String(nfes.length),
    vCarga: formatDecimal(vCarga, D1302),
    cUnid: input.totais.cUnid,
    qCarga: formatDecimal(qCarga, D1104),
  });

  // Autorizados ao XML (F105 a F107)
  const autXMLIn = input.autXML ?? [];
  if (autXMLIn.length > 10) issues.add('autXML', 'campo_invalido', 'no máximo 10 autorizados');
  const vistosAut = new Set<string>();
  const autXML = autXMLIn.map((a, n) => {
    const d = ctx.doc(a, `autXML[${n}]`, a.CNPJ !== undefined ? 'F105' : 'F106', a.CNPJ !== undefined ? '660' : '661');
    const k = docKey(d);
    if (k !== undefined && vistosAut.has(k))
      ctx.regra(`autXML[${n}]`, 'duplicado', 'autorizado repetido', 'F107', '459');
    if (k !== undefined) vistosAut.add(k);
    return d;
  });

  // Responsável técnico (F121)
  const rt = input.respTec ?? options.respTec;
  let infRespTec: Obj | undefined;
  if (rt !== undefined) {
    const r = lerCnpj(rt.CNPJ, { caminho: 'respTec.CNPJ' });
    if (!r.ok) ctx.regra('respTec.CNPJ', 'documento_invalido', 'CNPJ do responsável técnico inválido', 'F121', '713');
    infRespTec = clean({
      CNPJ: r.ok ? r.valor : rt.CNPJ,
      xContato: rt.xContato,
      email: rt.email,
      fone: digits(rt.fone),
      idCSRT: rt.csrt?.idCSRT,
      hashCSRT: rt.csrt?.hashCSRT,
    });
  }

  const ia = input.informacoesAdicionais;
  const infAdic =
    ia === undefined || (ia.infAdFisco === undefined && ia.infCpl === undefined)
      ? undefined
      : clean({ infAdFisco: ia.infAdFisco, infCpl: ia.infCpl });

  const ide = clean({
    cUF,
    tpAmb,
    tpEmit,
    tpTransp: input.tpTransp,
    mod: '58',
    serie: String(serie),
    nMDF: String(nMDF),
    cMDF,
    cDV,
    modal: '1',
    dhEmi,
    tpEmis,
    procEmi: '0',
    verProc: options.verProc ?? formatarVerProc('sinete', VERSAO_PACOTE),
    UFIni: ufIni,
    UFFim: ufFim,
    infMunCarrega: carrega.map((m) => ({ cMunCarrega: m.cMun, xMunCarrega: m.xMun })),
    infPercurso: percurso.length === 0 ? undefined : percurso.map((UFPer) => ({ UFPer })),
    dhIniViagem: instanteValido(input.dhIniViagem) ? formatDh(input.dhIniViagem, offset) : undefined,
    indCanalVerde: input.indCanalVerde ? '1' : undefined,
    indCarregaPosterior: posterior ? '1' : undefined,
  });

  const inf = clean({
    versao: VERSAO,
    Id: `MDFe${chave}`,
    ide,
    emit,
    infModal,
    infDoc,
    seg: seg.length === 0 ? undefined : seg,
    prodPred,
    tot,
    lacres:
      input.lacres === undefined || input.lacres.length === 0 ? undefined : input.lacres.map((nLacre) => ({ nLacre })),
    autXML: autXML.length === 0 ? undefined : autXML,
    infAdic,
    infRespTec,
  }) as unknown as TMDFe_infMDFe;

  textosForaDoXml(inf, 'infMDFe', issues);
  if (!issues.empty) return { ok: false, issues: issues.classificadas };

  // Serialização canônica e validação estrita contra o schema vigente, antes de qualquer assinatura.
  let xml: string;
  try {
    xml = `<MDFe xmlns="${MDFE_NS}">${serialize(infCt, 'infMDFe', inf, MDFE_NS)}</MDFe>`;
  } catch (err) {
    if (!(err instanceof SerializeError)) throw err;
    return { ok: false, issues: [{ caminho: err.path, code: 'schema', mensagem: err.message, origem: 'montagem' }] };
  }
  const infEl = primeiroFilho(lerXml(xml).raiz, 'infMDFe', MDFE_NS);
  const schemaIssues = infEl === undefined ? [] : validate(infCt, infEl);
  if (schemaIssues.length > 0) {
    return {
      ok: false,
      issues: schemaIssues.map((i) => ({
        caminho: i.caminho,
        code: 'schema',
        mensagem: `${i.code}: ${i.mensagem}`,
        origem: 'montagem',
      })),
    };
  }
  return {
    ok: true,
    value: { chave, id: `MDFe${chave}`, cMDF, cDV, tpEmis, tpAmb, dhEmi, schema: vigencia, infMDFe: inf, xml },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// QR Code e assinatura
// ---------------------------------------------------------------------------------------------------------------

const te = new TextEncoder();

/**
 * URL do QR Code (`qrCodMDFe`): endereço do portal, `chMDFe` e `tpAmb`; em contingência off-line, também `sign`, a
 * assinatura RSA-SHA1 da chave em Base64 (MOC Visão Geral, item 9.2).
 *
 * O `sign` vai em Base64 cru, sem codificação de URL: é o que o exemplo do MOC mostra (`&sign=ZZSH...I+wLY.../fUH...=`,
 * com `+`, `/` e `=` literais), e é o texto que a SEFAZ confere no `qrCodMDFe` (F115 a F119). Quem lê o QR Code tem de
 * tratar o `+` como caractere, não como espaço de formulário.
 */
export function qrCodeMdfe(chave: string, tpAmb: '1' | '2', sign?: string): string {
  const base = `${qrcode.url}?chMDFe=${chave}&tpAmb=${tpAmb}`;
  return sign === undefined ? base : `${base}&sign=${sign}`;
}

/** `sign` do QR Code: RSA PKCS#1 v1.5 com SHA-1 sobre os 44 caracteres da chave, com o certificado que assina o MDF-e. */
export async function assinaturaQrCode(chave: string, signer: Assinador): Promise<string> {
  const bytes = te.encode(chave);
  if (signer.tipo === 'dados') return codificarBase64(await signer.assinar(bytes, 'SHA-1'));
  const h = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-1', bytes));
  const di = new Uint8Array(PREFIXO_DIGEST_INFO_SHA1.length + h.length);
  di.set(PREFIXO_DIGEST_INFO_SHA1);
  di.set(h, PREFIXO_DIGEST_INFO_SHA1.length);
  return codificarBase64(await signer.assinarDigestInfo(di));
}

const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * O MDF-e montado com o `infMDFeSupl` (QR Code) inserido por splice antes do fechamento de `MDFe`, pronto para a
 * assinatura. Em contingência off-line, informe o `sign` (`assinaturaQrCode`). Para assinar em três fases (A3, HSM),
 * passe este texto ao `prepareSignature` do `@sinete/core/xml` com o `id` do MDF-e.
 */
export function comQrCode(built: BuiltMdfe, sign?: string): string {
  if (built.tpEmis === '2' && sign === undefined) {
    throw new ErroDeConfiguracao('MDF-e em contingência off-line precisa do sign no QR Code (F117, rejeição 482)');
  }
  if (built.tpEmis === '1' && sign !== undefined) {
    throw new ErroDeConfiguracao('MDF-e em emissão normal não leva sign no QR Code (F118, rejeição 488)');
  }
  const fim = '</MDFe>';
  if (!built.xml.endsWith(fim)) throw new ErroDeConfiguracao('MDF-e montado fora da forma esperada');
  const supl = `<infMDFeSupl><qrCodMDFe>${escapeXml(qrCodeMdfe(built.chave, built.tpAmb, sign))}</qrCodMDFe></infMDFeSupl>`;
  return built.xml.slice(0, -fim.length) + supl + fim;
}

/**
 * Assina o MDF-e montado: QR Code (com `sign` em contingência) e `Signature` como último filho de `MDFe`, ambos por
 * splice, e devolve a string final. É essa string que vai para a SEFAZ e para o banco.
 */
export async function signMdfe(built: BuiltMdfe, signer: Assinador): Promise<string> {
  const sign = built.tpEmis === '2' ? await assinaturaQrCode(built.chave, signer) : undefined;
  return assinarXml(comQrCode(built, sign), { id: built.id }, signer);
}

/** Prazo para transmitir um MDF-e emitido em contingência off-line: 168 horas depois da emissão (Visão Geral, 11.1). */
export function prazoContingencia(emitidoEm: Instante): Instante {
  return relogioFixo(emitidoEm.getTime() + emissao.contingencia.prazoTransmissaoHoras * 3_600_000).agora();
}
