/**
 * DACCE, a representação impressa da Carta de Correção Eletrônica (evento 110110). O MOC não define leiaute de DACCE:
 * segue a convenção de mercado (cabeçalho, chave com código de barras, dados do evento, texto da correção e condições
 * de uso), com os mínimos de fonte e o CODE-128C do MOC 7.0, Anexo II, no leiaute comum dos eventos (`evento.ts`). O
 * nome do emitente não está no XML do evento: vem da NF-e quando ela é passada; sem ela, sai o CNPJ/CPF do autor.
 */

import * as f from '../format.ts';
import type { EventoView } from '../input/evento.ts';
import type { NotaView } from '../input/nfe.ts';
import type { Documento } from '../model.ts';
import type { DaOpcoes } from './common.ts';
import type { Celula } from './evento.ts';
import { eventoLayout } from './evento.ts';

export interface DacceOpcoes extends DaOpcoes {
  /** `nfeProc` da nota corrigida, para o nome e o endereço do emitente no cabeçalho. */
  readonly nfe?: string;
}

/** Número, série, emissão e destinatário da nota, na linha do documento. */
export function linhaDaNota(nota: NotaView, sigla: string): readonly Celula[] {
  return [
    [`NÚMERO DA ${sigla}`, f.numero(nota.nNF)],
    ['SÉRIE', f.serie(nota.serie)],
    ['DATA DE EMISSÃO', f.data(nota.dhEmi)],
    ['DESTINATÁRIO', nota.dest?.xNome ?? ''],
  ];
}

export function dacceLayout(ev: EventoView, nota: NotaView | undefined, options: DaOpcoes): Documento {
  return eventoLayout(
    {
      nome: 'CARTA DE CORREÇÃO ELETRÔNICA',
      documento: { sigla: 'NF-e', artigo: 'da' },
      chave: ev.chNFe,
      cOrgao: ev.cOrgao,
      tpAmb: ev.tpAmb,
      autor: ev.autor,
      dhEvento: ev.dhEvento,
      tpEvento: ev.tpEvento,
      nSeqEvento: ev.nSeqEvento,
      ...(ev.ret ? { ret: ev.ret } : {}),
      ...(nota ? { emitente: nota.emit, linhaDoDocumento: linhaDaNota(nota, 'NF-e') } : {}),
      campos: [],
      quadros: [
        { titulo: 'CORREÇÃO', texto: String(ev.det.xCorrecao ?? ''), tamanho: 10 },
        { titulo: 'CONDIÇÕES DE USO', texto: String(ev.det.xCondUso ?? ''), tamanho: 7 },
      ],
      titulo: `DACCE ${ev.chNFe}`,
    },
    options,
  );
}
