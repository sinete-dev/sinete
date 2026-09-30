import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

/** Códigos estáveis dos erros do `@sinete/da`. */
export type CodigoErroDa =
  /** O XML não é bem formado. */
  | 'xml_invalido'
  /** A raiz não é a esperada pela função (ex.: `mdfeProc` passado ao `danfe`). */
  | 'documento_inesperado'
  /** Falta um grupo obrigatório para o formato pedido (ex.: QR Code da NFC-e). */
  | 'campo_ausente'
  /** O evento não é do tipo ou da nota esperada (ex.: cancelamento de outra chave). */
  | 'evento_incompativel'
  /** Formato pedido não se aplica ao documento (ex.: DANFE NFC-e para modelo 55). */
  | 'formato_incompativel'
  /** Imagem do logotipo em formato não suportado ou corrompida. */
  | 'imagem_invalida'
  /** Conteúdo que não cabe na simbologia (CODE-128C ímpar, QR maior que a versão 40). */
  | 'codigo_barras_invalido';

export class ErroDa extends ErroSinete<CodigoErroDa> {
  constructor(code: CodigoErroDa, message: string, opcoes?: ErroSineteOpcoes) {
    super(code, message, opcoes);
    this.name = 'ErroDa';
  }
}
