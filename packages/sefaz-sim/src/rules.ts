/**
 * Regras de negócio plugáveis. Cada serviço aplica, depois dos grupos gerais e da assinatura, a lista de regras do seu
 * tipo na ordem da lista; a primeira que devolver uma rejeição encerra a validação daquele documento. As regras padrão
 * (`DEFAULT_RULES`) são um subconjunto útil do MOC 7.0, cada uma com a origem em `source`. Para trocar, acrescentar ou
 * remover, monte outro `SimRules` a partir de `DEFAULT_RULES`.
 */

import { isUf, ufByCUf } from '@sinete/core';
import { parseChaveAcesso, parseCnpj, parseCpf, parseIe } from '@sinete/validators';
import type { SimConfig, Svc } from './context.ts';
import { parametrosDoQrCode } from './nfce.ts';
import type { SimAutorizador } from './services.ts';
import type { Contribuinte, Documento, EventoRecord, InutilizacaoRecord, NfeRecord, PendingNfe } from './state.ts';
import { docBase, docKey } from './state.ts';
import { parseDateTime, yearOf } from './time.ts';

/** Rejeição devolvida por uma regra: o `cStat` e os valores dos marcadores da mensagem oficial. */
export interface SimRejection {
  readonly cStat: string;
  readonly params?: Readonly<Record<string, string>>;
}

export interface SimRule<C> {
  /** Identificador da regra no documento de origem (`2B08-20`, `P15-10`). */
  readonly id: string;
  /** Documento e item de origem (`MOC 7.0 Anexo I, item 4.2.1`). */
  readonly source: string;
  check(ctx: C): SimRejection | undefined;
}

/** Consultas somente leitura ao estado, para as regras. */
export interface SimView {
  readonly config: SimConfig;
  readonly contingencia: Svc | undefined;
  nfe(chave: string): NfeRecord | undefined;
  nfeByNumero(emitente: string, mod: string, serie: string, nNF: string): NfeRecord | undefined;
  pendenteByNumero(emitente: string, mod: string, serie: string, nNF: string): PendingNfe | undefined;
  inutilizacaoCom(CNPJ: string, ano: string, mod: string, serie: number, nNF: number): InutilizacaoRecord | undefined;
  inutilizacoes(): readonly InutilizacaoRecord[];
  eventos(chave: string): readonly EventoRecord[];
  contribuinte(uf: string, ie: string): Contribuinte | undefined;
}

/** Campos da NF-e usados pelas regras de autorização. */
export interface NfeFacts {
  readonly id: string;
  readonly cUF: string;
  readonly cNF: string;
  readonly mod: string;
  readonly serie: string;
  readonly nNF: string;
  readonly dhEmi: string;
  readonly tpEmis: string;
  readonly cDV: string;
  readonly tpAmb: string;
  readonly emitente: Documento & { readonly xNome: string; readonly IE?: string; readonly UF: string };
  /** Campos da identificação que as regras do modelo (NF-e ou NFC-e) conferem; ausentes em fatos montados à mão. */
  readonly ide?: {
    readonly tpNF: string;
    readonly idDest: string;
    readonly tpImp: string;
    readonly finNFe: string;
    readonly indFinal: string;
    readonly indPres: string;
  };
  readonly vNF?: string;
  readonly destinatario?: Documento & { readonly idEstrangeiro?: string };
  /**
   * Grupo ZX (`infNFeSupl`): o QR Code e, na versão 3 off-line, se a assinatura confere com o certificado da nota
   * (conferida antes das regras, porque a verificação é assíncrona).
   */
  readonly supl?: { readonly qrCode?: string; readonly assinaturaConfere?: boolean };
}

export interface AutorizacaoContext {
  readonly nfe: NfeFacts;
  readonly chave: string;
  readonly autorizador: SimAutorizador;
  readonly view: SimView;
  readonly now: number;
}

export interface EventoFacts {
  readonly id: string;
  readonly cOrgao: string;
  readonly tpAmb: string;
  readonly autor: Documento;
  readonly chNFe: string;
  readonly dhEvento: string;
  readonly tpEvento: string;
  readonly nSeqEvento: string;
  readonly verEvento: string;
  /** Campos do `detEvento`, pelo nome local (`nProt`, `xJust`, `chNFeRef`, `cOrgaoAutor`, `tpAutor`). */
  readonly det: Readonly<Record<string, string>>;
}

export interface EventoContext {
  readonly evento: EventoFacts;
  readonly autorizador: SimAutorizador;
  readonly view: SimView;
  readonly now: number;
}

export interface InutilizacaoFacts {
  readonly id: string;
  readonly tpAmb: string;
  readonly cUF: string;
  readonly ano: string;
  readonly CNPJ: string;
  readonly mod: string;
  readonly serie: string;
  readonly nNFIni: string;
  readonly nNFFin: string;
}

export interface InutilizacaoContext {
  readonly inut: InutilizacaoFacts;
  readonly view: SimView;
  readonly now: number;
}

export interface SimRules {
  readonly autorizacao: readonly SimRule<AutorizacaoContext>[];
  readonly evento: readonly SimRule<EventoContext>[];
  readonly inutilizacao: readonly SimRule<InutilizacaoContext>[];
}

const ANEXO_I = 'MOC 7.0 Anexo I';
const VISAO_GERAL = 'MOC 7.0 Visão Geral';
const reject = (cStat: string, params?: Readonly<Record<string, string>>): SimRejection =>
  params === undefined ? { cStat } : { cStat, params };

const EMITENTE_EVENTOS = new Set(['110110', '110111', '110112']);
const CANCELAMENTOS = new Set(['110111', '110112']);
const MANIFESTACOES = new Set(['210200', '210210', '210220', '210240']);
/** Manifestações conclusivas (MOC 7.0 Visão Geral, 5.11.3, H06). */
const CONCLUSIVAS = new Set(['210200', '210220', '210240']);

// ---------- autorização (MOC 7.0 Anexo I, item 4.2.1) ----------

/**
 * Contribuinte do emitente no cadastro simulado: `null` quando a regra não se aplica (sem IE, ou cadastro sem nenhum
 * contribuinte da UF do emitente), `undefined` quando a IE não está cadastrada.
 */
function cadastroDoEmitente(nfe: NfeFacts, view: SimView): Contribuinte | undefined | null {
  const ie = nfe.emitente.IE;
  if (ie === undefined || !view.config.cadastro.some((c) => c.UF === nfe.emitente.UF)) return null;
  return view.contribuinte(nfe.emitente.UF, ie);
}

function aamm(dhEmi: string): string {
  return `${dhEmi.slice(2, 4)}${dhEmi.slice(5, 7)}`;
}

const autorizacao: SimRule<AutorizacaoContext>[] = [
  {
    id: 'A03-10',
    source: `${ANEXO_I}, item 4.2.1 (A. Dados da NF-e)`,
    check({ nfe, chave }: AutorizacaoContext): SimRejection | undefined {
      const emit = (nfe.emitente.CNPJ ?? `000${nfe.emitente.CPF ?? ''}`).padStart(14, '0');
      const esperado =
        `${nfe.cUF}${aamm(nfe.dhEmi)}${emit}${nfe.mod.padStart(2, '0')}${nfe.serie.padStart(3, '0')}` +
        `${nfe.nNF.padStart(9, '0')}${nfe.tpEmis}${nfe.cNF.padStart(8, '0')}${nfe.cDV}`;
      const dvOk = parseChaveAcesso(chave, { checkEmitente: false }).ok;
      return esperado === chave && dvOk ? undefined : reject('502');
    },
  },
  {
    id: 'B02-10',
    source: `${ANEXO_I}, item 4.2.1 (B. Identificação da NF-e)`,
    check: ({ nfe, view }: AutorizacaoContext): SimRejection | undefined =>
      view.config.cUFsAtendidas.includes(nfe.cUF) ? undefined : reject('226'),
  },
  {
    id: 'B11-10',
    source: `${ANEXO_I}, item 4.2.1; NFC-e só de saída (tpNF 1)`,
    check: ({ nfe }: AutorizacaoContext): SimRejection | undefined =>
      nfe.mod === '65' && nfe.ide !== undefined && nfe.ide.tpNF !== '1' ? reject('706') : undefined,
  },
  {
    id: 'B11a-10',
    source: `${ANEXO_I}, item 4.2.1; NFC-e só em operação interna (idDest 1)`,
    check: ({ nfe }: AutorizacaoContext): SimRejection | undefined =>
      nfe.mod === '65' && nfe.ide !== undefined && nfe.ide.idDest !== '1' ? reject('707') : undefined,
  },
  {
    id: 'B21-10',
    source: `${ANEXO_I}, item 4.2.1; NFC-e com tpImp 4 ou 5 (DANFC-e)`,
    check({ nfe }: AutorizacaoContext): SimRejection | undefined {
      if (nfe.ide === undefined) return undefined;
      const nfceImp = nfe.ide.tpImp === '4' || nfe.ide.tpImp === '5';
      if (nfe.mod === '65') return nfceImp ? undefined : reject('709');
      // B21-20: NF-e com o formato do DANFC-e.
      return nfceImp ? reject('710') : undefined;
    },
  },
  {
    id: 'B22-10',
    source: `${ANEXO_I}, item 4.2.1; contingência off-line (tpEmis 9) é só da NFC-e`,
    check: ({ nfe }: AutorizacaoContext): SimRejection | undefined =>
      nfe.mod === '55' && nfe.tpEmis === '9' ? reject('711') : undefined,
  },
  {
    id: 'B22-30',
    source: `${ANEXO_I}, item 4.2.1; tpEmis 3, 6 ou 7 só na SVC`,
    check: ({ nfe, autorizador }: AutorizacaoContext): SimRejection | undefined =>
      autorizador === 'uf' && ['3', '6', '7'].includes(nfe.tpEmis) ? reject('570') : undefined,
  },
  {
    id: 'B22-60',
    source: `${ANEXO_I}, item 4.2.1; na SVC, tpEmis 6 (SVC-AN) ou 7 (SVC-RS)`,
    check({ nfe, autorizador, view }: AutorizacaoContext): SimRejection | undefined {
      if (autorizador !== 'svc') return undefined;
      return nfe.tpEmis === (view.contingencia === 'SVC-RS' ? '7' : '6') ? undefined : reject('713');
    },
  },
  {
    id: 'B22-70',
    source: `${ANEXO_I}, item 4.2.1; NFC-e não é autorizada pela SVC`,
    check: ({ nfe, autorizador }: AutorizacaoContext): SimRejection | undefined =>
      autorizador === 'svc' && nfe.mod === '65' ? reject('783') : undefined,
  },
  {
    id: 'B24-10',
    source: `${ANEXO_I}, item 4.2.1`,
    check: ({ nfe, view }: AutorizacaoContext): SimRejection | undefined =>
      nfe.tpAmb === view.config.tpAmb ? undefined : reject('252'),
  },
  {
    id: 'B25-20',
    source: `${ANEXO_I}, item 4.2.1 (B25-20, B25a-10); NT 2025.002 v1.51, B25b-20 (NFC-e presencial: indPres 1, 4 ou 5)`,
    check({ nfe }: AutorizacaoContext): SimRejection | undefined {
      const ide = nfe.ide;
      if (nfe.mod !== '65' || ide === undefined) return undefined;
      if (ide.finNFe !== '1') return reject('715');
      if (ide.indFinal !== '1') return reject('716');
      return ['1', '4', '5'].includes(ide.indPres) ? undefined : reject('717');
    },
  },
  {
    id: 'ZX01-10',
    source: `${ANEXO_I}, item 4.2.1 (ZX01-10 e ZX02-10): infNFeSupl só na NFC-e, e nela o QR Code é obrigatório`,
    check({ nfe }: AutorizacaoContext): SimRejection | undefined {
      if (nfe.supl === undefined) return undefined;
      if (nfe.mod === '55') return nfe.supl.qrCode === undefined ? undefined : reject('393');
      return nfe.supl.qrCode === undefined ? reject('394') : undefined;
    },
  },
  {
    id: 'ZX02-222',
    source:
      'NT 2025.001 v1.03, regras ZX02-222 a ZX02-338 (QR Code versões 2 e 3; o hash da versão 2 com o CSC não é conferido)',
    check({ nfe, chave }: AutorizacaoContext): SimRejection | undefined {
      const qr = nfe.supl?.qrCode;
      if (nfe.mod !== '65' || qr === undefined) return undefined;
      const p = parametrosDoQrCode(qr);
      if (p === undefined) return undefined;
      const [chQr, versao, tpAmb] = p;
      const divergente = (param: string): SimRejection => reject('397', { Param: param });
      if (chQr === undefined || chQr === '') return reject('396', { Param: 'chNFe' });
      if (chQr !== chave) return divergente('chNFe');
      if (versao !== '2' && versao !== '3') return reject('398', { Param: versao ?? '' });
      if (versao === '2' && nfe.emitente.CPF !== undefined) return reject('444');
      if (tpAmb !== nfe.tpAmb) return divergente('tpAmb');
      const offline = nfe.tpEmis === '9';
      if (offline) {
        if (p[3] !== nfe.dhEmi.slice(8, 10)) return divergente('dhEmi');
        if (nfe.vNF !== undefined && Number(p[4]) !== Number(nfe.vNF)) return divergente('vNF');
      }
      if (versao !== '3') return undefined;
      if (!offline) return p.length > 3 ? reject('445') : undefined;
      const d = nfe.destinatario;
      const [tp, id] = [p[5] ?? '', p[6] ?? ''];
      const esperado =
        d?.CNPJ !== undefined
          ? ['1', d.CNPJ]
          : d?.CPF !== undefined
            ? ['2', d.CPF]
            : d?.idEstrangeiro !== undefined
              ? ['3', '']
              : ['', ''];
      if (tp !== esperado[0] || id !== esperado[1]) return divergente('idDest');
      if (p.length < 8 || (p[7] ?? '') === '') return reject('474');
      return nfe.supl?.assinaturaConfere === true ? undefined : reject('583');
    },
  },
  {
    id: 'C17',
    source: `${ANEXO_I}, item 4.2.1 (C17-10, C17-20 e C17-30)`,
    check({ nfe }: AutorizacaoContext): SimRejection | undefined {
      const ie = nfe.emitente.IE;
      // O PL_010f deixa emit/IE opcional no schema; a regra de negócio exige.
      if (ie === undefined || /^0*$/.test(ie)) return reject('229');
      if (ie === 'ISENTO') {
        // Só a NF-e avulsa (modelo 55, série 890 a 919) pode ter o emitente ISENTO.
        const serie = Number(nfe.serie);
        return nfe.mod === '55' && serie >= 890 && serie <= 919 ? undefined : reject('554');
      }
      const uf = nfe.emitente.UF;
      return isUf(uf) && parseIe(ie, uf).ok ? undefined : reject('209');
    },
  },
  {
    // 1C17-10 a 1C17-34: só quando o cadastro simulado tem contribuintes da UF do emitente.
    id: '1C17',
    source: `${ANEXO_I}, item 4.2.1 (1. Banco de Dados: Emitente), regras 1C17-10, 1C17-20, 1C17-30 e 1C17-34`,
    check({ nfe, view }: AutorizacaoContext): SimRejection | undefined {
      const c = cadastroDoEmitente(nfe, view);
      if (c === null) return undefined;
      if (c === undefined) return reject('230');
      if (nfe.emitente.CNPJ !== undefined && c.CNPJ !== nfe.emitente.CNPJ) return reject('231');
      if (nfe.emitente.CPF !== undefined && c.CPF !== nfe.emitente.CPF) return reject('622');
      return c.situacao === 'nao-habilitado' ? reject('203') : undefined;
    },
  },
  {
    id: '2B08',
    source: `${ANEXO_I}, item 4.2.1 (2. Banco de Dados: NF-e), regras 2B08-10 a 2B08-50`,
    check({ nfe, chave, view }: AutorizacaoContext): SimRejection | undefined {
      const emit = docKey(nfe.emitente) ?? '';
      const existing = view.nfeByNumero(emit, nfe.mod, nfe.serie, nfe.nNF);
      if (existing !== undefined) {
        if (existing.chave !== chave) return reject('539', { chNFe: existing.chave, nRec: existing.nRec });
        if (existing.situacao === 'cancelada') return reject('218', { nRec: existing.nRec });
        if (existing.situacao === 'denegada') return reject('205', { nRec: existing.nRec });
        return reject('204', { nRec: existing.nRec });
      }
      return view.pendenteByNumero(emit, nfe.mod, nfe.serie, nfe.nNF) === undefined ? undefined : reject('635');
    },
  },
  {
    id: '3B08-100',
    source: `${ANEXO_I}, item 4.2.1 (3. Banco de Dados: Inutilização; o ano da inutilização contra o AA da chave)`,
    check({ nfe, chave, view }: AutorizacaoContext): SimRejection | undefined {
      const cnpj = nfe.emitente.CNPJ;
      if (cnpj === undefined) return undefined;
      const ano = chave.slice(2, 4);
      return view.inutilizacaoCom(cnpj, ano, nfe.mod, Number(nfe.serie), Number(nfe.nNF)) ? reject('206') : undefined;
    },
  },
  {
    // Denegação por último: a NF-e passou em todas as rejeições e fica registrada como denegada, com protocolo.
    id: '1C17-40',
    source: `${ANEXO_I}, item 4.2.1 (1. Banco de Dados: Emitente); NT 2023.002 v1.00, item 6 (a NFC-e não é denegada: 1C17-38, rejeição 781)`,
    check({ nfe, view }: AutorizacaoContext): SimRejection | undefined {
      if (cadastroDoEmitente(nfe, view)?.situacao !== 'irregular') return undefined;
      return nfe.mod === '65' ? reject('781') : reject('301');
    },
  },
];

// ---------- eventos (MOC 7.0 Visão Geral, itens 5.8 a 5.11) ----------

/** J02a a J02g e P12-10 a P12-34: validação da chave de acesso, na ordem do MOC. */
export function chaveRejection(chave: string, now: number, offsetMinutes: number): SimRejection | undefined {
  const r = parseChaveAcesso(chave);
  if (r.ok) {
    if (Number(r.value.aamm.slice(0, 2)) > yearOf(now, offsetMinutes) % 100) return reject('615');
    // O parser aceita a chave de qualquer DF-e (CT-e 57, MDF-e 58...); aqui só NF-e e NFC-e (J02e, P12-30).
    return r.value.mod === '55' || r.value.mod === '65' ? undefined : reject('618');
  }
  const byIssue: Readonly<Record<string, string>> = {
    chave_dv_invalido: '236',
    chave_uf_invalida: '614',
    chave_ano_invalido: '615',
    chave_mes_invalido: '616',
    chave_emitente_invalido: '617',
    chave_cnpj_alfanumerico_fora_da_vigencia: '617',
    chave_modelo_invalido: '618',
    chave_modelo_nao_suportado: '618',
    chave_numero_invalido: '619',
  };
  return reject(byIssue[r.error.code] ?? '236');
}

function nfeDo(ctx: EventoContext): NfeRecord | undefined {
  return ctx.view.nfe(ctx.evento.chNFe);
}

const TOLERANCIA_MS = 5 * 60_000;

const evento: SimRule<EventoContext>[] = [
  {
    id: 'P07-10',
    source: `${VISAO_GERAL}, tabela 5-35`,
    check({ evento: e }: EventoContext): SimRejection | undefined {
      const esperado = `ID${e.tpEvento}${e.chNFe}${e.nSeqEvento.padStart(2, '0')}`;
      return e.id === esperado ? undefined : reject('572');
    },
  },
  {
    // Cancelamento, CC-e e cancelamento por substituição vão para a UF; manifestação vai para o AN (cOrgao 91).
    id: 'P08-10',
    source: `${VISAO_GERAL}, tabela 5-35`,
    check({ evento: e, autorizador, view }: EventoContext): SimRejection | undefined {
      const orgao = autorizador === 'an' ? '91' : e.chNFe.slice(0, 2);
      const doOrgao = autorizador === 'an' ? MANIFESTACOES.has(e.tpEvento) : EMITENTE_EVENTOS.has(e.tpEvento);
      const atende = autorizador === 'an' || view.config.cUFsAtendidas.includes(e.cOrgao);
      return e.cOrgao === orgao && doOrgao && atende ? undefined : reject('250');
    },
  },
  {
    id: 'P09-10',
    source: `${VISAO_GERAL}, tabela 5-35`,
    check: ({ evento: e, view }: EventoContext): SimRejection | undefined =>
      e.tpAmb === view.config.tpAmb ? undefined : reject('252'),
  },
  {
    id: 'P10-10',
    source: `${VISAO_GERAL}, tabela 5-35 (P10-10 e P11-10)`,
    check({ evento: e }: EventoContext): SimRejection | undefined {
      if (e.autor.CNPJ !== undefined) return parseCnpj(e.autor.CNPJ).ok ? undefined : reject('489');
      return parseCpf(e.autor.CPF ?? '').ok ? undefined : reject('490');
    },
  },
  {
    id: 'P12-10',
    source: `${VISAO_GERAL}, tabela 5-35 (P12-10 a P12-34)`,
    check: ({ evento: e, now, view }: EventoContext): SimRejection | undefined =>
      chaveRejection(e.chNFe, now, view.config.offsetMinutes),
  },
  {
    id: 'P12-44',
    source: `${VISAO_GERAL}, tabela 5-38 (autor do evento do emitente)`,
    check({ evento: e }: EventoContext): SimRejection | undefined {
      if (!EMITENTE_EVENTOS.has(e.tpEvento)) return undefined;
      const emit = e.chNFe.slice(6, 20);
      const autor = e.autor.CNPJ ?? `000${e.autor.CPF ?? ''}`;
      return autor === emit ? undefined : reject('574');
    },
  },
  {
    id: 'P13-10',
    source: `${VISAO_GERAL}, tabela 5-35 (tolerância de 5 minutos)`,
    check({ evento: e, now }: EventoContext): SimRejection | undefined {
      const t = parseDateTime(e.dhEvento);
      return t !== undefined && t > now + TOLERANCIA_MS ? reject('578') : undefined;
    },
  },
  {
    id: '3P15-10',
    source: `${VISAO_GERAL}, tabela 5-35`,
    check({ evento: e, view }: EventoContext): SimRejection | undefined {
      const dup = view.eventos(e.chNFe).some((x) => x.tpEvento === e.tpEvento && x.nSeqEvento === Number(e.nSeqEvento));
      return dup ? reject('573') : undefined;
    },
  },
  {
    id: 'P15-10',
    source: `${VISAO_GERAL}, tabelas 5-38 (cancelamento), 5-40 (CC-e, GA03: 1 a 20) e 5-42 (manifestação, H02)`,
    check({ evento: e }: EventoContext): SimRejection | undefined {
      const n = Number(e.nSeqEvento);
      if (e.tpEvento === '110110') return n > 20 ? reject('594') : undefined;
      return n === 1 ? undefined : reject('594');
    },
  },
  {
    id: 'P20-10',
    source: `${VISAO_GERAL}, tabela 5-38 (cancelamento por substituição: P20-10 e P21-10)`,
    check({ evento: e }: EventoContext): SimRejection | undefined {
      if (e.tpEvento !== '110112') return undefined;
      if (e.det.cOrgaoAutor !== e.chNFe.slice(0, 2)) return reject('455');
      return e.det.tpAutor === '1' ? undefined : reject('466');
    },
  },
  {
    id: 'GA03a',
    source: `${VISAO_GERAL}, tabela 5-40 (NFC-e não tem CC-e)`,
    check: ({ evento: e }: EventoContext): SimRejection | undefined =>
      e.tpEvento === '110110' && e.chNFe.slice(20, 22) === '65' ? reject('784') : undefined,
  },
  {
    id: 'H01',
    source: `${VISAO_GERAL}, tabela 5-42 (justificativa da operação não realizada)`,
    check: ({ evento: e }: EventoContext): SimRejection | undefined =>
      e.tpEvento === '210240' && (e.det.xJust ?? '') === '' ? reject('595') : undefined,
  },
  {
    // 2P12-10 no UF (cancelamento, CC-e) e H14 no AN: a chave precisa existir.
    id: '2P12-10',
    source: `${VISAO_GERAL}, tabela 5-38`,
    check: (ctx: EventoContext): SimRejection | undefined =>
      nfeDo(ctx) === undefined ? reject('494', { chNFe: ctx.evento.chNFe }) : undefined,
  },
  {
    id: 'P21',
    source: `${ANEXO_I}, tabela 4.4.2 (575); ${VISAO_GERAL}, 5.11 (autor da manifestação é o destinatário)`,
    check(ctx: EventoContext): SimRejection | undefined {
      if (!MANIFESTACOES.has(ctx.evento.tpEvento)) return undefined;
      const nfe = nfeDo(ctx);
      return docBase(nfe?.destinatario) === docBase(ctx.evento.autor) ? undefined : reject('575');
    },
  },
  {
    id: '2P12-14',
    source: `${VISAO_GERAL}, tabela 5-38 (2P12-14: 24 horas; 2P12-18: 168 horas no cancelamento por substituição)`,
    check(ctx: EventoContext): SimRejection | undefined {
      const e = ctx.evento;
      const nfe = nfeDo(ctx);
      if (!CANCELAMENTOS.has(e.tpEvento) || nfe === undefined || nfe.situacao !== 'autorizada') return undefined;
      const prazo =
        e.tpEvento === '110111' ? ctx.view.config.prazoCancelamentoMs : ctx.view.config.prazoCancelamentoSubstituicaoMs;
      return ctx.now - nfe.dhRecbtoMs > prazo ? reject('501') : undefined;
    },
  },
  {
    id: '2P12-22',
    source: `${VISAO_GERAL}, tabelas 5-38 (2P12-22) e 5-40 (GA01)`,
    check(ctx: EventoContext): SimRejection | undefined {
      if (!EMITENTE_EVENTOS.has(ctx.evento.tpEvento)) return undefined;
      return nfeDo(ctx)?.situacao === 'autorizada' ? undefined : reject('580');
    },
  },
  {
    id: 'H04',
    source: `${VISAO_GERAL}, tabela 5-42 (H04 e H05: ciência e desconhecimento de NF-e cancelada ou denegada)`,
    check(ctx: EventoContext): SimRejection | undefined {
      const tp = ctx.evento.tpEvento;
      if (nfeDo(ctx)?.situacao === 'autorizada') return undefined;
      if (tp === '210210') return reject('650');
      return tp === '210220' ? reject('651') : undefined;
    },
  },
  {
    id: 'H06',
    source: `${VISAO_GERAL}, tabela 5-42`,
    check(ctx: EventoContext): SimRejection | undefined {
      if (ctx.evento.tpEvento !== '210210') return undefined;
      return ctx.view.eventos(ctx.evento.chNFe).some((x) => CONCLUSIVAS.has(x.tpEvento)) ? reject('655') : undefined;
    },
  },
  {
    id: '2P13-10',
    source: `${VISAO_GERAL}, tabela 5-38 (2P13-10 e 2P13-14, tolerância de 5 minutos)`,
    check(ctx: EventoContext): SimRejection | undefined {
      const nfe = nfeDo(ctx);
      const t = parseDateTime(ctx.evento.dhEvento);
      if (nfe === undefined || t === undefined || !EMITENTE_EVENTOS.has(ctx.evento.tpEvento)) return undefined;
      if (t < nfe.dhEmiMs) return reject('577');
      return nfe.tpEmis === '1' && t < nfe.dhRecbtoMs - TOLERANCIA_MS ? reject('579') : undefined;
    },
  },
  {
    id: '2P23-10',
    source: `${VISAO_GERAL}, tabela 5-38`,
    check(ctx: EventoContext): SimRejection | undefined {
      if (!CANCELAMENTOS.has(ctx.evento.tpEvento)) return undefined;
      return nfeDo(ctx)?.nProt === ctx.evento.det.nProt ? undefined : reject('222');
    },
  },
  {
    // Vale a última manifestação: desconhecimento ou operação não realizada depois da confirmação liberam o cancelamento.
    id: '4P15-14',
    source: `${VISAO_GERAL}, tabela 5-38`,
    check(ctx: EventoContext): SimRejection | undefined {
      if (!CANCELAMENTOS.has(ctx.evento.tpEvento) || ctx.evento.chNFe.slice(20, 22) !== '55') return undefined;
      const ultima = ctx.view
        .eventos(ctx.evento.chNFe)
        .filter((x) => CONCLUSIVAS.has(x.tpEvento))
        .at(-1);
      return ultima?.tpEvento === '210200' ? reject('221') : undefined;
    },
  },
  {
    id: '5P31',
    source: `${VISAO_GERAL}, tabela 5-38 (P31-10 a P31-52 e 5P31-10 a 5P31-14: NF-e substituta)`,
    check(ctx: EventoContext): SimRejection | undefined {
      const e = ctx.evento;
      if (e.tpEvento !== '110112') return undefined;
      const ref = e.det.chNFeRef ?? '';
      if (!parseChaveAcesso(ref).ok) return reject('910', { campo: 'Dígito' });
      if (ref === e.chNFe) return reject('911', { campo: 'mesma Chave de Acesso' });
      if (ref.slice(6, 20) !== e.chNFe.slice(6, 20)) return reject('911', { campo: 'CNPJ/CPF' });
      const sub = ctx.view.nfe(ref);
      if (sub === undefined) return reject('912');
      return sub.situacao === 'autorizada' ? undefined : reject('913');
    },
  },
];

// ---------- inutilização (MOC 7.0 Visão Geral, item 5.3.4, tabela 5-12) ----------

const inutilizacao: SimRule<InutilizacaoContext>[] = [
  {
    id: 'I01',
    source: `${VISAO_GERAL}, tabela 5-12`,
    check: ({ inut, view }: InutilizacaoContext): SimRejection | undefined =>
      inut.tpAmb === view.config.tpAmb ? undefined : reject('252'),
  },
  {
    id: 'I02',
    source: `${VISAO_GERAL}, tabela 5-12`,
    check: ({ inut, view }: InutilizacaoContext): SimRejection | undefined =>
      view.config.cUFsAtendidas.includes(inut.cUF) ? undefined : reject('250'),
  },
  {
    id: 'I02a',
    source:
      'NT 2018.001 v1.10 (emitente CPF), item 6.2: série 910 a 969 identifica emitente pessoa física, e o controle de inutilização não se aplica a ele (item 6.1)',
    check({ inut }: InutilizacaoContext): SimRejection | undefined {
      const serie = Number(inut.serie);
      return serie >= 910 && serie <= 969 ? reject('266') : undefined;
    },
  },
  {
    id: 'I02b',
    source: `${VISAO_GERAL}, tabela 5-12 (I02b e I02c)`,
    check({ inut, now, view }: InutilizacaoContext): SimRejection | undefined {
      const ano = 2000 + Number(inut.ano);
      if (ano > yearOf(now, view.config.offsetMinutes)) return reject('453');
      return ano < 2006 ? reject('454') : undefined;
    },
  },
  {
    id: 'I03',
    source: `${VISAO_GERAL}, tabela 5-12 (I03 e I04: até 10.000 números)`,
    check({ inut }: InutilizacaoContext): SimRejection | undefined {
      const ini = Number(inut.nNFIni);
      const fin = Number(inut.nNFFin);
      if (ini > fin) return reject('224');
      return fin - ini + 1 > 10_000 ? reject('201') : undefined;
    },
  },
  {
    id: 'I04.a',
    source: `${VISAO_GERAL}, tabela 5-12`,
    check({ inut }: InutilizacaoContext): SimRejection | undefined {
      const esperado =
        `ID${inut.cUF}${inut.ano}${inut.CNPJ}${inut.mod}${inut.serie.padStart(3, '0')}` +
        `${inut.nNFIni.padStart(9, '0')}${inut.nNFFin.padStart(9, '0')}`;
      return inut.id === esperado ? undefined : reject('502');
    },
  },
  {
    id: 'I05',
    source: `${VISAO_GERAL}, tabela 5-12 (I05 e I06, pelo cadastro simulado)`,
    check({ inut, view }: InutilizacaoContext): SimRejection | undefined {
      // Cadastro da UF do pedido (cUF), que pode ser qualquer uma das atendidas pelo autorizador.
      const uf = ufByCUf(inut.cUF)?.sigla;
      const c = view.config.cadastro.find((x) => x.CNPJ === inut.CNPJ && x.UF === uf);
      if (c?.situacao === 'nao-habilitado') return reject('203');
      return c?.situacao === 'irregular' ? reject('240') : undefined;
    },
  },
  {
    id: 'I07',
    source: `${VISAO_GERAL}, tabela 5-12 (I07: mesma faixa do mesmo ano, com o nProt anterior; I07a: número já inutilizado)`,
    check({ inut, view }: InutilizacaoContext): SimRejection | undefined {
      const ini = Number(inut.nNFIni);
      const fin = Number(inut.nNFFin);
      const serie = Number(inut.serie);
      const mesmas = view
        .inutilizacoes()
        .filter((i) => i.CNPJ === inut.CNPJ && i.ano === inut.ano && i.mod === inut.mod && i.serie === serie);
      const igual = mesmas.find((i) => i.nNFIni === ini && i.nNFFin === fin);
      if (igual !== undefined) return reject('563', { nProt: igual.nProt });
      return mesmas.some((i) => i.nNFIni <= fin && i.nNFFin >= ini) ? reject('256') : undefined;
    },
  },
  {
    id: 'I08',
    source: `${VISAO_GERAL}, tabela 5-12 (NF-e do mesmo ano, pelo AA da chave)`,
    check({ inut, view }: InutilizacaoContext): SimRejection | undefined {
      for (let n = Number(inut.nNFIni); n <= Number(inut.nNFFin); n++) {
        const usada = view.nfeByNumero(inut.CNPJ, inut.mod, inut.serie, String(n));
        if (usada !== undefined && usada.chave.slice(2, 4) === inut.ano) return reject('241');
      }
      return undefined;
    },
  },
];

/** Regras padrão do simulador. */
export const DEFAULT_RULES: SimRules = { autorizacao, evento, inutilizacao };

/** Aplica as regras na ordem e devolve a primeira rejeição. */
export function firstRejection<C>(rules: readonly SimRule<C>[], ctx: C): SimRejection | undefined {
  for (const r of rules) {
    const found = r.check(ctx);
    if (found !== undefined) return found;
  }
  return undefined;
}
