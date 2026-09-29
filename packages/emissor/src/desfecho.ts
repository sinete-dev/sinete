/**
 * Desfecho normalizado do emissor, comum aos documentos (ADR 0010, decisão 4).
 *
 * O `SefazOutcome` do core descreve uma chamada à SEFAZ. O emissor descreve outra coisa: o que aconteceu com os bytes
 * assinados e gravados de um documento. Dois estados só existem aqui: `pendente` (os bytes podem ter chegado e ninguém
 * sabe ainda; o motivo diz por quê) e `divergente` (a SEFAZ tem outro documento no número desses bytes). A situação
 * posterior de um documento autorizado (cancelado ou encerrado fora deste fluxo) também só existe aqui.
 *
 * Todo desfecho leva o `bruto`, o desfecho do pacote do documento de onde ele saiu (o `AutorizacaoOutcome` da NF-e, a
 * consulta, a `NfseOutcome`), para ninguém perder informação.
 */

import type { RejectionHint } from '@sinete/core';
import { isSineteError } from '@sinete/core';

/** Documentos que o emissor conhece. Cada um tem um subpath: `@sinete/emissor/nfe`, `/mdfe`, `/nfse`. */
export type TipoDocumento = 'nfe' | 'mdfe' | 'nfse';

/** Situação do documento autorizado que mudou fora deste fluxo. `encerrado` só existe no MDF-e. */
export type SituacaoPosterior = 'cancelado' | 'encerrado';

/**
 * Por que os bytes ficaram pendentes:
 *
 * - `sem-resposta`: o envio (ou a consulta que o resolveria) não teve resposta; o erro vai em `causa`.
 * - `consulta-indefinida`: a consulta da chave respondeu sem decidir (serviço paralisado, consumo indevido).
 * - `lote-em-processamento`: a SEFAZ recebeu o lote (103) e o recibo não saiu de pendente dentro da espera; o número
 *   do recibo vai em `nRec`. Só na NF-e.
 * - `contingencia`: NFC-e em contingência off-line (tpEmis 9), gravada sem envio enquanto o autorizador está fora; a
 *   retomada transmite os mesmos bytes quando ele volta (ADR 0013).
 */
export type MotivoPendencia = 'sem-resposta' | 'consulta-indefinida' | 'lote-em-processamento' | 'contingencia';

interface DesfechoBase {
  readonly documento: TipoDocumento;
  /** Identidade dos bytes: a chave de acesso na NF-e e no MDF-e, o Id da DPS na NFS-e. */
  readonly id: string;
}

/** A SEFAZ autorizou estes bytes. `proc` é o documento com o protocolo, com os bytes gravados dentro. */
export interface DesfechoAutorizado<P = unknown, B = unknown> extends DesfechoBase {
  readonly tipo: 'autorizado';
  readonly cStat: string;
  readonly xMotivo: string;
  readonly proc: string;
  readonly protocolo: P;
  /**
   * Presente quando a consulta achou o documento já cancelado (ou, no MDF-e, encerrado) fora deste fluxo. A SEFAZ
   * autorizou estes bytes, mas o documento não está mais ativo: guarde-o com essa situação, sem e-mail nem cobrança de
   * documento ativo.
   */
  readonly situacaoAtual?: SituacaoPosterior;
  readonly bruto: B;
}

/**
 * O que o `digVal` do protocolo diz dos bytes gravados. `confere`: é o DigestValue deles. `sem-digval`: o protocolo não
 * o traz (é opcional no leiaute, e há autorizador que o omite). `difere`: a SEFAZ registrou outro conteúdo com a mesma
 * chave.
 */
export type ConteudoRegistrado = 'confere' | 'sem-digval' | 'difere';

/**
 * Uso denegado (só NF-e): o número fica consumido e o documento existe na SEFAZ. A denegação é decisão sobre a chave
 * (MOC 7.0 Anexo I, tabela 4.4.3: 110, 301, 302, 303): o número está denegado qualquer que seja o conteúdo, então o
 * desfecho é definitivo mesmo quando o protocolo não prova que o conteúdo registrado é o destes bytes (`conteudo`).
 */
export interface DesfechoDenegado<P = unknown, B = unknown> extends DesfechoBase {
  readonly tipo: 'denegado';
  readonly cStat: string;
  readonly xMotivo: string;
  /**
   * O que o `digVal` do protocolo diz dos bytes gravados. Com `sem-digval`, guarde a denegação com os bytes e o
   * protocolo; com `difere`, a SEFAZ denegou a chave com outro conteúdo: o número continua denegado, mas o documento
   * registrado não é o destes bytes, e alguém precisa saber.
   */
  readonly conteudo: ConteudoRegistrado;
  /** `nfeProc` com os bytes gravados e o protocolo; só com `conteudo: 'confere'`, quando o `digVal` prova o conteúdo. */
  readonly proc?: string;
  /** O protocolo da denegação, com o `protNFe` como veio na resposta. */
  readonly protocolo: P;
  /** Os bytes assinados gravados, byte a byte. */
  readonly xml: string;
  readonly bruto: B;
}

/**
 * A SEFAZ recusou estes bytes. Se o `cStat` está entre os indefinidos do documento (a duplicidade que a consulta não
 * resolveu, por exemplo), os bytes ficam gravados; nos outros, são descartados (`destinoDosBytes`).
 */
export interface DesfechoRecusado<B = unknown> extends DesfechoBase {
  readonly tipo: 'recusado';
  readonly cStat: string;
  readonly xMotivo: string;
  readonly hint?: RejectionHint;
  readonly bruto: B;
}

/** Ninguém sabe ainda o que a SEFAZ fez com estes bytes. Eles ficam gravados; `retomar` continua depois. */
export interface DesfechoPendente<B = unknown> extends DesfechoBase {
  readonly tipo: 'pendente';
  readonly motivo: MotivoPendencia;
  /** Status da última resposta, quando houve uma (a consulta indecisa, o recibo pendente). */
  readonly cStat?: string;
  readonly xMotivo?: string;
  /** Número do recibo do lote, com `motivo: 'lote-em-processamento'`. */
  readonly nRec?: string;
  /** Erro do envio ou da consulta, com `motivo: 'sem-resposta'`. */
  readonly causa?: unknown;
  /**
   * A recusa que levou à consulta (a duplicidade, 204 ou 539), quando a consulta não decidiu: é o que o emitente precisa
   * ver, mais que o motivo da pendência.
   */
  readonly anterior?: { readonly cStat: string; readonly xMotivo: string };
  readonly bruto?: B;
}

/**
 * A SEFAZ tem outro documento no número destes bytes: a mesma chave com outro conteúdo (o `digVal` não confere) ou
 * outra chave (539, E0014). Ou a chave está autorizada e o protocolo, nem na resposta nem na consulta, traz o `digVal`
 * (`conteudo: 'sem-digval'`): nada prova que o documento autorizado é o destes bytes. Reenviar não resolve; os bytes
 * ficam gravados para alguém recuperar o documento registrado (`chaveRegistrada`) e decidir.
 */
export interface DesfechoDivergente<B = unknown> extends DesfechoBase {
  readonly tipo: 'divergente';
  /** Chave do documento que a SEFAZ tem registrado, quando ela a informa. */
  readonly chaveRegistrada?: string;
  /**
   * Com a mesma chave: `difere` quando o `digVal` prova outro conteúdo, `sem-digval` quando a chave está autorizada e
   * o protocolo não traz o `digVal` para provar o conteúdo. Ausente quando a SEFAZ tem outra chave no número.
   */
  readonly conteudo?: Exclude<ConteudoRegistrado, 'confere'>;
  readonly cStat?: string;
  readonly xMotivo: string;
  /**
   * Com a opção `situacaoPosterior: 'divergente'` do emissor: a SEFAZ autorizou estes bytes, mas o documento já está
   * cancelado ou encerrado fora deste fluxo. `proc` é o documento autorizado, para quem for recuperá-lo.
   */
  readonly situacaoAtual?: SituacaoPosterior;
  readonly proc?: string;
  readonly bruto?: B;
}

/**
 * O integrador já guardou o documento destes bytes (o gancho `jaGuardado` respondeu sim): a transmissão caiu entre
 * guardar e apagar a gravação. A gravação foi apagada sem ir à SEFAZ.
 */
export interface DesfechoJaGuardado extends DesfechoBase {
  readonly tipo: 'ja-guardado';
}

/** Desfecho de `emitir` e `retomar`. `P` é o protocolo do documento; `B`, o desfecho bruto do pacote do documento. */
export type Desfecho<P = unknown, B = unknown> =
  | DesfechoAutorizado<P, B>
  | DesfechoDenegado<P, B>
  | DesfechoRecusado<B>
  | DesfechoPendente<B>
  | DesfechoDivergente<B>
  | DesfechoJaGuardado;

/** Desfecho que decide o documento: ele existe na SEFAZ e o integrador o guarda (`aoDecidir`). */
export type DesfechoDecidido<P = unknown, B = unknown> = DesfechoAutorizado<P, B> | DesfechoDenegado<P, B>;

/**
 * Desfecho de um evento pelo emissor (`cancelar`). `recuperado: true` quando o evento veio da consulta, depois de um
 * pedido sem resposta ou recusado por duplicidade: a SEFAZ já o tinha registrado.
 */
export type DesfechoEvento<E = unknown, B = unknown> =
  | {
      readonly tipo: 'registrado';
      readonly cStat: string;
      readonly xMotivo: string;
      readonly evento: E;
      /** O evento assinado com o retorno (`procEventoNFe`, `procEventoMDFe`, o XML do evento da NFS-e). */
      readonly procEvento: string;
      readonly recuperado: boolean;
      readonly bruto: B;
    }
  | {
      readonly tipo: 'recusado';
      readonly cStat: string;
      readonly xMotivo: string;
      readonly hint?: RejectionHint;
      readonly bruto: B;
    }
  | {
      readonly tipo: 'pendente';
      readonly motivo: 'sem-resposta' | 'consulta-indefinida';
      readonly cStat?: string;
      readonly xMotivo?: string;
      readonly causa?: unknown;
      readonly bruto?: B;
    };

/** O que fazer com os bytes gravados depois de um desfecho. */
export type DestinoDosBytes = 'concluir' | 'manter' | 'descartar';

/**
 * Política dos bytes (ADR 0010, decisão 3): decidido (autorizado ou denegado) grava o documento e conclui; já guardado
 * conclui; pendente e divergente mantêm; recusado descarta, menos quando o `cStat` está entre os indefinidos do
 * documento (`indefinido`, da tabela de cada perfil), que mantêm.
 */
export function destinoDosBytes(d: Desfecho, indefinido: (cStat: string) => boolean): DestinoDosBytes {
  switch (d.tipo) {
    case 'autorizado':
    case 'denegado':
    case 'ja-guardado':
      return 'concluir';
    case 'pendente':
    case 'divergente':
      return 'manter';
    case 'recusado':
      return indefinido(d.cStat) ? 'manter' : 'descartar';
  }
}

/**
 * Códigos de erro depois dos quais o documento pode ter chegado à SEFAZ: vale consultar antes de desistir. `cancelado`
 * entra porque o abort pode chegar depois de o pedido sair; `resposta_invalida` e `conexao_recusada`, porque um reset
 * ou uma resposta truncada podem vir de uma SEFAZ que já processou.
 */
const SEM_RESPOSTA: ReadonlySet<string> = new Set([
  'tempo_esgotado',
  'resposta_invalida',
  'conexao_recusada',
  'falha_rede',
  'cancelado',
]);

/** O erro é de um envio que pode ter chegado (veja `SEM_RESPOSTA`). */
export function semResposta(e: unknown): boolean {
  return isSineteError(e) && SEM_RESPOSTA.has(e.code);
}
