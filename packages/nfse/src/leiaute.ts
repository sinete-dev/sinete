/**
 * Módulos de schema da NFS-e Nacional (leiaute 1.01) escolhidos pela tabela de vigências do `@sinete/schemas`: o
 * relógio de emissão e o ambiente decidem o pacote de esquemas (20260209 ou 20260727, com CNPJ alfanumérico), nunca
 * uma tentativa. Os dois módulos têm a mesma forma de tipos; a diferença é de pattern (CNPJ, chave, série).
 */

import type { Ambiente, Clock } from '@sinete/core';
import { ConfigError } from '@sinete/core';
import type { RootElement, SchemaModuleInfo, VigenciaEntry } from '@sinete/schemas';
import { selecionarPl } from '@sinete/schemas';
import * as v20260209 from '@sinete/schemas/nfse/1.01-20260209';
import type { TCDPS, TCEvento, TCNFSe, TCPedRegEvt } from '@sinete/schemas/nfse/1.01-20260727';
import * as v20260727 from '@sinete/schemas/nfse/1.01-20260727';

/** Versão do leiaute (atributo `versao` da DPS, do pedido de evento e da NFS-e). */
export const VERSAO_LEIAUTE = '1.01';

/** Namespace dos documentos da NFS-e Nacional. */
export const NFSE_NS = 'http://www.sped.fazenda.gov.br/nfse';

export interface LeiauteNfse {
  readonly schema: SchemaModuleInfo;
  readonly DPSElement: RootElement<TCDPS>;
  readonly NFSeElement: RootElement<TCNFSe>;
  readonly pedRegEventoElement: RootElement<TCPedRegEvt>;
  readonly eventoElement: RootElement<TCEvento>;
}

const MODULOS: Readonly<Record<string, LeiauteNfse>> = {
  'nfse/1.01-20260209': v20260209,
  'nfse/1.01-20260727': v20260727,
};

/** O pacote de esquemas vigente no ambiente e no dia do relógio (fuso de Brasília). */
export function leiauteVigente(
  ambiente: Ambiente,
  relogio: Clock,
): { readonly vigencia: VigenciaEntry; readonly leiaute: LeiauteNfse } {
  const vigencia = selecionarPl('nfse', ambiente, relogio);
  const leiaute = MODULOS[vigencia.modulo];
  if (leiaute === undefined) throw new ConfigError(`módulo de schema da NFS-e sem código: ${vigencia.modulo}`);
  return { vigencia, leiaute };
}
