/**
 * Estado em memória do simulador: NF-e autorizadas e denegadas, eventos, inutilizações, lotes assíncronos, cadastro e o
 * NSU de cada interessado na distribuição de DF-e. Números de protocolo, recibo e NSU são sequenciais e
 * determinísticos (a mesma sequência de pedidos com o mesmo relógio dá os mesmos números).
 */

import type { TProtNFe } from '@sinete/schemas/nfe/PL_010f';
import type { Svc } from './context.ts';

/** Emitente, destinatário ou autor: CNPJ (numérico ou alfanumérico) ou CPF, sem máscara. */
export interface Documento {
  readonly CNPJ?: string;
  readonly CPF?: string;
}

/** CNPJ ou CPF de um documento, para chave de mapa. */
export function docKey(d: Documento | undefined): string | undefined {
  return d?.CNPJ ?? d?.CPF;
}

/** Raiz do documento: 8 primeiras posições do CNPJ, ou o CPF inteiro. */
export function docBase(d: Documento | undefined): string | undefined {
  if (d?.CNPJ !== undefined) return d.CNPJ.slice(0, 8);
  return d?.CPF;
}

export type SituacaoNfe = 'autorizada' | 'cancelada' | 'denegada';

export interface RegistroNfe {
  readonly chave: string;
  readonly cUF: string;
  readonly mod: string;
  readonly serie: string;
  readonly nNF: string;
  readonly cNF: string;
  readonly tpEmis: string;
  readonly tpNF: string;
  readonly dhEmi: string;
  readonly dhEmiMs: number;
  readonly vNF: string;
  readonly emitente: Documento & { readonly xNome: string; readonly IE?: string };
  readonly destinatario: Documento | undefined;
  /** CNPJ/CPF de `autXML` e do transportador, que recebem a NF-e completa pela distribuição. */
  readonly terceiros: readonly string[];
  /** O elemento `NFe` como recebido (com `xmlns`), sem nenhuma alteração. */
  readonly xml: string;
  readonly digVal: string;
  readonly nRec: string;
  readonly nProt: string;
  readonly cStat: string;
  readonly xMotivo: string;
  readonly dhRecbto: string;
  readonly dhRecbtoMs: number;
  /** `protNFe` devolvido na autorização (ou na denegação). */
  readonly prot: TProtNFe;
  situacao: SituacaoNfe;
  /** O destinatário já se manifestou e recebeu a NF-e completa pela distribuição. */
  liberadaAoDestinatario: boolean;
}

export interface RegistroEvento {
  readonly chave: string;
  readonly tpEvento: string;
  readonly nSeqEvento: number;
  readonly cOrgao: string;
  readonly autor: Documento;
  readonly dhEvento: string;
  readonly dhRegEvento: string;
  readonly nProt: string;
  readonly xEvento: string;
  /** O elemento `evento` como recebido. */
  readonly xml: string;
  /** `retEvento` devolvido. */
  readonly retEvento: string;
}

export interface RegistroInutilizacao {
  readonly cUF: string;
  readonly ano: string;
  readonly CNPJ: string;
  readonly mod: string;
  readonly serie: number;
  readonly nNFIni: number;
  readonly nNFFin: number;
  readonly nProt: string;
  readonly dhRecbto: string;
  readonly xml: string;
}

/** NF-e de um lote assíncrono ainda não processado. */
export interface NfePendente {
  readonly chave: string;
  readonly chaveDoEmitente: string;
  readonly mod: string;
  readonly serie: string;
  readonly nNF: string;
}

export interface RegistroLote {
  readonly nRec: string;
  readonly autorizador: 'uf' | 'svc';
  /** SVC que aceitou o lote, fixada no recebimento. */
  readonly svc: Svc | undefined;
  readonly recebidoEm: number;
  readonly disponivelEm: number;
  readonly dhRecbto: string;
  /** `enviNFe` como recebido; as NF-e são processadas quando o relógio passa de `disponivelEm`. */
  readonly payload: string;
  readonly pendente: readonly NfePendente[];
  /** CNPJ/CPF do certificado de transmissão, para a regra de consulta pelo mesmo transmissor. */
  readonly transmissor: string | undefined;
  /** `protNFe` de cada NF-e, depois de processado. */
  protNFe: TProtNFe[] | undefined;
  processadoEm: string | undefined;
}

/** Documento na fila de distribuição de um interessado. */
export interface DocumentoDaDistribuicao {
  readonly nsu: number;
  /** `resNFe_v1.01.xsd`, `procNFe_v4.00.xsd`, `resEvento_v1.01.xsd`, `procEventoNFe_v1.00.xsd`. */
  readonly schema: string;
  readonly xml: string;
  readonly chave: string;
}

/** Situação cadastral de um contribuinte no cadastro simulado da UF. */
export interface Contribuinte extends Documento {
  readonly UF: string;
  readonly IE: string;
  readonly xNome: string;
  /**
   * `habilitado` (padrão), `nao-habilitado` (203: emissor não habilitado) ou `irregular` (301: uso denegado por
   * irregularidade fiscal do emitente).
   */
  readonly situacao?: 'habilitado' | 'nao-habilitado' | 'irregular';
}

/**
 * Tipo de autorizador do número do protocolo e do recibo (MOC 7.0 Visão Geral, tabelas 4-7 e 4-8). O MDF-e usa `9`
 * seguido do cUF do emitente, a forma observada nos protocolos do MDF-e autorizados pela SVRS.
 */
export type TipoAutorizador = '1' | '3' | '4' | '8' | '9';

export type SituacaoMdfe = 'autorizado' | 'cancelado' | 'encerrado';

/** MDF-e autorizado, com o que as regras de não encerrados, eventos e consulta precisam. */
export interface RegistroMdfe {
  readonly chave: string;
  readonly cUF: string;
  readonly emitente: Documento;
  readonly serie: string;
  readonly nMDF: string;
  readonly cMDF: string;
  readonly tpEmit: string;
  readonly tpEmis: string;
  readonly modal: string;
  readonly UFIni: string;
  readonly UFFim: string;
  /** Quantidade de UFs de percurso (regra F87). */
  readonly qtdPercurso: number;
  /** Placa do veículo de tração, no modal rodoviário. */
  readonly placa: string | undefined;
  /** `tpProp` do proprietário do veículo de tração, quando informado (evento 110116, K06). */
  readonly tpProp: string | undefined;
  /** CNPJ ou CPF do proprietário do veículo de tração, quando informado (encerramento por terceiro, J09 e K11). */
  readonly proprietario: Documento | undefined;
  readonly carregaPosterior: boolean;
  /** Municípios de carregamento do MDF-e (evento 110111, K08). */
  readonly cMunCarrega: readonly string[];
  readonly dhEmi: string;
  readonly dhEmiMs: number;
  /** O elemento `MDFe` como recebido, sem nenhuma alteração. */
  readonly xml: string;
  readonly digVal: string;
  readonly nProt: string;
  readonly dhRecbto: string;
  readonly dhRecbtoMs: number;
  /** `protMDFe` devolvido na autorização, como texto. */
  readonly protMDFe: string;
  situacao: SituacaoMdfe;
}

export interface RegistroEventoMdfe {
  readonly chave: string;
  readonly tpEvento: string;
  readonly nSeqEvento: number;
  readonly cOrgao: string;
  readonly dhEvento: string;
  readonly dhRegEvento: string;
  readonly nProt: string;
  /** Detalhe do evento lido do `detEvento` (nome local para texto), para as regras dos eventos seguintes. */
  readonly det: Readonly<Record<string, string>>;
  /** NF-e incluídas pelo evento 110115. */
  readonly chNFe: readonly string[];
  /** O elemento `eventoMDFe` como recebido. */
  readonly xml: string;
  /** `retEventoMDFe` devolvido. */
  readonly retEvento: string;
}

export class SimState {
  readonly nfes: Map<string, RegistroNfe> = new Map();
  readonly eventos: RegistroEvento[] = [];
  readonly inutilizacoes: RegistroInutilizacao[] = [];
  readonly lotes: Map<string, RegistroLote> = new Map();
  readonly distribuicao: Map<string, DocumentoDaDistribuicao[]> = new Map();
  readonly mdfes: Map<string, RegistroMdfe> = new Map();
  readonly eventosMdfe: RegistroEventoMdfe[] = [];
  /** Última consulta `distNSU` sem documentos novos, por interessado (regra de consumo indevido). */
  readonly ultimaConsultaVazia: Map<string, number> = new Map();
  private readonly protocolos = new Map<string, number>();
  private recibos = 0;

  /** Próximo `nProt`: tipo do autorizador, cUF, ano com 2 dígitos e sequencial de 10 posições no ano. */
  nextProtocolo(tipo: TipoAutorizador, cUF: string, year: number): string {
    const prefix = `${tipo}${cUF}${String(year % 100).padStart(2, '0')}`;
    const n = (this.protocolos.get(prefix) ?? 0) + 1;
    this.protocolos.set(prefix, n);
    return `${prefix}${String(n).padStart(10, '0')}`;
  }

  /** Próximo `nRec`: cUF, tipo do autorizador e sequencial de 12 posições. */
  nextRecibo(cUF: string, tipo: TipoAutorizador): string {
    this.recibos += 1;
    return `${cUF}${tipo}${String(this.recibos).padStart(12, '0')}`;
  }

  nfeByNumero(emitenteKey: string, mod: string, serie: string, nNF: string): RegistroNfe | undefined {
    for (const n of this.nfes.values()) {
      if (docKey(n.emitente) === emitenteKey && n.mod === mod && Number(n.serie) === Number(serie)) {
        if (Number(n.nNF) === Number(nNF)) return n;
      }
    }
    return undefined;
  }

  /**
   * NF-e com o mesmo número num lote ainda não processado e recebido antes de `recebidoAntesDe` (o recibo do lote em
   * processamento): um lote posterior nunca invalida um anterior.
   */
  pendingByNumero(
    emitenteKey: string,
    mod: string,
    serie: string,
    nNF: string,
    recebidoAntesDe?: string,
  ): NfePendente | undefined {
    for (const l of this.lotes.values()) {
      if (l.nRec === recebidoAntesDe) return undefined;
      if (l.protNFe !== undefined) continue;
      const p = l.pendente.find(
        (x) =>
          x.chaveDoEmitente === emitenteKey &&
          x.mod === mod &&
          Number(x.serie) === Number(serie) &&
          Number(x.nNF) === Number(nNF),
      );
      if (p) return p;
    }
    return undefined;
  }

  /** Inutilização do ano (`AA`) que cobre o número: o `Id` da inutilização leva o ano, e cada ano é uma faixa própria. */
  inutilizacaoCom(
    CNPJ: string,
    ano: string,
    mod: string,
    serie: number,
    nNF: number,
  ): RegistroInutilizacao | undefined {
    return this.inutilizacoes.find(
      (i) =>
        i.CNPJ === CNPJ && i.ano === ano && i.mod === mod && i.serie === serie && nNF >= i.nNFIni && nNF <= i.nNFFin,
    );
  }

  /** MDF-e com o mesmo emitente, série e número (a chave natural das regras F81, F82 e G04). */
  mdfeByNumero(emitente: string, serie: string, nMDF: string): RegistroMdfe | undefined {
    for (const m of this.mdfes.values()) {
      if (docKey(m.emitente) === emitente && Number(m.serie) === Number(serie) && Number(m.nMDF) === Number(nMDF)) {
        return m;
      }
    }
    return undefined;
  }

  eventosDoMdfe(chave: string): RegistroEventoMdfe[] {
    return this.eventosMdfe.filter((e) => e.chave === chave);
  }

  eventosDa(chave: string): RegistroEvento[] {
    return this.eventos.filter((e) => e.chave === chave);
  }

  /** Acrescenta um documento à fila do interessado e devolve o NSU gerado. */
  distribuir(interessado: string, schema: string, xml: string, chave: string): number {
    const fila = this.distribuicao.get(interessado) ?? [];
    const nsu = fila.length + 1;
    fila.push({ nsu, schema, xml, chave });
    this.distribuicao.set(interessado, fila);
    return nsu;
  }
}
