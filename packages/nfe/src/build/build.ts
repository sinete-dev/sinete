/**
 * Montagem da NF-e: entrada do domínio (`DadosNfe`) para o objeto tipado do `@sinete/schemas` no PL vigente, com os
 * derivados e os totais em decimal exato, a chave de acesso e as regras conferidas antes de qualquer serialização. A
 * saída é a string canônica de `<NFe>` ainda sem assinatura, já validada contra o schema; `assinarNfe` insere a
 * `Signature` por splice (ADR 0003) e nada mais toca nela.
 */

import type { Ambiente, Assinador, ContextoDeTempo, Ocorrencia, Uf } from '@sinete/core';
import {
  ErroDeConfiguracao,
  ErroDeValidacao,
  ehUf,
  formatarVerProc,
  relogioFixo,
  tpAmbDoAmbiente,
  ufPorSigla,
} from '@sinete/core';
import { assinarXml, codificarBase64, lerXml, primeiroFilho } from '@sinete/core/xml';
import type { ComplexType, EntradaDeVigencia } from '@sinete/schemas';
import { ErroSerializacao, serializar, validar } from '@sinete/schemas';
import type {
  TNFe_infNFe,
  TNFe_infNFe_det,
  TNFe_infNFe_det_imposto,
  TNFe_infNFe_det_prod,
  TNFe_infNFe_ide_NFref,
  TNFe_infNFe_total_ICMSTot,
  TNFe_infNFe_total_ISSQNtot,
  TTribNFe,
} from '@sinete/schemas/nfe/PL_010f';
import { TIS as TISCt, TNFe_infNFeSupl, TTribNFe as TTribNFeCt } from '@sinete/schemas/nfe/PL_010f';
import { lerChaveAcesso, lerCnpj, lerCpf, lerIe, montarChaveAcesso } from '@sinete/validators';
import arredondamento from '../data/arredondamento.json' with { type: 'json' };
import produtorRural from '../data/produtor-rural.json' with { type: 'json' };
import reforma from '../data/reforma.json' with { type: 'json' };
import respTecData from '../data/resp-tec.json' with { type: 'json' };
import type { RoundingMode } from '../decimal.ts';
import { Decimal } from '../decimal.ts';
import { D0302, D0302A04, D1104V, D1110V, D1203, D1302, D1302_OPC } from '../format.ts';
import { Issues } from '../issues.ts';
import type {
  DadosNfe,
  Destinatario,
  DocumentoPessoa,
  Emitente,
  Endereco,
  EnderecoExterior,
  Item,
  Local,
  Referenciada,
  ResponsavelTecnico,
} from '../model.ts';
import type { AliquotaIbsCbsInformada, CalculadoraIbsCbs, PedidoIbsCbsItem } from '../ports.ts';
import { calculadoraIbsCbs } from '../rtc.ts';
import type { Instante } from '../time.ts';
import { deslocamentoDaUf, formatarDh } from '../time.ts';
import { VERSAO_PACOTE } from '../versao-gerada.ts';
import { conferirDestinatario } from './destinatario.ts';
import { decimaisInvalidos, grupoInvalido, ibsCbsDoItem, totalIbsCbs } from './ibscbs.ts';
import type { IcmsTotais } from './icms.ts';
import { buildIcms, zeroIcmsTotais } from './icms.ts';
import type { NfceSupl, PagMontado, QrCodeNfceOpcoes } from './nfce.ts';
import {
  assinarParametros,
  conferirNfce,
  NFCE_LIMITE_SEM_DESTINATARIO,
  pagamentoNfce,
  parametrosQrCode,
  urlsNfce,
} from './nfce.ts';
import { camposForaDoPl, escolherPl } from './pl.ts';
import { cstComIsento, exclusivoIbsCbs, vencimentos } from './rejeicoes.ts';
import { conferirTextosDaEntrada, textoXmlValido } from './textos.ts';
import { buildIcmsUfDest, buildIi, buildIpi, buildIssqn, buildPisCofins, buildPisCofinsSt } from './tributos.ts';
import type { Familia } from './values.ts';
import { Ctx, clean, digits, TOLERANCIA } from './values.ts';

let padrao: CalculadoraIbsCbs | undefined;

/** A calculadora de IBS/CBS usada quando `opcoes.ibsCbs` não vem: o motor do sinete, criada uma vez por processo. */
function calculadoraPadrao(): CalculadoraIbsCbs {
  padrao ??= calculadoraIbsCbs();
  return padrao;
}

export const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

/** Literal do nome do destinatário em homologação (MOC 7.0 Anexo I, RV E04-20, rejeição 598). */
export const XNOME_HOMOLOGACAO = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

/** Literal da descrição do primeiro item da NFC-e em homologação (MOC 7.0 Anexo I, RV I04-10, rejeição 373). */
export const XPROD_HOMOLOGACAO_NFCE = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

export type ExigenciaRespTec = 'obrigatorio' | 'opcional';

export interface MontarNfeOpcoes {
  readonly ambiente: Ambiente;
  /** Relógio de emissão (dhEmi, PL vigente, CSRT) e de fato gerador (IBS/CBS). */
  readonly tempo: ContextoDeTempo;
  /**
   * Calculadora de IBS/CBS dos itens com `ibsCbs.classificacao`. Padrão: `calculadoraIbsCbs()`, o motor do sinete com o
   * dataset embarcado (importado na primeira nota que precisar dele) e as alíquotas oficiais. Informe outra para trocar
   * dataset, alíquotas, base ou regras, ou para calcular fora do sinete.
   */
  readonly ibsCbs?: CalculadoraIbsCbs;
  /** Fuso do emitente em minutos; padrão pela UF (`data/fusos.json`). */
  readonly deslocamentoMin?: number;
  /** Versão do aplicativo emissor (`verProc`); padrão `sinete <versão do @sinete/nfe>` (`formatarVerProc`). */
  readonly verProc?: string;
  /** Sobrepõe o modo de arredondamento de uma família (`data/arredondamento.json`). */
  readonly arredondamento?: Partial<Record<Familia, RoundingMode>>;
  /** Responsável técnico padrão (a software house), usado quando a nota não traz `respTec`. */
  readonly respTec?: ResponsavelTecnico;
  /** Sobrepõe a exigência de infRespTec e CSRT da tabela por UF (`data/resp-tec.json`). */
  readonly exigencias?: { readonly infRespTec?: ExigenciaRespTec; readonly csrt?: ExigenciaRespTec };
  /** Fonte de aleatoriedade para o cNF; padrão `crypto.getRandomValues`. */
  readonly aleatorio?: (bytes: Uint8Array) => Uint8Array;
  /**
   * O `vPag` do único `detPag` passa a ser o `vNF` calculado na mesma montagem, e o valor informado nele é ignorado.
   * Serve a quem recebe à vista o total da nota e não quer calcular o `vNF` antes de montar. Mais de um `detPag`,
   * nenhum, ou `tPag` 90 (sem pagamento) dão ocorrência `pagamento_igual_total`: não há como saber como repartir o
   * total, e a nota sem pagamento tem `vPag` zero.
   */
  readonly pagamentoIgualTotal?: boolean;
  /**
   * Só NFC-e (modelo 65): versão do QR Code. Padrão `{ versao: '3' }`, que dispensa o CSC (NT 2025.001). Com
   * `{ versao: '2', idCSC, CSC }`, o hash leva o CSC fornecido pela SEFAZ da UF, que nunca vai para o XML.
   */
  readonly qrCode?: QrCodeNfceOpcoes;
  /**
   * Só NFC-e: endereço da consulta via QR Code (sem o `?p=`). Padrão: o da UF do emitente no ambiente e na data de
   * emissão (`data/nfce-urls.json`, do Portal Nacional da NFC-e). AM e MA publicam o endereço sem o protocolo: lá, é
   * obrigatório.
   */
  readonly urlQrCode?: string;
  /** Só NFC-e: URL da consulta por chave de acesso (`urlChave`). Padrão: a da UF (`data/nfce-urls.json`). */
  readonly urlChave?: string;
}

export interface NfeMontada {
  /** Chave de acesso (44 posições). */
  readonly chave: string;
  /** `Id` do `infNFe` (`NFe` + chave): é o que a assinatura referencia. */
  readonly id: string;
  readonly cNF: string;
  readonly cDV: string;
  /** 55 (NF-e) ou 65 (NFC-e). */
  readonly mod: '55' | '65';
  readonly tpEmis: string;
  readonly dhEmi: string;
  /**
   * Só NFC-e: o `infNFeSupl` a acrescentar (`comQrCode`, `assinarNfe`). Na versão 3 em contingência off-line, falta a
   * assinatura dos parâmetros, que só o certificado faz (`assinaturaQrCode`).
   */
  readonly nfce?: NfceSupl;
  /** Pacote de liberação usado (escolhido pela vigência). */
  readonly pl: EntradaDeVigencia;
  /** O objeto tipado, na forma do PL_010f (o mais novo que o pacote conhece). */
  readonly infNFe: TNFe_infNFe;
  /** `<NFe xmlns="...">` com o `infNFe` canônico, sem assinatura, já validado contra o schema. */
  readonly xml: string;
  /**
   * Alíquotas do IBS/CBS que a calculadora usou vindas de quem integra (`comAliquotasInformadas`), e não da tabela
   * oficial do pacote, por item. Ausente quando todas foram oficiais. A montagem não recusa por isso: é o caminho para
   * emitir com uma alíquota já publicada antes de o pacote trazê-la. Guarde junto com a nota e alerte quem opera; em
   * produção, a alíquota informada é responsabilidade de quem a informou.
   */
  readonly aliquotasInformadas?: readonly AliquotaIbsCbsInformada[];
}

export type ResultadoMontagemNfe =
  | { readonly ok: true; readonly valor: NfeMontada }
  | { readonly ok: false; readonly ocorrencias: readonly Ocorrencia[] };

const MODES: Record<Familia, RoundingMode> = Object.fromEntries(
  Object.entries(arredondamento.familias).map(([k, v]) => [k, v.modo as RoundingMode]),
) as Record<Familia, RoundingMode>;

const SEM_GTIN = 'SEM GTIN';
const BRASILIA = -180;

function diaBrasilia(d: Instante): string {
  return formatarDh(d, BRASILIA).slice(0, 10);
}

/** Exigência de infRespTec ou CSRT para a UF no ambiente e na data (tabela `data/resp-tec.json`). */
export function exigenciaRespTec(
  uf: Uf,
  ambiente: Ambiente,
  data: Instante,
): { readonly infRespTec: ExigenciaRespTec; readonly csrt: ExigenciaRespTec } {
  const dia = diaBrasilia(data);
  const ufs = respTecData.ufs as Readonly<
    Record<string, { readonly csrt?: Record<string, string>; readonly infRespTec?: Record<string, string> }>
  >;
  const regra = Object.hasOwn(ufs, uf) ? ufs[uf] : undefined;
  const vale = (r: Record<string, string> | undefined, padrao: string): ExigenciaRespTec => {
    const desde = r?.[ambiente];
    if (desde !== undefined) return dia >= desde ? 'obrigatorio' : (padrao as ExigenciaRespTec);
    return padrao as ExigenciaRespTec;
  };
  return {
    infRespTec: vale(regra?.infRespTec, respTecData.padrao.infRespTec),
    csrt: vale(regra?.csrt, respTecData.padrao.csrt),
  };
}

/** `hashCSRT`: Base64(SHA-1(CSRT + chave de acesso)) (NT 2018.005, campo ZD09). */
export async function hashCsrt(csrt: string, chave: string): Promise<string> {
  const d = await globalThis.crypto.subtle.digest('SHA-1', new TextEncoder().encode(csrt + chave));
  return codificarBase64(new Uint8Array(d));
}

/** Normaliza CNPJ ou CPF, apontando a ocorrência do validador. */
function documento(doc: DocumentoPessoa, path: string, issues: Issues): { CNPJ: string } | { CPF: string } {
  if (doc.CNPJ !== undefined) {
    const r = lerCnpj(doc.CNPJ, { caminho: `${path}.CNPJ` });
    if (!r.ok) issues.list.push(r.erro);
    return { CNPJ: r.ok ? r.valor : doc.CNPJ };
  }
  const r = lerCpf(doc.CPF ?? '', { caminho: `${path}.CPF` });
  if (!r.ok) issues.list.push(r.erro);
  return { CPF: r.ok ? r.valor : (doc.CPF ?? '') };
}

function ie(value: string | undefined, uf: Uf, path: string, issues: Issues, allowIsento: boolean): string | undefined {
  if (value === undefined) return undefined;
  const r = lerIe(value, uf, { caminho: path, aceitarIsento: allowIsento });
  if (!r.ok) {
    issues.list.push(r.erro);
    return value;
  }
  return r.valor.valor;
}

function endereco(e: Endereco): Record<string, string | undefined> {
  return {
    xLgr: e.xLgr,
    nro: e.nro,
    xCpl: e.xCpl,
    xBairro: e.xBairro,
    cMun: e.cMun,
    xMun: e.xMun,
    UF: e.UF,
    CEP: e.CEP === undefined ? undefined : digits(e.CEP),
    fone: e.fone === undefined ? undefined : digits(e.fone),
  };
}

function isExterior(e: Endereco | EnderecoExterior | undefined): e is EnderecoExterior {
  return e !== undefined && 'exterior' in e && e.exterior === true;
}

/** Gera um cNF de 8 dígitos que passa nas regras de emissão da chave (RV B03-10: fora das sequências e diferente do nNF). */
function gerarChave(
  parts: { cUF: string; aamm: string; emitente: string; mod: string; serie: string; nNF: string; tpEmis: string },
  cNFInformado: string | undefined,
  random: (b: Uint8Array) => Uint8Array,
  issues: Issues,
): { chave: string; cNF: string } | undefined {
  const tentar = (cNF: string): { chave: string; ok: boolean; issue?: Ocorrencia } => {
    const chave = montarChaveAcesso({ ...parts, cNF });
    const r = lerChaveAcesso(chave, { emissao: true, caminho: 'chave' });
    return r.ok ? { chave, ok: true } : { chave, ok: false, issue: r.erro };
  };
  if (cNFInformado !== undefined) {
    if (!/^\d{8}$/.test(cNFInformado)) {
      issues.add('cNF', 'campo_invalido', 'cNF tem 8 algarismos');
      return undefined;
    }
    const r = tentar(cNFInformado);
    if (!r.ok && r.issue) {
      // O cNF informado recusado pela regra da chave é da entrada, no campo dela; outra parte da chave recusada aponta
      // a chave montada (a causa, se for da entrada, já apareceu no campo dela).
      const doCnf = r.issue.code === 'chave_cnf_invalido';
      issues.list.push({
        ...r.issue,
        caminho: doCnf ? 'cNF' : r.issue.caminho,
        code: 'chave_invalida',
        mensagem: `${r.issue.mensagem} (${r.issue.code})`,
        origem: doCnf ? 'entrada' : 'montagem',
      });
    }
    return r.ok ? { chave: r.chave, cNF: cNFInformado } : undefined;
  }
  for (let n = 0; n < 32; n++) {
    const b = random(new Uint8Array(4));
    const v = ((b[0] ?? 0) * 2 ** 24 + (b[1] ?? 0) * 2 ** 16 + (b[2] ?? 0) * 2 ** 8 + (b[3] ?? 0)) % 100_000_000;
    const cNF = String(v).padStart(8, '0');
    const r = tentar(cNF);
    if (r.ok) return { chave: r.chave, cNF };
    if (r.issue && r.issue.code !== 'chave_cnf_invalido') {
      // A chave com o cNF gerado aqui foi recusada por outra parte (UF, emitente, série): a ocorrência aponta a chave
      // montada; a causa, se for da entrada, já apareceu no campo dela.
      issues.list.push({
        ...r.issue,
        code: 'chave_invalida',
        mensagem: `${r.issue.mensagem} (${r.issue.code})`,
        origem: 'montagem',
      });
      return undefined;
    }
  }
  issues.montagem('cNF', 'chave_invalida', 'não foi possível gerar um cNF válido');
  return undefined;
}

function referencia(ref: Referenciada, path: string, issues: Issues): TNFe_infNFe_ide_NFref {
  const chave = (c: string, p: string): string => {
    const r = lerChaveAcesso(c, { caminho: p });
    if (!r.ok) issues.list.push(r.erro);
    return r.ok ? r.valor.chave : c;
  };
  if ('refNFe' in ref) return { refNFe: chave(ref.refNFe, `${path}.refNFe`) };
  if ('refNFeSig' in ref) {
    // Chave com o código numérico zerado para sigilo (NT 2022.003, BA02a): o DV é o da chave original, então a
    // conferência do DV não se aplica; confere-se a forma, o modelo 55 e o cNF zerado.
    const c = ref.refNFeSig.replace(/\s/g, '').toUpperCase();
    if (!/^[0-9]{6}[0-9A-Z]{12}[0-9]{2}55[0-9]{22}$/.test(c) || c.slice(35, 43) !== '00000000') {
      issues.add(`${path}.refNFeSig`, 'chave_invalida', 'chave de NF-e (modelo 55) com o código numérico (cNF) zerado');
    }
    return { refNFeSig: c };
  }
  if ('refCTe' in ref) return { refCTe: chave(ref.refCTe, `${path}.refCTe`) };
  if ('refNF' in ref) return { refNF: ref.refNF };
  if ('refECF' in ref) return { refECF: ref.refECF };
  const nfp = ref.refNFP;
  // Nota de produtor em papel (modelo 04) extinta: só referência a nota emitida antes do fim na UF dela.
  if (nfp.mod === '04') {
    const porUf = produtorRural.refNFP.ufs as Readonly<Record<string, { readonly vedadaDesde: string }>>;
    const cUfSigla = Object.keys(porUf).find((k) => ufPorSigla(k)?.cUF === nfp.cUF);
    const vedadaDesde = cUfSigla ? (porUf[cUfSigla]?.vedadaDesde ?? '') : produtorRural.refNFP.modelo04.vedadaDesde;
    if (nfp.AAMM >= vedadaDesde) {
      issues.add(
        `${path}.refNFP.AAMM`,
        'referencia_vedada',
        `nota de produtor modelo 04 emitida em ${nfp.AAMM}, depois do fim do modelo (${vedadaDesde}; ${produtorRural.refNFP.modelo04.fonte})`,
      );
    }
  }
  const doc = documento(nfp as DocumentoPessoa, `${path}.refNFP`, issues);
  return {
    refNFP: {
      cUF: nfp.cUF,
      AAMM: nfp.AAMM,
      ...doc,
      IE: nfp.IE,
      mod: nfp.mod,
      serie: String(Number(nfp.serie)),
      nNF: String(Number(nfp.nNF)),
    },
  } as TNFe_infNFe_ide_NFref;
}

/**
 * Texto com caractere que o XML não representa vira ocorrência com o caminho do campo, em vez de falhar no parse do
 * documento montado. Os textos da entrada já foram conferidos com o caminho dela (`conferirTextosDaEntrada`): aqui só
 * sobra o que veio das opções da montagem.
 */
function textosForaDoXml(value: unknown, path: string, issues: Issues): void {
  if (typeof value === 'string') {
    if (!textoXmlValido(value)) issues.montagem(path, 'campo_invalido', 'texto com caractere não permitido em XML');
  } else if (Array.isArray(value)) {
    for (const [n, v] of value.entries()) textosForaDoXml(v, `${path}[${n}]`, issues);
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) textosForaDoXml(v, `${path}.${k}`, issues);
  }
}

interface ItemMontado {
  readonly det: TNFe_infNFe_det;
  readonly icms: IcmsTotais;
  readonly indTot: boolean;
  readonly issqn: boolean;
  readonly faturamentoDireto: boolean;
  readonly v: Record<
    | 'vProd'
    | 'vFrete'
    | 'vSeg'
    | 'vDesc'
    | 'vOutro'
    | 'vII'
    | 'vIPI'
    | 'vIPIDevol'
    | 'vPIS'
    | 'vCOFINS'
    | 'vPISST'
    | 'vCOFINSST'
    | 'vFCPUFDest'
    | 'vICMSUFDest'
    | 'vICMSUFRemet'
    | 'vTotTrib'
    | 'vISSQN'
    | 'vBCISS',
    Decimal
  >;
  readonly temUfDest: boolean;
  readonly temTotTrib: boolean;
  readonly issqnOpcionais: Record<string, Decimal>;
}

function montarItem(ctx: Ctx, item: Item, n: number, normal: boolean, semIe: boolean): ItemMontado {
  const path = `itens[${n}]`;
  const p = item.produto;
  const pp = `${path}.produto`;
  const qCom = ctx.req(p.qCom, `${pp}.qCom`, D1104V);
  const vUnCom = ctx.req(p.vUnCom, `${pp}.vUnCom`, D1110V);
  // RV I11 (rejeição 629) só vale para a NF-e normal (finNFe 1); nas demais o vProd informado prevalece.
  const vProd = (normal ? ctx.calc : ctx.base).call(ctx, p.vProd, qCom.times(vUnCom), `${pp}.vProd`, D1302, 'produto');
  const uTrib = p.uTrib ?? p.uCom;
  const qTrib = p.qTrib === undefined ? qCom : ctx.req(p.qTrib, `${pp}.qTrib`, D1104V);
  let vUnTrib: Decimal;
  if (p.vUnTrib !== undefined) vUnTrib = ctx.req(p.vUnTrib, `${pp}.vUnTrib`, D1110V);
  else if (uTrib === p.uCom && qTrib.eq(qCom)) vUnTrib = vUnCom;
  else if (qTrib.isZero()) vUnTrib = Decimal.ZERO;
  else vUnTrib = vProd.dividedBy(qTrib, 10, ctx.modes.produto);
  // RV I11 (rejeição 630), só na NF-e normal: vProd confere também com qTrib × vUnTrib, com a tolerância da nota (*4).
  if (normal) {
    const trib = ctx.round(qTrib.times(vUnTrib), D1302, 'produto');
    if (trib.minus(vProd).abs().gt(TOLERANCIA)) {
      ctx.issues.add(
        `${pp}.vUnTrib`,
        'valor_divergente',
        `qTrib × vUnTrib (${trib.toFixed(2)}) difere de vProd (${vProd.toFixed(2)}) em mais de ${TOLERANCIA.toString()}`,
      );
    }
  }
  // Campos TDec_1302Opc: zero informado é aceito e omitido do XML (o pattern não aceita zero).
  const opt = (v: typeof p.vFrete, k: string): Decimal => ctx.opt(v, `${pp}.${k}`, D1302) ?? Decimal.ZERO;
  const vFrete = opt(p.vFrete, 'vFrete');
  const vSeg = opt(p.vSeg, 'vSeg');
  const vDesc = opt(p.vDesc, 'vDesc');
  const vOutro = opt(p.vOutro, 'vOutro');
  const vOp = vProd.plus(vFrete).plus(vSeg).plus(vOutro).minus(vDesc);
  const cEAN = p.cEAN ?? SEM_GTIN;
  const especifico = p.especifico ?? {};
  const prod = clean({
    cProd: p.cProd,
    cEAN,
    cBarra: p.cBarra,
    xProd: p.xProd,
    NCM: digits(p.NCM),
    NVE: p.NVE as string[] | undefined,
    CEST: p.CEST === undefined ? undefined : digits(p.CEST),
    indEscala: p.indEscala,
    CNPJFab: p.CNPJFab,
    cBenef: p.cBenef,
    gCred: p.gCred,
    tpCredPresIBSZFM: p.tpCredPresIBSZFM,
    EXTIPI: p.EXTIPI,
    CFOP: digits(p.CFOP),
    uCom: p.uCom,
    qCom: ctx.s(qCom, D1104V),
    vUnCom: ctx.s(vUnCom, D1110V),
    vProd: ctx.s(vProd, D1302),
    cEANTrib: p.cEANTrib ?? cEAN,
    cBarraTrib: p.cBarraTrib,
    uTrib,
    qTrib: ctx.s(qTrib, D1104V),
    vUnTrib: ctx.s(vUnTrib, D1110V),
    vFrete: ctx.so(vFrete, D1302_OPC),
    vSeg: ctx.so(vSeg, D1302_OPC),
    vDesc: ctx.so(vDesc, D1302_OPC),
    vOutro: ctx.so(vOutro, D1302_OPC),
    indTot: p.indTot ?? '1',
    indBemMovelUsado: p.indBemMovelUsado,
    DI: p.DI,
    detExport: p.detExport,
    xPed: p.xPed,
    nItemPed: p.nItemPed,
    nFCI: p.nFCI,
    rastro: p.rastro,
    infProdNFF: p.infProdNFF,
    infProdEmb: p.infProdEmb,
    ...especifico,
  }) as unknown as TNFe_infNFe_det_prod;

  const imp = item.impostos;
  const ip = `${path}.impostos`;
  const imposto: Record<string, unknown> = {};
  const z = Decimal.ZERO;
  const v: ItemMontado['v'] = {
    vProd,
    vFrete,
    vSeg,
    vDesc,
    vOutro,
    vII: z,
    vIPI: z,
    vIPIDevol: z,
    vPIS: z,
    vCOFINS: z,
    vPISST: z,
    vCOFINSST: z,
    vFCPUFDest: z,
    vICMSUFDest: z,
    vICMSUFRemet: z,
    vTotTrib: z,
    vISSQN: z,
    vBCISS: z,
  };
  let issqnOpcionais: Record<string, Decimal> = {};
  const vTotTrib = ctx.opt(imp.vTotTrib, `${ip}.vTotTrib`, D1302);
  if (vTotTrib !== undefined) {
    imposto.vTotTrib = ctx.s(vTotTrib, D1302);
    v.vTotTrib = vTotTrib;
  }
  if (imp.icms !== undefined && imp.issqn !== undefined) {
    ctx.issues.add(ip, 'combinacao_invalida', 'o item tem ICMS ou ISSQN, nunca os dois');
  }
  if (imp.ipi !== undefined) {
    const r = buildIpi(ctx, imp.ipi, vOp, `${ip}.ipi`);
    imposto.IPI = r.grupo;
    v.vIPI = r.vIPI;
  }
  let icms = zeroIcmsTotais();
  if (imp.icms !== undefined) {
    const r = buildIcms(ctx, imp.icms, { vOp, vIPI: v.vIPI }, `${ip}.icms`);
    imposto.ICMS = r.grupo;
    icms = r.totais;
  } else if (imp.issqn === undefined && imp.ibsCbs === undefined && !semIe) {
    // Na NF-e sem IE do emitente a falta de ICMS e ISSQN é a exceção 2 da RV B25-90 (NT 2026.007); a falta do grupo
    // IBS/CBS sai como a 162, no caminho dele.
    ctx.issues.add(`${ip}.icms`, 'campo_obrigatorio', 'o item precisa de ICMS (ou ISSQN, na NF-e conjugada)');
  }
  if (imp.ii !== undefined) {
    const r = buildIi(ctx, imp.ii, `${ip}.ii`);
    imposto.II = r.grupo;
    v.vII = r.vII;
  }
  if (imp.issqn !== undefined) {
    const r = buildIssqn(ctx, imp.issqn, `${ip}.issqn`);
    imposto.ISSQN = r.grupo;
    v.vISSQN = r.vISSQN;
    v.vBCISS = r.vBC;
    issqnOpcionais = r.opcionais;
  }
  if (imp.pis !== undefined) {
    const r = buildPisCofins(ctx, imp.pis, 'PIS', `${ip}.pis`);
    imposto.PIS = r.grupo;
    v.vPIS = r.valor;
  }
  if (imp.pisSt !== undefined) {
    const r = buildPisCofinsSt(ctx, imp.pisSt, 'PIS', `${ip}.pisSt`);
    imposto.PISST = r.grupo;
    if (r.soma) v.vPISST = r.valor;
  }
  if (imp.cofins !== undefined) {
    const r = buildPisCofins(ctx, imp.cofins, 'COFINS', `${ip}.cofins`);
    imposto.COFINS = r.grupo;
    v.vCOFINS = r.valor;
  }
  if (imp.cofinsSt !== undefined) {
    const r = buildPisCofinsSt(ctx, imp.cofinsSt, 'COFINS', `${ip}.cofinsSt`);
    imposto.COFINSST = r.grupo;
    if (r.soma) v.vCOFINSST = r.valor;
  }
  if (imp.icmsUfDest !== undefined) {
    const r = buildIcmsUfDest(ctx, imp.icmsUfDest, `${ip}.icmsUfDest`);
    imposto.ICMSUFDest = r.grupo;
    v.vFCPUFDest = r.vFCPUFDest;
    v.vICMSUFDest = r.vICMSUFDest;
    v.vICMSUFRemet = r.vICMSUFRemet;
  }
  if (imp.is !== undefined) imposto.IS = imp.is;
  if (imp.ibsCbs?.grupo !== undefined) imposto.IBSCBS = imp.ibsCbs.grupo;

  const det: Record<string, unknown> = {
    nItem: String(n + 1),
    prod,
    imposto: imposto as unknown as TNFe_infNFe_det_imposto,
  };
  if (item.impostoDevol !== undefined) {
    const pDevol = ctx.req(item.impostoDevol.pDevol, `${path}.impostoDevol.pDevol`, D0302);
    const vIPIDevol = ctx.req(item.impostoDevol.vIPIDevol, `${path}.impostoDevol.vIPIDevol`, D1302);
    det.impostoDevol = { pDevol: ctx.s(pDevol, D0302), IPI: { vIPIDevol: ctx.s(vIPIDevol, D1302) } };
    v.vIPIDevol = vIPIDevol;
  }
  if (item.infAdProd !== undefined) det.infAdProd = item.infAdProd;
  if (item.obsItem !== undefined) det.obsItem = item.obsItem;
  if (item.DFeReferenciado !== undefined) {
    const r = lerChaveAcesso(item.DFeReferenciado.chaveAcesso, { caminho: `${path}.DFeReferenciado.chaveAcesso` });
    if (!r.ok) ctx.issues.list.push(r.erro);
    det.DFeReferenciado = clean({
      chaveAcesso: r.ok ? r.valor.chave : item.DFeReferenciado.chaveAcesso,
      nItem: item.DFeReferenciado.nItem === undefined ? undefined : String(item.DFeReferenciado.nItem),
    });
  }
  return {
    det: det as unknown as TNFe_infNFe_det,
    icms,
    indTot: (p.indTot ?? '1') === '1',
    issqn: imp.issqn !== undefined,
    faturamentoDireto: (especifico as { veicProd?: { tpOp?: string } }).veicProd?.tpOp === '2',
    v,
    temUfDest: imp.icmsUfDest !== undefined,
    temTotTrib: vTotTrib !== undefined,
    issqnOpcionais,
  };
}

/** Parte do vItem/vNF comum aos dois (MOC W16-10 com NT 2020.005 e NT 2023.004; NT 2025.002 VB01-10 e VB01-20). */
function composicao(m: ItemMontado, incluirProd: boolean): Decimal {
  const v = m.v;
  let total = (incluirProd ? v.vProd : Decimal.ZERO)
    .minus(v.vDesc)
    .minus(m.icms.vICMSDesonDeduz)
    .plus(v.vFrete)
    .plus(v.vSeg)
    .plus(v.vOutro)
    .plus(v.vII)
    .plus(v.vIPI)
    .plus(v.vPISST)
    .plus(v.vCOFINSST);
  if (!m.faturamentoDireto) {
    total = total.plus(m.icms.vST).plus(m.icms.vICMSMonoReten).plus(m.icms.vFCPST).plus(v.vIPIDevol);
  }
  return total;
}

/** Monta, calcula e valida. Nunca lança por dado do chamador: devolve as ocorrências. */
export async function montarNfe(entrada: DadosNfe, opcoes: MontarNfeOpcoes): Promise<ResultadoMontagemNfe> {
  const issues = new Issues();
  const finNFeIn = entrada.finNFe ?? '1';
  const mod = entrada.modelo ?? '55';
  if (mod !== '55' && mod !== '65') {
    issues.add('modelo', 'modelo_nao_suportado', `modelo ${String(mod)}: o builder monta NF-e (55) e NFC-e (65)`);
    return { ok: false, ocorrencias: issues.classificadas };
  }
  const nfce = mod === '65';
  // Padrões da identificação resolvidos uma vez: o mesmo valor vai para o ide e para a calculadora de IBS/CBS. A NFC-e
  // é presencial e para consumidor final (MOC 7.0 Anexo I, B25a-10 e B25b-20).
  const indPres = entrada.indPres ?? (nfce ? '1' : finNFeIn === '2' || finNFeIn === '3' ? '0' : '9');
  const indFinal = entrada.indFinal ?? (nfce || entrada.destinatario?.indIEDest === '9' ? '1' : '0');
  const ctx = new Ctx(issues, { ...MODES, ...opcoes.arredondamento }, finNFeIn !== '2' && finNFeIn !== '3');
  const pRedutorGov = entrada.gCompraGov && ctx.req(entrada.gCompraGov.pRedutor, 'gCompraGov.pRedutor', D0302A04);
  const emitUf = entrada.emitente.endereco.UF;
  if (!ehUf(emitUf)) {
    issues.add('emitente.endereco.UF', 'campo_invalido', 'UF do emitente inválida');
    return { ok: false, ocorrencias: issues.classificadas };
  }
  const cUF = ufPorSigla(emitUf)?.cUF ?? '';
  const offset = opcoes.deslocamentoMin ?? deslocamentoDaUf(emitUf);
  const agora = opcoes.tempo.emissao.agora();
  // Um instante de fato gerador por montagem: o mesmo vai para a calculadora e para a regra de composição do vItem.
  const fatoGerador = opcoes.tempo.fatoGerador.agora();
  const dhEmi = formatarDh(agora, offset);
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const tpAmb = tpAmbDoAmbiente(opcoes.ambiente);

  // PL vigente (ErroVigencia do schemas propaga: data fora de toda vigência é erro de configuração, não de dado).
  // O PL sai do mesmo instante do dhEmi: reler o relógio numa virada de vigência escolheria outro PL.
  const pl = escolherPl(opcoes.ambiente, relogioFixo(agora));

  // Emitente (grupo C)
  const e: Emitente = entrada.emitente;
  const emitDoc = documento(e, 'emitente', issues);
  const serie = Number(entrada.serie);
  const nNF = Number(entrada.nNF);
  if (!Number.isInteger(serie) || serie < 0 || serie > 999) issues.add('serie', 'serie_invalida', 'série de 0 a 999');
  if (!Number.isInteger(nNF) || nNF < 1 || nNF > 999_999_999)
    issues.add('nNF', 'campo_invalido', 'nNF de 1 a 999999999');
  const [cpfIni, cpfFim] = produtorRural.series.cpf as [number, number];
  const [cnpjIni, cnpjFim] = produtorRural.series.cnpj as [number, number];
  if ('CPF' in emitDoc && (serie < cpfIni || serie > cpfFim)) {
    issues.add(
      'serie',
      'serie_invalida',
      `emitente pessoa física usa as séries ${cpfIni} a ${cpfFim} (${produtorRural.series.fonte})`,
    );
  } else if ('CNPJ' in emitDoc && Number.isInteger(serie) && serie >= 0 && (serie < cnpjIni || serie > cnpjFim)) {
    issues.add(
      'serie',
      'serie_invalida',
      `emitente CNPJ usa as séries ${cnpjIni} a ${cnpjFim} (${produtorRural.series.fonteCnpj})`,
    );
  }
  const emit = clean({
    ...emitDoc,
    xNome: e.xNome,
    xFant: e.xFant,
    enderEmit: clean({ ...endereco(e.endereco), cPais: '1058', xPais: 'BRASIL' }),
    IE: ie(e.IE, emitUf, 'emitente.IE', issues, true),
    IEST: e.IEST,
    IM: e.IM,
    CNAE: e.CNAE,
    CRT: e.CRT,
    ISUFEmit: e.ISUFEmit,
  });

  // Destinatário (grupo E): obrigatório na NF-e (RV E01-10); na NFC-e, só na entrega a domicílio (E01-20, conferida
  // com as demais regras da NFC-e).
  const d: Destinatario | undefined = entrada.destinatario;
  let dest: Record<string, unknown> | undefined;
  let destUf: Uf | 'EX' | undefined;
  if (d === undefined) {
    if (!nfce) issues.add('destinatario', 'campo_obrigatorio', 'a NF-e exige o destinatário (E01-10, rejeição 719)');
  } else {
    const docDest =
      'idEstrangeiro' in d && d.idEstrangeiro !== undefined
        ? { idEstrangeiro: d.idEstrangeiro }
        : documento(d as DocumentoPessoa, 'destinatario', issues);
    let enderDest: Record<string, string | undefined> | undefined;
    if (isExterior(d.endereco)) {
      destUf = 'EX';
      enderDest = clean({
        xLgr: d.endereco.xLgr,
        nro: d.endereco.nro,
        xCpl: d.endereco.xCpl,
        xBairro: d.endereco.xBairro,
        cMun: '9999999',
        xMun: 'EXTERIOR',
        UF: 'EX',
        cPais: d.endereco.cPais,
        xPais: d.endereco.xPais,
        fone: d.endereco.fone === undefined ? undefined : digits(d.endereco.fone),
      });
    } else if (d.endereco !== undefined) {
      destUf = d.endereco.UF;
      enderDest = clean({ ...endereco(d.endereco), cPais: '1058', xPais: 'BRASIL' });
    }
    // IE sem UF (endereço ausente) ou no exterior não é conferida aqui: a E05-10 e a E17-40 recusam a combinação.
    const destIe =
      d.IE !== undefined && destUf !== undefined && destUf !== 'EX'
        ? ie(d.IE, destUf, 'destinatario.IE', issues, false)
        : d.IE;
    dest = clean({
      ...docDest,
      xNome: opcoes.ambiente === 'homologacao' ? XNOME_HOMOLOGACAO : d.xNome,
      enderDest,
      indIEDest: d.indIEDest,
      IE: destIe,
      ISUF: d.ISUF,
      IM: d.IM,
      email: d.email,
    });
  }

  // Identificação: contingência e forma de emissão
  const cont = entrada.contingencia;
  const tpEmis = cont?.tpEmis ?? '1';
  if (cont !== undefined) {
    if (cont.xJust.length < 15 || cont.xJust.length > 256) {
      issues.add(
        'contingencia.xJust',
        'contingencia_invalida',
        'justificativa da contingência com 15 a 256 caracteres',
      );
    }
    if (cont.dhCont.getTime() > agora.getTime()) {
      issues.add('contingencia.dhCont', 'contingencia_invalida', 'entrada em contingência posterior à emissão');
    }
    if (!nfce && tpEmis === '9') {
      issues.add(
        'contingencia.tpEmis',
        'contingencia_invalida',
        'contingência off-line (tpEmis 9) é só da NFC-e (B22-10, rejeição 711)',
      );
    }
    if (nfce && (tpEmis === '6' || tpEmis === '7')) {
      issues.add(
        'contingencia.tpEmis',
        'contingencia_invalida',
        'a NFC-e não é autorizada pela SVC; a contingência dela é off-line, tpEmis 9 (B22-70, rejeição 783)',
      );
    }
  }

  // Identificação que as regras do modelo conferem antes de montar.
  // Na NFC-e a operação é sempre interna (B11a-10, rejeição 707): o endereço do consumidor não a torna interestadual.
  const idDest =
    entrada.idDest ?? (nfce ? '1' : destUf === 'EX' ? '3' : destUf !== undefined && destUf !== emitUf ? '2' : '1');
  const tpImp = entrada.tpImp ?? (nfce ? '4' : '1');
  conferirDestinatario(
    entrada,
    {
      mod,
      tpNF: entrada.tpNF,
      idDest,
      idDestInformado: entrada.idDest !== undefined,
      indFinal,
      producao: opcoes.ambiente === 'producao',
    },
    issues,
  );
  if (nfce) {
    conferirNfce(
      entrada,
      {
        tpNF: entrada.tpNF,
        idDest,
        tpImp,
        finNFe: finNFeIn,
        indFinal,
        indPres,
      },
      issues,
    );
  } else if (tpImp === '4' || tpImp === '5') {
    issues.add('tpImp', 'campo_invalido', 'tpImp 4 e 5 (DANFC-e) são da NFC-e (B21-20, rejeição 710)');
  }
  const qr: QrCodeNfceOpcoes = opcoes.qrCode ?? { versao: '3' };
  if (nfce && qr.versao === '2') {
    // O CSC e o idCSC são opções do montador, não da nota: as ocorrências são da montagem (ADR 0011).
    if (!/^\d{1,6}$/.test(qr.idCSC) || Number(qr.idCSC) === 0) {
      issues.montagem(
        'qrCode.idCSC',
        'qrcode_invalido',
        'idCSC tem de 1 a 6 algarismos, diferente de zero (Manual do DANFE NFC-e 6.0, 4.6)',
      );
    }
    if (qr.CSC.length < 16 || qr.CSC.length > 36) {
      issues.montagem(
        'qrCode.CSC',
        'qrcode_invalido',
        'o CSC tem de 16 a 36 caracteres (Manual do DANFE NFC-e 6.0, 4.6)',
      );
    }
    if ('CPF' in emitDoc) {
      issues.montagem(
        'qrCode.versao',
        'qrcode_invalido',
        'emitente pessoa física usa o QR Code versão 3 (NT 2025.001, ZX02-222, rejeição 444)',
      );
    }
  }

  // Chave de acesso e cNF
  const random =
    opcoes.aleatorio ??
    ((b: Uint8Array): Uint8Array => globalThis.crypto.getRandomValues(b as Uint8Array<ArrayBuffer>));
  const emitente14 = 'CNPJ' in emitDoc ? emitDoc.CNPJ : emitDoc.CPF;
  const gerada = issues.empty
    ? gerarChave(
        { cUF, aamm, emitente: emitente14, mod, serie: String(serie), nNF: String(nNF), tpEmis },
        entrada.cNF,
        random,
        issues,
      )
    : undefined;
  const chave = gerada?.chave ?? '0'.repeat(44);
  const cNF = gerada?.cNF ?? '00000000';
  const cDV = chave.slice(43);

  // Itens
  if (entrada.itens.length === 0 || entrada.itens.length > 990) {
    issues.add('itens', 'itens_limite', 'a NF-e tem de 1 a 990 itens');
  }
  const semIe = !nfce && entrada.emitente.IE === undefined;
  const itens = entrada.itens.map((it, n) => montarItem(ctx, it, n, finNFeIn === '1', semIe));
  // Na NFC-e em homologação, a descrição do primeiro item é a literal da RV I04-10, como o nome do destinatário da
  // E04-20: o builder a põe, e a descrição informada fica fora do XML de teste.
  const primeiro = itens[0];
  if (nfce && opcoes.ambiente === 'homologacao' && primeiro !== undefined) {
    (primeiro.det.prod as unknown as Record<string, unknown>).xProd = XPROD_HOMOLOGACAO_NFCE;
  }

  // IBS/CBS pela calculadora das opções, ou pelo motor do sinete
  const classificados = entrada.itens
    .map((it, n) => ({ it, n }))
    .filter(({ it }) => it.impostos.ibsCbs?.classificacao !== undefined);
  let aliquotasInformadas: readonly AliquotaIbsCbsInformada[] = [];
  if (classificados.length > 0) {
    const calculadora = opcoes.ibsCbs ?? calculadoraPadrao();
    const reqs: PedidoIbsCbsItem[] = classificados.map(({ it, n }) => {
      const c = it.impostos.ibsCbs?.classificacao as NonNullable<
        NonNullable<typeof it.impostos.ibsCbs>['classificacao']
      >;
      const m = itens[n] as ItemMontado;
      const vBC = ctx.opt(c.vBC, `itens[${n}].impostos.ibsCbs.classificacao.vBC`, D1302);
      const qTrib = Decimal.of((m.det.prod as { qTrib: string }).qTrib);
      return {
        nItem: n + 1,
        CST: c.CST,
        cClassTrib: c.cClassTrib,
        ...(c.indDoacao ? { indDoacao: c.indDoacao } : {}),
        ...(c.cCredPres ? { cCredPres: c.cCredPres } : {}),
        ...(c.gTribRegular ? { gTribRegular: c.gTribRegular } : {}),
        ...(vBC ? { vBC } : {}),
        NCM: (m.det.prod as { NCM: string }).NCM,
        CFOP: (m.det.prod as { CFOP: string }).CFOP,
        uTrib: (m.det.prod as { uTrib: string }).uTrib,
        qTrib,
        vProd: m.v.vProd,
        vDesc: m.v.vDesc,
        vFrete: m.v.vFrete,
        vSeg: m.v.vSeg,
        vOutro: m.v.vOutro,
        vICMS: m.icms.vICMS,
        vICMSST: m.icms.vST,
        vFCP: m.icms.vFCP,
        vFCPST: m.icms.vFCPST,
        vIPI: m.v.vIPI,
        vPIS: m.v.vPIS,
        vCOFINS: m.v.vCOFINS,
        vII: m.v.vII,
        vISSQN: m.v.vISSQN,
        vICMSUFDest: m.v.vICMSUFDest,
        vFCPUFDest: m.v.vFCPUFDest,
      };
    });
    const destino =
      entrada.entrega !== undefined
        ? { UF: entrada.entrega.UF, cMun: entrada.entrega.cMun }
        : d?.endereco !== undefined
          ? isExterior(d.endereco)
            ? { UF: 'EX' as const, cMun: '9999999' }
            : { UF: d.endereco.UF, cMun: d.endereco.cMun }
          : undefined;
    const compra = entrada.gCompraGov;
    const resp = await calculadora.calcular({
      nota: {
        fatoGerador,
        emissao: agora,
        ambiente: opcoes.ambiente,
        mod,
        tpNF: entrada.tpNF,
        finNFe: finNFeIn,
        ...(entrada.tpNFDebito ? { tpNFDebito: entrada.tpNFDebito } : {}),
        ...(entrada.tpNFCredito ? { tpNFCredito: entrada.tpNFCredito } : {}),
        indFinal,
        indPres,
        emitente: { UF: emitUf, cMun: e.endereco.cMun, CRT: e.CRT },
        ...(destino ? { destino } : {}),
        ...(entrada.cMunFGIBS ? { cMunFGIBS: entrada.cMunFGIBS } : {}),
        ...(compra && pRedutorGov
          ? {
              compraGov: {
                tpEnteGov: compra.tpEnteGov,
                pRedutor: pRedutorGov,
                tpOperGov: compra.tpOperGov,
              },
            }
          : {}),
      },
      itens: reqs,
    });
    issues.addAll(resp.ocorrencias ?? [], 'montagem');
    aliquotasInformadas = resp.aliquotasInformadas ?? [];
    // A calculadora que recusou já disse por quê: o grupo que faltar é consequência da ocorrência dela, e uma segunda
    // ocorrência por item repetiria a causa. `ibscbs_calculo` fica para a calculadora que omite um item sem explicar.
    const explicou = (resp.ocorrencias?.length ?? 0) > 0;
    for (const { n } of classificados) {
      const g = resp.itens.find((x) => x.nItem === n + 1);
      if (g === undefined) {
        if (!explicou)
          issues.montagem(
            `itens[${n}].impostos.ibsCbs`,
            'ibscbs_calculo',
            'a calculadora não devolveu o grupo IBSCBS do item',
          );
        continue;
      }
      ((itens[n] as ItemMontado).det.imposto as Record<string, unknown>).IBSCBS = g.IBSCBS;
    }
  }

  // Grupos repassados (IBSCBS pronto ou da calculadora, IS) chegam como texto: número malformado vira ocorrência antes
  // de qualquer soma, nunca exceção.
  itens.forEach((m, n) => {
    const imp = m.det.imposto as { IBSCBS?: unknown; IS?: unknown };
    const ib = `itens[${n}].impostos.ibsCbs`;
    const is = `itens[${n}].impostos.is`;
    // O IBSCBS pronto (ibsCbs.grupo) é da entrada; o que a calculadora devolveu é da montagem (ADR 0011).
    const ibsDaCalculadora = entrada.itens[n]?.impostos.ibsCbs?.grupo === undefined;
    const antes = issues.list.length;
    decimaisInvalidos(imp.IBSCBS, ib, issues);
    if (ibsDaCalculadora) issues.reclassificarDesde(antes, 'montagem');
    decimaisInvalidos(imp.IS, is, issues);
    if (issues.list.length === antes) {
      grupoInvalido(TTribNFeCt as ComplexType, 'IBSCBS', imp.IBSCBS, ib, issues);
      if (ibsDaCalculadora) issues.reclassificarDesde(antes, 'montagem');
      grupoInvalido(TISCt as ComplexType, 'IS', imp.IS, is, issues);
    }
  });
  // Texto e tamanho dos campos de texto pelo tipo do PL, com o caminho da entrada (ADR 0011); o campo que outra
  // conferência já recusou fica só com a ocorrência dela.
  // Em homologação, o nome do destinatário e, na NFC-e, a descrição do primeiro item são as literais da E04-20 e da I04-10:
  // o texto informado não vai ao XML.
  const substituidos =
    opcoes.ambiente === 'homologacao' ? ['destinatario.xNome', ...(nfce ? ['itens[0].produto.xProd'] : [])] : [];
  conferirTextosDaEntrada(entrada, pl.infNFe as ComplexType, issues, new Set(substituidos));
  // Nota sem IE do emitente (NT 2026.007, ADR 0012): conferida com o grupo IBSCBS já montado e antes de parar nas
  // ocorrências dos itens, para todas as violações voltarem juntas.
  exclusivoIbsCbs(
    entrada,
    { nfce, dhEmi, instantes: [agora, fatoGerador] },
    itens.map((m) => m.det.imposto as { IBSCBS?: unknown }),
    issues,
  );
  if (!issues.empty) return { ok: false, ocorrencias: issues.classificadas };

  // Totais (grupo W)
  const gruposIbsCbs = itens
    .map((m) => (m.det.imposto as { IBSCBS?: TTribNFe }).IBSCBS)
    .filter((g): g is TTribNFe => g !== undefined);
  const somaTributosNoItem = diaBrasilia(fatoGerador) >= reforma.vItemSomaTributosDesde;
  let vNFTot = Decimal.ZERO;
  // vItem e vNFTot existem quando a nota tem tributo da reforma: IBS/CBS ou IS (NT 2025.002, VB01 e W60).
  const temReforma = gruposIbsCbs.length > 0 || itens.some((m) => (m.det.imposto as { IS?: unknown }).IS !== undefined);
  if (temReforma) {
    for (const m of itens) {
      let vItem = composicao(m, m.indTot);
      const g = (m.det.imposto as { IBSCBS?: TTribNFe }).IBSCBS;
      if (somaTributosNoItem) {
        // VB01-10: o vIS soma no item por si, com ou sem grupo IBSCBS no mesmo item.
        const is = (m.det.imposto as { IS?: { vIS?: string } }).IS?.vIS;
        if (is !== undefined) vItem = vItem.plus(Decimal.of(is));
      }
      if (g !== undefined && somaTributosNoItem) {
        const t = ibsCbsDoItem(g);
        vItem = vItem.plus(t.vIBS).plus(t.vCBS);
        if (!m.faturamentoDireto) vItem = vItem.plus(t.vTotIBSMonoItem).plus(t.vTotCBSMonoItem);
      }
      (m.det as Record<string, unknown>).vItem = ctx.s(vItem, D1302);
      vNFTot = vNFTot.plus(vItem);
    }
  }
  const soma = (f: (m: ItemMontado) => Decimal, filtro: (m: ItemMontado) => boolean = () => true): Decimal =>
    itens.filter(filtro).reduce((acc, m) => acc.plus(f(m)), Decimal.ZERO);
  const icmsItens = (m: ItemMontado): boolean => !m.issqn;
  const icmsSoma = (k: keyof IcmsTotais): Decimal => soma((m) => m.icms[k] as Decimal);
  const vProdTot = soma(
    (m) => m.v.vProd,
    (m) => m.indTot && !m.issqn,
  );
  const vServ = soma(
    (m) => m.v.vProd,
    (m) => m.indTot && m.issqn,
  );
  const vNF = itens.reduce((acc, m) => acc.plus(composicao(m, m.indTot && !m.issqn)), Decimal.ZERO).plus(vServ);
  const S = (x: Decimal): string => ctx.s(x, D1302);
  const mono = itens.some((m) => m.icms.mono);
  const ufDest = itens.some((m) => m.temUfDest);
  const ICMSTot = clean({
    vBC: S(icmsSoma('vBC')),
    vICMS: S(icmsSoma('vICMS')),
    vICMSDeson: S(icmsSoma('vICMSDeson')),
    vFCPUFDest: ufDest ? S(soma((m) => m.v.vFCPUFDest)) : undefined,
    vICMSUFDest: ufDest ? S(soma((m) => m.v.vICMSUFDest)) : undefined,
    vICMSUFRemet: ufDest ? S(soma((m) => m.v.vICMSUFRemet)) : undefined,
    vFCP: S(icmsSoma('vFCP')),
    vBCST: S(icmsSoma('vBCST')),
    vST: S(icmsSoma('vST')),
    vFCPST: S(icmsSoma('vFCPST')),
    vFCPSTRet: S(icmsSoma('vFCPSTRet')),
    qBCMono: mono ? S(ctx.round(icmsSoma('qBCMono'), D1302, 'icms')) : undefined,
    vICMSMono: mono ? S(icmsSoma('vICMSMono')) : undefined,
    qBCMonoReten: mono ? S(ctx.round(icmsSoma('qBCMonoReten'), D1302, 'icms')) : undefined,
    vICMSMonoReten: mono ? S(icmsSoma('vICMSMonoReten')) : undefined,
    qBCMonoRet: mono ? S(ctx.round(icmsSoma('qBCMonoRet'), D1302, 'icms')) : undefined,
    vICMSMonoRet: mono ? S(icmsSoma('vICMSMonoRet')) : undefined,
    vProd: S(vProdTot),
    vFrete: S(soma((m) => m.v.vFrete)),
    vSeg: S(soma((m) => m.v.vSeg)),
    vDesc: S(soma((m) => m.v.vDesc)),
    vII: S(soma((m) => m.v.vII)),
    vIPI: S(soma((m) => m.v.vIPI)),
    vIPIDevol: S(soma((m) => m.v.vIPIDevol)),
    vPIS: S(soma((m) => m.v.vPIS, icmsItens)),
    vCOFINS: S(soma((m) => m.v.vCOFINS, icmsItens)),
    vOutro: S(soma((m) => m.v.vOutro)),
    vNF: S(vNF),
    vTotTrib: itens.some((m) => m.temTotTrib) ? S(soma((m) => m.v.vTotTrib)) : undefined,
  }) as TNFe_infNFe_total_ICMSTot;
  const total: Record<string, unknown> = { ICMSTot };
  if (itens.some((m) => m.issqn)) {
    const iss = itens.filter((m) => m.issqn);
    const so = (x: Decimal): string | undefined => ctx.so(x, D1302_OPC);
    const opc = (k: string): string | undefined =>
      so(iss.reduce((a, m) => a.plus(m.issqnOpcionais[k] ?? Decimal.ZERO), Decimal.ZERO));
    total.ISSQNtot = clean({
      vServ: so(vServ),
      vBC: so(
        soma(
          (m) => m.v.vBCISS,
          (m) => m.issqn,
        ),
      ),
      vISS: so(
        soma(
          (m) => m.v.vISSQN,
          (m) => m.issqn,
        ),
      ),
      vPIS: so(
        soma(
          (m) => m.v.vPIS,
          (m) => m.issqn,
        ),
      ),
      vCOFINS: so(
        soma(
          (m) => m.v.vCOFINS,
          (m) => m.issqn,
        ),
      ),
      dCompet: dhEmi.slice(0, 10),
      vDeducao: opc('vDeducao'),
      vOutro: opc('vOutro'),
      vDescIncond: opc('vDescIncond'),
      vDescCond: opc('vDescCond'),
      vISSRet: opc('vISSRet'),
    }) as TNFe_infNFe_total_ISSQNtot;
  }
  const comIs = itens.filter((m) => (m.det.imposto as { IS?: unknown }).IS !== undefined);
  if (comIs.length > 0) {
    total.ISTot = {
      vIS: S(
        comIs.reduce(
          (a, m) => a.plus(Decimal.of((m.det.imposto as { IS: { vIS?: string } }).IS.vIS ?? '0')),
          Decimal.ZERO,
        ),
      ),
    };
  }
  if (gruposIbsCbs.length > 0) total.IBSCBSTot = totalIbsCbs(gruposIbsCbs);
  if (temReforma) total.vNFTot = S(vNFTot);

  // Identificação (grupo B)
  const finNFe = finNFeIn;
  const ide = clean({
    cUF,
    cNF,
    natOp: entrada.natOp,
    mod,
    serie: String(serie),
    nNF: String(nNF),
    dhEmi,
    dhSaiEnt: entrada.dhSaiEnt === undefined ? undefined : formatarDh(entrada.dhSaiEnt, offset),
    dPrevEntrega: entrada.dPrevEntrega,
    tpNF: entrada.tpNF,
    idDest,
    cMunFG: entrada.cMunFG ?? e.endereco.cMun,
    cMunFGIBS: entrada.cMunFGIBS,
    tpImp,
    tpEmis,
    cDV,
    tpAmb,
    finNFe,
    tpNFDebito: entrada.tpNFDebito,
    tpNFCredito: entrada.tpNFCredito,
    indFinal,
    indPres,
    // NT 2020.006: indIntermed obrigatório com indPres 2, 3, 4 e 9.
    indIntermed: entrada.indIntermed ?? (['2', '3', '4', '9'].includes(indPres) ? '0' : undefined),
    procEmi: '0',
    verProc: opcoes.verProc ?? formatarVerProc('sinete', VERSAO_PACOTE),
    dhCont: cont === undefined ? undefined : formatarDh(cont.dhCont, offset),
    xJust: cont?.xJust,
    NFref: entrada.referenciadas?.map((r, n) => referencia(r, `referenciadas[${n}]`, issues)),
    gCompraGov:
      entrada.gCompraGov === undefined
        ? undefined
        : clean({
            tpEnteGov: entrada.gCompraGov.tpEnteGov,
            pRedutor: ctx.s(pRedutorGov ?? Decimal.ZERO, D0302A04),
            tpOperGov: entrada.gCompraGov.tpOperGov,
            refDFeAnt: entrada.gCompraGov.refDFeAnt as string[] | undefined,
          }),
    gPagAntecipado: entrada.gPagAntecipado === undefined ? undefined : { refNFe: [...entrada.gPagAntecipado] },
  });

  // Locais, autorizados, transporte, cobrança, pagamento, informações adicionais
  const local = (l: Local | undefined, path: string): Record<string, unknown> | undefined =>
    l === undefined
      ? undefined
      : clean({
          ...documento(l, path, issues),
          xNome: l.xNome,
          ...endereco(l),
          cPais: '1058',
          xPais: 'BRASIL',
          email: l.email,
          IE: l.IE,
        });
  if ((entrada.autXML?.length ?? 0) > 10) issues.add('autXML', 'campo_invalido', 'no máximo 10 autorizados');
  const autXML = entrada.autXML?.map((a, n) => documento(a, `autXML[${n}]`, issues));

  const tr = entrada.transporte;
  const transp: Record<string, unknown> = { modFrete: tr?.modFrete ?? '9' };
  if (tr?.transportador !== undefined) {
    const t = tr.transportador;
    const docT =
      t.CNPJ !== undefined || t.CPF !== undefined
        ? documento(t as DocumentoPessoa, 'transporte.transportador', issues)
        : {};
    transp.transporta = clean({ ...docT, xNome: t.xNome, IE: t.IE, xEnder: t.xEnder, xMun: t.xMun, UF: t.UF });
  }
  if (tr?.retTransp !== undefined) {
    const r = tr.retTransp;
    const vBCRet = ctx.req(r.vBCRet, 'transporte.retTransp.vBCRet', D1302);
    const pICMSRet = ctx.req(r.pICMSRet, 'transporte.retTransp.pICMSRet', D0302A04);
    const vICMSRet = ctx.calc(r.vICMSRet, vBCRet.percent(pICMSRet), 'transporte.retTransp.vICMSRet', D1302, 'icms');
    transp.retTransp = {
      vServ: S(ctx.req(r.vServ, 'transporte.retTransp.vServ', D1302)),
      vBCRet: S(vBCRet),
      pICMSRet: ctx.s(pICMSRet, D0302A04),
      vICMSRet: S(vICMSRet),
      CFOP: r.CFOP,
      cMunFG: r.cMunFG,
    };
  }
  if (tr?.veicTransp !== undefined) transp.veicTransp = tr.veicTransp;
  if (tr?.reboque !== undefined) transp.reboque = tr.reboque;
  if (tr?.vagao !== undefined) transp.vagao = tr.vagao;
  if (tr?.balsa !== undefined) transp.balsa = tr.balsa;
  if (tr?.volumes !== undefined) {
    transp.vol = tr.volumes.map((vol, n) =>
      clean({
        qVol: vol.qVol === undefined ? undefined : String(vol.qVol),
        esp: vol.esp,
        marca: vol.marca,
        nVol: vol.nVol,
        pesoL: ctx.so(ctx.opt(vol.pesoL, `transporte.volumes[${n}].pesoL`, D1203), D1203),
        pesoB: ctx.so(ctx.opt(vol.pesoB, `transporte.volumes[${n}].pesoB`, D1203), D1203),
        lacres: vol.lacres?.map((nLacre) => ({ nLacre })),
      }),
    );
  }

  let cobr: Record<string, unknown> | undefined;
  if (entrada.cobranca !== undefined) {
    const c = entrada.cobranca;
    cobr = {};
    if (c.fatura !== undefined) {
      const f = c.fatura;
      const vOrig = ctx.opt(f.vOrig, 'cobranca.fatura.vOrig', D1302);
      const vDescF = ctx.opt(f.vDesc, 'cobranca.fatura.vDesc', D1302);
      const vLiq =
        vOrig === undefined
          ? ctx.opt(f.vLiq, 'cobranca.fatura.vLiq', D1302)
          : ctx.calc(f.vLiq, vOrig.minus(vDescF ?? Decimal.ZERO), 'cobranca.fatura.vLiq', D1302, 'produto');
      cobr.fat = clean({
        nFat: f.nFat,
        vOrig: ctx.so(vOrig, D1302),
        vDesc: ctx.so(vDescF, D1302),
        vLiq: ctx.so(vLiq, D1302),
      });
    }
    if (c.duplicatas !== undefined) {
      if (c.duplicatas.length > 120) issues.add('cobranca.duplicatas', 'campo_invalido', 'no máximo 120 duplicatas');
      cobr.dup = c.duplicatas.map((dup, n) =>
        clean({
          // NT 2016.002: nDup sequencial com 3 dígitos.
          nDup: dup.nDup ?? String(n + 1).padStart(3, '0'),
          dVenc: dup.dVenc,
          vDup: ctx.s(ctx.req(dup.vDup, `cobranca.duplicatas[${n}].vDup`, D1302_OPC), D1302_OPC),
        }),
      );
    }
  }

  const pagIn = entrada.pagamento ?? { detPag: [{ tPag: '90' as const, vPag: '0' }] };
  const igualTotal = opcoes.pagamentoIgualTotal === true;
  if (igualTotal) {
    const unico = entrada.pagamento?.detPag.length === 1 ? entrada.pagamento.detPag[0] : undefined;
    if (unico === undefined) {
      issues.add('pagamento.detPag', 'pagamento_igual_total', 'pagamentoIgualTotal pede exatamente um detPag');
    } else if (unico.tPag === '90') {
      issues.add('pagamento.detPag[0].tPag', 'pagamento_igual_total', 'tPag 90 (sem pagamento) não recebe o total');
    }
  }
  const pag = clean({
    detPag: pagIn.detPag.map((p, n) =>
      clean({
        indPag: p.indPag,
        tPag: p.tPag,
        xPag: p.xPag,
        // Com pagamentoIgualTotal, o único pagamento é o total da nota, já calculado acima.
        vPag: igualTotal ? S(vNF) : S(ctx.req(p.vPag, `pagamento.detPag[${n}].vPag`, D1302)),
        dPag: p.dPag,
        CNPJPag: p.CNPJPag,
        UFPag: p.UFPag,
        card: p.card,
      }),
    ),
    vTroco: ctx.so(ctx.opt(pagIn.vTroco, 'pagamento.vTroco', D1302), D1302),
  }) as unknown as PagMontado;
  // Pagamentos e troco contra o vNF (W16), não o vNFTot: é o total que a YA03-10 (NT 2025.001 v1.03) e a YA09-10 (MOC 7.0
  // Anexo I) citam, e a NT 2025.002 (até a v1.51) não mudou essas regras nem o W16.
  if (nfce && entrada.pagamento !== undefined && entrada.pagamento.detPag.length > 0 && issues.empty) {
    pagamentoNfce(pag, vNF, issues);
  }
  // W16-40 (rejeição 750): acima do limite, a NFC-e identifica o destinatário por CNPJ, CPF ou idEstrangeiro.
  if (nfce && vNF.gt(Decimal.of(NFCE_LIMITE_SEM_DESTINATARIO)) && dest === undefined) {
    issues.add(
      'destinatario',
      'campo_obrigatorio',
      `NFC-e acima de R$ ${NFCE_LIMITE_SEM_DESTINATARIO} identifica o destinatário (W16-40, rejeição 750)`,
    );
  }
  const ia = entrada.informacoesAdicionais;
  const infAdic =
    ia === undefined || Object.values(ia).every((x) => x === undefined)
      ? undefined
      : clean({
          infAdFisco: ia.infAdFisco,
          infCpl: ia.infCpl,
          obsCont: ia.obsCont,
          obsFisco: ia.obsFisco,
          procRef: ia.procRef,
        });

  // Responsável técnico e CSRT (NT 2018.005), com a exigência por UF como dado
  const exig = { ...exigenciaRespTec(emitUf, opcoes.ambiente, agora), ...opcoes.exigencias };
  const rt = entrada.respTec ?? opcoes.respTec;
  let infRespTec: Record<string, unknown> | undefined;
  if (rt === undefined) {
    if (exig.infRespTec === 'obrigatorio') {
      issues.add('respTec', 'resp_tec_obrigatorio', `a UF ${emitUf} exige o responsável técnico (rejeição 972)`);
    }
  } else {
    const cnpjRt = lerCnpj(rt.CNPJ, { caminho: 'respTec.CNPJ' });
    if (!cnpjRt.ok) issues.list.push(cnpjRt.erro);
    infRespTec = {
      CNPJ: cnpjRt.ok ? cnpjRt.valor : rt.CNPJ,
      xContato: rt.xContato,
      email: rt.email,
      fone: digits(rt.fone),
    };
    if (rt.csrt !== undefined) {
      infRespTec.idCSRT = rt.csrt.idCSRT;
      infRespTec.hashCSRT = await hashCsrt(rt.csrt.CSRT, chave);
    } else if (exig.csrt === 'obrigatorio') {
      issues.add('respTec.csrt', 'csrt_obrigatorio', `a UF ${emitUf} exige idCSRT e hashCSRT (rejeição 975)`);
    }
  }

  const inf = clean({
    versao: '4.00',
    Id: `NFe${chave}`,
    ide,
    emit,
    dest,
    retirada: local(entrada.retirada, 'retirada'),
    entrega: local(entrada.entrega, 'entrega'),
    autXML,
    det: itens.map((m) => m.det),
    total,
    transp,
    cobr,
    pag,
    infIntermed: entrada.infIntermed,
    infAdic,
    exporta: entrada.exporta,
    compra: entrada.compra,
    cana: entrada.cana,
    infRespTec,
    agropecuario: entrada.agropecuario,
  }) as unknown as TNFe_infNFe;

  // Regras da SEFAZ que só dependem do documento (ADR 0012).
  cstComIsento(entrada, idDest, issues);
  vencimentos(entrada, { dhEmi, instante: agora }, issues);

  camposForaDoPl(pl.infNFe, inf, 'infNFe', pl.vigencia.pl, issues);
  textosForaDoXml(inf, 'infNFe', issues);
  if (!issues.empty) return { ok: false, ocorrencias: issues.classificadas };

  // Serialização canônica e validação estrita contra o schema do PL vigente, antes de qualquer assinatura.
  // O serializer recusa com ErroSerializacao o que não cabe no modelo (escolhas exclusivas informadas juntas, por
  // exemplo vagao e balsa): vira ocorrência com o caminho do XML, nunca exceção.
  let xml: string;
  try {
    xml = `<NFe xmlns="${NFE_NS}">${serializar(pl.infNFe, 'infNFe', inf, NFE_NS)}</NFe>`;
  } catch (e) {
    if (!(e instanceof ErroSerializacao)) throw e;
    return {
      ok: false,
      ocorrencias: [{ caminho: e.caminho, code: 'schema', mensagem: e.message, origem: 'montagem' }],
    };
  }
  const doc = lerXml(xml);
  const infEl = primeiroFilho(doc.raiz, 'infNFe', NFE_NS);
  const schemaIssues = infEl === undefined ? [] : validar(pl.infNFe, infEl);
  if (schemaIssues.length > 0) {
    return {
      ok: false,
      ocorrencias: schemaIssues.map((i) => ({
        caminho: i.caminho,
        code: 'schema',
        mensagem: `${i.code}: ${i.mensagem}`,
        origem: 'montagem',
      })),
    };
  }
  let supl: NfceSupl | undefined;
  if (nfce) {
    // infNFeSupl (grupo ZX, NT 2025.001 item 04): endereços da UF no dia da emissão, pelo horário de Brasília.
    const tabela = urlsNfce(emitUf, opcoes.ambiente, diaBrasilia(agora));
    const urlQr = opcoes.urlQrCode ?? tabela.qrCode;
    const urlChave = opcoes.urlChave ?? tabela.urlChave;
    if (urlQr === undefined || !/^https?:\/\//i.test(urlQr)) {
      issues.montagem(
        'urlQrCode',
        'qrcode_invalido',
        `sem endereço completo do QR Code da NFC-e para ${emitUf} em ${opcoes.ambiente}: informe urlQrCode (data/nfce-urls.json)`,
      );
    }
    if (urlChave === undefined) {
      issues.montagem(
        'urlChave',
        'qrcode_invalido',
        `sem URL de consulta por chave da NFC-e para ${emitUf}: informe urlChave`,
      );
    }
    if (urlQr === undefined || urlChave === undefined || !issues.empty)
      return { ok: false, ocorrencias: issues.classificadas };
    const p = await parametrosQrCode(
      {
        chave,
        ambiente: opcoes.ambiente,
        tpEmis,
        dhEmi,
        vNF: (inf.total as { ICMSTot: { vNF: string } }).ICMSTot.vNF,
        ...(dest === undefined ? {} : { dest: dest as { CNPJ?: string; CPF?: string; idEstrangeiro?: string } }),
        xml,
      },
      qr,
    );
    supl = { versao: qr.versao, urlChave, base: `${urlQr.replace(/\?+$/, '')}?p=`, ...p };
    // O infNFeSupl contra o schema antes de assinar (padrões do qrCode por versão, tamanho do urlChave). Na versão 3
    // off-line, com uma assinatura do tamanho da de uma chave RSA de 2048 bits no lugar da que o certificado ainda vai
    // fazer; o `comQrCode` confere de novo com a assinatura verdadeira.
    const suplIssues = conferirSupl(
      inserirSupl({ xml, nfce: supl } as NfeMontada, supl.assinar ? ASSINATURA_2048 : undefined),
    );
    if (suplIssues.length > 0) return { ok: false, ocorrencias: suplIssues };
  }
  return {
    ok: true,
    valor: {
      chave,
      id: `NFe${chave}`,
      cNF,
      cDV,
      mod,
      tpEmis,
      dhEmi,
      ...(supl === undefined ? {} : { nfce: supl }),
      pl: pl.vigencia,
      infNFe: inf,
      xml,
      ...(aliquotasInformadas.length === 0 ? {} : { aliquotasInformadas }),
    },
  };
}

/** Base64 de uma assinatura RSA de 2048 bits (256 bytes): a forma da assinatura do QR Code off-line na montagem. */
const ASSINATURA_2048 = codificarBase64(new Uint8Array(256));

/** Ocorrências do `infNFeSupl` do XML contra o schema (`TNFe_infNFeSupl`), como de montagem. */
function conferirSupl(xml: string): Ocorrencia[] {
  const el = primeiroFilho(lerXml(xml).raiz, 'infNFeSupl', NFE_NS);
  const erros = el === undefined ? [] : validar(TNFe_infNFeSupl as ComplexType, el);
  return erros.map((i) => ({
    caminho: i.caminho,
    code: 'schema',
    mensagem: `${i.code}: ${i.mensagem}`,
    origem: 'montagem',
  }));
}

const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Assinatura dos parâmetros do QR Code da NFC-e em contingência off-line com a versão 3 (RSA-SHA1 em Base64, com o
 * certificado que assina a nota; Manual do DANFE NFC-e 6.0, 4.4.2). `undefined` quando o QR Code não leva assinatura
 * (NF-e, emissão normal, versão 2).
 */
export async function assinaturaQrCode(nota: NfeMontada, assinador: Assinador): Promise<string | undefined> {
  return nota.nfce?.assinar === true ? assinarParametros(nota.nfce.parametros, assinador) : undefined;
}

/**
 * A NFC-e montada com o `infNFeSupl` (QR Code e `urlChave`) inserido por splice antes do fechamento de `NFe`, pronta
 * para a assinatura. Na versão 3 em contingência off-line, informe a `assinatura` (`assinaturaQrCode`); nos demais
 * casos ela não existe (ZX02-330, rejeição 445; ZX02-334, rejeição 474). Para assinar em três fases (A3, HSM), passe
 * este texto ao `prepararAssinatura` do `@sinete/core/xml` com o `id` da nota. Na NF-e (modelo 55), devolve o XML como
 * veio: ela não tem `infNFeSupl` (ZX01-10, rejeição 393).
 */
export function comQrCode(nota: NfeMontada, assinatura?: string): string {
  const xml = inserirSupl(nota, assinatura);
  // Com a assinatura verdadeira, o qrCode pode passar do tamanho que a montagem conferiu (chave maior que 2048 bits).
  if (assinatura !== undefined) {
    const issues = conferirSupl(xml);
    if (issues.length > 0) throw new ErroDeValidacao('o QR Code da NFC-e não passou no schema', issues);
  }
  return xml;
}

function inserirSupl(built: NfeMontada, assinatura: string | undefined): string {
  const s = built.nfce;
  if (s === undefined) {
    if (assinatura !== undefined) throw new ErroDeConfiguracao('a NF-e (modelo 55) não tem QR Code');
    return built.xml;
  }
  if (s.assinar && assinatura === undefined) {
    throw new ErroDeConfiguracao(
      'NFC-e em contingência off-line com QR Code versão 3 precisa da assinatura (ZX02-334, rejeição 474)',
    );
  }
  if (!s.assinar && assinatura !== undefined) {
    throw new ErroDeConfiguracao('este QR Code não leva assinatura (ZX02-330, rejeição 445)');
  }
  const fim = '</NFe>';
  if (!built.xml.endsWith(fim)) throw new ErroDeConfiguracao('NFC-e montada fora da forma esperada');
  const qrCode = `${s.base}${s.parametros}${assinatura === undefined ? '' : `|${assinatura}`}`;
  const supl = `<infNFeSupl><qrCode>${escapeXml(qrCode)}</qrCode><urlChave>${escapeXml(s.urlChave)}</urlChave></infNFeSupl>`;
  return built.xml.slice(0, -fim.length) + supl + fim;
}

/**
 * Assina a NF-e montada: na NFC-e, insere antes o `infNFeSupl` (`comQrCode`, com a assinatura do QR Code quando a
 * contingência off-line pede); depois, a `Signature` como último filho de `NFe`, tudo por splice, e devolve a string
 * final. É essa string que vai para a SEFAZ e para o banco; nada depois deve reparseá-la para reescrever.
 */
export async function assinarNfe(nota: NfeMontada, assinador: Assinador): Promise<string> {
  return assinarXml(comQrCode(nota, await assinaturaQrCode(nota, assinador)), { id: nota.id }, assinador);
}
