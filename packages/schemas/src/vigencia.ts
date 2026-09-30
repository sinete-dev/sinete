/**
 * Escolha do módulo de schema por data e ambiente (ADR 0002, decisão 6). O PL vem de uma tabela versionada com fonte
 * e vigência (`data/vigencia.json`), nunca de tentativa: a emissão usa a data do relógio de emissão (princípio 6) e
 * o ambiente, e o documento recebido usa a data dele (`dhEmi`, `dhEvento`).
 *
 * A comparação é por dia no fuso de Brasília (UTC-3, sem horário de verão desde 2019): o PL vale a partir das 00:00
 * da data de início. Datas de homologação da SEFAZ são "até" e podem variar por UF; a tabela registra a data da NT.
 */

import type { Ambiente, Relogio } from '@sinete/core';
import { formatarDataHoraComFuso } from '@sinete/core';
import table from './data/vigencia.json' with { type: 'json' };
import { VigenciaError } from './errors.ts';

export interface VigenciaEntry {
  /** Subpath do módulo (`nfe/PL_010f`). */
  readonly modulo: string;
  readonly pl: string;
  /** Início em homologação (`AAAA-MM-DD`), ou `null` sem data registrada. */
  readonly homologacao: string | null;
  /** Início em produção (`AAAA-MM-DD`), ou `null` sem data registrada. */
  readonly producao: string | null;
  /** De onde veio a data (NT, cronograma, aviso do portal). */
  readonly fonte: string;
}

/** Família de documento na tabela de vigências (um teste confere que bate com as chaves do JSON). */
export type FamiliaSchema =
  | 'nfe'
  | 'mdfe'
  | 'mdfe/eventos'
  | 'mdfe/servicos'
  | 'nfe/evento-cancelamento'
  | 'nfe/evento-cce'
  | 'nfe/evento-cancelamento-substituicao'
  | 'nfe/evento-confirmacao-operacao'
  | 'nfe/evento-ciencia-operacao'
  | 'nfe/evento-desconhecimento-operacao'
  | 'nfe/evento-operacao-nao-realizada'
  | 'nfe/inutilizacao'
  | 'nfe/consulta-protocolo'
  | 'nfe/consulta-cadastro'
  | 'nfe/status-servico'
  | 'nfe/dist-dfe'
  | 'nfse';

/** A tabela inteira, como dado. */
export const VIGENCIAS: Readonly<Record<FamiliaSchema, readonly VigenciaEntry[]>> = table.familias satisfies Record<
  FamiliaSchema,
  readonly VigenciaEntry[]
>;

/** Data de atualização da tabela. */
export const VIGENCIAS_ATUALIZADAS_EM: string = table.atualizadoEm;

const BRASILIA_MIN = -180;

/**
 * O módulo vigente para a família no instante do relógio e no ambiente dados: a entrada de início mais recente que
 * não passa da data. Na emissão, passe o relógio de emissão; para documento recebido, um `fixedClock` com a data dele.
 * Lança `VigenciaError` (`pl_sem_vigencia`) quando nenhuma entrada cobre a data.
 */
export function selecionarPl(familia: FamiliaSchema, ambiente: Ambiente, relogio: Relogio): VigenciaEntry {
  const entries = Object.hasOwn(VIGENCIAS, familia) ? VIGENCIAS[familia] : undefined;
  if (!entries) throw new VigenciaError(`família desconhecida: ${String(familia)}`);
  if (ambiente !== 'producao' && ambiente !== 'homologacao') {
    throw new VigenciaError(`ambiente desconhecido: ${String(ambiente)}`);
  }
  const dia = formatarDataHoraComFuso(relogio.agora(), BRASILIA_MIN).slice(0, 10);
  let best: VigenciaEntry | undefined;
  let bestStart = '';
  for (const e of entries) {
    const start = e[ambiente] ?? '';
    if (start > dia) continue;
    if (best === undefined || start >= bestStart) {
      best = e;
      bestStart = start;
    }
  }
  if (!best) {
    const first = entries
      .map((e) => e[ambiente])
      .filter((d): d is string => d !== null)
      .sort()[0];
    throw new VigenciaError(
      `nenhum PL de ${familia} vigente em ${ambiente} no dia ${dia}${first ? ` (o primeiro da tabela começa em ${first})` : ''}`,
      { detalhes: { familia, ambiente, dia } },
    );
  }
  return best;
}
