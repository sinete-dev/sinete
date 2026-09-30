/** Erros do `@sinete/emissor`. Todos estendem o `SineteError` do core, com `code` estável. */

import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

/** Códigos lançados pelas classes do `@sinete/emissor` (`contrato_violado` é da suíte de `@sinete/emissor/contrato`). */
export type EmissorErrorCode =
  | 'transmissao_em_andamento'
  | 'trava_perdida'
  | 'transmissao_ja_gravada'
  | 'recusa_repetida'
  | 'contrato_violado';

/**
 * Outro processo (ou outra chamada) tem a trava deste documento em vigor: está transmitindo agora. Nada foi à SEFAZ.
 * Tente de novo depois; se o outro processo morreu, a trava vence sozinha no prazo.
 */
export class TransmissaoEmAndamentoError extends ErroSinete<'transmissao_em_andamento'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('transmissao_em_andamento', message, options);
    this.name = 'TransmissaoEmAndamentoError';
  }
}

/**
 * A trava venceu e pode ter sido assumida por outro processo: quem a perdeu não grava, não descarta e não guarda o
 * desfecho. O outro processo retoma pelos bytes gravados.
 */
export class TravaPerdidaError extends ErroSinete<'trava_perdida'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('trava_perdida', message, options);
    this.name = 'TravaPerdidaError';
  }
}

/**
 * Já há bytes gravados para o documento: gravar outros por cima criaria um segundo documento para o mesmo número.
 * Retome com os gravados.
 */
export class TransmissaoJaGravadaError extends ErroSinete<'transmissao_ja_gravada'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('transmissao_ja_gravada', message, options);
    this.name = 'TransmissaoJaGravadaError';
  }
}

/**
 * A SEFAZ recusou de vez o mesmo conteúdo deste documento, com a mesma rejeição, o limite de vezes dentro da janela
 * (`details`: `cStat`, `xMotivo`, `recusadaEm`, `primeiraEm`, `vezes`, `limite`, `janelaMs`). Nada foi gravado nem
 * enviado: reenviar a mesma nota com a mesma rejeição é o que a SEFAZ conta como consumo indevido (MOC 7.0 Anexo I, item
 * 4.3.1, rejeição 656). Corrija a nota (outro conteúdo passa e recomeça a conta) ou, depois de resolver a causa fora da
 * nota (o cadastro na SEFAZ, por exemplo), emita com `reenviarRecusado: true`.
 */
export class RecusaRepetidaError extends ErroSinete<'recusa_repetida'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('recusa_repetida', message, options);
    this.name = 'RecusaRepetidaError';
  }
}
