/**
 * Carga sob demanda do `@sinete/da` (peer dependency opcional) para o `pdf` e o `pdfCancelado` dos emissores.
 *
 * O especificador é montado em runtime: um import literal faria o bundler de quem não instalou o `@sinete/da` falhar
 * ao resolver o módulo. O custo é que o bundler também não o leva para quem instalou, então no browser e no Deno o
 * módulo vai pela opção `da`, importado de forma estática pelo app (ADR 0009, decisão 3).
 */

import { ErroDeConfiguracao } from '@sinete/core';

/** Carregador de um subpath do `@sinete/da`, com o módulo injetado quando houver. */
export function carregadorDa<M>(subpath: string, injetado: M | undefined): () => Promise<M> {
  let modulo = injetado;
  const especificador = ['@sinete/da', subpath].join('/');
  return async (): Promise<M> => {
    if (modulo !== undefined) return modulo;
    try {
      modulo = (await import(/* @vite-ignore */ /* webpackIgnore: true */ especificador)) as M;
    } catch (cause) {
      throw new ErroDeConfiguracao('o PDF usa o @sinete/da: instale o pacote ou passe o módulo na opção da', { cause });
    }
    return modulo;
  };
}

/*
 * Opções do PDF dos emissores. Espelham as do `@sinete/da` (`DanfeOpcoes`, `DamdfeOpcoes`, `DanfseOpcoes`) sem importar
 * os tipos de lá: quem não usa o PDF não precisa do pacote instalado nem para compilar. O teste de tipos do emissor
 * (`test/pdf-tipos.test.ts`) falha se um espelho e o original deixarem de ter os mesmos membros.
 */

/** Formato do DANFE; sem ele, sai do XML (modelo 65 é `nfce`; no 55, o `tpImp`). */
export type FormatoPdfNfe = 'retrato' | 'paisagem' | 'simplificado' | 'etiqueta' | 'simplificado-tipo2' | 'nfce';

/** Protocolo e data de registro de um evento (o EPEC do DANFE, o cancelamento do DAMDFE). */
export interface ProtocoloDoEvento {
  readonly nProt: string;
  readonly dhRegEvento: string;
}

/** Opções do `pdf` da NF-e: as do `danfe` do `@sinete/da/nfe`. */
export interface PdfNfeOpcoes {
  /** Logotipo do emitente em PNG ou JPEG. */
  readonly logo?: Uint8Array;
  readonly formato?: FormatoPdfNfe;
  /** Largura do papel dos formatos em bobina ou etiqueta, em mm. */
  readonly largura?: number;
  /** Bloco de canhoto (padrão: sim). */
  readonly canhoto?: boolean;
  /** Quadro de totais de IBS, CBS e IS (padrão: quando a NF-e tem `IBSCBSTot` ou `ISTot`). */
  readonly ibsCbs?: boolean;
  /** Colunas de ICMS ST no quadro de produtos (padrão: quando algum item tem ST). */
  readonly colunasSt?: boolean;
  /** Protocolo do EPEC, quando `tpEmis` = 4. */
  readonly epec?: ProtocoloDoEvento;
  /** Tamanho da fonte dos itens e das informações complementares, em pt (6 a 12; padrão 6,5). */
  readonly fonteItens?: number;
  /** Via impressa em contingência, na bobina. */
  readonly via?: 'consumidor' | 'estabelecimento';
  /** QR Code ao lado da identificação (padrão quando a largura permite) ou centralizado, na bobina. */
  readonly qrLateral?: boolean;
  /** Marca de cancelada: o `procEventoNFe` do cancelamento, ou `true` para carimbar sem protocolo. */
  readonly cancelamento?: string | true;
}

/** Opções do `pdf` do MDF-e: as do `damdfe` do `@sinete/da/mdfe`. */
export interface PdfMdfeOpcoes {
  /** Logotipo do emitente em PNG ou JPEG. */
  readonly logo?: Uint8Array;
  /** Lista dos documentos vinculados. Padrão: só em contingência, onde é obrigatória. */
  readonly documentos?: boolean;
  /** Marca de cancelado: o `procEventoMDFe` do cancelamento, o protocolo e a data já lidos, ou `true`. */
  readonly cancelado?: boolean | string | ProtocoloDoEvento;
}

/** Opções do `pdf` da NFS-e: as do `danfse` do `@sinete/da/nfse`. */
export interface PdfNfseOpcoes {
  /** Marca de cancelada: o evento registrado de cancelamento desta NFS-e, ou `true`. */
  readonly cancelamento?: string | true;
  /** Marca de substituída: o evento registrado de cancelamento por substituição desta NFS-e, ou `true`. */
  readonly substituicao?: string | true;
  /** Canhoto (padrão: com canhoto). */
  readonly canhoto?: boolean;
  /** Nome do município pelo código IBGE, para os endereços que o XML traz só com o código. */
  readonly nomeMunicipio?: (cMun: string) => string | undefined;
}
