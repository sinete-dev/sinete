/**
 * Os módulos de schema da NFS-e que o simulador usa, pela mesma tabela de vigências do `@sinete/schemas` que o
 * emissor usa: o relógio da Sefin simulada e o ambiente escolhem o pacote (20260209 ou 20260727).
 */

import type { Ambiente, Assinador } from '@sinete/core';
import { relogioFixo } from '@sinete/core';
import type { DocumentoXml } from '@sinete/core/xml';
import { assinarXml } from '@sinete/core/xml';
import type { ElementoRaiz } from '@sinete/schemas';
import { decodificarRaiz, selecionarPl, serializarRaiz, validarRaiz } from '@sinete/schemas';
import * as v20260209 from '@sinete/schemas/nfse/1.01-20260209';
import type { TCDPS, TCPedRegEvt, TSCodJustSubst } from '@sinete/schemas/nfse/1.01-20260727';
import * as v20260727 from '@sinete/schemas/nfse/1.01-20260727';

interface Modulo {
  readonly DPSElement: ElementoRaiz<TCDPS>;
  readonly pedRegEventoElement: ElementoRaiz<TCPedRegEvt>;
}

const MODULOS: Readonly<Record<string, Modulo>> = {
  'nfse/1.01-20260209': v20260209,
  'nfse/1.01-20260727': v20260727,
};

export interface PedidoDaSefin {
  readonly chave: string;
  readonly autor: { readonly CNPJ?: string; readonly CPF?: string };
  readonly detalhe: { readonly chSubstituta: string; readonly cMotivo: string; readonly xMotivo?: string };
  readonly dhEvento: string;
  readonly tpAmb: '1' | '2';
  readonly signer: Assinador;
}

export interface LeiauteSim {
  readonly modulo: string;
  /** Ocorrências de schema (`caminho: código`), vazio quando válido. */
  validar(tipo: 'dps' | 'pedRegEvento', doc: DocumentoXml): string[];
  lerDps(doc: DocumentoXml): TCDPS;
  lerPedido(doc: DocumentoXml): TCPedRegEvt;
  /** Pedido do cancelamento por substituição (e105102) que a Sefin registra sozinha, assinado pelo simulador. */
  pedidoDaSefin(p: PedidoDaSefin): Promise<string>;
}

export function leiauteNfseEm(ambiente: Ambiente, ms: number): LeiauteSim {
  const modulo = selecionarPl('nfse', ambiente, relogioFixo(ms)).modulo;
  const m = MODULOS[modulo] as Modulo;
  const raiz = (tipo: 'dps' | 'pedRegEvento'): ElementoRaiz<unknown> =>
    tipo === 'dps' ? m.DPSElement : m.pedRegEventoElement;
  return {
    modulo,
    validar: (tipo: 'dps' | 'pedRegEvento', doc: DocumentoXml): string[] =>
      validarRaiz(raiz(tipo), doc).map((i) => `${i.caminho}: ${i.code}`),
    lerDps: (doc: DocumentoXml): TCDPS => decodificarRaiz(m.DPSElement, doc).valor,
    lerPedido: (doc: DocumentoXml): TCPedRegEvt => decodificarRaiz(m.pedRegEventoElement, doc).valor,
    async pedidoDaSefin(p: PedidoDaSefin): Promise<string> {
      const id = `PRE${p.chave}105102`;
      const autor = p.autor.CNPJ !== undefined ? { CNPJAutor: p.autor.CNPJ } : { CPFAutor: p.autor.CPF ?? '' };
      const xml = serializarRaiz(m.pedRegEventoElement, {
        versao: '1.01',
        infPedReg: {
          Id: id,
          tpAmb: p.tpAmb,
          verAplic: 'sefaz-sim',
          dhEvento: p.dhEvento,
          chNFSe: p.chave,
          ...autor,
          e105102: {
            xDesc: 'Cancelamento de NFS-e por Substituição',
            cMotivo: p.detalhe.cMotivo as TSCodJustSubst,
            ...(p.detalhe.xMotivo === undefined ? {} : { xMotivo: p.detalhe.xMotivo }),
            chSubstituta: p.detalhe.chSubstituta,
          },
        } as TCPedRegEvt['infPedReg'],
      });
      return assinarXml(xml, { id }, p.signer);
    },
  };
}
